# Summy — Chrome Extension

AI-powered page summaries and chat. Summy captures the text content of any webpage and sends it to **Claude**, **ChatGPT**, or **DeepSeek** — either via API or by automatically asking the AI in a background tab — and displays the result right in the side panel.

---

## What's New in v3.2

- **Results now display above the controls.** Summaries and answers appear at the top of the side panel so you see them immediately without scrolling past buttons.
- **Provider dropdown.** Replaced the three separate provider buttons with a single dropdown menu to pick your AI (Claude, ChatGPT, or DeepSeek) plus one action button. Cleaner, less clutter.
- **Bug fixes for background scraping.** Fixed an issue where the "Asking Claude..." loading state would hang indefinitely. The root cause was an overly broad CSS selector (`[class*="stop"]`) in the generation-detection logic that matched unrelated elements on the page, making Summy think the AI was always still typing. Tightened all provider selectors to match only the actual stop/streaming indicators.
- **Background tab loading fix.** Chrome throttles JavaScript in tabs opened with `active: false`, which could prevent AI pages from loading at all. Summy now briefly opens the tab in the foreground so it boots up, then switches back to your original tab automatically.
- **Longer timeouts and retry logic.** Increased delays for input detection and send-button clicks to account for slower page loads. Added a retry if the send button isn't found on the first attempt.

---

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the folder containing these files
5. The extension icon will appear in your toolbar

> **Tip:** Pin the extension by clicking the puzzle-piece icon in Chrome's toolbar and pinning "Summy".

---

## How It Works

Click the Summy icon in your toolbar to open the side panel. It stays open alongside the page you're reading.

Summy has three modes:

| Mode | What it does |
|------|-------------|
| **Summarize** | Generates a TLDR, key points, and takeaways from the page |
| **Ask a Question** | Answers a specific question about the page content |
| **Custom Prompt** | Sends your own prompt along with the page content |

### With API keys (fastest)

1. Open the side panel and add your API key(s) in **Settings** (gear icon)
2. Pick a mode, then click a provider — the result appears directly in the side panel

### Without API keys (automatic)

1. Open the side panel
2. Pick a mode, then click a provider
3. Summy opens the AI chat in a background tab, pastes the prompt, and submits it automatically
4. The response is scraped and displayed in the side panel — no tab switching needed

---

## Supported Providers

| Provider | Chat URL | API key source |
|----------|----------|---------------|
| **Claude** | [claude.ai](https://claude.ai) | [console.anthropic.com](https://console.anthropic.com/) → API Keys |
| **ChatGPT** | [chatgpt.com](https://chatgpt.com) | [platform.openai.com](https://platform.openai.com/api-keys) → API Keys |
| **DeepSeek** | [chat.deepseek.com](https://chat.deepseek.com) | [platform.deepseek.com](https://platform.deepseek.com/api_keys) → API Keys |

API keys are **optional**. Without a key, Summy opens the AI chat in a background tab, auto-submits the prompt, and brings the response back to the side panel. Keys are stored in `chrome.storage.local` and never leave your machine except when making the API request to the provider you chose.

---

## File Structure

```
├── manifest.json      # Extension manifest (v3) — side panel config
├── background.js      # Service worker — opens side panel, relays AI responses
├── content.js         # Injected into AI chat pages — auto-pastes, auto-submits, scrapes response
├── sidepanel.html     # Side panel UI (main interface)
├── panel.js           # Side panel logic — page capture, API calls, background scrape flow, settings
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Troubleshooting

- **Side panel doesn't open?** Make sure you're on Chrome 114+ (side panel API requirement). Refresh the page after installing, or check `chrome://extensions` for errors.
- **API error?** Double-check that your key is correct and has credits or balance.
- **Content is truncated?** Very long pages are trimmed to around 12,000 characters to stay within API limits.
- **Response not coming back?** The background scraper waits up to 2 minutes for the AI to finish. If it times out, try again or add an API key for more reliable results.
- **"N/A" status on a page?** Browser internal pages (`chrome://`, `about:`, etc.) can't be read by extensions.
