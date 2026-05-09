# IG Follower Remover

A Chrome extension to bulk-remove Instagram followers with auto-loading, filtering, selection control, and configurable speed.

Made by Jab1718


---

## Installation

1. Download and unzip the extension folder
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `ig-follower-remover` folder
5. The extension is now active on Instagram

To update after downloading new files: go to `chrome://extensions` and click the **↺ refresh** icon on the extension card.

---

## How to use

1. Go to any Instagram profile and open their **Followers** list
2. The panel appears automatically on the right side of the screen
3. Click **Scan** — the extension automatically scrolls the followers dialog to the bottom, loading all followers, then lists every account
4. Use filters, search, and checkboxes to select who to remove
5. Click **Remove selected**

> **Important:** The followers dialog must be open before clicking Scan. The extension needs the scrollable container inside the dialog to auto-load.

### Auto-load

When Scan is clicked, the extension:
- Scrolls the followers dialog continuously until no new accounts appear
- Updates the counter in real time: **⟳ Loading… (52)**
- Stops automatically when the list is fully loaded (~2.4s with no new items)
- Does a final scan pass to make sure nothing was missed

There is no need to scroll manually anymore.

### Selection

- Click any row to toggle selection
- **Select all** selects everyone currently visible (respects active filters and search)
- **Deselect all** appears when all visible rows are already selected
- Enabling the **Not following back** filter automatically selects all NFB accounts

### Filters

| Filter | What it shows |
|---|---|
| **Not following back** | Only accounts that do not follow you back (NFB badge) |
| **✓ Verified** | Only verified (blue tick) accounts |

Filters can be combined with each other and with the search bar.

### Badges

Each row shows badges based on data read from the Instagram DOM:

- `✓` — Verified account (blue)
- `NFB` — Not Following Back (red)
- `FB` — Following Back (green)

### Speed control

The **Delay between removals** slider sets how long the extension waits between each removal. Default is 2.0 seconds.

| Setting | Risk level |
|---|---|
| 0.5s – 1.0s | Higher chance of Instagram rate-limiting |
| 2.0s – 3.0s | Recommended — safe for most sessions |
| 4.0s – 8.0s | Very safe, slow |

### Stopping

Click **■ Stop removing** at any time to pause mid-run. Already-removed accounts stay removed.

---

## How it works

The extension injects a content script into all Instagram pages. When the followers dialog is open, it:

1. Finds the scrollable container inside the dialog and scrolls it to the bottom repeatedly until no new content loads
2. Uses a `MutationObserver` during scrolling to capture every new row as Instagram renders it
3. For each row, walks the DOM tree to extract username, avatar, full name, verified status, and follow-back status
4. When removing, fires a full chain of pointer and mouse events (`pointerdown → mousedown → pointerup → mouseup → click`) to trigger Instagram's React event handlers — a plain `.click()` is not enough
5. Waits for the confirmation popup and clicks the confirm **Remove** button automatically using Instagram's known button class `_a9-- _ap36 _a9-_`

---

## Files

```
ig-follower-remover/
├── manifest.json   Chrome extension manifest (Manifest V3)
├── content.js      Main logic — auto-loading, scanning, filtering, removing
├── panel.css       Panel UI styles
└── icon.png        Extension icon
```

---

## Limitations

- Works on Instagram's English interface (`Remove` button text). Other languages are not detected.
- NFB/Verified detection reads from the live DOM. If Instagram changes its HTML structure or class names, detection may break and the extension will need an update.
- Instagram may temporarily restrict actions if too many removals are made in a short session. Use a delay of 2s or more and take breaks between large runs.

---

## Disclaimer

This extension automates actions on Instagram. Use it responsibly and in accordance with [Instagram's Terms of Use](https://help.instagram.com/581066165581870). The authors are not responsible for any account restrictions that may result from its use.
