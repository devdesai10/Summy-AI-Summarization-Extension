// ─── Content Script ─────────────────────────────────────────
// Side panel: Summarize + Chat + Voice — all CSS inlined in shadow DOM

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
  const PANEL_WIDTH = 400;

  function getCSS() {
    return `
      :host {
        all: initial;
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        color: #e4e6f0;
        line-height: 1.55;
      }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      .hidden { display: none !important; }

      .ps-container {
        width: 100%; height: 100vh;
        background: #0f1117;
        border-left: 1px solid #2a2d3e;
        display: flex; flex-direction: column;
        overflow: hidden;
        padding: 24px 20px 0;
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #e4e6f0;
        font-size: 14px;
        line-height: 1.55;
      }

      /* close */
      .ps-close {
        position: absolute; top: 18px; right: 18px;
        background: #181a24; border: 1px solid #2a2d3e;
        color: #8b8fa4; width: 32px; height: 32px;
        border-radius: 8px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s, color 0.2s; z-index: 10;
      }
      .ps-close:hover { background: #22253a; color: #e4e6f0; }

      /* header */
      .ps-header {
        display: flex; align-items: center; gap: 14px;
        margin-bottom: 22px; flex-shrink: 0;
      }
      .ps-logo {
        width: 42px; height: 42px; border-radius: 11px;
        background: linear-gradient(135deg, #d97757, #b05838);
        display: flex; align-items: center; justify-content: center;
        color: #fff; flex-shrink: 0;
        box-shadow: 0 4px 14px rgba(217,119,87,0.25);
      }
      .ps-header-text { display: flex; flex-direction: column; }
      .ps-title { font-size: 17px; font-weight: 700; letter-spacing: -0.3px; color: #e4e6f0; }
      .ps-subtitle { font-size: 10px; color: #8b8fa4; text-transform: uppercase; letter-spacing: 1.1px; margin-top: 1px; }

      .ps-section-label { font-size: 13px; color: #8b8fa4; margin-bottom: 14px; }

      /* views */
      .ps-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

      /* provider buttons */
      .ps-provider-btn {
        width: 100%; display: flex; align-items: center; gap: 14px;
        padding: 14px; background: #181a24; border: 1px solid #2a2d3e;
        border-radius: 12px; cursor: pointer; color: #e4e6f0;
        margin-bottom: 10px; transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
        text-align: left; font-family: inherit; font-size: 14px;
      }
      .ps-provider-btn:hover { transform: translateY(-1px); }
      .ps-provider--claude:hover { border-color: #d97757; box-shadow: 0 4px 18px rgba(217,119,87,0.25); }
      .ps-provider--gpt:hover { border-color: #19c37d; box-shadow: 0 4px 18px rgba(25,195,125,0.25); }

      .ps-provider-icon {
        width: 38px; height: 38px; border-radius: 9px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .ps-icon--claude { background: rgba(217,119,87,0.15); color: #d97757; }
      .ps-icon--gpt { background: rgba(25,195,125,0.12); color: #19c37d; }

      .ps-provider-text { display: flex; flex-direction: column; flex: 1; }
      .ps-provider-text strong { font-size: 14px; font-weight: 600; }
      .ps-provider-text small { font-size: 11px; color: #8b8fa4; margin-top: 2px; }
      .ps-arrow { color: #8b8fa4; font-size: 18px; transition: transform 0.2s; }
      .ps-provider-btn:hover .ps-arrow { transform: translateX(3px); }

      /* key view */
      .ps-back {
        background: none; border: none; color: #8b8fa4; cursor: pointer;
        font-size: 13px; margin-bottom: 18px; padding: 0; font-family: inherit;
        transition: color 0.2s;
      }
      .ps-back:hover { color: #e4e6f0; }

      .ps-input-wrap { position: relative; margin-bottom: 14px; }
      .ps-input {
        width: 100%; padding: 12px 44px 12px 14px; border-radius: 12px;
        border: 1px solid #2a2d3e; background: #181a24; color: #e4e6f0;
        font-size: 13px; font-family: 'SFMono-Regular','Consolas',monospace;
        outline: none; transition: border-color 0.2s, box-shadow 0.2s;
      }
      .ps-input:focus { border-color: #d97757; box-shadow: 0 0 0 3px rgba(217,119,87,0.25); }
      .ps-input.ps-shake { animation: shake 0.4s ease; }
      @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }

      .ps-toggle-vis {
        position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
        background: none; border: none; color: #8b8fa4; cursor: pointer; padding: 4px;
      }
      .ps-toggle-vis:hover { color: #e4e6f0; }

      .ps-hint { font-size: 11px; color: #8b8fa4; margin-top: 10px; }

      /* buttons */
      .ps-btn {
        font-family: inherit; border: none; cursor: pointer; border-radius: 12px;
        font-weight: 600; font-size: 14px; transition: transform 0.1s, box-shadow 0.2s;
      }
      .ps-btn:active { transform: scale(0.97); }
      .ps-btn--primary {
        width: 100%; padding: 13px 20px;
        background: linear-gradient(135deg, #d97757, #b05838);
        color: #fff; box-shadow: 0 4px 16px rgba(217,119,87,0.25);
      }
      .ps-btn--primary:hover { box-shadow: 0 6px 24px rgba(217,119,87,0.25); }
      .ps-btn--sm { padding: 8px 18px; background: #22253a; color: #e4e6f0; font-size: 13px; }
      .ps-btn--sm:hover { background: #2a2d3e; }

      /* provider badge */
      .ps-provider-badge {
        display: flex; align-items: center; gap: 8px; padding: 9px 14px;
        background: #181a24; border: 1px solid #2a2d3e;
        border-radius: 12px; margin-bottom: 16px; font-size: 13px; flex-shrink: 0;
      }
      .ps-badge-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .ps-dot--claude { background: #d97757; box-shadow: 0 0 6px rgba(217,119,87,0.25); }
      .ps-dot--gpt { background: #19c37d; box-shadow: 0 0 6px rgba(25,195,125,0.25); }
      .ps-badge-label { color: #8b8fa4; }
      .ps-badge-name { font-weight: 600; }
      .ps-change-provider {
        margin-left: auto; background: none; border: none; color: #8b8fa4;
        font-size: 12px; cursor: pointer; font-family: inherit;
        text-decoration: underline; transition: color 0.2s;
      }
      .ps-change-provider:hover { color: #e4e6f0; }

      /* tabs */
      .ps-tabs {
        display: flex; gap: 4px; margin-bottom: 16px; background: #181a24;
        border: 1px solid #2a2d3e; border-radius: 12px; padding: 4px; flex-shrink: 0;
      }
      .ps-tab {
        flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
        padding: 10px 0; border: none; background: transparent; color: #8b8fa4;
        font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
        border-radius: 9px; transition: background 0.2s, color 0.2s;
      }
      .ps-tab:hover { color: #e4e6f0; }
      .ps-tab--active { background: #22253a; color: #e4e6f0; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }

      .ps-tab-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

      /* page card */
      .ps-page-card {
        display: flex; align-items: center; gap: 12px; padding: 14px;
        background: #181a24; border: 1px solid #2a2d3e;
        border-radius: 12px; margin-bottom: 16px; flex-shrink: 0;
      }
      .ps-page-icon {
        width: 38px; height: 38px; border-radius: 9px; background: #22253a;
        display: flex; align-items: center; justify-content: center;
        color: #8b8fa4; flex-shrink: 0;
      }
      .ps-page-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .ps-page-title { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ps-page-url { font-size: 11px; color: #8b8fa4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      /* summarize button */
      .ps-btn--summarize {
        width: 100%; display: flex; align-items: center; gap: 14px; padding: 18px;
        background: linear-gradient(135deg, #d97757, #c45a30); border: none;
        border-radius: 12px; cursor: pointer; color: #fff; font-family: inherit;
        text-align: left; box-shadow: 0 6px 24px rgba(217,119,87,0.25), 0 2px 8px rgba(0,0,0,0.3);
        transition: transform 0.15s, box-shadow 0.2s; margin-bottom: 16px; flex-shrink: 0;
      }
      .ps-btn--summarize:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(217,119,87,0.25), 0 4px 12px rgba(0,0,0,0.4); }
      .ps-btn--summarize:active { transform: translateY(0) scale(0.98); }
      .ps-btn-icon {
        width: 44px; height: 44px; border-radius: 11px; background: rgba(255,255,255,0.18);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .ps-btn-text { display: flex; flex-direction: column; gap: 2px; }
      .ps-btn-text strong { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
      .ps-btn-text small { font-size: 11px; opacity: 0.75; font-weight: 400; }

      /* loading */
      .ps-loading {
        display: flex; flex-direction: column; align-items: center; gap: 10px;
        padding: 36px 0 24px; animation: fadeUp 0.3s ease both;
      }
      .ps-loading-text { font-size: 14px; font-weight: 600; }
      .ps-loading-sub { font-size: 12px; color: #8b8fa4; }
      .ps-spinner {
        width: 34px; height: 34px; border: 3px solid #22253a;
        border-top-color: #d97757; border-radius: 50%; animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      /* result */
      .ps-result {
        padding: 18px; background: #181a24; border: 1px solid #2a2d3e;
        border-radius: 12px; animation: fadeUp 0.35s ease both;
        overflow-y: auto; flex: 1;
      }
      .ps-result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .ps-result-header h2 { font-size: 14px; font-weight: 700; }
      .ps-result-actions { display: flex; gap: 6px; }
      .ps-icon-btn {
        background: #22253a; border: 1px solid #2a2d3e;
        border-radius: 8px; width: 30px; height: 30px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: #8b8fa4; transition: color 0.2s, background 0.2s;
      }
      .ps-icon-btn:hover { color: #e4e6f0; background: #2a2d3e; }
      .ps-icon-btn.ps-copied { color: #19c37d; }

      .ps-result-body { font-size: 13px; line-height: 1.7; }
      .ps-result-body .ps-h3 { font-size: 13px; font-weight: 700; margin: 14px 0 5px; }
      .ps-result-body .ps-ul { padding-left: 16px; margin: 6px 0; list-style: none; }
      .ps-result-body .ps-li { position: relative; padding-left: 12px; margin-bottom: 5px; }
      .ps-result-body .ps-li::before { content: ""; position: absolute; left: 0; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: #d97757; }
      .ps-result-body code { background: #22253a; padding: 1px 5px; border-radius: 4px; font-size: 12px; }

      .ps-error {
        margin-bottom: 12px; padding: 14px; background: rgba(239,68,68,0.08);
        border: 1px solid rgba(239,68,68,0.2); border-radius: 12px;
        display: flex; flex-direction: column; gap: 10px; animation: fadeUp 0.3s ease both;
      }
      .ps-error p { font-size: 13px; color: #f87171; }

      /* chat */
      .ps-chat-messages {
        flex: 1; overflow-y: auto; padding: 4px 2px 12px;
        display: flex; flex-direction: column; gap: 12px;
        scrollbar-width: thin; scrollbar-color: #22253a transparent;
      }
      .ps-chat-welcome {
        display: flex; flex-direction: column; align-items: center;
        text-align: center; padding: 40px 20px; gap: 10px; margin: auto 0;
      }
      .ps-chat-welcome-icon {
        width: 56px; height: 56px; border-radius: 16px; background: #181a24;
        border: 1px solid #2a2d3e; display: flex; align-items: center;
        justify-content: center; color: #8b8fa4; margin-bottom: 4px;
      }
      .ps-chat-welcome-title { font-size: 15px; font-weight: 700; }
      .ps-chat-welcome-sub { font-size: 12px; color: #8b8fa4; line-height: 1.5; }

      .ps-chat-msg { display: flex; animation: fadeUp 0.25s ease both; }
      .ps-chat-msg--user { justify-content: flex-end; }
      .ps-chat-msg--assistant { justify-content: flex-start; }
      .ps-chat-msg--error { justify-content: flex-start; }

      .ps-msg-bubble {
        max-width: 88%; padding: 11px 14px; border-radius: 14px;
        font-size: 13px; line-height: 1.6; word-wrap: break-word;
      }
      .ps-msg--user {
        background: linear-gradient(135deg, #d97757, #c45a30);
        color: #fff; border-bottom-right-radius: 4px;
      }
      .ps-msg--ai {
        background: #181a24; border: 1px solid #2a2d3e;
        border-bottom-left-radius: 4px;
      }
      .ps-msg--ai .ps-h3 { font-size: 13px; font-weight: 700; margin: 10px 0 4px; }
      .ps-msg--ai .ps-ul { padding-left: 14px; margin: 4px 0; list-style: none; }
      .ps-msg--ai .ps-li { position: relative; padding-left: 12px; margin-bottom: 4px; }
      .ps-msg--ai .ps-li::before { content: ""; position: absolute; left: 0; top: 8px; width: 4px; height: 4px; border-radius: 50%; background: #d97757; }
      .ps-msg--error {
        background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
        color: #f87171;
      }

      .ps-typing { display: flex; align-items: center; gap: 5px; padding: 14px 18px; }
      .ps-dot-pulse {
        width: 7px; height: 7px; border-radius: 50%; background: #8b8fa4;
        animation: dotPulse 1.4s infinite ease-in-out both;
      }
      .ps-dot-pulse:nth-child(2) { animation-delay: 0.16s; }
      .ps-dot-pulse:nth-child(3) { animation-delay: 0.32s; }
      @keyframes dotPulse {
        0%,80%,100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
      }

      /* chat input */
      .ps-chat-input-area { flex-shrink: 0; padding: 12px 0 16px; border-top: 1px solid #2a2d3e; }
      .ps-chat-input-wrap {
        display: flex; align-items: flex-end; gap: 8px;
        background: #181a24; border: 1px solid #2a2d3e;
        border-radius: 12px; padding: 8px 8px 8px 14px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .ps-chat-input-wrap:focus-within { border-color: #d97757; box-shadow: 0 0 0 3px rgba(217,119,87,0.25); }

      .ps-chat-textarea {
        flex: 1; background: none; border: none; color: #e4e6f0;
        font-family: inherit; font-size: 13px; line-height: 1.5;
        resize: none; outline: none; min-height: 20px; max-height: 120px;
      }
      .ps-chat-textarea::placeholder { color: #8b8fa4; }

      .ps-chat-btns { display: flex; gap: 4px; flex-shrink: 0; }

      .ps-voice-btn {
        width: 36px; height: 36px; border-radius: 10px; border: 1px solid #2a2d3e;
        background: #22253a; color: #8b8fa4; cursor: pointer;
        display: flex; align-items: center; justify-content: center; transition: all 0.2s;
      }
      .ps-voice-btn:hover { color: #e4e6f0; background: #2a2d3e; }
      .ps-voice--active {
        background: rgba(239,68,68,0.15) !important;
        border-color: rgba(239,68,68,0.4) !important;
        color: #f87171 !important;
        animation: voicePulse 1.5s infinite;
      }
      @keyframes voicePulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
        50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
      }

      .ps-send-btn {
        width: 36px; height: 36px; border-radius: 10px; border: none;
        background: linear-gradient(135deg, #d97757, #c45a30);
        color: #fff; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.1s, box-shadow 0.2s;
        box-shadow: 0 2px 8px rgba(217,119,87,0.25);
      }
      .ps-send-btn:hover { transform: scale(1.05); box-shadow: 0 4px 14px rgba(217,119,87,0.25); }
      .ps-send-btn:active { transform: scale(0.95); }

      .ps-chat-hint { font-size: 11px; color: #8b8fa4; margin-top: 8px; text-align: center; }
    `;
  }

  /* ── build panel ───────────────────────────────── */
  function createPanel() {
    panel = document.createElement("div");
    panel.id = "ps-ai-root";
    panel.style.cssText = [
      "position: fixed",
      "top: 0",
      "right: 0",
      "width: " + PANEL_WIDTH + "px",
      "height: 100vh",
      "z-index: 2147483647",
      "transform: translateX(100%)",
      "transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
    ].join(" !important;") + " !important;";

    shadow = panel.attachShadow({ mode: "open" });

    // Inline style — no external file needed
    const styleEl = document.createElement("style");
    styleEl.textContent = getCSS();
    shadow.appendChild(styleEl);

    const wrapper = document.createElement("div");
    wrapper.id = "ps-panel";
    wrapper.innerHTML = getHTML();
    shadow.appendChild(wrapper);

    document.body.appendChild(panel);

    // Slide in after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.style.setProperty("transform", "translateX(0)", "important");
        document.documentElement.style.transition = "margin-right 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
        document.documentElement.style.marginRight = PANEL_WIDTH + "px";
      });
    });

    bindEvents(wrapper);
  }

  /* ── HTML ───────────────────────────────────────── */
  function getHTML() {
    return `
    <div class="ps-container">
      <button class="ps-close" aria-label="Close panel">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div class="ps-header">
        <div class="ps-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="ps-header-text">
          <h1 class="ps-title">Page Summarizer</h1>
          <span class="ps-subtitle">AI-powered summaries &amp; chat</span>
        </div>
      </div>

      <!-- AUTH -->
      <div class="ps-view" id="ps-auth">
        <p class="ps-section-label">Choose your AI provider</p>
        <button class="ps-provider-btn ps-provider--claude" data-provider="claude">
          <span class="ps-provider-icon ps-icon--claude"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.709 15.955l4.397-2.85-.379-.597-4.805 2.752a.667.667 0 0 0-.247.91l3.263 5.657a.667.667 0 0 0 .91.247l.597-.345-3.736-6.474zm8.958-12.622L9.27 10.06l.597.345L14.64 3.6a.667.667 0 0 0-.247-.911L8.736.124a.667.667 0 0 0-.91.247l-.345.597 6.186 2.365zm5.324 5.258h-5.28v.69h5.583a.667.667 0 0 0 .667-.667V2.26a.667.667 0 0 0-.667-.667h-.69l.387 7.0zm-13.982 6.818h5.28v-.69H4.706a.667.667 0 0 0-.667.667v6.354a.667.667 0 0 0 .667.667h.69l-.387-6.998z"/></svg></span>
          <span class="ps-provider-text"><strong>Sign in with Claude</strong><small>Anthropic API</small></span>
          <span class="ps-arrow">&rarr;</span>
        </button>
        <button class="ps-provider-btn ps-provider--gpt" data-provider="chatgpt">
          <span class="ps-provider-icon ps-icon--gpt"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.602 1.5v3.001l-2.602 1.5-2.602-1.5z"/></svg></span>
          <span class="ps-provider-text"><strong>Sign in with ChatGPT</strong><small>OpenAI API</small></span>
          <span class="ps-arrow">&rarr;</span>
        </button>
      </div>

      <!-- API KEY -->
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

      <!-- MAIN -->
      <div class="ps-view hidden" id="ps-main">
        <div class="ps-provider-badge">
          <span class="ps-badge-dot" id="ps-badge-dot"></span>
          <span class="ps-badge-label">Connected to</span>
          <span class="ps-badge-name" id="ps-badge-name">Claude</span>
          <button class="ps-change-provider" id="ps-switch">Switch</button>
        </div>

        <div class="ps-tabs">
          <button class="ps-tab ps-tab--active" data-tab="summarize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Summarize
          </button>
          <button class="ps-tab" data-tab="chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Chat
          </button>
        </div>

        <!-- SUMMARIZE TAB -->
        <div class="ps-tab-content" id="ps-tab-summarize">
          <div class="ps-page-card">
            <div class="ps-page-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></div>
            <div class="ps-page-info">
              <span class="ps-page-title" id="ps-page-title">Current Page</span>
              <span class="ps-page-url" id="ps-page-url">example.com</span>
            </div>
          </div>
          <button class="ps-btn ps-btn--summarize" id="ps-summarize">
            <span class="ps-btn-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
            <span class="ps-btn-text"><strong>Summarize This Page</strong><small>Capture &amp; analyze full page content</small></span>
          </button>
          <div class="ps-loading hidden" id="ps-s-loading"><div class="ps-spinner"></div><p class="ps-loading-text">Reading page content...</p><p class="ps-loading-sub">This usually takes 5-10 seconds</p></div>
          <div class="ps-result hidden" id="ps-s-result">
            <div class="ps-result-header"><h2>Summary</h2><div class="ps-result-actions"><button class="ps-icon-btn" id="ps-copy" title="Copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></div>
            <div class="ps-result-body" id="ps-s-result-body"></div>
          </div>
          <div class="ps-error hidden" id="ps-s-error"><p id="ps-s-error-msg"></p><button class="ps-btn ps-btn--sm" id="ps-s-retry">Try Again</button></div>
        </div>

        <!-- CHAT TAB -->
        <div class="ps-tab-content hidden" id="ps-tab-chat">
          <div class="ps-chat-messages" id="ps-chat-messages">
            <div class="ps-chat-welcome">
              <div class="ps-chat-welcome-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
              <p class="ps-chat-welcome-title">Chat about this page</p>
              <p class="ps-chat-welcome-sub">Ask questions, get explanations, or dig deeper into the content.</p>
            </div>
          </div>
          <div class="ps-chat-input-area">
            <div class="ps-chat-input-wrap">
              <textarea id="ps-chat-input" class="ps-chat-textarea" rows="1" placeholder="Ask about this page..."></textarea>
              <div class="ps-chat-btns">
                <button class="ps-voice-btn" id="ps-voice-btn" title="Voice input">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
                <button class="ps-send-btn" id="ps-send-btn" title="Send message">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
            <p class="ps-chat-hint" id="ps-voice-status">Press the mic to talk</p>
          </div>
        </div>

      </div>
    </div>`;
  }

  /* ── events ────────────────────────────────────── */
  function bindEvents(root) {
    const $ = (s) => root.querySelector(s);
    const $$ = (s) => root.querySelectorAll(s);
    let chosenProvider = null;

    $(".ps-close").addEventListener("click", togglePanel);

    $$(".ps-provider-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        chosenProvider = btn.dataset.provider;
        $("#ps-key-title").textContent = "Enter your " + (chosenProvider === "claude" ? "Claude (Anthropic)" : "ChatGPT (OpenAI)") + " API key";
        $("#ps-api-input").placeholder = chosenProvider === "claude" ? "sk-ant-..." : "sk-...";
        showView("key");
        chrome.storage.local.get([chosenProvider + "_key"], (res) => {
          if (res[chosenProvider + "_key"]) $("#ps-api-input").value = res[chosenProvider + "_key"];
        });
      });
    });

    $("#ps-back-to-auth").addEventListener("click", () => showView("auth"));
    $("#ps-toggle-key").addEventListener("click", () => {
      const inp = $("#ps-api-input");
      inp.type = inp.type === "password" ? "text" : "password";
    });

    $("#ps-save-key").addEventListener("click", () => {
      const key = $("#ps-api-input").value.trim();
      if (!key) { $("#ps-api-input").classList.add("ps-shake"); setTimeout(() => $("#ps-api-input").classList.remove("ps-shake"), 500); return; }
      chrome.storage.local.set({ [chosenProvider + "_key"]: key, active_provider: chosenProvider });
      enterMain();
    });

    $("#ps-switch").addEventListener("click", () => showView("auth"));

    // tabs
    $$(".ps-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".ps-tab").forEach((t) => t.classList.remove("ps-tab--active"));
        tab.classList.add("ps-tab--active");
        $$(".ps-tab-content").forEach((c) => c.classList.add("hidden"));
        $("#ps-tab-" + tab.dataset.tab).classList.remove("hidden");
      });
    });

    // summarize
    $("#ps-summarize").addEventListener("click", () => runSummary());
    $("#ps-s-retry").addEventListener("click", () => runSummary());
    $("#ps-copy").addEventListener("click", () => {
      navigator.clipboard.writeText($("#ps-s-result-body").innerText).then(() => {
        const btn = $("#ps-copy"); btn.innerHTML = "&#10003;"; btn.classList.add("ps-copied");
        setTimeout(() => { btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'; btn.classList.remove("ps-copied"); }, 1500);
      });
    });

    // chat
    $("#ps-send-btn").addEventListener("click", () => sendChat());
    $("#ps-chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } });
    $("#ps-chat-input").addEventListener("input", () => { const ta = $("#ps-chat-input"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; });
    $("#ps-voice-btn").addEventListener("click", () => toggleVoice());

    function showView(name) { $$(".ps-view").forEach((v) => v.classList.add("hidden")); $("#ps-" + name).classList.remove("hidden"); }

    function enterMain() {
      $("#ps-badge-name").textContent = chosenProvider === "claude" ? "Claude" : "ChatGPT";
      $("#ps-badge-dot").className = "ps-badge-dot " + (chosenProvider === "claude" ? "ps-dot--claude" : "ps-dot--gpt");
      $("#ps-page-title").textContent = document.title || "Untitled Page";
      $("#ps-page-url").textContent = location.hostname + location.pathname;
      pageContext = capturePageContent();
      chatHistory = [];
      showView("main");
    }

    chrome.storage.local.get(["active_provider", "claude_key", "chatgpt_key"], (res) => {
      if (res.active_provider && res[res.active_provider + "_key"]) { chosenProvider = res.active_provider; enterMain(); }
    });

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

    async function sendChat() {
      const input = $("#ps-chat-input");
      const text = input.value.trim();
      if (!text) return;
      input.value = ""; input.style.height = "auto";
      const welcome = $(".ps-chat-welcome"); if (welcome) welcome.remove();
      appendMsg("user", text);
      chatHistory.push({ role: "user", content: text });
      const typingId = appendTyping();
      try {
        const apiKey = await getKey();
        const reply = await callAIChat(chosenProvider, apiKey, pageContext, chatHistory);
        removeTyping(typingId);
        appendMsg("assistant", reply);
        chatHistory.push({ role: "assistant", content: reply });
      } catch (err) {
        removeTyping(typingId);
        appendMsg("error", err.message || "Something went wrong.");
      }
    }

    function appendMsg(role, text) {
      const c = $("#ps-chat-messages");
      const el = document.createElement("div");
      el.className = "ps-chat-msg ps-chat-msg--" + role;
      if (role === "user") el.innerHTML = '<div class="ps-msg-bubble ps-msg--user">' + escapeHtml(text) + "</div>";
      else if (role === "assistant") el.innerHTML = '<div class="ps-msg-bubble ps-msg--ai">' + formatMarkdown(text) + "</div>";
      else el.innerHTML = '<div class="ps-msg-bubble ps-msg--error">' + escapeHtml(text) + "</div>";
      c.appendChild(el); c.scrollTop = c.scrollHeight;
    }

    let tc = 0;
    function appendTyping() {
      const id = "ps-typing-" + (++tc);
      const c = $("#ps-chat-messages");
      const el = document.createElement("div");
      el.className = "ps-chat-msg ps-chat-msg--assistant"; el.id = id;
      el.innerHTML = '<div class="ps-msg-bubble ps-msg--ai ps-typing"><span class="ps-dot-pulse"></span><span class="ps-dot-pulse"></span><span class="ps-dot-pulse"></span></div>';
      c.appendChild(el); c.scrollTop = c.scrollHeight;
      return id;
    }
    function removeTyping(id) { const el = shadow.getElementById(id); if (el) el.remove(); }

    function toggleVoice() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { $("#ps-voice-status").textContent = "Speech recognition not supported"; return; }
      if (isRecording && recognition) { recognition.stop(); return; }
      recognition = new SR();
      recognition.lang = "en-US"; recognition.interimResults = true; recognition.continuous = false;
      recognition.onstart = () => { isRecording = true; $("#ps-voice-btn").classList.add("ps-voice--active"); $("#ps-voice-status").textContent = "Listening..."; };
      recognition.onresult = (e) => {
        let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        $("#ps-chat-input").value = t;
        const ta = $("#ps-chat-input"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
      };
      recognition.onend = () => {
        isRecording = false; $("#ps-voice-btn").classList.remove("ps-voice--active"); $("#ps-voice-status").textContent = "Press the mic to talk";
        if ($("#ps-chat-input").value.trim()) sendChat();
      };
      recognition.onerror = (e) => {
        isRecording = false; $("#ps-voice-btn").classList.remove("ps-voice--active");
        $("#ps-voice-status").textContent = e.error === "not-allowed" ? "Microphone access denied" : "Voice error: " + e.error;
      };
      recognition.start();
    }

    function getKey() {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([chosenProvider + "_key"], (res) => {
          const k = res[chosenProvider + "_key"]; k ? resolve(k) : reject(new Error("API key not found."));
        });
      });
    }
  }

  /* ── capture page ──────────────────────────────── */
  function capturePageContent() {
    const sels = ["article", '[role="main"]', "main", ".post-content", ".entry-content", ".article-body", "#content"];
    let el = null;
    for (const s of sels) { el = document.querySelector(s); if (el) break; }
    if (!el) el = document.body;
    const clone = el.cloneNode(true);
    clone.querySelectorAll("script,style,nav,footer,aside,iframe,noscript,svg,img,[role='navigation'],[role='banner'],[role='complementary']").forEach((n) => n.remove());
    let text = (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length > 12000) text = text.slice(0, 12000) + "\n…[truncated]";
    return text;
  }

  function buildSummarizePrompt(t) {
    return "You are a page summarizer. Provide a clear, well-structured summary of the following web page content. Include:\n1. A one-sentence TLDR\n2. Key points (as bullet points)\n3. Any notable details or takeaways\n\nWeb page content:\n---\n" + t + "\n---";
  }

  /* ── AI calls ──────────────────────────────────── */
  async function callAI(provider, apiKey, prompt) {
    if (provider === "claude") {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "Claude API error (" + r.status + ")"); }
      const d = await r.json(); return d.content.map((b) => b.text).join("");
    } else {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1024, messages: [{ role: "system", content: "You are a helpful page summarizer." }, { role: "user", content: prompt }] }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "OpenAI API error (" + r.status + ")"); }
      const d = await r.json(); return d.choices[0].message.content;
    }
  }

  async function callAIChat(provider, apiKey, pageText, history) {
    const sys = "You are a helpful assistant. The user is viewing a web page. Here is the page content for context:\n\n---\n" + pageText + "\n---\n\nAnswer the user's questions about this page. Be concise but thorough.";
    if (provider === "claude") {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024, system: sys, messages: history.map((m) => ({ role: m.role, content: m.content })) }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "Claude API error (" + r.status + ")"); }
      const d = await r.json(); return d.content.map((b) => b.text).join("");
    } else {
      const msgs = [{ role: "system", content: sys }, ...history.map((m) => ({ role: m.role, content: m.content }))];
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1024, messages: msgs }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "OpenAI API error (" + r.status + ")"); }
      const d = await r.json(); return d.choices[0].message.content;
    }
  }

  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^### (.+)$/gm, '<h3 class="ps-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 class="ps-h3">$1</h3>')
      .replace(/^[-•] (.+)$/gm, '<li class="ps-li">$1</li>')
      .replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul class="ps-ul">$&</ul>')
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  /* ── toggle ────────────────────────────────────── */
  function togglePanel() {
    if (panelOpen) {
      panel.style.setProperty("transform", "translateX(100%)", "important");
      document.documentElement.style.marginRight = "0";
      if (isRecording && recognition) recognition.stop();
      setTimeout(() => { if (panel) { panel.remove(); panel = null; shadow = null; } }, 320);
    } else {
      createPanel();
    }
    panelOpen = !panelOpen;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggleSidePanel") togglePanel();
  });
})();
