// Background service worker — handles extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "toggleSidePanel" });
});
