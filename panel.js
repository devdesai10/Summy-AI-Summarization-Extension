(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let currentMode = "summarize";
  let pageData = { text: "", title: "", url: "" };
  let keys = { claude: "", chatgpt: "", deepseek: "" };

  const NAMES = { claude: "Claude", chatgpt: "ChatGPT", deepseek: "DeepSeek" };

  // ── listen for scraped responses from background AI tabs ──
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SUMMY_RESPONSE") {
      $("#loading").classList.add("hidden");

      if (msg.error) {
        $("#error-box").textContent = msg.error;
        $("#error-box").classList.remove("hidden");
      } else if (msg.text) {
        showResult(msg.text);
      }
    }

    if (msg.action === "tabChanged") {
      setTimeout(refreshPage, 300);
    }
  });

  function showResult(text) {
    const modeNames = { summarize: "Summary", chat: "Answer", custom: "Response" };
    $("#result-title").textContent = modeNames[currentMode] || "Response";
    $("#result-body").innerHTML = formatMarkdown(text);
    $("#result-area").classList.remove("hidden");
    $("#result-area").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── load saved keys ──
  function loadKeys(cb) {
    chrome.storage.local.get(["claude_key", "chatgpt_key", "deepseek_key"], (res) => {
      keys.claude  = res.claude_key  || "";
      keys.chatgpt = res.chatgpt_key || "";
      keys.deepseek = res.deepseek_key || "";
      updateHint();
      if (cb) cb();
    });
  }
  loadKeys();

  function updateHint() {
    const hasAnyKey = keys.claude || keys.chatgpt || keys.deepseek;
    $("#no-key-hint").classList.toggle("hidden", hasAnyKey);
  }

  // ── capture page content via background script ──
  function refreshPage() {
    chrome.runtime.sendMessage({ action: "capturePageContent" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res) {
        pageData = res;
        updatePageInfo();
      }
    });
  }

  function updatePageInfo() {
    if (pageData.unsupported) {
      $("#page-title").textContent = pageData.title || "Unsupported Page";
      $("#page-url").textContent = "This page type can't be read";
      $("#page-status").className = "page-status page-status--error";
      $("#page-status").textContent = "N/A";
    } else if (pageData.text) {
      $("#page-title").textContent = pageData.title || "Untitled Page";
      $("#page-url").textContent = pageData.url || "";
      $("#page-status").className = "page-status page-status--ok";
      $("#page-status").textContent = "Ready";
    } else {
      $("#page-title").textContent = pageData.title || "Loading...";
      $("#page-url").textContent = pageData.url || "";
      $("#page-status").className = "page-status page-status--loading";
      $("#page-status").textContent = "Loading";
      setTimeout(refreshPage, 1000);
    }
  }

  // Initial load
  refreshPage();

  // Re-capture when panel becomes visible
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshPage();
  });

  // ── mode tabs ──
  $$(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".mode-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentMode = tab.dataset.mode;
      $("#custom-area").classList.toggle("hidden", currentMode !== "custom");
      $("#chat-area").classList.toggle("hidden", currentMode !== "chat");

      // Update button label to match mode
      const labels = { summarize: "Get Summary", chat: "Get Answer", custom: "Run Prompt" };
      $("#go-btn").textContent = labels[currentMode] || "Go";
    });
  });

  // ── build prompt ──
  function buildPrompt() {
    if (!pageData.text) return null;
    const header = "Page: " + (pageData.title || "Unknown") + "\nURL: " + (pageData.url || "Unknown") + "\n\n";
    if (currentMode === "summarize") {
      return "[Summy — Summarize Mode]\n\n" + header + "Please summarize the following web page content. Include:\n1. A one-sentence TLDR\n2. Key points as bullet points\n3. Any notable details or takeaways\n\n---\n" + pageData.text + "\n---";
    } else if (currentMode === "chat") {
      const q = $("#chat-input").value.trim();
      if (!q) return null;
      return "[Summy — Ask a Question Mode]\n\n" + header + "Here is the content of a web page I'm reading:\n\n---\n" + pageData.text + "\n---\n\nMy question: " + q;
    } else {
      const c = $("#custom-input").value.trim();
      if (!c) return null;
      return "[Summy — Custom Prompt Mode]\n\n" + header + c + "\n\nHere is the web page content:\n\n---\n" + pageData.text + "\n---";
    }
  }

  // ── Go button click ──
  $("#go-btn").addEventListener("click", () => {
    const provider = $("#provider-select").value;
    handleProvider(provider);
  });

  async function handleProvider(provider) {
    if (pageData.unsupported) { showToast("Can't read this page", true); return; }
    if (currentMode === "chat" && !$("#chat-input").value.trim()) { showToast("Type a question first!", true); return; }
    if (currentMode === "custom" && !$("#custom-input").value.trim()) { showToast("Type a prompt first!", true); return; }

    // Show loading, hide previous result
    $("#loading").classList.remove("hidden");
    $("#result-area").classList.add("hidden");
    $("#error-box").classList.add("hidden");

    // Fresh capture before building prompt
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "capturePageContent" }, (res) => {
        if (res && res.text) {
          pageData = res;
          updatePageInfo();
        }
        resolve();
      });
    });

    if (!pageData.text) {
      $("#loading").classList.add("hidden");
      showToast("Page content is empty — try refreshing", true);
      return;
    }

    const prompt = buildPrompt();
    if (!prompt) {
      $("#loading").classList.add("hidden");
      showToast("Could not build prompt", true);
      return;
    }

    if (keys[provider]) {
      // ── API mode ──
      try {
        const response = await callAI(provider, keys[provider], prompt);
        $("#loading").classList.add("hidden");
        showResult(response);
      } catch (err) {
        $("#loading").classList.add("hidden");
        $("#error-box").textContent = err.message || "Something went wrong.";
        $("#error-box").classList.remove("hidden");
      }
    } else {
      // ── No API key: background tab scrape ──
      $(".loading-text").textContent = "Asking " + NAMES[provider] + "... this may take a moment";

      chrome.runtime.sendMessage(
        { type: "OPEN_AND_PASTE", provider, prompt },
        (response) => {
          if (!response || !response.ok) {
            $("#loading").classList.add("hidden");
            $("#error-box").textContent = "Failed to open " + NAMES[provider] + ". Try again.";
            $("#error-box").classList.remove("hidden");
          }
        }
      );
    }

    if (currentMode === "chat") $("#chat-input").value = "";
    if (currentMode === "custom") $("#custom-input").value = "";
  }

  // ── AI API calls ──
  async function callAI(provider, apiKey, prompt) {
    if (provider === "claude") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1024, messages:[{role:"user",content:prompt}] })
      });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"Claude error ("+r.status+")"); }
      const d = await r.json(); return d.content.map(b=>b.text).join("");
    } else if (provider === "chatgpt") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:"Bearer "+apiKey },
        body: JSON.stringify({ model:"gpt-4o-mini", max_tokens:1024, messages:[{role:"system",content:"You are a helpful assistant."},{role:"user",content:prompt}] })
      });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"OpenAI error ("+r.status+")"); }
      const d = await r.json(); return d.choices[0].message.content;
    } else {
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:"Bearer "+apiKey },
        body: JSON.stringify({ model:"deepseek-chat", max_tokens:1024, messages:[{role:"system",content:"You are a helpful assistant."},{role:"user",content:prompt}] })
      });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"DeepSeek error ("+r.status+")"); }
      const d = await r.json(); return d.choices[0].message.content;
    }
  }

  // (copy button removed)

  // ── settings ──
  $("#open-settings").addEventListener("click", () => {
    $("#v-main").classList.add("hidden");
    $("#v-settings").classList.remove("hidden");
    $("#key-claude").value = keys.claude;
    $("#key-chatgpt").value = keys.chatgpt;
    $("#key-deepseek").value = keys.deepseek;
  });
  $("#back-btn").addEventListener("click", () => {
    $("#v-settings").classList.add("hidden");
    $("#v-main").classList.remove("hidden");
  });
  $("#hint-settings").addEventListener("click", (e) => {
    e.preventDefault();
    $("#open-settings").click();
  });

  $("#save-keys").addEventListener("click", () => {
    const c = $("#key-claude").value.trim();
    const g = $("#key-chatgpt").value.trim();
    const d = $("#key-deepseek").value.trim();
    chrome.storage.local.set({ claude_key: c, chatgpt_key: g, deepseek_key: d }, () => {
      keys.claude = c; keys.chatgpt = g; keys.deepseek = d;
      updateHint();
      showToast("Keys saved!");
      $$(".key-input").forEach(inp => { inp.classList.add("saved"); setTimeout(()=>inp.classList.remove("saved"), 1200); });
    });
  });

  // ── format markdown ──
  function formatMarkdown(text) {
    // Process block-level elements first
    let result = text
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
      // Bullet points (must come before inline * handling)
      .replace(/^\* (.+)$/gm, '<li class="md-li">$1</li>')
      .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
      .replace(/^• (.+)$/gm, '<li class="md-li">$1</li>')
      // Numbered lists
      .replace(/^\d+\.\s+(.+)$/gm, '<li class="md-li">$1</li>');

    // Wrap consecutive <li> in <ul>
    result = result.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, function(m) {
      return '<ul class="md-ul">' + m + '</ul>';
    });

    // Inline formatting (after block elements are handled)
    result = result
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

    // Line breaks
    result = result
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");

    return result;
  }

  // ── toast ──
  function showToast(text, isError) {
    const t = $("#toast");
    $("#toast-text").textContent = text;
    t.style.background = isError ? "#ef4444" : "#22c55e";
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2800);
  }

  // ── auto-resize textareas ──
  ["#chat-input", "#custom-input"].forEach(s => {
    $(s).addEventListener("input", () => {
      const t = $(s);
      t.style.height = "auto";
      t.style.height = Math.min(t.scrollHeight, 150) + "px";
    });
  });
})();
