// Track whether panel is open
let panelIsOpen = false;

// Toggle side panel on icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (panelIsOpen) {
    // Close by disabling, then re-enabling so it can be opened again
    await chrome.sidePanel.setOptions({ enabled: false });
    await chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: true });
    panelIsOpen = false;
  } else {
    await chrome.sidePanel.open({ tabId: tab.id });
    panelIsOpen = true;
  }
});

// Listen for panel close (when user closes via Chrome's X button)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "summy-panel") {
    panelIsOpen = true;
    port.onDisconnect.addListener(() => {
      panelIsOpen = false;
    });
  }
});

// Allow the side panel to request page content from any tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "capturePageContent") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0] || !tabs[0].url || tabs[0].url.startsWith("chrome://") || tabs[0].url.startsWith("about:")) {
        sendResponse({ text: "", title: "Unsupported Page", url: "" });
        return;
      }
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const sels = ["article", '[role="main"]', "main", ".post-content", ".entry-content", ".article-body", "#content"];
            let el = null;
            for (const s of sels) { el = document.querySelector(s); if (el) break; }
            if (!el) el = document.body;
            const clone = el.cloneNode(true);
            clone.querySelectorAll("script,style,nav,footer,aside,iframe,noscript,svg,img,[role='navigation'],[role='banner'],[role='complementary']").forEach(n => n.remove());
            let text = (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
            if (text.length > 12000) text = text.slice(0, 12000) + "\n…[truncated]";
            return { text, title: document.title, url: location.hostname + location.pathname };
          }
        });
        sendResponse(results[0].result);
      } catch (err) {
        sendResponse({ text: "", title: "Error", url: "", error: err.message });
      }
    });
    return true; // keep channel open for async response
  }
});
