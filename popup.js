(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let currentMode = "summarize";
  let pageData = { text: "", title: "", url: "" };
  let keys = { claude: "", chatgpt: "", deepseek: "" };

  const NAMES = { claude: "Claude", chatgpt: "ChatGPT", deepseek: "DeepSeek" };

  // ── load saved keys ──
  function loadKeys(cb) {
    chrome.storage.local.get(["claude_key", "chatgpt_key", "deepseek_key"], (res) => {
      keys.claude = res.claude_key || "";
      keys.chatgpt = res.chatgpt_key || "";
      keys.deepseek = res.deepseek_key || "";
      renderProviders();
      if (cb) cb();
    });
  }
  loadKeys();

  // ── render provider buttons ──
  function renderProviders() {
    const container = $("#providers");
    container.innerHTML = "";
    const hasAnyKey = keys.claude || keys.chatgpt || keys.deepseek;

    [
      { id: "claude", name: "Claude", sub: "claude.ai", icon: "C", cls: "p-icon--claude" },
      { id: "chatgpt", name: "ChatGPT", sub: "chatgpt.com", icon: "G", cls: "p-icon--gpt" },
      { id: "deepseek", name: "DeepSeek", sub: "chat.deepseek.com", icon: "D", cls: "p-icon--deepseek" },
    ].forEach((p) => {
      const hasKey = !!keys[p.id];
      const btn = document.createElement("button");
      btn.className = "provider-btn";
      btn.dataset.provider = p.id;
      btn.innerHTML =
        '<span class="p-icon ' + p.cls + '">' + p.icon + '</span>' +
        '<span class="p-text"><strong>' + p.name + '</strong><small>' + p.sub + '</small></span>' +
        '<span class="p-action ' + (hasKey ? "p-action--api" : "p-action--copy") + '">' +
        (hasKey ? "Get Summary" : "Paste & Open") + '</span>';
      btn.addEventListener("click", () => handleProvider(p.id));
      container.appendChild(btn);
    });

    $("#no-key-hint").classList.toggle("hidden", hasAnyKey);
  }

  // ── show basic tab info on open (no content scraping) ──
  async function showTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      $("#page-title").textContent = tab.title || "Current Tab";
      $("#page-url").textContent = tab.url || "";

      if (!tab.url || /^(chrome|chrome-extension|about|edge|devtools):/.test(tab.url)) {
        $("#page-status").className = "page-status page-status--error";
        $("#page-status").textContent = "N/A";
        pageData = { text: "", title: tab.title || "", url: tab.url || "", unsupported: true };
      } else {
        $("#page-status").className = "page-status page-status--ok";
        $("#page-status").textContent = "Ready";
        // Store basic info; full text captured on demand
        pageData = { text: "", title: tab.title || "", url: tab.url || "" };
      }
    } catch {
      $("#page-title").textContent = "Unknown";
      $("#page-status").className = "page-status page-status--error";
      $("#page-status").textContent = "Error";
    }
  }
  showTabInfo();

  // ── capture page content (only called when a provider button is clicked) ──
  async function capturePage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || /^(chrome|chrome-extension|about|edge|devtools):/.test(tab.url)) {
        pageData = { text: "", title: tab?.title || "Browser Page", url: tab?.url || "", unsupported: true };
        return;
      }
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Selectors ordered from most specific to broadest
          var sels = [
            ".article-body", ".story-body", ".post-content", ".entry-content",
            ".article-content", ".story-content", ".content-body",
            '[data-testid="article-body"]', '[class*="ArticleBody"]', '[class*="article-body"]',
            "article", '[role="article"]', '[role="main"]', "main",
            "#content", "#main-content", ".main-content",
            "#article", ".article", ".story"
          ];
          var el = null;
          for (var i = 0; i < sels.length; i++) {
            try { el = document.querySelector(sels[i]); } catch(e) { /* skip bad selector */ }
            if (el && el.innerText && el.innerText.trim().length > 50) break;
            el = null;
          }
          // Fallback: grab body
          if (!el) el = document.body;

          var c = el.cloneNode(true);
          // Remove non-content elements
          var remove = "script,style,nav,footer,aside,iframe,noscript,svg,img,video,audio,canvas,header,form,button,[role='navigation'],[role='banner'],[role='complementary'],.sidebar,.ad,.advertisement,.cookie-banner,.popup,.modal,.social-share,[class*='cookie'],[class*='banner'],[class*='newsletter'],[class*='promo'],[id*='ad-'],[class*='ad-slot']";
          try { c.querySelectorAll(remove).forEach(function(n){n.remove();}); } catch(e) {}

          var t = "";
          try { t = (c.innerText || c.textContent || ""); } catch(e) {}
          t = t.replace(/\t/g, " ").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

          // If we got very little text from the targeted element, try body as fallback
          if (t.length < 100 && el !== document.body) {
            var bc = document.body.cloneNode(true);
            try { bc.querySelectorAll(remove).forEach(function(n){n.remove();}); } catch(e) {}
            var bt = "";
            try { bt = (bc.innerText || bc.textContent || ""); } catch(e) {}
            bt = bt.replace(/\t/g, " ").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
            if (bt.length > t.length) t = bt;
          }

          if (t.length > 12000) t = t.slice(0, 12000) + "\n…[truncated]";
          return { text: t, title: document.title || "", url: location.href || "" };
        }
      });
      const result = (results && results[0] && results[0].result) ? results[0].result : null;
      if (result) {
        pageData = result;
      } else {
        pageData = { text: "", title: tab.title || "", url: tab.url || "" };
      }
    } catch (e) {
      pageData = { text: "", title: "Error", url: "", unsupported: true };
    }
  }

  // ── mode tabs ──
  $$(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".mode-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentMode = tab.dataset.mode;
      $("#custom-area").classList.toggle("hidden", currentMode !== "custom");
      $("#chat-area").classList.toggle("hidden", currentMode !== "chat");
    });
  });

  // ── build prompt ──
  function buildPrompt() {
    if (!pageData.text) return null;
    const header = "Page: " + (pageData.title||"Unknown") + "\nURL: " + (pageData.url||"Unknown") + "\n\n";
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

  // ── handle provider click ──
  async function handleProvider(provider) {
    if (pageData.unsupported) { showToast("Can't read this page", true); return; }
    if (currentMode === "chat" && !$("#chat-input").value.trim()) { showToast("Type a question first!", true); return; }
    if (currentMode === "custom" && !$("#custom-input").value.trim()) { showToast("Type a prompt first!", true); return; }

    // Show loading while we capture + process
    $("#loading").classList.remove("hidden");
    $("#result-area").classList.add("hidden");
    $("#error-box").classList.add("hidden");

    // Capture page content now
    await capturePage();

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
      // ── API mode: fetch and show inline ──
      const modeNames = { summarize: "Summary", chat: "Answer", custom: "Response" };
      $("#result-title").textContent = modeNames[currentMode];

      try {
        const response = await callAI(provider, keys[provider], prompt);
        $("#loading").classList.add("hidden");
        $("#result-body").innerHTML = formatMarkdown(response);
        $("#result-area").classList.remove("hidden");
        $("#result-area").scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        $("#loading").classList.add("hidden");
        $("#error-box").textContent = err.message || "Something went wrong.";
        $("#error-box").classList.remove("hidden");
      }
    } else {
      // ── Paste & Open mode ──
      $("#loading").classList.add("hidden");
      try { await navigator.clipboard.writeText(prompt); } catch { /* fallback below */ }

      chrome.runtime.sendMessage(
        { type: "OPEN_AND_PASTE", provider, prompt },
        (response) => {
          if (response && response.ok) {
            showToast("Opening " + NAMES[provider] + "... prompt will be pasted automatically!");
          } else {
            const urls = { claude: "https://claude.ai/new", chatgpt: "https://chatgpt.com/", deepseek: "https://chat.deepseek.com/" };
            chrome.tabs.create({ url: urls[provider] });
            showToast("Copied! Opening " + NAMES[provider] + "... paste & send!");
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

  // ── copy result ──
  $("#copy-result").addEventListener("click", () => {
    const text = $("#result-body").innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = $("#copy-result"); btn.innerHTML = "&#10003;"; btn.classList.add("copied");
      setTimeout(() => {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        btn.classList.remove("copied");
      }, 1500);
    });
  });

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
      renderProviders();
      showToast("Keys saved!");
      $$(".key-input").forEach(inp => { inp.classList.add("saved"); setTimeout(()=>inp.classList.remove("saved"), 1200); });
    });
  });

  // ── format ──
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

  // ── toast ──
  function showToast(text, isError) {
    const t = $("#toast");
    $("#toast-text").textContent = text;
    t.style.background = isError ? "#ef4444" : "#22c55e";
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2400);
  }

  // ── auto-resize ──
  ["#chat-input","#custom-input"].forEach(s => {
    $(s).addEventListener("input", () => { const t=$(s); t.style.height="auto"; t.style.height=Math.min(t.scrollHeight,100)+"px"; });
  });
})();
