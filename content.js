// content.js — Injected into Claude, ChatGPT, and DeepSeek pages.
// Pastes the Summy prompt, auto-submits, and scrapes the AI response.

(function () {
  const MAX_WAIT = 20000;
  const POLL_INTERVAL = 500;
  const RESPONSE_TIMEOUT = 120000;
  const RESPONSE_POLL = 2000;

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
        document.querySelector('fieldset .ProseMirror') ||
        document.querySelector('div[contenteditable="true"]')
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
        bubbles: true, cancelable: true, inputType: "insertText", data: text
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
        document.querySelector('button[data-testid="send-button"]') ||
        document.querySelector('fieldset button[type="button"]:last-of-type')
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
        document.querySelector('button[aria-label="Send"]') ||
        document.querySelector('textarea + button') ||
        document.querySelector('div[role="button"][aria-disabled]')
      );
    }
    return null;
  }

  // ── Response scraping: snapshot-diff approach ──
  // Instead of guessing specific selectors, we snapshot the full page text
  // before submission, then after generation stops we grab the new text
  // that appeared — that's the AI response.

  function getPageText() {
    // Get all visible text from the main content area
    var body = document.body.cloneNode(true);
    // Remove scripts, styles, and hidden elements
    body.querySelectorAll("script, style, noscript, [hidden], [aria-hidden='true']").forEach(function(n) { n.remove(); });
    return (body.innerText || body.textContent || "").trim();
  }

  function isStillGenerating(provider) {
    if (provider === "claude") {
      if (document.querySelector('[data-is-streaming="true"]')) return true;
      var stopBtn = document.querySelector('button[aria-label="Stop Response"]') ||
                    document.querySelector('button[aria-label="Stop response"]');
      return !!stopBtn;
    }
    if (provider === "chatgpt") {
      return !!(
        document.querySelector('button[aria-label="Stop generating"]') ||
        document.querySelector('button[data-testid="stop-button"]') ||
        document.querySelector('.result-streaming')
      );
    }
    if (provider === "deepseek") {
      return !!(
        document.querySelector('button[aria-label="Stop generating"]') ||
        document.querySelector('button[aria-label="Stop Generating"]')
      );
    }
    return false;
  }

  // Extract the AI response by finding text that's new since the snapshot
  function extractNewText(beforeSnapshot, afterSnapshot) {
    // Simple approach: find where the new text diverges from the old
    // The AI response will be the new content that appeared after submission
    if (!afterSnapshot || afterSnapshot.length <= beforeSnapshot.length) return "";

    // Try to find the response by looking for text after the last occurrence
    // of our prompt content (the AI sites echo the user message)
    // Fallback: just take the difference
    var newPart = afterSnapshot.slice(beforeSnapshot.length).trim();

    // If that's too short, try a smarter diff
    if (newPart.length < 20) {
      // Find the longest common prefix
      var i = 0;
      var minLen = Math.min(beforeSnapshot.length, afterSnapshot.length);
      while (i < minLen && beforeSnapshot[i] === afterSnapshot[i]) i++;
      newPart = afterSnapshot.slice(i).trim();
    }

    return newPart;
  }

  // ── Main injection flow ──

  function tryInject() {
    const provider = detectProvider();
    if (!provider) return;

    chrome.storage.local.get("summy_pending", (res) => {
      const pending = res.summy_pending;
      if (!pending || pending.provider !== provider) return;

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
          // Take a snapshot of the page BEFORE we paste and submit
          var beforeSnapshot = getPageText();

          setInputValue(el, prompt, provider);

          if (autoSubmit) {
            setTimeout(() => {
              const sendBtn = findSendButton(provider);
              if (sendBtn) {
                sendBtn.click();
                pollForResponse(provider, beforeSnapshot);
              } else {
                setTimeout(() => {
                  const retryBtn = findSendButton(provider);
                  if (retryBtn) {
                    retryBtn.click();
                    pollForResponse(provider, beforeSnapshot);
                  } else {
                    chrome.runtime.sendMessage({
                      type: "SUMMY_RESPONSE",
                      error: "Could not find the send button on " + provider + ". The prompt was pasted but not submitted."
                    });
                  }
                }, 1500);
              }
            }, 1000);
          } else {
            showBanner("Summy prompt pasted! Review and press Send when ready.");
          }
        }, 800);
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
        navigator.clipboard.writeText(prompt).catch(() => {});
      }
    }, POLL_INTERVAL);
  }

  function pollForResponse(provider, beforeSnapshot) {
    const start = Date.now();
    let lastText = "";
    let stableCount = 0;
    let sawActivity = false;

    // Wait for the AI to start generating
    const initialDelay = 6000;

    setTimeout(() => {
      const poll = setInterval(() => {
        const generating = isStillGenerating(provider);
        const currentPage = getPageText();
        const newText = extractNewText(beforeSnapshot, currentPage);

        if (generating || (newText && newText.length > 30)) {
          sawActivity = true;
        }

        if (newText && newText.length > 0) {
          if (generating) {
            lastText = newText;
            stableCount = 0;
          } else {
            if (newText === lastText) {
              stableCount++;
            } else {
              stableCount = 0;
              lastText = newText;
            }

            if (stableCount >= 2 && (sawActivity || newText.length > 50)) {
              clearInterval(poll);
              chrome.runtime.sendMessage({
                type: "SUMMY_RESPONSE",
                text: cleanResponse(newText, provider)
              });
              return;
            }
          }
        }

        if (Date.now() - start - initialDelay > RESPONSE_TIMEOUT) {
          clearInterval(poll);
          if (lastText && lastText.length > 30) {
            chrome.runtime.sendMessage({
              type: "SUMMY_RESPONSE",
              text: cleanResponse(lastText, provider)
            });
          } else {
            chrome.runtime.sendMessage({
              type: "SUMMY_RESPONSE",
              error: "Timed out waiting for a response from " + provider + ". The AI page may not have loaded properly."
            });
          }
        }
      }, RESPONSE_POLL);
    }, initialDelay);
  }

  // Clean up the scraped response — extract only the AI's actual answer
  function cleanResponse(text, provider) {
    // The scraped text contains: [echoed prompt] + [AI response] + [UI chrome]
    // We need to extract just the AI response.

    // Strategy 1: Find the response after the prompt's closing "---" delimiter
    // Our prompt always ends with "---" and the AI response follows
    var delimIdx = text.lastIndexOf("---");
    if (delimIdx > 0) {
      var afterDelim = text.slice(delimIdx + 3).trim();
      if (afterDelim.length > 30) {
        text = afterDelim;
      }
    }

    // Strategy 2: If the text starts with "[Summy" or "Page:" it still has the prompt
    var summyIdx = text.indexOf("[Summy");
    if (summyIdx >= 0) {
      // Find the end of the prompt (after the last "---")
      var promptEnd = text.indexOf("---", summyIdx);
      if (promptEnd > 0) {
        // There might be a second "---" closing the content block
        var secondDelim = text.indexOf("---", promptEnd + 3);
        if (secondDelim > 0) {
          text = text.slice(secondDelim + 3).trim();
        } else {
          text = text.slice(promptEnd + 3).trim();
        }
      }
    }

    // Strategy 3: Look for common AI response markers
    // Claude/ChatGPT responses to our summarize prompt typically start with "TLDR" or "**TLDR"
    var tldrIdx = text.search(/\bTLDR\b/i);
    if (tldrIdx > 10) {
      // There's junk before the TLDR — strip it
      text = text.slice(tldrIdx);
    }

    // Remove UI chrome that appears after the response
    var uiPatterns = [
      /\n(Sonnet|Claude|GPT|Opus|Haiku|Model:)[\s\S]*$/i,
      /\nClaude is AI and can make mistakes[\s\S]*$/i,
      /\nPlease double-check responses[\s\S]*$/i,
      /\nChatGPT can make mistakes[\s\S]*$/i,
      /\n(Share|Copy|Retry|Edit|Like|Dislike|Good response|Bad response|Show more|Regenerate)\s*$/gm,
      /\n\d+:\d+\s*(AM|PM)\s*$/gm
    ];
    for (var i = 0; i < uiPatterns.length; i++) {
      text = text.replace(uiPatterns[i], "");
    }

    // Remove standalone UI button text lines
    text = text
      .replace(/^(Copy|Edit|Retry|Share|Like|Dislike|Good response|Bad response|Show more|Regenerate)\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return text;
  }

  function showBanner(text, isError) {
    const banner = document.createElement("div");
    banner.textContent = text;
    Object.assign(banner.style, {
      position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)",
      zIndex: "999999", padding: "10px 20px", borderRadius: "10px",
      fontSize: "13px", fontWeight: "600",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#fff", background: isError ? "#ef4444" : "#6C5CE7",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      transition: "opacity 0.4s ease", opacity: "0", pointerEvents: "none"
    });
    document.body.appendChild(banner);
    requestAnimationFrame(() => { banner.style.opacity = "1"; });
    setTimeout(() => {
      banner.style.opacity = "0";
      setTimeout(() => banner.remove(), 500);
    }, 4000);
  }

  tryInject();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.summy_pending && changes.summy_pending.newValue) {
      tryInject();
    }
  });
})();
