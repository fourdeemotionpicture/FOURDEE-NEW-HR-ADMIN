export async function syncToGoogleSheet(action: "add" | "delete", data: any) {
  try {
    const url = process.env.GOOGLE_SHEET_WEB_APP_URL;
    if (!url) {
      console.log("[Google Sheet Sync] Skipping sync: GOOGLE_SHEET_WEB_APP_URL is not set.");
      return;
    }

    const secret = process.env.SYNC_SECRET || "FourDeeErpSync2026";
    
    console.log(`[Google Sheet Sync] Sending sync request for action: ${action}`);
    
    // Trigger request in background asynchronously
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data, secret }),
    }).catch((err) => {
      console.error("[Google Sheet Sync] Async fetch error:", err);
    });
  } catch (error) {
    console.error("[Google Sheet Sync] Error:", error);
  }
}
