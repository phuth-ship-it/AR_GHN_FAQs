/**
 * Statement Search API Module
 * Handles fetching and caching sao ke (bank statement) data from a
 * dedicated Google Apps Script Web App, separate from the FAQ api.js.
 *
 * Sheet structure (only left table "NẠP THEO SAO KÊ NGÂN HÀNG"):
 *   Column B → Nội dung chuyển khoản (search key)
 *   Column E → Ngày nạp
 *   Column F → Trạng thái ("Đã xử lý" | "Chưa xử lý")
 *
 * Tabs are organized by month in format: T{MM}.{YYYY}  (e.g. T05.2026)
 * The correct tab is auto-detected from the current date at runtime.
 */

// ============================================================
// CONFIG — điền URL sau khi deploy Google Apps Script
// ============================================================
export const STATEMENT_CONFIG = {
    /**
     * URL của Google Apps Script Web App đã deploy với quyền "Anyone".
     * Để trống → sẽ hiển thị mock data demo.
     * @example 'https://script.google.com/macros/s/AKfy.../exec'
     */
    url: 'https://script.google.com/macros/s/AKfycbz7ge9GCaqIeEwIElbcBEWpVH2t0Md7fFIs4yc08FWdf7miROv6VyEtNn5CSLo1jcp-nQ/exec', // TODO: Điền URL GAS sau khi deploy

    /**
     * Link cố định dùng chung cho TẤT CẢ record "Chưa xử lý".
     * Không lấy từ sheet. Không thay đổi theo từng record.
     */
    processLink: 'https://noibo.ghn.vn/eform/form/create?flowId=652cbeb7106b9cd9a5737e4a'
};

// ============================================================
// CACHE CONFIG
// ============================================================
const CACHE_KEY      = 'statement_data_cache';
const CACHE_TIME_KEY = 'statement_data_cache_time';
const CACHE_SHEET_KEY = 'statement_data_cache_sheet'; // track which sheet was cached
const CACHE_TTL_MS   = 5 * 60 * 1000; // 5 phút

// ============================================================
// SHEET NAME DETECTION
// Auto-detect tên tab theo format T{MM}.{YYYY}
// VD: tháng 5/2026 → "T05.2026", tháng 6/2026 → "T06.2026"
// ============================================================
export function getCurrentSheetName() {
    const now = new Date();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `T${mm}.${yyyy}`;
}

// ============================================================
// FETCH + CACHE
// ============================================================

/**
 * Fetch statement data for the current month tab from Google Apps Script.
 * Uses sessionStorage cache with 5-minute TTL.
 * Falls back to mock data if URL is not configured.
 *
 * @returns {Promise<{ success: boolean, data?: Array, error?: string }>}
 */
export async function fetchStatementData() {
    const sheetName = getCurrentSheetName();

    // 1. Try sessionStorage cache (only if same sheet tab)
    const cached = getCachedData(sheetName);
    if (cached) {
        console.log(`[StatementAPI] Loaded from cache (sheet: ${sheetName})`);
        return { success: true, data: cached };
    }

    // 2. Fetch from GAS if URL is configured
    if (STATEMENT_CONFIG.url && STATEMENT_CONFIG.url.trim() !== '') {
        try {
            const apiUrl = `${STATEMENT_CONFIG.url}?sheet=${encodeURIComponent(sheetName)}`;
            console.log(`[StatementAPI] Fetching sheet "${sheetName}" from GAS...`);

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // GAS trả về { success: false, error: "MONTH_SHEET_NOT_FOUND" }
            // khi tab tháng chưa tồn tại
            if (result && result.success === false) {
                console.warn(`[StatementAPI] GAS error:`, result.error);
                return { success: false, error: result.error || 'UNKNOWN_ERROR' };
            }

            // GAS trả về mảng trực tiếp
            if (Array.isArray(result)) {
                // Lọc bỏ row header (dòng đầu chứa tên cột từ sheet)
                const filtered = filterHeaderRow(result);
                setCacheData(filtered, sheetName);
                return { success: true, data: filtered };
            }

            throw new Error('Invalid data format from GAS');

        } catch (err) {
            console.error('[StatementAPI] Fetch failed:', err);
            return { success: false, error: err.message };
        }
    }

    // 3. Fallback: mock data (khi chưa điền URL)
    console.log('[StatementAPI] URL not configured. Using mock data.');
    return { success: true, data: MOCK_STATEMENT_DATA };
}

// ============================================================
// SEARCH LOGIC
// ============================================================

/**
 * Search statement records by contains match on "Nội dung chuyển khoản" (Column B).
 *
 * Rules:
 *   - trim() both sides before comparison
 *   - ignore case (toLowerCase)
 *   - substring contains match (case-insensitive)
 *
 * @param {Array}  records    - Array of raw row objects from GAS
 * @param {string} searchText - User input string
 * @returns {Array} Matched records
 */
export function searchStatements(records, searchText) {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];

    return records.filter(row => {
        // Column B: "Nội dung chuyển khoản" — contains match + trim + ignore case
        const content = (row['Nội dung'] || row['B'] || '').toString().trim().toLowerCase();
        return content.includes(query);
    });
}

// ============================================================
// HEADER ROW FILTER
// GAS có thể trả về dòng đầu tiên là header (tên cột) thay vì data.
// Detect và loại bỏ row header để tránh hiển thị sai.
// ============================================================

/**
 * Filters out the header row from GAS response.
 * The GAS script for statement sheets may return the first row
 * containing column names (e.g. "Nội dung chuyển khoản", "Ngày nạp", "Trạng thái")
 * as data instead of skipping it.
 *
 * Detection: if "Trạng thái" value equals "Trạng thái" (the column name itself)
 * then it's a header row.
 *
 * @param {Array} records - Raw array from GAS
 * @returns {Array} Filtered array without header row
 */
function filterHeaderRow(records) {
    if (!Array.isArray(records) || records.length === 0) return records;

    return records.filter(row => {
        const trangThai = (row['Trạng thái'] || '').toString().trim();
        // Header row has "Trạng thái" as its own value
        if (trangThai === 'Trạng thái') return false;
        // Also check "Nội dung" column for header value
        const noiDung = (row['Nội dung'] || '').toString().trim();
        if (noiDung === 'Nội dung chuyển khoản') return false;
        return true;
    });
}

// ============================================================
// CACHE HELPERS
// ============================================================

function getCachedData(sheetName) {
    try {
        const cachedSheet   = sessionStorage.getItem(CACHE_SHEET_KEY);
        const cacheTime     = sessionStorage.getItem(CACHE_TIME_KEY);
        const cachedContent = sessionStorage.getItem(CACHE_KEY);

        if (cachedSheet === sheetName && cacheTime && cachedContent) {
            const elapsed = Date.now() - parseInt(cacheTime, 10);
            if (elapsed < CACHE_TTL_MS) {
                return JSON.parse(cachedContent);
            }
        }
    } catch (e) {
        console.error('[StatementAPI] Cache read error:', e);
    }
    return null;
}

function setCacheData(data, sheetName) {
    try {
        sessionStorage.setItem(CACHE_KEY,       JSON.stringify(data));
        sessionStorage.setItem(CACHE_TIME_KEY,  Date.now().toString());
        sessionStorage.setItem(CACHE_SHEET_KEY, sheetName);
    } catch (e) {
        console.error('[StatementAPI] Cache write error:', e);
    }
}

/**
 * Clears the statement cache (useful for manual refresh).
 */
export function clearStatementCache() {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(CACHE_TIME_KEY);
    sessionStorage.removeItem(CACHE_SHEET_KEY);
}

// ============================================================
// MOCK DATA (demo khi URL chưa được điền)
// ============================================================
const MOCK_STATEMENT_DATA = [
    { 'Nội dung': 'MBVCB.140359123.Chuyen tien nap xu GHN', 'Ngày': '02/05/2026', 'Trạng thái': 'Đã xử lý' },
    { 'Nội dung': 'MBVCB.140360456.Nap xu GHN thang 5',    'Ngày': '05/05/2026', 'Trạng thái': 'Đã xử lý' },
    { 'Nội dung': 'MBVCB.140361789.Thanh toan xu GHN',      'Ngày': '',           'Trạng thái': 'Chưa xử lý' },
    { 'Nội dung': 'VCCB.998877.Nap vi xu credit GHN',       'Ngày': '10/05/2026', 'Trạng thái': 'Đã xử lý' },
    { 'Nội dung': 'TCB.123456789.Chuyen khoan GHN xu',      'Ngày': '',           'Trạng thái': 'Chưa xử lý' },
];
