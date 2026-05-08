# IG Follower Remover

A Chrome extension to bulk-remove Instagram followers with filtering, selection control, and configurable speed.


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
3. Click **Scan followers** — the extension reads all visible Remove buttons and lists the accounts
4. **Scroll down** in the followers dialog to load more, then **Rescan** to pick them up
5. Use the checkboxes to select who to remove, then click **Remove selected**

### Selection

- Click any row to toggle selection
- **Select all** selects everyone currently visible (respects active filters and search)
- **Deselect all** appears when all visible rows are selected

### Filters

| Filter | What it shows |
|---|---|
| **Not following back** | Only accounts that do not follow you back (NFB badge) |
| **✓ Verified** | Only verified (blue tick) accounts |

Filters can be combined. The search bar also works alongside them.

### Badges

Each row displays badges based on data read from the Instagram DOM:

- `✓` — Verified account (blue)
- `NFB` — Not Following Back (red)
- `FB` — Following Back (green)

> **Note:** Badges depend on Instagram rendering the Follow/Following button in each row. Scroll slowly through the followers list before scanning so Instagram has time to render all rows fully.

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

1. Scans the DOM for elements containing a **Remove** button
2. Walks up the DOM tree to find the associated username, avatar, full name, verified status, and follow-back status
3. When removing, fires a full chain of pointer and mouse events (`pointerdown → mousedown → pointerup → mouseup → click`) to trigger Instagram's React event handlers — a plain `.click()` is not enough
4. Waits for the confirmation popup and clicks the confirm **Remove** button automatically

A `MutationObserver` watches the followers dialog for new rows loaded as you scroll, and adds them to the list automatically.

---

## Files

```
ig-follower-remover/
├── manifest.json   Chrome extension manifest (Manifest V3)
├── content.js      Main logic — scanning, filtering, removing
├── panel.css       Panel UI styles
└── icon.png        Extension icon
```

---

## Limitations

- Works on Instagram's English interface (`Remove` button text). Other languages may not be detected.
- Instagram loads followers in batches — scroll down to load more before scanning.
- NFB/Verified detection reads from the live DOM. If Instagram changes its HTML structure or class names, detection may stop working and the extension will need an update.
- Instagram may temporarily limit actions if too many removals are made in a short session. Use a delay of 2s or more and take breaks between large runs.

---

## Disclaimer

This extension automates actions on Instagram. Use it responsibly and in accordance with [Instagram's Terms of Use](https://help.instagram.com/581066165581870). The authors are not responsible for any account restrictions that may result from its use.
