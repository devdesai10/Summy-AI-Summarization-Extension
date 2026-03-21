// ─── Summy v1.04 ───────────────────────────────────────────
// Side panel: Summarize (bottom) + Always-on Chat + Voice
// Providers: Claude, ChatGPT, DeepSeek

(function () {
  if (window.__summyInjected) return;
  window.__summyInjected = true;

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
        color: #e4e6f0; font-size: 14px; line-height: 1.55;
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
        background: linear-gradient(135deg, #6C5CE7, #a855f7);
        display: flex; align-items: center; justify-content: center;
        color: #fff; flex-shrink: 0;
        box-shadow: 0 4px 14px rgba(108,92,231,0.3);
        font-weight: 800; font-size: 20px; letter-spacing: -1px;
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
      .ps-provider--deepseek:hover { border-color: #4A9EFF; box-shadow: 0 4px 18px rgba(74,158,255,0.25); }

      .ps-provider-icon {
        width: 38px; height: 38px; border-radius: 9px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .ps-icon--claude { background: rgba(217,119,87,0.15); color: #d97757; }
      .ps-icon--gpt { background: rgba(25,195,125,0.12); color: #19c37d; }
      .ps-icon--deepseek { background: rgba(74,158,255,0.12); color: #4A9EFF; }

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
      .ps-input:focus { border-color: #6C5CE7; box-shadow: 0 0 0 3px rgba(108,92,231,0.25); }
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
        background: linear-gradient(135deg, #6C5CE7, #a855f7);
        color: #fff; box-shadow: 0 4px 16px rgba(108,92,231,0.3);
      }
      .ps-btn--primary:hover { box-shadow: 0 6px 24px rgba(108,92,231,0.3); }
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
      .ps-dot--deepseek { background: #4A9EFF; box-shadow: 0 0 6px rgba(74,158,255,0.25); }
      .ps-badge-label { color: #8b8fa4; }
      .ps-badge-name { font-weight: 600; }
      .ps-change-provider {
        margin-left: auto; background: none; border: none; color: #8b8fa4;
        font-size: 12px; cursor: pointer; font-family: inherit;
        text-decoration: underline; transition: color 0.2s;
      }
      .ps-change-provider:hover { color: #e4e6f0; }

      /* ── MAIN LAYOUT: chat area + bottom bar ── */
      .ps-main-body {
        flex: 1; display: flex; flex-direction: column; overflow: hidden;
      }

      /* chat messages */
      .ps-chat-messages {
        flex: 1; overflow-y: auto; padding: 4px 2px 12px;
        display: flex; flex-direction: column; gap: 12px;
        scrollbar-width: thin; scrollbar-color: #22253a transparent;
      }
      .ps-chat-welcome {
        display: flex; flex-direction: column; align-items: center;
        text-align: center; padding: 30px 20px; gap: 10px; margin: auto 0;
      }
      .ps-chat-welcome-icon {
        width: 56px; height: 56px; border-radius: 16px; background: #181a24;
        border: 1px solid #2a2d3e; display: flex; align-items: center;
        justify-content: center; color: #8b8fa4; margin-bottom: 4px;
      }
      .ps-chat-welcome-title { font-size: 15px; font-weight: 700; }
      .ps-chat-welcome-sub { font-size: 12px; color: #8b8fa4; line-height: 1.5; max-width: 280px; }

      .ps-chat-msg { display: flex; animation: fadeUp 0.25s ease both; }
      .ps-chat-msg--user { justify-content: flex-end; }
      .ps-chat-msg--assistant { justify-content: flex-start; }
      .ps-chat-msg--error { justify-content: flex-start; }

      .ps-msg-bubble {
        max-width: 88%; padding: 11px 14px; border-radius: 14px;
        font-size: 13px; line-height: 1.6; word-wrap: break-word;
      }
      .ps-msg--user {
        background: linear-gradient(135deg, #6C5CE7, #a855f7);
        color: #fff; border-bottom-right-radius: 4px;
      }
      .ps-msg--ai {
        background: #181a24; border: 1px solid #2a2d3e;
        border-bottom-left-radius: 4px;
      }
      .ps-msg--ai .ps-h3 { font-size: 13px; font-weight: 700; margin: 10px 0 4px; }
      .ps-msg--ai .ps-ul { padding-left: 14px; margin: 4px 0; list-style: none; }
      .ps-msg--ai .ps-li { position: relative; padding-left: 12px; margin-bottom: 4px; }
      .ps-msg--ai .ps-li::before { content: ""; position: absolute; left: 0; top: 8px; width: 4px; height: 4px; border-radius: 50%; background: #6C5CE7; }
      .ps-msg--ai code { background: #22253a; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
      .ps-msg--error {
        background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;
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
      @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      /* ── summary result (appears in chat area) ── */
      .ps-summary-card {
        padding: 16px; background: #181a24; border: 1px solid #2a2d3e;
        border-radius: 12px; animation: fadeUp 0.35s ease both;
      }
      .ps-summary-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .ps-summary-header h2 { font-size: 14px; font-weight: 700; }
      .ps-summary-actions { display: flex; gap: 6px; }
      .ps-icon-btn {
        background: #22253a; border: 1px solid #2a2d3e;
        border-radius: 8px; width: 30px; height: 30px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: #8b8fa4; transition: color 0.2s, background 0.2s;
      }
      .ps-icon-btn:hover { color: #e4e6f0; background: #2a2d3e; }
      .ps-icon-btn.ps-copied { color: #19c37d; }
      .ps-summary-body { font-size: 13px; line-height: 1.7; }
      .ps-summary-body .ps-h3 { font-size: 13px; font-weight: 700; margin: 14px 0 5px; }
      .ps-summary-body .ps-ul { padding-left: 16px; margin: 6px 0; list-style: none; }
      .ps-summary-body .ps-li { position: relative; padding-left: 12px; margin-bottom: 5px; }
      .ps-summary-body .ps-li::before { content: ""; position: absolute; left: 0; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: #6C5CE7; }
      .ps-summary-body code { background: #22253a; padding: 1px 5px; border-radius: 4px; font-size: 12px; }

      /* ── bottom bar: chat input + summarize ── */
      .ps-bottom-bar {
        flex-shrink: 0; padding: 12px 0 16px;
        border-top: 1px solid #2a2d3e;
        display: flex; flex-direction: column; gap: 10px;
      }

      .ps-chat-input-wrap {
        display: flex; align-items: flex-end; gap: 8px;
        background: #181a24; border: 1px solid #2a2d3e;
        border-radius: 12px; padding: 8px 8px 8px 14px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .ps-chat-input-wrap:focus-within { border-color: #6C5CE7; box-shadow: 0 0 0 3px rgba(108,92,231,0.25); }

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
        background: linear-gradient(135deg, #6C5CE7, #a855f7);
        color: #fff; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.1s, box-shadow 0.2s;
        box-shadow: 0 2px 8px rgba(108,92,231,0.25);
      }
      .ps-send-btn:hover { transform: scale(1.05); box-shadow: 0 4px 14px rgba(108,92,231,0.3); }
      .ps-send-btn:active { transform: scale(0.95); }

      .ps-voice-hint { font-size: 11px; color: #8b8fa4; text-align: center; }

      /* summarize button — at the bottom */
      .ps-btn--summarize {
        width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
        padding: 14px 18px;
        background: linear-gradient(135deg, #6C5CE7, #a855f7); border: none;
        border-radius: 12px; cursor: pointer; color: #fff; font-family: inherit;
        font-size: 14px; font-weight: 700; letter-spacing: -0.2px;
        box-shadow: 0 4px 18px rgba(108,92,231,0.3), 0 2px 6px rgba(0,0,0,0.2);
        transition: transform 0.15s, box-shadow 0.2s;
      }
      .ps-btn--summarize:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(108,92,231,0.35), 0 3px 10px rgba(0,0,0,0.3); }
      .ps-btn--summarize:active { transform: translateY(0) scale(0.98); }

      .ps-loading-inline {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        padding: 14px; color: #8b8fa4; font-size: 13px;
      }
      .ps-spinner-sm {
        width: 20px; height: 20px; border: 2px solid #22253a;
        border-top-color: #6C5CE7; border-radius: 50%; animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .ps-error-inline {
        padding: 10px 14px; background: rgba(239,68,68,0.08);
        border: 1px solid rgba(239,68,68,0.2); border-radius: 10px;
        font-size: 13px; color: #f87171; text-align: center;
      }
    `;
  }

  /* ── build panel ───────────────────────────────── */
  function createPanel() {
    panel = document.createElement("div");
    panel.id = "summy-root";
    panel.style.cssText = [
      "position: fixed", "top: 0", "right: 0",
      "width: " + PANEL_WIDTH + "px", "height: 100vh",
      "z-index: 2147483647",
      "transform: translateX(100%)",
      "transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
    ].join(" !important;") + " !important;";

    shadow = panel.attachShadow({ mode: "open" });
    const styleEl = document.createElement("style");
    styleEl.textContent = getCSS();
    shadow.appendChild(styleEl);

    const wrapper = document.createElement("div");
    wrapper.id = "ps-panel";
    wrapper.innerHTML = getHTML();
    shadow.appendChild(wrapper);

    document.body.appendChild(panel);

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
      <button class="ps-close" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div class="ps-header">
        <div class="ps-logo">S</div>
        <div class="ps-header-text">
          <h1 class="ps-title">Summy</h1>
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

        <button class="ps-provider-btn ps-provider--deepseek" data-provider="deepseek">
          <span class="ps-provider-icon ps-icon--deepseek"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg></span>
          <span class="ps-provider-text"><strong>Sign in with DeepSeek</strong><small>DeepSeek API</small></span>
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

        <div class="ps-main-body">
          <!-- Chat / summary area -->
          <div class="ps-chat-messages" id="ps-chat-messages">
            <div class="ps-chat-welcome">
              <div class="ps-chat-welcome-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
              <p class="ps-chat-welcome-title">Welcome to Summy</p>
              <p class="ps-chat-welcome-sub">Summarize this page with the button below, or ask any question about its content.</p>
            </div>
          </div>

          <!-- Bottom bar: chat input + summarize -->
          <div class="ps-bottom-bar">
            <div class="ps-chat-input-wrap">
              <textarea id="ps-chat-input" class="ps-chat-textarea" rows="1" placeholder="Ask anything about this page..."></textarea>
              <div class="ps-chat-btns">
                <button class="ps-voice-btn" id="ps-voice-btn" title="Voice input">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
                <button class="ps-send-btn" id="ps-send-btn" title="Send message">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
            <p class="ps-voice-hint hidden" id="ps-voice-status">Listening...</p>
            <button class="ps-btn ps-btn--summarize" id="ps-summarize">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Summarize This Page
            </button>
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

    // provider pick
    $$(".ps-provider-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        chosenProvider = btn.dataset.provider;
        const labels = { claude: "Claude (Anthropic)", chatgpt: "ChatGPT (OpenAI)", deepseek: "DeepSeek" };
        const placeholders = { claude: "sk-ant-...", chatgpt: "sk-...", deepseek: "sk-..." };
        $("#ps-key-title").textContent = "Enter your " + labels[chosenProvider] + " API key";
        $("#ps-api-input").placeholder = placeholders[chosenProvider];
        showView("key");
        chrome.storage.local.get([chosenProvider + "_key"], (res) => {
          if (res[chosenProvider + "_key"]) $("#ps-api-input").value = res[chosenProvider + "_key"];
        });
      });
    });

    $("#ps-back-to-auth").addEventListener("click", () => showView("auth"));
    $("#ps-toggle-key").addEventListener("click", () => {
      const inp = $("#ps-api-input"); inp.type = inp.type === "password" ? "text" : "password";
    });

    $("#ps-save-key").addEventListener("click", () => {
      const key = $("#ps-api-input").value.trim();
      if (!key) { $("#ps-api-input").classList.add("ps-shake"); setTimeout(() => $("#ps-api-input").classList.remove("ps-shake"), 500); return; }
      chrome.storage.local.set({ [chosenProvider + "_key"]: key, active_provider: chosenProvider });
      enterMain();
    });

    $("#ps-switch").addEventListener("click", () => showView("auth"));

    // summarize
    $("#ps-summarize").addEventListener("click", () => runSummary());

    // chat
    $("#ps-send-btn").addEventListener("click", () => sendChat());
    $("#ps-chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } });
    $("#ps-chat-input").addEventListener("input", () => { const ta = $("#ps-chat-input"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; });
    $("#ps-voice-btn").addEventListener("click", () => toggleVoice());

    function showView(name) { $$(".ps-view").forEach((v) => v.classList.add("hidden")); $("#ps-" + name).classList.remove("hidden"); }

    function enterMain() {
      const names = { claude: "Claude", chatgpt: "ChatGPT", deepseek: "DeepSeek" };
      const dotClass = { claude: "ps-dot--claude", chatgpt: "ps-dot--gpt", deepseek: "ps-dot--deepseek" };
      $("#ps-badge-name").textContent = names[chosenProvider];
      $("#ps-badge-dot").className = "ps-badge-dot " + dotClass[chosenProvider];
      pageContext = capturePageContent();
      chatHistory = [];
      showView("main");
    }

    chrome.storage.local.get(["active_provider", "claude_key", "chatgpt_key", "deepseek_key"], (res) => {
      if (res.active_provider && res[res.active_provider + "_key"]) { chosenProvider = res.active_provider; enterMain(); }
    });

    /* ── summarize ── */
    async function runSummary() {
      const container = $("#ps-chat-messages");
      const welcome = $(".ps-chat-welcome"); if (welcome) welcome.remove();

      // add loading into chat area
      const loadEl = document.createElement("div");
      loadEl.className = "ps-loading-inline";
      loadEl.id = "ps-s-loading";
      loadEl.innerHTML = '<div class="ps-spinner-sm"></div> Summarizing page...';
      container.appendChild(loadEl);
      container.scrollTop = container.scrollHeight;

      try {
        const apiKey = await getKey();
        const summary = await callAI(chosenProvider, apiKey, buildSummarizePrompt(pageContext));
        const lEl = shadow.getElementById("ps-s-loading"); if (lEl) lEl.remove();

        // insert summary card
        const card = document.createElement("div");
        card.className = "ps-summary-card";
        card.innerHTML = '<div class="ps-summary-header"><h2>Summary</h2><div class="ps-summary-actions"><button class="ps-icon-btn ps-copy-btn" title="Copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></div><div class="ps-summary-body">' + formatMarkdown(summary) + '</div>';
        container.appendChild(card);
        container.scrollTop = container.scrollHeight;

        // copy handler
        card.querySelector(".ps-copy-btn").addEventListener("click", () => {
          navigator.clipboard.writeText(card.querySelector(".ps-summary-body").innerText).then(() => {
            const b = card.querySelector(".ps-copy-btn"); b.innerHTML = "&#10003;"; b.classList.add("ps-copied");
            setTimeout(() => { b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'; b.classList.remove("ps-copied"); }, 1500);
          });
        });

        // also add to chat history so AI remembers it
        chatHistory.push({ role: "user", content: "Summarize this page." });
        chatHistory.push({ role: "assistant", content: summary });

      } catch (err) {
        const lEl = shadow.getElementById("ps-s-loading"); if (lEl) lEl.remove();
        const errEl = document.createElement("div");
        errEl.className = "ps-error-inline";
        errEl.textContent = err.message || "Something went wrong.";
        container.appendChild(errEl);
        container.scrollTop = container.scrollHeight;
      }
    }

    /* ── chat ── */
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
      const el = document.createElement("div"); el.className = "ps-chat-msg ps-chat-msg--assistant"; el.id = id;
      el.innerHTML = '<div class="ps-msg-bubble ps-msg--ai ps-typing"><span class="ps-dot-pulse"></span><span class="ps-dot-pulse"></span><span class="ps-dot-pulse"></span></div>';
      c.appendChild(el); c.scrollTop = c.scrollHeight; return id;
    }
    function removeTyping(id) { const el = shadow.getElementById(id); if (el) el.remove(); }

    /* ── voice ── */
    function toggleVoice() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { $("#ps-voice-status").textContent = "Speech recognition not supported"; $("#ps-voice-status").classList.remove("hidden"); return; }
      if (isRecording && recognition) { recognition.stop(); return; }
      recognition = new SR();
      recognition.lang = "en-US"; recognition.interimResults = true; recognition.continuous = false;
      recognition.onstart = () => { isRecording = true; $("#ps-voice-btn").classList.add("ps-voice--active"); $("#ps-voice-status").textContent = "Listening..."; $("#ps-voice-status").classList.remove("hidden"); };
      recognition.onresult = (e) => {
        let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        $("#ps-chat-input").value = t;
        const ta = $("#ps-chat-input"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
      };
      recognition.onend = () => {
        isRecording = false; $("#ps-voice-btn").classList.remove("ps-voice--active"); $("#ps-voice-status").classList.add("hidden");
        if ($("#ps-chat-input").value.trim()) sendChat();
      };
      recognition.onerror = (e) => {
        isRecording = false; $("#ps-voice-btn").classList.remove("ps-voice--active");
        $("#ps-voice-status").textContent = e.error === "not-allowed" ? "Microphone access denied" : "Voice error: " + e.error;
        setTimeout(() => $("#ps-voice-status").classList.add("hidden"), 3000);
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

  /* ── capture ───────────────────────────────────── */
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
    } else if (provider === "chatgpt") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1024, messages: [{ role: "system", content: "You are a helpful page summarizer." }, { role: "user", content: prompt }] }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "OpenAI API error (" + r.status + ")"); }
      const d = await r.json(); return d.choices[0].message.content;
    } else {
      // DeepSeek — OpenAI-compatible API
      const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model: "deepseek-chat", max_tokens: 1024, messages: [{ role: "system", content: "You are a helpful page summarizer." }, { role: "user", content: prompt }] }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "DeepSeek API error (" + r.status + ")"); }
      const d = await r.json(); return d.choices[0].message.content;
    }
  }

  async function callAIChat(provider, apiKey, pageText, history) {
    const sys = "You are a helpful assistant. The user is viewing a web page. Here is the page content for context:\n\n---\n" + pageText + "\n---\n\nAnswer the user's questions about this page. Be concise but thorough.";
    if (provider === "claude") {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024, system: sys, messages: history.map((m) => ({ role: m.role, content: m.content })) }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "Claude API error (" + r.status + ")"); }
      const d = await r.json(); return d.content.map((b) => b.text).join("");
    } else if (provider === "chatgpt") {
      const msgs = [{ role: "system", content: sys }, ...history.map((m) => ({ role: m.role, content: m.content }))];
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1024, messages: msgs }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "OpenAI API error (" + r.status + ")"); }
      const d = await r.json(); return d.choices[0].message.content;
    } else {
      const msgs = [{ role: "system", content: sys }, ...history.map((m) => ({ role: m.role, content: m.content }))];
      const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model: "deepseek-chat", max_tokens: 1024, messages: msgs }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "DeepSeek API error (" + r.status + ")"); }
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
