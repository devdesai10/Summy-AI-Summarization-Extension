# Page Summarizer AI — Chrome Extension

A Chrome extension that opens a sleek side panel to capture and summarize any webpage using **Claude (Anthropic)** or **ChatGPT (OpenAI)**.

---

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder from this download
5. The extension icon (orange document) will appear in your toolbar

> **Tip:** Pin the extension for quick access by clicking the puzzle-piece icon in Chrome's toolbar and pinning "Page Summarizer AI".

---

## Usage

1. **Click the extension icon** on any webpage — a panel slides open on the right
2. **Choose your AI provider** — Claude or ChatGPT
3. **Enter your API key** — it's stored locally in your browser and never sent anywhere except the chosen API
4. **Click "Summarize This Page"** — the extension extracts the page content and sends it to the AI for a structured summary
5. **Copy the summary** with one click

---

## API Keys

| Provider | Where to get a key |
|----------|-------------------|
| **Claude** | [console.anthropic.com](https://console.anthropic.com/) → API Keys |
| **ChatGPT** | [platform.openai.com](https://platform.openai.com/api-keys) → API Keys |

Your keys are saved in `chrome.storage.local` — they never leave your machine except when making the API request to the provider you chose.

---

## File Structure

```
chrome-extension/
├── manifest.json      # Extension manifest (v3)
├── background.js      # Service worker — handles icon click
├── content.js         # Injected script — panel UI + AI calls
├── sidepanel.css      # Panel styles (shadow DOM isolated)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Troubleshooting

- **Panel doesn't open?** Refresh the page after installing, or check `chrome://extensions` for errors.
- **API error?** Double-check your key is correct and has credits/balance.
- **Content is truncated?** Very long pages are trimmed to ~12 000 characters to stay within API limits.
- **CORS errors with Claude?** The extension uses the `anthropic-dangerous-direct-browser-access` header. Make sure your Anthropic API key has browser access enabled.
