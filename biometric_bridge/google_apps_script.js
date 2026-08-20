/**
 * Four Dee ERP - Google Sheets 2-Way Sync Script (Updated Columns Layout)
 * 
 * Paste this script in your Google Sheet (Extensions -> Apps Script).
 * Set the WEBSITE_URL to your active HR Portal URL.
 * 
 * Deployment Instructions:
 * 1. Click "Deploy" -> "New deployment"
 * 2. Select type: "Web app"
 * 3. Set "Execute as": "Me (your-email)"
 * 4. Set "Who has access": "Anyone"
 * 5. Copy the Web App URL and set it as GOOGLE_SHEET_WEB_APP_URL in Vercel environment variables.
 */

const WEBSITE_URL = "https://fourdee-new-hr-admin-taupe.vercel.app";
const SYNC_SECRET = "FourDeeErpSync2026"; // Must match SYNC_SECRET in your website's .env

// Add custom menu to Google Sheets for manual triggering
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("HR Portal Sync")
    .addItem("Sync Sheet to HR Portal 📤", "syncSheetToPortal")
    .addToUi();
}

/**
 * 1. SENDS ALL DATA FROM GOOGLE SHEETS TO WEBSITE PORTAL
 */
function syncSheetToPortal() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getDataRange();
  const values = range.getDisplayValues(); // Retrieve formatted screen text
  
  if (values.length <= 1) {
    SpreadsheetApp.getUi().alert("Sheet is empty!");
    return;
  }

  const rows = [];
  let lastDateStr = null;
  let lastCategory = null;

  // Start from index 1 (skipping header row)
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    
    let rawDate = row[0] ? String(row[0]).trim() : "";
    let rawCategory = row[1] ? String(row[1]).trim() : "";
    let rawDesc = row[2] ? String(row[2]).trim() : "";
    let rawOpening = row[3] ? String(row[3]).trim() : ""; // Column D: ADDED Petty Cash
    let rawAmount = row[4] ? String(row[4]).trim() : "";  // Column E: SPENDED
    let rawBalance = row[5] ? String(row[5]).trim() : "";  // Column F: BALANCE
    let rawBillUrl = row[6] ? String(row[6]).trim() : "";  // Column G: Bill URL (if present)

    // Parse DD/MM/YYYY display string manually to YYYY-MM-DD
    let dateStr = "";
    if (rawDate !== "") {
      const parts = rawDate.split("/");
      if (parts.length === 3) {
        dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        lastDateStr = dateStr;
      }
    } else {
      dateStr = lastDateStr;
    }

    if (!dateStr) continue; // Skip rows without date or inherits

    if (rawCategory && typeof rawCategory === "string" && rawCategory.trim() !== "") {
      lastCategory = rawCategory.trim();
    }

    // Clean numeric values
    let amount = parseFloat(rawAmount) || 0.0;
    let opening = 0.0;
    
    if (rawOpening) {
      // Strip letters (like '(praveen)' or text) to get float
      const cleanedOpening = String(rawOpening).replace(/[^0-9.]/g, "");
      opening = parseFloat(cleanedOpening) || 0.0;
    }

    let dayEndBalance = null;
    if (rawBalance) {
      const cleanedBalance = String(rawBalance).replace(/[^0-9.-]/g, "");
      dayEndBalance = parseFloat(cleanedBalance) || null;
    }

    if (amount === 0.0 && opening === 0.0) {
      continue; // Skip blank lines
    }

    rows.push({
      date: dateStr,
      category: lastCategory || "Other",
      description: String(rawDesc || "").trim(),
      amount: amount,
      opening: opening,
      dayEndBalance: dayEndBalance,
      billUrl: String(rawBillUrl).trim()
    });
  }

  // Send request to Vercel Endpoint
  const url = `${WEBSITE_URL}/api/expenses/sync-sheet`;
  const payload = {
    secret: SYNC_SECRET,
    rows: rows
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 200 && result.success) {
      SpreadsheetApp.getUi().alert("SUCCESS: Website database successfully synced with this sheet!");
    } else {
      SpreadsheetApp.getUi().alert("SYNC FAILED: " + (result.error || response.getContentText()));
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert("CONNECTION ERROR: " + e.message);
  }
}

/**
 * 2. RECEIVES WEBHOOK UPDATES FROM WEBSITE (POST AND DELETE actions)
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const { action, data, secret } = postData;
    
    if (secret !== SYNC_SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (action === "add") {
      // Format Date YYYY-MM-DD to DD/MM/YYYY
      let displayDate = "";
      if (data.date) {
        const dateParts = data.date.split("-");
        if (dateParts.length === 3) {
          displayDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
      }

      // Prepare row structure based on new layout:
      // Date (Col A), Category (Col B), Description (Col C), ADDED Petty Cash (Col D), SPENDED (Col E), BALANCE (Col F), Bill URL (Col G)
      const newRow = [
        displayDate,
        data.paidTo || data.category || "",
        data.notes || "",
        data.type === "petty_cash" ? data.amount : "", // Column D: ADDED
        data.type === "expense" ? data.amount : "",    // Column E: SPENDED
        data.balanceAfter || "",                        // Column F: BALANCE
        data.billUrl || ""                             // Column G: Bill URL
      ];
      
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Row appended" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "delete") {
      const range = sheet.getDataRange();
      const values = range.getValues();
      let displayDate = "";
      
      if (data.date) {
        const dateParts = data.date.split("-");
        if (dateParts.length === 3) {
          displayDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
      }

      const matchAmount = parseFloat(data.amount) || 0.0;
      let deletedCount = 0;

      // Iterate backwards so deleting rows doesn't break indexes
      for (let i = values.length - 1; i >= 1; i--) {
        const row = values[i];
        
        let rowDate = "";
        if (row[0] instanceof Date) {
          rowDate = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "dd/MM/yyyy");
        } else if (typeof row[0] === "string") {
          rowDate = row[0].trim();
        }

        const rowCategory = String(row[1] || "").trim();
        const rowDesc = String(row[2] || "").trim();
        
        let rowAmount = 0.0;
        if (data.type === "expense") {
          rowAmount = parseFloat(row[4]) || 0.0; // Column E: SPENDED
        } else {
          const cleanedOpening = String(row[3] || "").replace(/[^0-9.]/g, ""); // Column D: ADDED Petty Cash
          rowAmount = parseFloat(cleanedOpening) || 0.0;
        }

        // Match date, category, description, and amount
        const isMatch = (
          (rowDate === displayDate || !row[0]) && 
          rowCategory.toLowerCase() === String(data.category).toLowerCase().trim() &&
          rowAmount === matchAmount
        );

        if (isMatch) {
          sheet.deleteRow(i + 1); // sheet lines are 1-indexed
          deletedCount++;
          break; // Stop after deleting one matching row
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ success: true, message: `Deleted ${deletedCount} rows` }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
