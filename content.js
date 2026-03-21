// ─── Content Script ─────────────────────────────────────────
// Side panel with: Summarize button, Chat with AI, Voice input

(function () {
  if (window.__pageSummarizerInjected) return;
  window.__pageSummarizerInjected = true;

  let panelOpen = false;
  let panel = null;
  let shadow = null;
  let chatHistory = [];
  let pageContext = "";
  let recognition = null;
  let isRecording = false;
  const PANEL_WIDTH = 420;

  /* ── build panel ───────────────────────────────── */
  function createPanel() {
    panel = document.createElement("div");
    panel.id = "ps-ai-root";
    panel.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      width: ${PANEL_WIDTH}px !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      transform: translateX(100%) !important;
      transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important;
    `;

    shadow = panel.attachShadow({ mode: "open" });

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
      requestAnimationFrame(() => {
        panel.style.transform = "translateX(0) !important";
        document.documentElement.style.transition =
          "margin-right 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
        document.documentElement.style.marginRight = PANEL_WIDTH + "px";
      });
    });

    bindEvents(wrapper);
  }

  /* ── HTML ───────────────────────────────────────── */
  function getPanelHTML() {
    return `
    <div class="ps-container">

      <button class="ps-close" aria-label="Close panel">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <!-- header -->
      <div class="ps-header">
        <div class="ps-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div class="ps-header-text">
          <h1 class="ps-title">Page Summarizer</h1>
          <span class="ps-subtitle">AI-powered summaries &amp; chat</span>
        </div>
      </div>

      <!-- ═══ VIEW 1: AUTH ═══ -->
      <div class="ps-view" id="ps-auth">
        <p class="ps-section-label">Choose your AI provider</p>

        <button class="ps-provider-btn ps-provider--claude" data-provider="claude">
          <span class="ps-provider-icon ps-icon--claude">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.709 15.955l4.397-2.85-.379-.597-4.805 2.752a.667.667 0 0 0-.247.91l3.263 5.657a.667.667 0 0 0 .91.247l.597-.345-3.736-6.474zm8.958-12.622L9.27 10.06l.597.345L14.64 3.6a.667.667 0 0 0-.247-.911L8.736.124a.667.667 0 0 0-.91.247l-.345.597 6.186 2.365zm5.324 5.258h-5.28v.69h5.583a.667.667 0 0 0 .667-.667V2.26a.667.667 0 0 0-.667-.667h-.69l.387 7.0zm-13.982 6.818h5.28v-.69H4.706a.667.667 0 0 0-.667.667v6.354a.667.667 0 0 0 .667.667h.69l-.387-6.998z"/></svg>
          </span>
          <span class="ps-provider-text">
            <strong>Sign in with Claude</strong>
            <small>Anthropic API</small>
          </span>
          <span class="ps-arrow">&rarr;</span>
        </button>

        <button class="ps-provider-btn ps-provider--gpt" data-provider="chatgpt">
          <span class="ps-provider-icon ps-icon--gpt">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.602 1.5v3.001l-2.602 1.5-2.602-1.5z"/></svg>
          </span>
          <span class="ps-provider-text">
            <strong>Sign in with ChatGPT</strong>
            <small>OpenAI API</small>
          </span>
          <span class="ps-arrow">&rarr;</span>
        </button>
      </div>

      <!-- ═══ VIEW 2: API KEY ═══ -->
      <div class="ps-view hidden" id="ps-key">
        <button class="ps-back" id="ps-back-to-auth">&larr; Back</button>
        <p class="ps-section-label" id="ps-key-title">Enter your API key</p>
        <div class="ps-input-wrap">
          <input type="password" id="ps-api-input" class="ps-input" placeholder="sk-..." autocomplete="off" />
          <button class="ps-toggle-vis" id="ps-toggle-key" aria-label="Show key">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <button class="ps-btn ps-btn--primary" id="ps-save-key">Save &amp; Continue</button>
        <p class="ps-hint">Your key is stored locally and never shared.</p>
      </div>

      <!-- ═══ VIEW 3: MAIN ═══ -->
      <div class="ps-view hidden" id="ps-main">

        <!-- provider badge -->
        <div class="ps-provider-badge">
          <span class="ps-badge-dot" id="ps-badge-dot"></span>
          <span class="ps-badge-label">Connected to</span>
          <span class="ps-badge-name" id="ps-badge-name">Claude</span>
          <button class="ps-change-provider" id="ps-switch">Switch</button>
        </div>

        <!-- tab bar -->
        <div class="ps-tabs">
          <button class="ps-tab ps-tab--active" data-tab="summarize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Summarize
          </button>
          <button class="ps-tab" data-tab="chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Chat
          </button>
        </div>

        <!-- ── SUMMARIZE TAB ── -->
        <div class="ps-tab-content" id="ps-tab-summarize">
          <div class="ps-page-card">
            <div class="ps-page-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
            <div class="ps-page-info">
              <span class="ps-page-title" id="ps-page-title">Current Page</span>
              <span class="ps-page-url" id="ps-page-url">example.com</span>
            </div>
          </div>

          <button class="ps-btn ps-btn--summarize" id="ps-summarize">
            <span class="ps-btn-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </span>
            <span class="ps-btn-text">
              <strong>Summarize This Page</strong>
              <small>Capture &amp; analyze full page content</small>
            </span>
          </button>

          <div class="ps-loading hidden" id="ps-s-loading">
            <div class="ps-spinner"></div>
            <p class="ps-loading-text">Reading page content...</p>
            <p class="ps-loading-sub">This usually takes 5-10 seconds</p>
          </div>

          <div class="ps-result hidden" id="ps-s-result">
            <div class="ps-result-header">
              <h2>Summary</h2>
              <div class="ps-result-actions">
                <button class="ps-icon-btn" id="ps-copy" title="Copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="ps-icon-btn" id="ps-resummarize" title="Re-summarize"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
              </div>
            </div>
            <div class="ps-result-body" id="ps-s-result-body"></div>
          </div>

          <div class="ps-error hidden" id="ps-s-error">
            <p id="ps-s-error-msg"></p>
            <button class="ps-btn ps-btn--sm" id="ps-s-retry">Try Again</button>
          </div>
        </div>

        <!-- ── CHAT TAB ── -->
        <div class="ps-tab-content hidden" id="ps-tab-chat">

          <div class="ps-chat-messages" id="ps-chat-messages">
            <div class="ps-chat-welcome">
              <div class="ps-chat-welcome-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <p class="ps-chat-welcome-title">Chat about this page</p>
              <p class="ps-chat-welcome-sub">Ask questions, get explanations, or dig deeper into the content.</p>
            </div>
          </div>

          <div class="ps-chat-input-area">
            <div class="ps-chat-input-wrap">
              <textarea id="ps-chat-input" class="ps-chat-textarea" rows="1" placeholder="Ask about this page..."></textarea>
              <div class="ps-chat-btns">
                <button class="ps-voice-btn" id="ps-voice-btn" title="Voice input">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
                <button class="ps-send-btn" id="ps-send-btn" title="Send message">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
            <p class="ps-chat-hint" id="ps-voice-status">Press the mic to talk</p>
          </div>
        </div>

      </div>
    </div>
    `;
  }

  /* ── events ────────────────────────────────────── */
  function bindEvents(root) {
    const $ = (sel) => root.querySelector(sel);
    const $$ = (sel) => root.querySelectorAll(sel);

    let chosenProvider = null;

    // close
    $(".ps-close").addEventListener("click", togglePanel);

    // provider pick
    $$(".ps-provider-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        chosenProvider = btn.dataset.provider;
        const label = chosenProvider === "claude" ? "Claude (Anthropic)" : "ChatGPT (OpenAI)";
        $("#ps-key-title").textContent = `Enter your ${label} API key`;
        $("#ps-api-input").placeholder = chosenProvider === "claude" ? "sk-ant-..." : "sk-...";
        showView("key");
        chrome.storage.local.get([chosenProvider + "_key"], (res) => {
          if (res[chosenProvider + "_key"]) $("#ps-api-input").value = res[chosenProvider + "_key"];
        });
      });
    });

    // back
    $("#ps-back-to-auth").addEventListener("click", () => showView("auth"));

    // toggle key vis
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
      chrome.storage.local.set({ [chosenProvider + "_key"]: key, active_provider: chosenProvider });
      enterMain();
    });

    // switch provider
    $("#ps-switch").addEventListener("click", () => showView("auth"));

    // ── tabs ──
    $$(".ps-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".ps-tab").forEach((t) => t.classList.remove("ps-tab--active"));
        tab.classList.add("ps-tab--active");
        $$(".ps-tab-content").forEach((c) => c.classList.add("hidden"));
        $(`#ps-tab-${tab.dataset.tab}`).classList.remove("hidden");
      });
    });

    // ── summarize ──
    $("#ps-summarize").addEventListener("click", () => runSummary());
    $("#ps-resummarize").addEventListener("click", () => runSummary());
    $("#ps-s-retry").addEventListener("click", () => runSummary());

    // copy
    $("#ps-copy").addEventListener("click", () => {
      navigator.clipboard.writeText($("#ps-s-result-body").innerText).then(() => {
        const btn = $("#ps-copy");
        btn.innerHTML = "&#10003;";
        btn.classList.add("ps-copied");
        setTimeout(() => {
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
          btn.classList.remove("ps-copied");
        }, 1500);
      });
    });

    // ── chat send ──
    $("#ps-send-btn").addEventListener("click", () => sendChat());
    $("#ps-chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });

    // auto-resize textarea
    $("#ps-chat-input").addEventListener("input", () => {
      const ta = $("#ps-chat-input");
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    });

    // ── voice input ──
    $("#ps-voice-btn").addEventListener("click", () => toggleVoice());

    /* ── helpers ──────────────────── */
    function showView(name) {
      $$(".ps-view").forEach((v) => v.classList.add("hidden"));
      $(`#ps-${name}`).classList.remove("hidden");
    }

    function enterMain() {
      const name = chosenProvider === "claude" ? "Claude" : "ChatGPT";
      $("#ps-badge-name").textContent = name;
      const dot = $("#ps-badge-dot");
      dot.className = "ps-badge-dot " + (chosenProvider === "claude" ? "ps-dot--claude" : "ps-dot--gpt");
      $("#ps-page-title").textContent = document.title || "Untitled Page";
      $("#ps-page-url").textContent = location.hostname + location.pathname;
      // capture page context once
      pageContext = capturePageContent();
      chatHistory = [];
      showView("main");
    }

    // auto-enter if already signed in
    chrome.storage.local.get(["active_provider", "claude_key", "chatgpt_key"], (res) => {
      if (res.active_provider && res[res.active_provider + "_key"]) {
        chosenProvider = res.active_provider;
        enterMain();
      }
    });

    /* ── summarize ───────────────── */
    async function runSummary() {
      $("#ps-summarize").classList.add("hidden");
      $("#ps-s-result").classList.add("hidden");
      $("#ps-s-error").classList.add("hidden");
      $("#ps-s-loading").classList.remove("hidden");

      try {
        const apiKey = await getKey();
        const summary = await callAI(chosenProvider, apiKey, buildSummarizePrompt(pageContext));
        $("#ps-s-result-body").innerHTML = formatMarkdown(summary);
        $("#ps-s-loading").classList.add("hidden");
        $("#ps-s-result").classList.remove("hidden");
        $("#ps-summarize").classList.remove("hidden");
      } catch (err) {
        $("#ps-s-loading").classList.add("hidden");
        $("#ps-summarize").classList.remove("hidden");
        $("#ps-s-error-msg").textContent = err.message || "Something went wrong.";
        $("#ps-s-error").classList.remove("hidden");
      }
    }

    /* ── chat ────────────────────── */
    async function sendChat() {
      const input = $("#ps-chat-input");
      const text = input.value.trim();
      if (!text) return;

      input.value = "";
      input.style.height = "auto";

      // remove welcome
      const welcome = $(".ps-chat-welcome");
      if (welcome) welcome.remove();

      appendMessage("user", text);
      chatHistory.push({ role: "user", content: text });

      // show typing indicator
      const typingId = appendTyping();

      try {
        const apiKey = await getKey();
        const reply = await callAIChat(chosenProvider, apiKey, pageContext, chatHistory);
        removeTyping(typingId);
        appendMessage("assistant", reply);
        chatHistory.push({ role: "assistant", content: reply });
      } catch (err) {
        removeTyping(typingId);
        appendMessage("error", err.message || "Something went wrong.");
      }
    }

    function appendMessage(role, text) {
      const container = $("#ps-chat-messages");
      const msg = document.createElement("div");
      msg.className = `ps-chat-msg ps-chat-msg--${role}`;

      if (role === "user") {
        msg.innerHTML = `<div class="ps-msg-bubble ps-msg--user">${escapeHtml(text)}</div>`;
      } else if (role === "assistant") {
        msg.innerHTML = `<div class="ps-msg-bubble ps-msg--ai">${formatMarkdown(text)}</div>`;
      } else {
        msg.innerHTML = `<div class="ps-msg-bubble ps-msg--error">${escapeHtml(text)}</div>`;
      }

      container.appendChild(msg);
      container.scrollTop = container.scrollHeight;
    }

    let typingCounter = 0;
    function appendTyping() {
      const id = "ps-typing-" + (++typingCounter);
      const container = $("#ps-chat-messages");
      const el = document.createElement("div");
      el.className = "ps-chat-msg ps-chat-msg--assistant";
      el.id = id;
      el.innerHTML = `<div class="ps-msg-bubble ps-msg--ai ps-typing">
        <span class="ps-dot-pulse"></span>
        <span class="ps-dot-pulse"></span>
        <span class="ps-dot-pulse"></span>
      </div>`;
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;
      return id;
    }

    function removeTyping(id) {
      const el = shadow.getElementById(id);
      if (el) el.remove();
    }

    /* ── voice ───────────────────── */
    function toggleVoice() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        $("#ps-voice-status").textContent = "Speech recognition not supported in this browser";
        return;
      }

      if (isRecording && recognition) {
        recognition.stop();
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        isRecording = true;
        $("#ps-voice-btn").classList.add("ps-voice--active");
        $("#ps-voice-status").textContent = "Listening...";
      };

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        $("#ps-chat-input").value = transcript;
        // auto-resize
        const ta = $("#ps-chat-input");
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
      };

      recognition.onend = () => {
        isRecording = false;
        $("#ps-voice-btn").classList.remove("ps-voice--active");
        $("#ps-voice-status").textContent = "Press the mic to talk";
        // auto-send if we got text
        const text = $("#ps-chat-input").value.trim();
        if (text) {
          sendChat();
        }
      };

      recognition.onerror = (event) => {
        isRecording = false;
        $("#ps-voice-btn").classList.remove("ps-voice--active");
        if (event.error === "not-allowed") {
          $("#ps-voice-status").textContent = "Microphone access denied. Check browser permissions.";
        } else {
          $("#ps-voice-status").textContent = "Voice error: " + event.error;
        }
      };

      recognition.start();
    }

    /* ── get key ─────────────────── */
    function getKey() {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([chosenProvider + "_key"], (res) => {
          const k = res[chosenProvider + "_key"];
          if (!k) reject(new Error("API key not found. Please re-enter."));
          else resolve(k);
        });
      });
    }
  }

  /* ── capture page ──────────────────────────────── */
  function capturePageContent() {
    const selectors = ["article", '[role="main"]', "main", ".post-content", ".entry-content", ".article-body", "#content"];
    let el = null;
    for (const sel of selectors) { el = document.querySelector(sel); if (el) break; }
    if (!el) el = document.body;
    const clone = el.cloneNode(true);
    clone.querySelectorAll("script, style, nav, footer, aside, iframe, noscript, svg, img, [role='navigation'], [role='banner'], [role='complementary']").forEach((n) => n.remove());
    let text = clone.innerText || clone.textContent || "";
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    if (text.length > 12000) text = text.slice(0, 12000) + "\n…[truncated]";
    return text;
  }

  /* ── prompts ───────────────────────────────────── */
  function buildSummarizePrompt(pageText) {
    return `You are a page summarizer. Provide a clear, well-structured summary of the following web page content. Include:
1. A one-sentence TLDR
2. Key points (as bullet points)
3. Any notable details or takeaways

Web page content:
---
${pageText}
---`;
  }

  /* ── AI calls ──────────────────────────────────── */
  async function callAI(provider, apiKey, prompt) {
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
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
        throw new Error(err?.error?.message || `OpenAI API error (${res.status})`);
      }
      const data = await res.json();
      return data.choices[0].message.content;
    }
  }

  async function callAIChat(provider, apiKey, pageText, history) {
    const systemMsg = `You are a helpful assistant. The user is viewing a web page. Here is the page content for context:\n\n---\n${pageText}\n---\n\nAnswer the user's questions about this page. Be concise but thorough.`;

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
          system: systemMsg,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Claude API error (${res.status})`);
      }
      const data = await res.json();
      return data.content.map((b) => b.text).join("");
    } else {
      const messages = [
        { role: "system", content: systemMsg },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1024, messages }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `OpenAI API error (${res.status})`);
      }
      const data = await res.json();
      return data.choices[0].message.content;
    }
  }

  /* ── format ────────────────────────────────────── */
  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code class="ps-code">$1</code>')
      .replace(/^### (.+)$/gm, '<h3 class="ps-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 class="ps-h3">$1</h3>')
      .replace(/^[-•] (.+)$/gm, '<li class="ps-li">$1</li>')
      .replace(/(<li.*?<\/li>\n?)+/g, '<ul class="ps-ul">$&</ul>')
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── toggle ────────────────────────────────────── */
  function togglePanel() {
    if (panelOpen) {
      panel.style.transform = "translateX(100%) !important";
      document.documentElement.style.marginRight = "0";
      if (isRecording && recognition) { recognition.stop(); }
      setTimeout(() => {
        if (panel) { panel.remove(); panel = null; shadow = null; }
      }, 320);
    } else {
      createPanel();
    }
    panelOpen = !panelOpen;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggleSidePanel") togglePanel();
  });
})();
