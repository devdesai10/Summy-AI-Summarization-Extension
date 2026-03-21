// Background service worker — handles extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  // Don't run on chrome:// or edge:// internal pages
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
    return;
  }

  try {
    // Try sending a message first — works if content script is already injected
    await chrome.tabs.sendMessage(tab.id, { action: "toggleSidePanel" });
  } catch (err) {
    // Content script not injected yet — inject it, then send the message
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["sidepanel.css"],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      // Small delay to let the script initialize
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "toggleSidePanel" });
      }, 100);
    } catch (injectErr) {
      console.warn("Page Summarizer: Cannot run on this page.", injectErr);
    }
  }
});
