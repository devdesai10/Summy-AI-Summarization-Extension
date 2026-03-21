(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let chosenProvider = null;
  let chatHistory = [];
  let pageContext = "";
  let recognition = null;
  let isRecording = false;

  // ── views ──
  function showView(name) {
    $$(".view").forEach((v) => v.classList.add("hidden"));
    $(`#v-${name}`).classList.remove("hidden");
  }

  // ── provider pick ──
  $$(".provider-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      chosenProvider = btn.dataset.provider;
      const labels = { claude: "Claude (Anthropic)", chatgpt: "ChatGPT (OpenAI)", deepseek: "DeepSeek" };
      const placeholders = { claude: "sk-ant-...", chatgpt: "sk-...", deepseek: "sk-..." };
      $("#key-title").textContent = "Enter your " + labels[chosenProvider] + " API key";
      $("#key-input").placeholder = placeholders[chosenProvider];
      $("#key-input").value = "";
      showView("key");
      chrome.storage.local.get([chosenProvider + "_key"], (res) => {
        if (res[chosenProvider + "_key"]) $("#key-input").value = res[chosenProvider + "_key"];
      });
    });
  });

  // ── key view ──
  $("#back-btn").addEventListener("click", () => showView("auth"));
  $("#toggle-vis").addEventListener("click", () => {
    const inp = $("#key-input");
    inp.type = inp.type === "password" ? "text" : "password";
  });
  $("#save-key").addEventListener("click", () => {
    const key = $("#key-input").value.trim();
    if (!key) {
      $("#key-input").classList.add("shake");
      setTimeout(() => $("#key-input").classList.remove("shake"), 500);
      return;
    }
    chrome.storage.local.set({ [chosenProvider + "_key"]: key, active_provider: chosenProvider });
    enterMain();
  });

  // ── switch ──
  $("#switch-btn").addEventListener("click", () => showView("auth"));

  // ── enter main ──
  function enterMain() {
    const names = { claude: "Claude", chatgpt: "ChatGPT", deepseek: "DeepSeek" };
    const dots = { claude: "badge-dot--claude", chatgpt: "badge-dot--gpt", deepseek: "badge-dot--deepseek" };
    $("#badge-name").textContent = names[chosenProvider];
    $("#badge-dot").className = "badge-dot " + dots[chosenProvider];
    chatHistory = [];
    refreshPageContext();
    showView("main");
  }

  // ── get page content from active tab via background ──
  function refreshPageContext() {
    chrome.runtime.sendMessage({ action: "capturePageContent" }, (res) => {
      if (res && res.text) {
        pageContext = res.text;
      }
    });
  }

  // auto-refresh context when panel regains focus (tab switch)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && chosenProvider) refreshPageContext();
  });

  // ── auto sign in ──
  chrome.storage.local.get(["active_provider", "claude_key", "chatgpt_key", "deepseek_key"], (res) => {
    if (res.active_provider && res[res.active_provider + "_key"]) {
      chosenProvider = res.active_provider;
      enterMain();
    }
  });

  // ── summarize ──
  $("#summarize-btn").addEventListener("click", async () => {
    const container = $("#chat-messages");
    const w = $("#welcome"); if (w) w.remove();

    // refresh page context for current tab
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "capturePageContent" }, (res) => {
        if (res && res.text) pageContext = res.text;
        resolve();
      });
    });

    if (!pageContext) {
      const err = document.createElement("div");
      err.className = "error-inline";
      err.textContent = "Could not read page content. Try refreshing the page.";
      container.appendChild(err);
      return;
    }

    const loadEl = document.createElement("div");
    loadEl.className = "loading-inline";
    loadEl.id = "s-loading";
    loadEl.innerHTML = '<div class="spinner-sm"></div> Summarizing page...';
    container.appendChild(loadEl);
    container.scrollTop = container.scrollHeight;

    try {
      const apiKey = await getKey();
      const summary = await callAI(chosenProvider, apiKey, buildSummarizePrompt(pageContext));
      const lEl = document.getElementById("s-loading"); if (lEl) lEl.remove();

      const card = document.createElement("div");
      card.className = "summary-card";
      card.innerHTML = '<div class="summary-header"><h2>Summary</h2><button class="icon-btn copy-btn" title="Copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div><div class="summary-body">' + formatMarkdown(summary) + '</div>';
      container.appendChild(card);
      container.scrollTop = container.scrollHeight;

      card.querySelector(".copy-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(card.querySelector(".summary-body").innerText).then(() => {
          const b = card.querySelector(".copy-btn"); b.innerHTML = "&#10003;"; b.classList.add("copied");
          setTimeout(() => { b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'; b.classList.remove("copied"); }, 1500);
        });
      });

      chatHistory.push({ role: "user", content: "Summarize this page." });
      chatHistory.push({ role: "assistant", content: summary });

    } catch (err) {
      const lEl = document.getElementById("s-loading"); if (lEl) lEl.remove();
      const errEl = document.createElement("div");
      errEl.className = "error-inline";
      errEl.textContent = err.message || "Something went wrong.";
      container.appendChild(errEl);
      container.scrollTop = container.scrollHeight;
    }
  });

  // ── chat ──
  $("#send-btn").addEventListener("click", () => sendChat());
  $("#chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  $("#chat-input").addEventListener("input", () => {
    const ta = $("#chat-input"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  });

  async function sendChat() {
    const input = $("#chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = ""; input.style.height = "auto";
    const w = $("#welcome"); if (w) w.remove();

    // refresh context
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "capturePageContent" }, (res) => {
        if (res && res.text) pageContext = res.text;
        resolve();
      });
    });

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
    const c = $("#chat-messages");
    const el = document.createElement("div");
    el.className = "chat-msg chat-msg--" + role;
    if (role === "user") el.innerHTML = '<div class="msg-bubble msg--user">' + escapeHtml(text) + '</div>';
    else if (role === "assistant") el.innerHTML = '<div class="msg-bubble msg--ai">' + formatMarkdown(text) + '</div>';
    else el.innerHTML = '<div class="msg-bubble msg--error">' + escapeHtml(text) + '</div>';
    c.appendChild(el); c.scrollTop = c.scrollHeight;
  }

  let tc = 0;
  function appendTyping() {
    const id = "typing-" + (++tc);
    const c = $("#chat-messages");
    const el = document.createElement("div"); el.className = "chat-msg chat-msg--assistant"; el.id = id;
    el.innerHTML = '<div class="msg-bubble msg--ai typing"><span class="dot-pulse"></span><span class="dot-pulse"></span><span class="dot-pulse"></span></div>';
    c.appendChild(el); c.scrollTop = c.scrollHeight; return id;
  }
  function removeTyping(id) { const el = document.getElementById(id); if (el) el.remove(); }

  // ── voice ──
  $("#voice-btn").addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $("#voice-status").textContent = "Not supported in this browser"; $("#voice-status").classList.remove("hidden"); return; }
    if (isRecording && recognition) { recognition.stop(); return; }
    recognition = new SR();
    recognition.lang = "en-US"; recognition.interimResults = true; recognition.continuous = false;
    recognition.onstart = () => { isRecording = true; $("#voice-btn").classList.add("active"); $("#voice-status").textContent = "Listening..."; $("#voice-status").classList.remove("hidden"); };
    recognition.onresult = (e) => {
      let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      $("#chat-input").value = t;
      const ta = $("#chat-input"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    };
    recognition.onend = () => {
      isRecording = false; $("#voice-btn").classList.remove("active"); $("#voice-status").classList.add("hidden");
      if ($("#chat-input").value.trim()) sendChat();
    };
    recognition.onerror = (e) => {
      isRecording = false; $("#voice-btn").classList.remove("active");
      $("#voice-status").textContent = e.error === "not-allowed" ? "Mic access denied" : "Error: " + e.error;
      setTimeout(() => $("#voice-status").classList.add("hidden"), 3000);
    };
    recognition.start();
  });

  // ── helpers ──
  function getKey() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([chosenProvider + "_key"], (res) => {
        const k = res[chosenProvider + "_key"]; k ? resolve(k) : reject(new Error("API key not found."));
      });
    });
  }

  function buildSummarizePrompt(t) {
    return "You are a page summarizer. Provide a clear, well-structured summary of the following web page content. Include:\n1. A one-sentence TLDR\n2. Key points (as bullet points)\n3. Any notable details or takeaways\n\nWeb page content:\n---\n" + t + "\n---";
  }

  // ── AI calls ──
  async function callAI(provider, apiKey, prompt) {
    if (provider === "claude") {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}, body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1024,messages:[{role:"user",content:prompt}]}) });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"Claude error ("+r.status+")"); }
      const d = await r.json(); return d.content.map(b=>b.text).join("");
    } else if (provider === "chatgpt") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+apiKey}, body:JSON.stringify({model:"gpt-4o-mini",max_tokens:1024,messages:[{role:"system",content:"You are a helpful page summarizer."},{role:"user",content:prompt}]}) });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"OpenAI error ("+r.status+")"); }
      const d = await r.json(); return d.choices[0].message.content;
    } else {
      const r = await fetch("https://api.deepseek.com/chat/completions", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+apiKey}, body:JSON.stringify({model:"deepseek-chat",max_tokens:1024,messages:[{role:"system",content:"You are a helpful page summarizer."},{role:"user",content:prompt}]}) });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"DeepSeek error ("+r.status+")"); }
      const d = await r.json(); return d.choices[0].message.content;
    }
  }

  async function callAIChat(provider, apiKey, pageText, history) {
    const sys = "You are a helpful assistant. The user is viewing a web page. Here is the page content for context:\n\n---\n" + pageText + "\n---\n\nAnswer the user's questions about this page. Be concise but thorough.";
    if (provider === "claude") {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}, body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1024,system:sys,messages:history.map(m=>({role:m.role,content:m.content}))}) });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"Claude error ("+r.status+")"); }
      const d = await r.json(); return d.content.map(b=>b.text).join("");
    } else if (provider === "chatgpt") {
      const msgs = [{role:"system",content:sys},...history.map(m=>({role:m.role,content:m.content}))];
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+apiKey}, body:JSON.stringify({model:"gpt-4o-mini",max_tokens:1024,messages:msgs}) });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"OpenAI error ("+r.status+")"); }
      const d = await r.json(); return d.choices[0].message.content;
    } else {
      const msgs = [{role:"system",content:sys},...history.map(m=>({role:m.role,content:m.content}))];
      const r = await fetch("https://api.deepseek.com/chat/completions", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+apiKey}, body:JSON.stringify({model:"deepseek-chat",max_tokens:1024,messages:msgs}) });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"DeepSeek error ("+r.status+")"); }
      const d = await r.json(); return d.choices[0].message.content;
    }
  }

  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
      .replace(/^[-•] (.+)$/gm, '<li class="md-li">$1</li>')
      .replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>')
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
})();
