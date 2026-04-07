let panelIsOpen = false;

// Toggle side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (panelIsOpen) {
    await chrome.sidePanel.setOptions({ enabled: false });
    await chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: true });
    panelIsOpen = false;
  } else {
    await chrome.sidePanel.open({ tabId: tab.id });
    panelIsOpen = true;
  }
});

// Track panel open/close
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "summy-panel") {
    panelIsOpen = true;
    port.onDisconnect.addListener(() => { panelIsOpen = false; });
  }
});

// Notify panel when active tab changes or page finishes loading
chrome.tabs.onActivated.addListener(() => {
  if (panelIsOpen) {
    chrome.runtime.sendMessage({ action: "tabChanged" }).catch(() => {});
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete" && panelIsOpen) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) {
        chrome.runtime.sendMessage({ action: "tabChanged" }).catch(() => {});
      }
    });
  }
});

// Handle page capture requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "capturePageContent") {
    captureFromActiveTab().then(sendResponse).catch(() => {
      sendResponse({ text: "", title: "Error", url: "" });
    });
    return true; // async
  }
});

async function captureFromActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab || !tab.url) {
    return { text: "", title: "No tab found", url: "" };
  }

  // Can't inject into chrome://, about:, edge://, or extension pages
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("devtools://")
  ) {
    return { text: "", title: tab.title || "Browser Page", url: tab.url, unsupported: true };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        try {
          const sels = [
            "article", '[role="main"]', "main",
            ".post-content", ".entry-content", ".article-body",
            "#content", "#main-content", ".main-content"
          ];
          let el = null;
          for (const s of sels) {
            el = document.querySelector(s);
            if (el) break;
          }
          if (!el) el = document.body;

          const clone = el.cloneNode(true);
          clone.querySelectorAll(
            "script,style,nav,footer,aside,iframe,noscript,svg,img,video,audio,canvas," +
            "[role='navigation'],[role='banner'],[role='complementary']," +
            ".sidebar,.ad,.advertisement,.cookie-banner,.popup,.modal"
          ).forEach(n => n.remove());

          let text = (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
          if (text.length > 12000) text = text.slice(0, 12000) + "\n…[truncated]";

          return {
            text: text,
            title: document.title || "",
            url: location.href || ""
          };
        } catch (e) {
          return { text: "", title: document.title || "", url: location.href || "", error: e.message };
        }
      }
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    return { text: "", title: tab.title || "", url: tab.url || "" };
  } catch (err) {
    // Injection failed (restricted page)
    return { text: "", title: tab.title || "Restricted Page", url: tab.url || "", unsupported: true };
  }
}
