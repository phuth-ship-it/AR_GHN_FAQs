/**
 * Statement Search UI Module
 * Renders the full "Tra cứu sao kê Xu GHN" page as an internal SPA view.
 *
 * Components:
 *   StatementSearchPage   → renderStatementSearchPage()
 *   StatementSearchBar    → renderStatementSearchBar()
 *   StatementResultCard   → renderStatementResultCard(record)
 *   StatementEmptyState   → renderStatementEmptyState(type)
 */

import { STATEMENT_CONFIG, fetchStatementData, searchStatements, getCurrentSheetName } from './statement-api.js';
import { navigate } from './router.js';

// ============================================================
// MAIN PAGE RENDERER
// ============================================================

/**
 * Renders the full Statement Search page into #app container.
 * Called by app.js handleRouteTransition() on route 'statement-search'.
 *
 * @param {HTMLElement} appContainer - The #app DOM element
 */
export function renderStatementSearchPage(appContainer) {
    document.title = 'Tra cứu sao kê | GHN Support';

    // Render initial shell with search bar + empty state
    appContainer.innerHTML = `
        <div class="statement-search-page" id="statement-page">

            <!-- PAGE HEADER: title + back button -->
            <div class="statement-page-header">
                <div class="statement-page-title">
                    <div class="statement-title-icon">
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <div>
                        <h1 class="statement-page-h1">Tra cứu sao kê Xu GHN</h1>
                        <p class="statement-page-subtitle">Kiểm tra trạng thái nạp Xu theo sao kê ngân hàng</p>
                    </div>
                </div>

                <!-- Back button: navigate về category Xu GHN -->
                <button id="btn-statement-back" class="btn-back statement-back-btn">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                    </svg>
                    Quay về
                </button>
            </div>

            <!-- SEARCH AREA (centered) -->
            <div class="statement-search-wrapper">
                <div class="statement-search-bar" id="statement-search-bar">
                    <div class="statement-search-input-row">
                        <div class="statement-search-input-wrap">
                            <svg class="statement-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            <input
                                type="text"
                                id="statement-input"
                                class="statement-search-input"
                                placeholder="Nhập mã hoặc nội dung sao kê để tìm kiếm"
                                autocomplete="off"
                                spellcheck="false"
                            />
                        </div>
                        <button id="statement-search-btn" class="btn-primary statement-search-btn">
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            TÌM KIẾM
                        </button>
                    </div>
                    <p class="statement-search-hint">
                        Nhập mã hoặc một phần nội dung chuyển khoản (VD: MBVCB.140359123...) để tra cứu.
                    </p>
                </div>
            </div>

            <!-- RESULTS AREA -->
            <div id="statement-results" class="statement-results-area">
                <!-- Initial empty state -->
                ${renderStatementEmptyState('initial')}
            </div>

        </div>
    `;

    // ── Event listeners ──────────────────────────────────────

    // Back button → navigate về category Xu GHN
    document.getElementById('btn-statement-back')?.addEventListener('click', () => {
        navigate('/category/xu-ghn');
    });

    // Search on button click
    document.getElementById('statement-search-btn')?.addEventListener('click', () => {
        triggerSearch();
    });

    // Search on Enter key
    document.getElementById('statement-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerSearch();
        }
    });
}

// ============================================================
// SEARCH TRIGGER
// ============================================================

/**
 * Reads input value, sets loading state, fetches data, renders results.
 */
async function triggerSearch() {
    const input     = document.getElementById('statement-input');
    const searchBtn = document.getElementById('statement-search-btn');
    const resultsEl = document.getElementById('statement-results');

    if (!input || !searchBtn || !resultsEl) return;

    const query = input.value.trim();

    // Guard: empty query
    if (!query) {
        input.focus();
        input.classList.add('statement-input-error');
        setTimeout(() => input.classList.remove('statement-input-error'), 800);
        return;
    }

    // ── Loading state ─────────────────────────────────────────
    setSearchLoading(true, searchBtn);
    resultsEl.innerHTML = renderStatementLoadingState();

    try {
        // Fetch data (from cache or GAS)
        const result = await fetchStatementData();

        // Handle GAS error (e.g., tab tháng chưa tồn tại)
        if (!result.success) {
            setSearchLoading(false, searchBtn);

            if (result.error === 'MONTH_SHEET_NOT_FOUND') {
                resultsEl.innerHTML = renderStatementEmptyState('no-month-data');
            } else {
                resultsEl.innerHTML = renderStatementEmptyState('error', result.error);
            }
            return;
        }

        // Filter: exact match + trim + ignore case (no fuzzy, no contains)
        const matches = searchStatements(result.data, query);

        setSearchLoading(false, searchBtn);

        // Render results or empty state
        if (matches.length === 0) {
            resultsEl.innerHTML = renderStatementEmptyState('no-results');
        } else {
            // Render result header + cards
            resultsEl.innerHTML = `
                <div class="statement-results-header">
                    <span class="statement-results-count">
                        Tìm thấy <strong>${matches.length}</strong> kết quả trong tháng ${getCurrentSheetName().replace('T', '').replace('.', '/')}
                    </span>
                </div>
                <div class="statement-cards-list" id="statement-cards-list">
                    ${matches.map((record, idx) => renderStatementResultCard(record, idx)).join('')}
                </div>
            `;

            // Smooth scroll to results
            requestAnimationFrame(() => {
                resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

    } catch (err) {
        console.error('[StatementSearch] Unexpected error:', err);
        setSearchLoading(false, searchBtn);
        resultsEl.innerHTML = renderStatementEmptyState('error', err.message);
    }
}

// ============================================================
// COMPONENT: StatementSearchBar loading state
// ============================================================

function setSearchLoading(isLoading, searchBtn) {
    if (!searchBtn) return;
    if (isLoading) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = `
            <svg class="statement-spin-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Đang tìm...
        `;
    } else {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            TÌM KIẾM
        `;
    }
}

// ============================================================
// COMPONENT: StatementResultCard
// ============================================================

/**
 * Renders a single result card with 3 columns.
 *
 * Column 1: Nội dung (Column B from sheet)
 * Column 2: Tình trạng badge (Đã xử lý → green | Chưa xử lý → orange)
 * Column 3: Action
 *   CASE 1 – Đã xử lý: "Xử lý ngày DD/MM/YYYY" (text, from Column E)
 *   CASE 2 – Chưa xử lý: button "Xử lý ngay" → STATEMENT_CONFIG.processLink (target=_blank)
 *
 * @param {Object} record  - Row object with keys: Nội dung, Trạng thái, Ngày
 * @param {number} idx     - Index for staggered animation delay
 * @returns {string} HTML string
 */
export function renderStatementResultCard(record, idx = 0) {
    const noiDung   = (record['Nội dung']  || '').toString().trim();
    const trangThai = (record['Trạng thái'] || '').toString().trim();
    const ngay      = (record['Ngày']       || '').toString().trim();

    const isDone = trangThai === 'Đã xử lý';

    // Badge HTML
    const badgeHtml = isDone
        ? `<span class="statement-badge badge-success">
               <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
               </svg>
               Đã xử lý
           </span>`
        : `<span class="statement-badge badge-warning">
               <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
               </svg>
               Chưa xử lý
           </span>`;

    // Action column HTML
    // CASE 1: Đã xử lý → hiển thị ngày (không có button)
    // CASE 2: Chưa xử lý → button "Xử lý ngay" dùng chung 1 link cố định
    let actionHtml = '';
    if (isDone) {
        actionHtml = ngay
            ? `<span class="statement-action-date">
                   <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                           d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                   </svg>
                   Xử lý ngày ${ngay}
               </span>`
            : `<span class="statement-action-date statement-action-date--empty">—</span>`;
    } else {
        // Dùng chung 1 link cố định STATEMENT_CONFIG.processLink cho mọi record "Chưa xử lý"
        actionHtml = `
            <a
                href="${STATEMENT_CONFIG.processLink}"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-primary statement-process-btn"
                id="statement-process-btn-${idx}"
            >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                Xử lý ngay
            </a>`;
    }

    // Card animation delay for stagger effect
    const delay = Math.min(idx * 60, 300); // max 300ms delay

    return `
        <div class="statement-result-card" style="animation-delay: ${delay}ms">
            <!-- Col 1: Nội dung chuyển khoản -->
            <div class="statement-card-col statement-col-content">
                <span class="statement-col-label">Nội dung</span>
                <span class="statement-col-value statement-content-text" title="${noiDung}">${noiDung}</span>
            </div>

            <!-- Col 2: Tình trạng badge -->
            <div class="statement-card-col statement-col-status">
                <span class="statement-col-label">Tình trạng</span>
                ${badgeHtml}
            </div>

            <!-- Col 3: Hành động / kết quả -->
            <div class="statement-card-col statement-col-action">
                <span class="statement-col-label">Hành động</span>
                ${actionHtml}
            </div>
        </div>
    `;
}

// ============================================================
// COMPONENT: StatementEmptyState
// ============================================================

/**
 * Renders the appropriate empty state based on context type.
 *
 * @param {'initial'|'no-results'|'no-month-data'|'error'} type
 * @param {string} [errorMsg] - Optional error message for 'error' type
 * @returns {string} HTML string
 */
export function renderStatementEmptyState(type, errorMsg = '') {
    const states = {
        // Chưa search lần nào (trạng thái ban đầu)
        initial: {
            icon: `<svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="statement-empty-illustration">
                       <!-- Document body -->
                       <rect x="25" y="18" width="55" height="70" rx="6" fill="var(--border-color)"/>
                       <!-- Lines on document -->
                       <rect x="35" y="32" width="35" height="5" rx="2.5" fill="var(--bg-surface-hover)"/>
                       <rect x="35" y="44" width="28" height="4" rx="2" fill="var(--bg-surface-hover)"/>
                       <rect x="35" y="55" width="32" height="4" rx="2" fill="var(--bg-surface-hover)"/>
                       <!-- Folder bottom -->
                       <rect x="15" y="76" width="75" height="12" rx="6" fill="var(--border-color)"/>
                       <!-- Chat bubble -->
                       <rect x="60" y="6" width="38" height="28" rx="8" fill="var(--bg-surface-hover)" stroke="var(--border-color)" stroke-width="1.5"/>
                       <circle cx="70" cy="20" r="3" fill="var(--text-muted)"/>
                       <circle cx="79" cy="20" r="3" fill="var(--text-muted)"/>
                       <circle cx="88" cy="20" r="3" fill="var(--text-muted)"/>
                       <path d="M75 34 L72 40 L80 34" fill="var(--bg-surface-hover)" stroke="var(--border-color)" stroke-width="1.5"/>
                   </svg>`,
            title: 'Chưa có thông tin sao kê',
            subtitle: 'Nhập nội dung để kiểm tra thông tin'
        },

        // Đã search nhưng không tìm thấy
        'no-results': {
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="statement-empty-icon">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                           d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                   </svg>`,
            title: 'Không tìm thấy sao kê',
            subtitle: `Không có nội dung phù hợp trong tháng ${getCurrentSheetName().replace('T', '').replace('.', '/')}`
        },

        // Tab tháng chưa tồn tại trong sheet
        'no-month-data': {
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="statement-empty-icon">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                           d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                   </svg>`,
            title: 'Chưa có dữ liệu tháng hiện tại',
            subtitle: `Dữ liệu tháng ${getCurrentSheetName().replace('T', '').replace('.', '/')} chưa được cập nhật.`
        },

        // Lỗi kết nối / unexpected
        error: {
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="statement-empty-icon statement-error-icon">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                           d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                   </svg>`,
            title: 'Không thể kết nối dữ liệu',
            subtitle: errorMsg || 'Vui lòng kiểm tra kết nối mạng và thử lại.'
        }
    };

    const s = states[type] || states['initial'];
    const isInitial = type === 'initial';

    return `
        <div class="statement-empty-state ${isInitial ? 'statement-empty-initial' : ''}">
            <div class="statement-empty-visual">
                ${s.icon}
            </div>
            <h3 class="statement-empty-title ${type === 'error' ? 'statement-empty-title--error' : ''}">${s.title}</h3>
            <p class="statement-empty-subtitle">${s.subtitle}</p>
        </div>
    `;
}

// ============================================================
// COMPONENT: Loading state (inline skeleton)
// ============================================================

function renderStatementLoadingState() {
    return `
        <div class="statement-loading-state">
            ${[1, 2, 3].map(() => `
                <div class="statement-result-card statement-card-skeleton">
                    <div class="statement-card-col">
                        <div class="skeleton skeleton-text" style="width: 70%; height: 14px; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 90%; height: 18px;"></div>
                    </div>
                    <div class="statement-card-col">
                        <div class="skeleton skeleton-text" style="width: 50%; height: 14px; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 80px; height: 26px; border-radius: 9999px;"></div>
                    </div>
                    <div class="statement-card-col">
                        <div class="skeleton skeleton-text" style="width: 50%; height: 14px; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 70%; height: 18px;"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}
