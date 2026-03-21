// ─── Content Script ─────────────────────────────────────────
// Injects a right-side panel into the current page and handles
// page-content capture + AI summarisation via user-chosen provider.

(function () {
  if (window.__pageSummarizerInjected) return;
  window.__pageSummarizerInjected = true;

  /* ── state ─────────────────────────────────────── */
  let panelOpen = false;
  let panel = null;
  let shadow = null;

  /* ── build panel ───────────────────────────────── */
  function createPanel() {
    panel = document.createElement("div");
    panel.id = "ps-ai-root";
    shadow = panel.attachShadow({ mode: "open" });

    // Load CSS into shadow DOM
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = chrome.runtime.getURL("sidepanel.css");
    shadow.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.id = "ps-panel";
    wrapper.innerHTML = getPanelHTML();
    shadow.appendChild(wrapper);

    document.body.appendChild(panel);
    requestAnimationFrame(() => {
      wrapper.classList.add("open");
    });

    bindEvents(wrapper);
  }

  /* ── panel markup ──────────────────────────────── */
  function getPanelHTML() {
    return `
    <div class="ps-backdrop"></div>
    <div class="ps-container">

      <!-- close btn -->
      <button class="ps-close" aria-label="Close">&times;</button>

      <!-- header -->
      <div class="ps-header">
        <div class="ps-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <h1 class="ps-title">Page Summarizer</h1>
        <span class="ps-subtitle">AI-powered summaries</span>
      </div>

      <!-- provider picker (login screen) -->
      <div class="ps-view ps-view--auth" id="ps-auth">
        <p class="ps-auth-label">Choose your AI provider</p>

        <button class="ps-provider-btn ps-provider--claude" data-provider="claude">
          <span class="ps-provider-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.709 15.955l4.397-2.85-.379-.597-4.805 2.752a.667.667 0 0 0-.247.91l3.263 5.657a.667.667 0 0 0 .91.247l.597-.345-3.736-6.474zm8.958-12.622L9.27 10.06l.597.345L14.64 3.6a.667.667 0 0 0-.247-.911L8.736.124a.667.667 0 0 0-.91.247l-.345.597 6.186 2.365zm5.324 5.258h-5.28v.69h5.583a.667.667 0 0 0 .667-.667V2.26a.667.667 0 0 0-.667-.667h-.69l.387 7.0zm-13.982 6.818h5.28v-.69H4.706a.667.667 0 0 0-.667.667v6.354a.667.667 0 0 0 .667.667h.69l-.387-6.998z"/>
            </svg>
          </span>
          <span class="ps-provider-text">
            <strong>Sign in with Claude</strong>
            <small>Anthropic API</small>
          </span>
          <span class="ps-arrow">&rarr;</span>
        </button>

        <button class="ps-provider-btn ps-provider--gpt" data-provider="chatgpt">
          <span class="ps-provider-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.602 1.5v3.001l-2.602 1.5-2.602-1.5z"/>
            </svg>
          </span>
          <span class="ps-provider-text">
            <strong>Sign in with ChatGPT</strong>
            <small>OpenAI API</small>
          </span>
          <span class="ps-arrow">&rarr;</span>
        </button>
      </div>

      <!-- API key entry -->
      <div class="ps-view ps-view--key hidden" id="ps-key">
        <button class="ps-back" id="ps-back-to-auth">&larr; Back</button>
        <p class="ps-key-label" id="ps-key-title">Enter your API key</p>
        <div class="ps-input-wrap">
          <input type="password" id="ps-api-input" class="ps-input" placeholder="sk-..." autocomplete="off" />
          <button class="ps-toggle-vis" id="ps-toggle-key" aria-label="Show key">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <button class="ps-btn ps-btn--primary" id="ps-save-key">Save &amp; Continue</button>
        <p class="ps-hint">Your key is stored locally and never shared.</p>
      </div>

      <!-- main summarizer view -->
      <div class="ps-view ps-view--main hidden" id="ps-main">
        <div class="ps-provider-badge" id="ps-active-badge">
          <span class="ps-badge-dot"></span>
          <span id="ps-badge-name">Claude</span>
          <button class="ps-change-provider" id="ps-switch">Change</button>
        </div>

        <div class="ps-capture-area">
          <div class="ps-page-info">
            <span class="ps-page-title" id="ps-page-title">Current Page</span>
            <span class="ps-page-url" id="ps-page-url"></span>
          </div>
          <button class="ps-btn ps-btn--primary ps-btn--capture" id="ps-summarize">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Summarize This Page
          </button>
        </div>

        <!-- result -->
        <div class="ps-result hidden" id="ps-result">
          <div class="ps-result-header">
            <h2>Summary</h2>
            <button class="ps-copy" id="ps-copy" title="Copy to clipboard">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
          <div class="ps-result-body" id="ps-result-body"></div>
        </div>

        <!-- loading -->
        <div class="ps-loading hidden" id="ps-loading">
          <div class="ps-spinner"></div>
          <p>Analyzing page content…</p>
        </div>

        <!-- error -->
        <div class="ps-error hidden" id="ps-error">
          <p id="ps-error-msg"></p>
          <button class="ps-btn ps-btn--sm" id="ps-retry">Retry</button>
        </div>
      </div>

    </div>
    `;
  }

  /* ── events ────────────────────────────────────── */
  function bindEvents(root) {
    const $ = (sel) => root.querySelector(sel);

    let chosenProvider = null;

    // close
    $(".ps-close").addEventListener("click", togglePanel);
    $(".ps-backdrop").addEventListener("click", togglePanel);

    // provider pick
    root.querySelectorAll(".ps-provider-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        chosenProvider = btn.dataset.provider;
        const label =
          chosenProvider === "claude" ? "Claude (Anthropic)" : "ChatGPT (OpenAI)";
        $("#ps-key-title").textContent = `Enter your ${label} API key`;
        $("#ps-api-input").placeholder =
          chosenProvider === "claude" ? "sk-ant-..." : "sk-...";
        showView("key");

        // check if key already saved
        chrome.storage.local.get([chosenProvider + "_key"], (res) => {
          const saved = res[chosenProvider + "_key"];
          if (saved) {
            $("#ps-api-input").value = saved;
          }
        });
      });
    });

    // back
    $("#ps-back-to-auth").addEventListener("click", () => showView("auth"));

    // toggle key visibility
    $("#ps-toggle-key").addEventListener("click", () => {
      const inp = $("#ps-api-input");
      inp.type = inp.type === "password" ? "text" : "password";
    });

    // save key
    $("#ps-save-key").addEventListener("click", () => {
      const key = $("#ps-api-input").value.trim();
      if (!key) {
        $("#ps-api-input").classList.add("ps-shake");
        setTimeout(() => $("#ps-api-input").classList.remove("ps-shake"), 500);
        return;
      }
      const storageKey = chosenProvider + "_key";
      chrome.storage.local.set({ [storageKey]: key, active_provider: chosenProvider });
      enterMain();
    });

    // change provider
    $("#ps-switch").addEventListener("click", () => showView("auth"));

    // summarize
    $("#ps-summarize").addEventListener("click", () => runSummary($));

    // copy
    $("#ps-copy").addEventListener("click", () => {
      const text = $("#ps-result-body").innerText;
      navigator.clipboard.writeText(text).then(() => {
        const btn = $("#ps-copy");
        btn.innerHTML = "✓";
        setTimeout(() => {
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        }, 1500);
      });
    });

    // retry
    $("#ps-retry").addEventListener("click", () => runSummary($));

    /* ── helpers ────────────────── */
    function showView(name) {
      root.querySelectorAll(".ps-view").forEach((v) => v.classList.add("hidden"));
      $(`#ps-${name}`).classList.remove("hidden");
    }

    function enterMain() {
      const providerName = chosenProvider === "claude" ? "Claude" : "ChatGPT";
      $("#ps-badge-name").textContent = providerName;
      const dot = $(".ps-badge-dot");
      dot.className = "ps-badge-dot";
      dot.classList.add(chosenProvider === "claude" ? "ps-dot--claude" : "ps-dot--gpt");
      $("#ps-page-title").textContent = document.title || "Untitled Page";
      $("#ps-page-url").textContent = location.hostname + location.pathname;
      showView("main");
    }

    // check if already signed in
    chrome.storage.local.get(["active_provider", "claude_key", "chatgpt_key"], (res) => {
      if (res.active_provider && res[res.active_provider + "_key"]) {
        chosenProvider = res.active_provider;
        enterMain();
      }
    });

    /* ── summarize logic ─────────── */
    async function runSummary($) {
      $("#ps-result").classList.add("hidden");
      $("#ps-error").classList.add("hidden");
      $("#ps-loading").classList.remove("hidden");

      // capture page text
      const pageText = capturePageContent();

      try {
        const storageKey = chosenProvider + "_key";
        const data = await new Promise((res) =>
          chrome.storage.local.get([storageKey], res)
        );
        const apiKey = data[storageKey];
        if (!apiKey) throw new Error("API key not found. Please re-enter it.");

        const summary = await callAI(chosenProvider, apiKey, pageText);
        $("#ps-result-body").innerHTML = formatSummary(summary);
        $("#ps-loading").classList.add("hidden");
        $("#ps-result").classList.remove("hidden");
      } catch (err) {
        $("#ps-loading").classList.add("hidden");
        $("#ps-error-msg").textContent = err.message || "Something went wrong.";
        $("#ps-error").classList.remove("hidden");
      }
    }
  }

  /* ── capture page content ──────────────────────── */
  function capturePageContent() {
    const selectors = [
      "article",
      '[role="main"]',
      "main",
      ".post-content",
      ".entry-content",
      ".article-body",
      "#content",
    ];
    let el = null;
    for (const sel of selectors) {
      el = document.querySelector(sel);
      if (el) break;
    }
    if (!el) el = document.body;

    // clone and strip scripts / styles / nav / footer / aside
    const clone = el.cloneNode(true);
    clone
      .querySelectorAll("script, style, nav, footer, aside, iframe, noscript, svg, img")
      .forEach((n) => n.remove());

    let text = clone.innerText || clone.textContent || "";
    // collapse whitespace
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    // limit to ~12k chars to stay within API limits
    if (text.length > 12000) text = text.slice(0, 12000) + "\n…[truncated]";
    return text;
  }

  /* ── AI calls ──────────────────────────────────── */
  async function callAI(provider, apiKey, pageText) {
    const prompt = `You are a page summarizer. Provide a clear, well-structured summary of the following web page content. Include:
1. A one-sentence TLDR
2. Key points (as bullet points)
3. Any notable details or takeaways

Web page content:
---
${pageText}
---`;

    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Claude API error (${res.status})`);
      }
      const data = await res.json();
      return data.content.map((b) => b.text).join("");
    } else {
      // ChatGPT / OpenAI
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1024,
          messages: [
            { role: "system", content: "You are a helpful page summarizer." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err?.error?.message || `OpenAI API error (${res.status})`
        );
      }
      const data = await res.json();
      return data.choices[0].message.content;
    }
  }

  /* ── format summary ────────────────────────────── */
  function formatSummary(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/^### (.+)$/gm, '<h3 class="ps-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 class="ps-h3">$1</h3>')
      .replace(/^[-•] (.+)$/gm, '<li class="ps-li">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, '<ul class="ps-ul">$&</ul>')
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  /* ── toggle logic ──────────────────────────────── */
  function togglePanel() {
    if (panelOpen) {
      const wrapper = shadow.querySelector("#ps-panel");
      wrapper.classList.remove("open");
      setTimeout(() => {
        panel.remove();
        panel = null;
        shadow = null;
      }, 320);
    } else {
      createPanel();
    }
    panelOpen = !panelOpen;
  }

  /* ── message listener ──────────────────────────── */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggleSidePanel") togglePanel();
  });
})();
