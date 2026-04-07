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

1. **Click the extension icon** on any webpage — a side panel opens
2. **Click "Capture Screen"** — the extension grabs a screenshot of the current page and copies it to your clipboard
3. **Choose your AI** — click the Claude, ChatGPT, or DeepSeek button
4. **A new chat opens in a new tab** — paste your clipboard (`Cmd + V` / `Ctrl + V`) into the chat to send the screenshot to the AI

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
