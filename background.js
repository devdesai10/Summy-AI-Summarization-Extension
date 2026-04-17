// background.js — Service worker that opens the side panel on icon click,
// coordinates background AI tab creation, and relays scraped responses.

// Open side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Panel requests page content from the active tab
  if (msg.action === "capturePageContent") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url || /^(chrome|chrome-extension|about|edge|devtools):/.test(tab.url)) {
        sendResponse({ text: "", title: tab?.title || "Browser Page", url: tab?.url || "", unsupported: true });
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          var sels = [
            ".article-body", ".story-body", ".post-content", ".entry-content",
            ".article-content", ".story-content", ".content-body",
            '[data-testid="article-body"]', '[class*="ArticleBody"]', '[class*="article-body"]',
            "article", '[role="article"]', '[role="main"]', "main",
            "#content", "#main-content", ".main-content",
            "#article", ".article", ".story"
          ];
          var el = null;
          for (var i = 0; i < sels.length; i++) {
            try { el = document.querySelector(sels[i]); } catch(e) {}
            if (el && el.innerText && el.innerText.trim().length > 50) break;
            el = null;
          }
          if (!el) el = document.body;

          var c = el.cloneNode(true);
          var remove = "script,style,nav,footer,aside,iframe,noscript,svg,img,video,audio,canvas,header,form,button,[role='navigation'],[role='banner'],[role='complementary'],.sidebar,.ad,.advertisement,.cookie-banner,.popup,.modal,.social-share,[class*='cookie'],[class*='banner'],[class*='newsletter'],[class*='promo'],[id*='ad-'],[class*='ad-slot']";
          try { c.querySelectorAll(remove).forEach(function(n){n.remove();}); } catch(e) {}

          var t = "";
          try { t = (c.innerText || c.textContent || ""); } catch(e) {}
          t = t.replace(/\t/g, " ").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

          if (t.length < 100 && el !== document.body) {
            var bc = document.body.cloneNode(true);
            try { bc.querySelectorAll(remove).forEach(function(n){n.remove();}); } catch(e) {}
            var bt = "";
            try { bt = (bc.innerText || bc.textContent || ""); } catch(e) {}
            bt = bt.replace(/\t/g, " ").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
            if (bt.length > t.length) t = bt;
          }

          if (t.length > 12000) t = t.slice(0, 12000) + "\n…[truncated]";
          return { text: t, title: document.title || "", url: location.href || "" };
        }
      }).then((results) => {
        const result = (results && results[0] && results[0].result) ? results[0].result : null;
        sendResponse(result || { text: "", title: tab.title || "", url: tab.url || "" });
      }).catch(() => {
        sendResponse({ text: "", title: tab.title || "", url: tab.url || "", unsupported: true });
      });
    });
    return true; // async sendResponse
  }

  // Open AI tab in background, store pending prompt for content script
  if (msg.type === "OPEN_AND_PASTE") {
    const { provider, prompt } = msg;

    const urls = {
      claude: "https://claude.ai/new",
      chatgpt: "https://chatgpt.com/",
      deepseek: "https://chat.deepseek.com/"
    };

    const targetUrl = urls[provider];
    if (!targetUrl) { sendResponse({ ok: false }); return; }

    chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
      chrome.storage.local.set({
        summy_pending: { provider, prompt, tabId: tab.id, autoSubmit: true }
      });
      sendResponse({ ok: true, tabId: tab.id });
    });

    return true;
  }

  // Relay scraped response from content script to the side panel
  if (msg.type === "SUMMY_RESPONSE") {
    chrome.runtime.sendMessage({
      type: "SUMMY_RESPONSE",
      text: msg.text,
      error: msg.error,
      tabId: sender.tab?.id
    }).catch(() => {});

    // Close the background AI tab
    if (sender.tab?.id) {
      chrome.tabs.remove(sender.tab.id).catch(() => {});
    }
    return;
  }
});

// Notify the side panel when the active tab changes
chrome.tabs.onActivated.addListener(() => {
  chrome.runtime.sendMessage({ action: "tabChanged" }).catch(() => {});
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    chrome.runtime.sendMessage({ action: "tabChanged" }).catch(() => {});
  }
});
