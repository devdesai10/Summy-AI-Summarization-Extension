(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let currentMode = "summarize";
  let pageData = { text: "", title: "", url: "" };

  const URLS = {
    claude: "https://claude.ai/new",
    chatgpt: "https://chatgpt.com/",
    deepseek: "https://chat.deepseek.com/",
  };
  const NAMES = { claude: "Claude", chatgpt: "ChatGPT", deepseek: "DeepSeek" };

  // ── capture page from active tab ──
  async function capturePage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("about:") || tab.url.startsWith("edge://")) {
        pageData = { text: "", title: tab?.title || "Browser Page", url: tab?.url || "", unsupported: true };
        updateStatus();
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            const sels = [
              "article", '[role="main"]', "main",
              ".post-content", ".entry-content", ".article-body",
              "#content", "#main-content", ".main-content", ".story-body"
            ];
            let el = null;
            for (const s of sels) { el = document.querySelector(s); if (el) break; }
            if (!el) el = document.body;

            const clone = el.cloneNode(true);
            clone.querySelectorAll(
              "script,style,nav,footer,aside,iframe,noscript,svg,img,video,audio,canvas," +
              "[role='navigation'],[role='banner'],[role='complementary']," +
              ".sidebar,.ad,.advertisement,.cookie-banner,.popup,.modal,.social-share"
            ).forEach(n => n.remove());

            let text = (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
            if (text.length > 12000) text = text.slice(0, 12000) + "\n…[truncated]";
            return { text, title: document.title || "", url: location.href || "" };
          } catch (e) {
            return { text: "", title: document.title || "", url: location.href || "", error: e.message };
          }
        }
      });

      if (results && results[0] && results[0].result) {
        pageData = results[0].result;
      } else {
        pageData = { text: "", title: tab.title || "", url: tab.url || "" };
      }
    } catch (err) {
      pageData = { text: "", title: "Error", url: "", unsupported: true };
    }

    updateStatus();
  }

  function updateStatus() {
    if (pageData.unsupported) {
      $("#page-title").textContent = pageData.title || "Unsupported Page";
      $("#page-url").textContent = "Can't read this page type";
      $("#page-status").className = "page-status page-status--error";
      $("#page-status").textContent = "N/A";
    } else if (pageData.text) {
      $("#page-title").textContent = pageData.title || "Untitled";
      $("#page-url").textContent = pageData.url || "";
      $("#page-status").className = "page-status page-status--ok";
      $("#page-status").textContent = "Ready";
    } else {
      $("#page-title").textContent = pageData.title || "Loading...";
      $("#page-url").textContent = pageData.url || "";
      $("#page-status").className = "page-status page-status--loading";
      $("#page-status").textContent = "Loading";
      // Retry
      setTimeout(capturePage, 800);
    }
  }

  // Capture immediately on popup open
  capturePage();

  // ── mode tabs ──
  $$(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".mode-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentMode = tab.dataset.mode;
      $("#custom-area").classList.toggle("hidden", currentMode !== "custom");
      $("#chat-area").classList.toggle("hidden", currentMode !== "chat");
    });
  });

  // ── build prompt ──
  function buildPrompt() {
    const text = pageData.text;
    if (!text) return null;
    const header = "Page: " + (pageData.title || "Unknown") + "\nURL: " + (pageData.url || "Unknown") + "\n\n";

    if (currentMode === "summarize") {
      return "[Summy — Summarize Mode]\n\n" + header +
        "Please summarize the following web page content. Include:\n" +
        "1. A one-sentence TLDR\n" +
        "2. Key points as bullet points\n" +
        "3. Any notable details or takeaways\n\n" +
        "---\n" + text + "\n---";
    } else if (currentMode === "chat") {
      const q = $("#chat-input").value.trim();
      if (!q) return null;
      return "[Summy — Ask a Question Mode]\n\n" + header +
        "Here is the content of a web page I'm reading:\n\n---\n" + text + "\n---\n\nMy question: " + q;
    } else {
      const c = $("#custom-input").value.trim();
      if (!c) return null;
      return "[Summy — Custom Prompt Mode]\n\n" + header +
        c + "\n\nHere is the web page content:\n\n---\n" + text + "\n---";
    }
  }

  // ── provider buttons ──
  $$(".provider-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const provider = btn.dataset.provider;

      // Fresh capture
      await capturePage();

      if (pageData.unsupported) {
        showToast("Can't read this page type", true);
        return;
      }
      if (!pageData.text) {
        showToast("Page content is empty — try refreshing the page", true);
        return;
      }
      if (currentMode === "chat" && !$("#chat-input").value.trim()) {
        showToast("Type a question first!", true);
        return;
      }
      if (currentMode === "custom" && !$("#custom-input").value.trim()) {
        showToast("Type a prompt first!", true);
        return;
      }

      const prompt = buildPrompt();
      if (!prompt) {
        showToast("Could not build prompt", true);
        return;
      }

      // Copy
      try {
        await navigator.clipboard.writeText(prompt);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = prompt; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }

      showToast("Copied! Opening " + NAMES[provider] + "...");

      // Open in new tab
      chrome.tabs.create({ url: URLS[provider] });

      if (currentMode === "chat") $("#chat-input").value = "";
      if (currentMode === "custom") $("#custom-input").value = "";
    });
  });

  // ── toast ──
  function showToast(text, isError) {
    const toast = $("#toast");
    $("#toast-text").textContent = text;
    toast.style.background = isError ? "#ef4444" : "#22c55e";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  }

  // ── auto-resize ──
  ["#chat-input", "#custom-input"].forEach((sel) => {
    $(sel).addEventListener("input", () => {
      const ta = $(sel); ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
    });
  });
})();
