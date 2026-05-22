/**
 * Google Apps Script API Mediator for FAQ Website
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click Extensions -> Apps Script.
 * 3. Delete any default code and paste this script.
 * 4. Click Save (Disk Icon).
 * 5. Click Deploy -> New deployment.
 * 6. Under "Select type", click the Cog icon and choose "Web app".
 * 7. Set configuration:
 *    - Description: FAQ API
 *    - Execute as: Me (your-email)
 *    - Who has access: Anyone
 * 8. Click Deploy.
 * 9. Copy the "Web app URL" and paste it into `js/api.js` (inside `API_CONFIG.url`).
 */

function doGet(e) {
  try {
    // 1. Open sheet active or by default the first tab
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
        throw new Error("Không thể liên kết với Google Sheets. Hãy đảm bảo Script được tạo từ menu Extensions -> Apps Script của bảng tính.");
    }
    
    var sheet = spreadsheet.getSheets()[0]; // Selects the first tab
    var range = sheet.getDataRange();
    var values = range.getValues();
    
    // Return empty list if there's no data or only headers
    if (values.length <= 1) {
      return createJsonResponse([]);
    }
    
    // 2. Read headers dynamically from the first row
    var rawHeaders = values[0];
    var headers = rawHeaders.map(function(h) {
      return h.toString().trim(); // Match exactly with JS case (Category, Topic, Description...)
    });
    
    var data = [];
    
    // 3. Loop through subsequent rows
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      
      // Skip row if Category column is completely empty
      if (!row[0] || row[0].toString().trim() === "") {
        continue;
      }
      
      var item = {};
      var hasContent = false;
      
      for (var j = 0; j < headers.length; j++) {
        var key = headers[j];
        if (!key) continue; // skip blank headers
        
        var cellValue = row[j];
        
        // Sanitize cell values
        if (cellValue instanceof Date) {
          item[key] = cellValue.toISOString();
        } else if (cellValue !== undefined && cellValue !== null) {
          item[key] = cellValue.toString().trim();
        } else {
          item[key] = "";
        }
        
        if (item[key] !== "") {
          hasContent = true;
        }
      }
      
      if (hasContent) {
        data.push(item);
      }
    }
    
    return createJsonResponse(data);
    
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * Creates Content Service formatted JSON response to bypass CORS blocks.
 */
function createJsonResponse(data) {
  var output = JSON.stringify(data);
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}
