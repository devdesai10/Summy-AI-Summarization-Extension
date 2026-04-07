(function () {
  chrome.runtime.connect({ name: "summy-panel" });

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let currentMode = "summarize";
  let pageData = { text: "", title: "", url: "" };
  let refreshTimer = null;

  const URLS = {
    claude: "https://claude.ai/new",
    chatgpt: "https://chatgpt.com/",
    deepseek: "https://chat.deepseek.com/",
  };
  const NAMES = {
    claude: "Claude",
    chatgpt: "ChatGPT",
    deepseek: "DeepSeek",
  };

  // ── capture page content ──
  function refreshPage() {
    chrome.runtime.sendMessage({ action: "capturePageContent" }, (res) => {
      if (chrome.runtime.lastError) {
        // Extension context might have been invalidated, retry
        return;
      }
      if (res) {
        pageData = res;
        updatePageInfo();
      }
    });
  }

  function updatePageInfo() {
    if (pageData.unsupported) {
      $("#page-title").textContent = pageData.title || "Unsupported Page";
      $("#page-url").textContent = "This page type can't be captured";
      $("#page-status").className = "page-status page-status--error";
      $("#page-status").textContent = "Not available";
    } else if (pageData.text) {
      $("#page-title").textContent = pageData.title || "Untitled Page";
      $("#page-url").textContent = pageData.url || "";
      $("#page-status").className = "page-status page-status--ok";
      $("#page-status").textContent = "Ready";
    } else {
      $("#page-title").textContent = pageData.title || "Loading...";
      $("#page-url").textContent = pageData.url || "";
      $("#page-status").className = "page-status page-status--loading";
      $("#page-status").textContent = "Loading...";
      // Retry in 1 second
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refreshPage, 1000);
    }
  }

  // Initial load
  refreshPage();

  // Re-capture when panel becomes visible
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshPage();
  });

  // Listen for tab changes from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "tabChanged") {
      // Small delay to let the new page finish rendering
      setTimeout(refreshPage, 300);
    }
  });

  // Also poll every 3 seconds as a fallback to catch navigation
  setInterval(refreshPage, 3000);

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
      return header +
        "Please summarize the following web page content. Include:\n" +
        "1. A one-sentence TLDR\n" +
        "2. Key points as bullet points\n" +
        "3. Any notable details or takeaways\n\n" +
        "---\n" + text + "\n---";
    } else if (currentMode === "chat") {
      const question = $("#chat-input").value.trim();
      if (!question) return null;
      return header +
        "Here is the content of a web page I'm reading:\n\n" +
        "---\n" + text + "\n---\n\n" +
        "My question: " + question;
    } else {
      const custom = $("#custom-input").value.trim();
      if (!custom) return null;
      return header +
        custom + "\n\n" +
        "Here is the web page content:\n\n" +
        "---\n" + text + "\n---";
    }
  }

  // ── provider buttons ──
  $$(".provider-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const provider = btn.dataset.provider;

      // Always do a fresh capture right before copying
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "capturePageContent" }, (res) => {
          if (res && res.text) {
            pageData = res;
            updatePageInfo();
          }
          resolve();
        });
      });

      // Validate
      if (pageData.unsupported) {
        showToast("Can't read this page type (browser internal page)", true);
        return;
      }

      if (!pageData.text) {
        showToast("Page content is empty. Try refreshing the page.", true);
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
        showToast("Could not build prompt. Try again.", true);
        return;
      }

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(prompt);
      } catch (err) {
        // Fallback for older browsers
        const ta = document.createElement("textarea");
        ta.value = prompt;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      // Open AI site
      window.open(URLS[provider], "_blank");

      showToast("Copied! Opening " + NAMES[provider] + "... Just paste & send!");

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
    setTimeout(() => toast.classList.remove("show"), 2800);
  }

  // ── auto-resize textareas ──
  ["#chat-input", "#custom-input"].forEach((sel) => {
    $(sel).addEventListener("input", () => {
      const ta = $(sel);
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 150) + "px";
    });
  });
})();
