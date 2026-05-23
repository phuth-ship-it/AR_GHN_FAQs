/**
 * Google Apps Script — Statement Search API
 * Dành riêng cho sheet: "[RM] KIỂM TRA THÔNG TIN NẠP VÍ XU CREDIT"
 *
 * Instructions:
 * 1. Mở Google Sheet "[RM] KIỂM TRA THÔNG TIN NẠP VÍ XU CREDIT"
 * 2. Click Extensions → Apps Script
 * 3. Xóa toàn bộ code mặc định và paste script này vào
 * 4. Thay SHEET_ID bên dưới bằng ID của Google Sheet
 *    (lấy từ URL: https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit)
 * 5. Click Save (biểu tượng đĩa)
 * 6. Click Deploy → New deployment
 * 7. Chọn type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Deploy → copy URL → điền vào js/statement-api.js (STATEMENT_CONFIG.url)
 *
 * Sheet structure expected:
 *   Tab name: T{MM}.{YYYY}  (VD: T05.2026, T06.2026)
 *   Column B: Nội dung chuyển khoản (search key)
 *   Column E: Ngày nạp
 *   Column F: Trạng thái ("Đã xử lý" | "Chưa xử lý")
 *
 * Request format:
 *   GET ?sheet=T05.2026
 *
 * Response success:
 *   [{ "Nội dung": "...", "Ngày": "...", "Trạng thái": "..." }, ...]
 *
 * Response error (tab không tồn tại):
 *   { "success": false, "error": "MONTH_SHEET_NOT_FOUND" }
 */

// ============================================================
// CONFIG — điền ID của Google Sheet
// ============================================================
var SHEET_ID = ''; // TODO: Điền Google Sheet ID vào đây

// Column indices (0-based):
//   B = index 1 → Nội dung chuyển khoản
//   E = index 4 → Ngày nạp
//   F = index 5 → Trạng thái
var COL_NOI_DUNG  = 1; // Column B
var COL_NGAY      = 4; // Column E
var COL_TRANG_THAI = 5; // Column F

// ============================================================
// MAIN HANDLER
// ============================================================
function doGet(e) {
  try {
    // 1. Lấy tên tab từ query param ?sheet=T05.2026
    var sheetName = e && e.parameter && e.parameter.sheet
      ? e.parameter.sheet.toString().trim()
      : null;

    if (!sheetName) {
      return createJsonResponse({ success: false, error: 'MISSING_SHEET_PARAM' });
    }

    // 2. Mở Spreadsheet theo SHEET_ID
    var spreadsheet;
    if (SHEET_ID && SHEET_ID.trim() !== '') {
      spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    } else {
      // Fallback: dùng sheet đang active (khi chạy từ trong sheet)
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!spreadsheet) {
      return createJsonResponse({ success: false, error: 'SPREADSHEET_NOT_FOUND' });
    }

    // 3. Tìm tab theo tên (ví dụ: "T05.2026")
    var sheet = spreadsheet.getSheetByName(sheetName);

    // Tab tháng chưa tồn tại → trả lỗi cụ thể (frontend sẽ hiển thị thông báo phù hợp)
    if (!sheet) {
      return createJsonResponse({ success: false, error: 'MONTH_SHEET_NOT_FOUND' });
    }

    // 4. Đọc dữ liệu từ sheet
    var lastRow = sheet.getLastRow();

    // Không có dữ liệu (chỉ có header hoặc trống)
    if (lastRow <= 1) {
      return createJsonResponse([]);
    }

    // Lấy toàn bộ range có dữ liệu
    var values = sheet.getDataRange().getValues();

    var data = [];

    // 5. Loop từ row 2 trở đi (bỏ qua header row)
    for (var i = 1; i < values.length; i++) {
      var row = values[i];

      // Lấy giá trị từ đúng 3 cột: B, E, F
      var noiDung   = getCellString(row, COL_NOI_DUNG);
      var ngay      = getCellString(row, COL_NGAY);
      var trangThai = getCellString(row, COL_TRANG_THAI);

      // Bỏ qua row hoàn toàn trống
      if (!noiDung && !trangThai) continue;

      // Chỉ export các cột cần thiết, đặt key khớp với frontend
      data.push({
        'Nội dung':   noiDung,
        'Ngày':       ngay,
        'Trạng thái': trangThai
      });
    }

    return createJsonResponse(data);

  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Lấy giá trị cell dạng string, trim, xử lý Date object.
 */
function getCellString(row, colIndex) {
  if (colIndex >= row.length) return '';

  var val = row[colIndex];

  if (val === null || val === undefined) return '';

  // Google Sheets có thể trả Date object cho cột ngày tháng
  if (val instanceof Date) {
    // Format: DD/MM/YYYY
    var d = val.getDate().toString().padStart(2, '0');
    var m = (val.getMonth() + 1).toString().padStart(2, '0');
    var y = val.getFullYear();
    return d + '/' + m + '/' + y;
  }

  return val.toString().trim();
}

/**
 * Tạo JSON response với CORS headers để frontend gọi được.
 */
function createJsonResponse(data) {
  var output = JSON.stringify(data);
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}
