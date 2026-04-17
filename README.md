# Summy — Chrome Extension

AI-powered page summaries and chat. Summy captures the text content of any webpage and sends it to **Claude**, **ChatGPT**, or **DeepSeek** — either via API (results shown inline) or by copying a ready-made prompt and opening the AI chat for you.

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

Summy has three modes:

| Mode | What it does |
|------|-------------|
| **Summarize** | Generates a TLDR, key points, and takeaways from the page |
| **Ask a Question** | Answers a specific question about the page content |
| **Custom Prompt** | Sends your own prompt along with the page content |

### With API keys (inline results)

1. Click the extension icon to open the popup
2. Add your API key(s) in **Settings**
3. Pick a mode, then click a provider — the result appears right in the popup

### Without API keys (paste and open)

1. Click the extension icon to open the popup
2. Pick a mode, then click a provider
3. Summy copies a ready-made prompt to your clipboard and opens the AI chat
4. The prompt is automatically pasted into the chat input — just review and send

Summy also includes a **side panel** view with the same copy-and-open workflow.

---

## Supported Providers

| Provider | Chat URL | API key source |
|----------|----------|---------------|
| **Claude** | [claude.ai](https://claude.ai) | [console.anthropic.com](https://console.anthropic.com/) → API Keys |
| **ChatGPT** | [chatgpt.com](https://chatgpt.com) | [platform.openai.com](https://platform.openai.com/api-keys) → API Keys |
| **DeepSeek** | [chat.deepseek.com](https://chat.deepseek.com) | [platform.deepseek.com](https://platform.deepseek.com/api_keys) → API Keys |

API keys are **optional**. Without a key, Summy uses the paste-and-open flow instead. Keys are stored in `chrome.storage.local` and never leave your machine except when making the API request to the provider you chose.

---

## File Structure

```
├── manifest.json      # Extension manifest (v3)
├── background.js      # Service worker — opens AI tabs and stores pending prompts
├── content.js         # Injected into AI chat pages — auto-pastes the prompt
├── popup.html         # Popup UI (opened from toolbar icon)
├── popup.js           # Popup logic — page capture, API calls, paste-and-open
├── sidepanel.html     # Side panel UI
├── panel.js           # Side panel logic — copy-and-open flow
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Troubleshooting

- **Popup doesn't show page info?** Refresh the page after installing, or check `chrome://extensions` for errors.
- **API error?** Double-check that your key is correct and has credits or balance.
- **Content is truncated?** Very long pages are trimmed to around 12,000 characters to stay within API limits.
- **Prompt not auto-pasting?** The content script needs the AI chat page to fully load. If it times out, the prompt is still on your clipboard — just paste manually.
- **"N/A" status on a page?** Browser internal pages (`chrome://`, `about:`, etc.) can't be read by extensions.
