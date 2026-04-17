// content.js — Injected into Claude, ChatGPT, and DeepSeek pages.
// Checks for a pending Summy prompt and pastes it into the chat input.

(function () {
  const MAX_WAIT = 15000; // max ms to wait for the input element
  const POLL_INTERVAL = 500;

  function detectProvider() {
    const host = location.hostname;
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("chatgpt.com")) return "chatgpt";
    if (host.includes("chat.deepseek.com")) return "deepseek";
    return null;
  }

  function findInputElement(provider) {
    if (provider === "claude") {
      // Claude uses a contenteditable div with class "ProseMirror"
      return (
        document.querySelector('[contenteditable="true"].ProseMirror') ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('fieldset .ProseMirror')
      );
    }
    if (provider === "chatgpt") {
      // ChatGPT uses a contenteditable div inside the prompt area, or a textarea
      return (
        document.querySelector("#prompt-textarea") ||
        document.querySelector('div[contenteditable="true"][data-placeholder]') ||
        document.querySelector('textarea[data-id="root"]') ||
        document.querySelector("textarea")
      );
    }
    if (provider === "deepseek") {
      // DeepSeek uses a textarea or contenteditable
      return (
        document.querySelector("textarea#chat-input") ||
        document.querySelector("textarea") ||
        document.querySelector('div[contenteditable="true"]')
      );
    }
    return null;
  }

  function setInputValue(el, text, provider) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      // For native textarea/input elements
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // For contenteditable divs (Claude, some ChatGPT versions)
      el.focus();

      // Create a paragraph with the text
      if (provider === "claude") {
        // Claude's ProseMirror expects <p> elements
        el.innerHTML = "<p>" + escapeHtml(text) + "</p>";
      } else {
        el.textContent = text;
      }

      // Fire input event so the framework picks up the change
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text
      }));
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\n/g, "</p><p>");
  }

  function findSendButton(provider) {
    if (provider === "claude") {
      // Claude: button with aria-label "Send Message" or the send SVG button
      return (
        document.querySelector('button[aria-label="Send Message"]') ||
        document.querySelector('button[aria-label="Send message"]') ||
        document.querySelector('fieldset button[type="button"]:last-of-type') ||
        document.querySelector('button[data-testid="send-button"]')
      );
    }
    if (provider === "chatgpt") {
      return (
        document.querySelector('button[data-testid="send-button"]') ||
        document.querySelector('button[aria-label="Send prompt"]') ||
        document.querySelector('form button[type="submit"]')
      );
    }
    if (provider === "deepseek") {
      return (
        document.querySelector('div[role="button"][aria-disabled]') ||
        document.querySelector('button[aria-label="Send"]') ||
        document.querySelector('textarea + button') ||
        document.querySelector('button._7436101')
      );
    }
    return null;
  }

  // Main: poll for pending prompt and inject it
  function tryInject() {
    const provider = detectProvider();
    if (!provider) return;

    chrome.storage.local.get("summy_pending", (res) => {
      const pending = res.summy_pending;
      if (!pending || pending.provider !== provider) return;

      // Clear it immediately so we don't re-inject on page navigation
      chrome.storage.local.remove("summy_pending");

      const { prompt } = pending;
      waitForInput(provider, prompt);
    });
  }

  function waitForInput(provider, prompt) {
    const start = Date.now();

    const poll = setInterval(() => {
      const el = findInputElement(provider);
      if (el) {
        clearInterval(poll);
        // Small delay to let the page fully initialize
        setTimeout(() => {
          setInputValue(el, prompt, provider);
          showBanner("Summy prompt pasted! Review and press Send when ready.");
        }, 600);
        return;
      }
      if (Date.now() - start > MAX_WAIT) {
        clearInterval(poll);
        showBanner("Summy: Couldn't find the chat input. Prompt copied to clipboard — paste manually.", true);
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(prompt).catch(() => {});
      }
    }, POLL_INTERVAL);
  }

  // Show a small notification banner at the top of the page
  function showBanner(text, isError) {
    const banner = document.createElement("div");
    banner.textContent = text;
    Object.assign(banner.style, {
      position: "fixed",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "999999",
      padding: "10px 20px",
      borderRadius: "10px",
      fontSize: "13px",
      fontWeight: "600",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#fff",
      background: isError ? "#ef4444" : "#6C5CE7",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
      opacity: "0",
      pointerEvents: "none"
    });
    document.body.appendChild(banner);

    requestAnimationFrame(() => {
      banner.style.opacity = "1";
    });

    setTimeout(() => {
      banner.style.opacity = "0";
      setTimeout(() => banner.remove(), 500);
    }, 4000);
  }

  // Run on load and also listen for storage changes (in case the tab was already open)
  tryInject();

  // Also listen for changes in case the page was already loaded when the prompt was set
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.summy_pending && changes.summy_pending.newValue) {
      tryInject();
    }
  });
})();
