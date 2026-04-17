// content.js — Injected into Claude, ChatGPT, and DeepSeek pages.
// Pastes the Summy prompt, optionally auto-submits, and scrapes the AI response.

(function () {
  const MAX_WAIT = 15000;   // max ms to wait for the input element
  const POLL_INTERVAL = 500;
  const RESPONSE_TIMEOUT = 120000; // max ms to wait for AI response (2 min)
  const RESPONSE_POLL = 1000;

  function detectProvider() {
    const host = location.hostname;
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("chatgpt.com")) return "chatgpt";
    if (host.includes("chat.deepseek.com")) return "deepseek";
    return null;
  }

  function findInputElement(provider) {
    if (provider === "claude") {
      return (
        document.querySelector('[contenteditable="true"].ProseMirror') ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('fieldset .ProseMirror')
      );
    }
    if (provider === "chatgpt") {
      return (
        document.querySelector("#prompt-textarea") ||
        document.querySelector('div[contenteditable="true"][data-placeholder]') ||
        document.querySelector('textarea[data-id="root"]') ||
        document.querySelector("textarea")
      );
    }
    if (provider === "deepseek") {
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
      el.focus();
      if (provider === "claude") {
        el.innerHTML = "<p>" + escapeHtml(text) + "</p>";
      } else {
        el.textContent = text;
      }
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

  // ── Scrape the AI response ──

  function getResponseElements(provider) {
    if (provider === "claude") {
      // Claude renders assistant messages in [data-is-streaming] or .font-claude-message, etc.
      return document.querySelectorAll(
        '[data-testid="chat-message-content"], .font-claude-message, [class*="message-content"]'
      );
    }
    if (provider === "chatgpt") {
      return document.querySelectorAll(
        '[data-message-author-role="assistant"] .markdown, .agent-turn .markdown, [data-testid="conversation-turn-"] .markdown'
      );
    }
    if (provider === "deepseek") {
      return document.querySelectorAll(
        '.ds-markdown--block, [class*="message-content"], .markdown-body'
      );
    }
    return [];
  }

  function isStillGenerating(provider) {
    if (provider === "claude") {
      return !!(
        document.querySelector('[data-is-streaming="true"]') ||
        document.querySelector('button[aria-label="Stop Response"]') ||
        document.querySelector('[class*="stop"]')
      );
    }
    if (provider === "chatgpt") {
      return !!(
        document.querySelector('button[aria-label="Stop generating"]') ||
        document.querySelector('button[data-testid="stop-button"]') ||
        document.querySelector('[class*="stop-button"]') ||
        document.querySelector('.result-streaming')
      );
    }
    if (provider === "deepseek") {
      return !!(
        document.querySelector('div[role="button"][aria-disabled="true"]') ||
        document.querySelector('[class*="stop"]') ||
        document.querySelector('.loading-spinner')
      );
    }
    return false;
  }

  function getLatestResponseText(provider) {
    const els = getResponseElements(provider);
    if (els.length === 0) return "";
    const last = els[els.length - 1];
    return (last.innerText || last.textContent || "").trim();
  }

  // ── Main injection flow ──

  function tryInject() {
    const provider = detectProvider();
    if (!provider) return;

    chrome.storage.local.get("summy_pending", (res) => {
      const pending = res.summy_pending;
      if (!pending || pending.provider !== provider) return;

      // Clear immediately so we don't re-inject
      chrome.storage.local.remove("summy_pending");

      const { prompt, autoSubmit } = pending;
      waitForInput(provider, prompt, autoSubmit);
    });
  }

  function waitForInput(provider, prompt, autoSubmit) {
    const start = Date.now();

    const poll = setInterval(() => {
      const el = findInputElement(provider);
      if (el) {
        clearInterval(poll);
        setTimeout(() => {
          setInputValue(el, prompt, provider);

          if (autoSubmit) {
            // Auto-submit: click the send button after a short delay
            setTimeout(() => {
              const sendBtn = findSendButton(provider);
              if (sendBtn) {
                sendBtn.click();
                // Now poll for the response
                pollForResponse(provider);
              } else {
                // Couldn't find send button — notify popup of failure
                chrome.runtime.sendMessage({
                  type: "SUMMY_RESPONSE",
                  error: "Could not find the send button on " + provider + ". The prompt was pasted but not submitted."
                });
                showBanner("Summy: Couldn't auto-send. Prompt is pasted — press Send manually.", true);
              }
            }, 800);
          } else {
            showBanner("Summy prompt pasted! Review and press Send when ready.");
          }
        }, 600);
        return;
      }
      if (Date.now() - start > MAX_WAIT) {
        clearInterval(poll);
        if (autoSubmit) {
          chrome.runtime.sendMessage({
            type: "SUMMY_RESPONSE",
            error: "Timed out waiting for the chat input on " + provider + "."
          });
        }
        showBanner("Summy: Couldn't find the chat input. Prompt copied to clipboard — paste manually.", true);
        navigator.clipboard.writeText(prompt).catch(() => {});
      }
    }, POLL_INTERVAL);
  }

  function pollForResponse(provider) {
    const start = Date.now();
    let lastText = "";
    let stableCount = 0;
    // Wait a bit before starting to poll (give the AI time to begin generating)
    const initialDelay = 3000;

    setTimeout(() => {
      const poll = setInterval(() => {
        const text = getLatestResponseText(provider);
        const generating = isStillGenerating(provider);

        if (text && text.length > 0 && !generating) {
          // Response is present and generation has stopped
          if (text === lastText) {
            stableCount++;
          } else {
            stableCount = 0;
            lastText = text;
          }
          // Wait for text to be stable for 2 consecutive polls
          if (stableCount >= 2) {
            clearInterval(poll);
            chrome.runtime.sendMessage({
              type: "SUMMY_RESPONSE",
              text: text
            });
            return;
          }
        } else if (text && text.length > 0) {
          // Still generating — update lastText
          lastText = text;
          stableCount = 0;
        }

        if (Date.now() - start - initialDelay > RESPONSE_TIMEOUT) {
          clearInterval(poll);
          if (lastText) {
            // Send whatever we have
            chrome.runtime.sendMessage({
              type: "SUMMY_RESPONSE",
              text: lastText
            });
          } else {
            chrome.runtime.sendMessage({
              type: "SUMMY_RESPONSE",
              error: "Timed out waiting for a response from " + provider + "."
            });
          }
        }
      }, RESPONSE_POLL);
    }, initialDelay);
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

  // Run on load and listen for storage changes
  tryInject();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.summy_pending && changes.summy_pending.newValue) {
      tryInject();
    }
  });
})();
