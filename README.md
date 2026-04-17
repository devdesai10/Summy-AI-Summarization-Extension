# Summy — Chrome Extension

AI-powered page summaries and chat. Summy captures the text content of any webpage and sends it to **Claude**, **ChatGPT**, or **DeepSeek** — either via API or by automatically asking the AI in a background tab — and displays the result right in the side panel.

---

## What's New in v3.6

- **Scrollable results with pinned controls.** The side panel is now split into two zones: a scrollable area on top for results, and pinned controls at the bottom. The mode tabs, AI dropdown, and "Get Summary" button stay visible at all times, no matter how long the response is.
- **Clean response extraction.** Fixed an issue where the scraped response included the echoed prompt, page content, and UI text ("Sonnet 4.6", "Claude is AI and can make mistakes", "Share", etc.). The content script now strips the prompt, finds the actual AI answer, and removes platform UI artifacts before displaying the result.
- **Improved markdown rendering.** Bullet points (`*`, `-`, `•`) and numbered lists are now processed before inline formatting, fixing a bug where the italic regex would eat bullet content and leave only headings visible.
- **Snapshot-diff scraping.** Replaced the fragile CSS-selector-based response scraping with a snapshot-diff approach. The content script captures the full page text before submission, then diffs it after the AI finishes to extract only the new content. This works regardless of DOM structure changes on AI sites.

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

Pick your AI provider from the dropdown at the bottom and hit the button. Results appear in the scrollable area above.

### With API keys (fastest)

1. Open the side panel and add your API key(s) in **Settings** (gear icon)
2. Pick a mode and provider, then click "Get Summary" — the result appears directly in the side panel

### Without API keys (automatic)

1. Open the side panel
2. Pick a mode and provider, then click "Get Summary"
3. Summy opens the AI chat in a background tab, pastes the prompt, and submits it automatically
4. The response is scraped, cleaned, and displayed in the side panel — no tab switching needed

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
├── manifest.json      # Extension manifest (v3) — side panel + sidePanel permission
├── background.js      # Service worker — opens side panel, captures page content, relays AI responses
├── content.js         # Injected into AI chat pages — auto-pastes, auto-submits, scrapes and cleans response
├── sidepanel.html     # Side panel UI — scrollable results + pinned controls
├── panel.js           # Side panel logic — API calls, background scrape flow, settings, markdown rendering
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
- **Response includes junk text?** The cleaner strips known UI patterns, but AI sites change frequently. Adding an API key bypasses scraping entirely for the most reliable results.
- **Response not coming back?** The background scraper waits up to 2 minutes for the AI to finish. If it times out, try again or add an API key.
- **"N/A" status on a page?** Browser internal pages (`chrome://`, `about:`, etc.) can't be read by extensions.
