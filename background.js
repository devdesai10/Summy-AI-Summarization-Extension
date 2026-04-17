// background.js — Service worker that coordinates prompt injection
// When the popup sends a prompt + target provider, we open the tab and
// tell the content script to paste it in.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OPEN_AND_PASTE") {
    const { provider, prompt } = msg;

    const urls = {
      claude: "https://claude.ai/new",
      chatgpt: "https://chatgpt.com/",
      deepseek: "https://chat.deepseek.com/"
    };

    const targetUrl = urls[provider];
    if (!targetUrl) { sendResponse({ ok: false }); return; }

    // Open the tab, then wait for the content script to be ready
    chrome.tabs.create({ url: targetUrl }, (tab) => {
      const tabId = tab.id;

      // Store the prompt so the content script can pick it up
      chrome.storage.local.set({
        summy_pending: { provider, prompt, tabId }
      });

      sendResponse({ ok: true, tabId });
    });

    return true; // keep sendResponse channel open for async
  }
});
