<div align="center">

# Task Checklist for Moodle

**Every Moodle deadline in one checklist, with reminders on your schedule.**

[![Release](https://img.shields.io/github/v/release/ManHazz/Task-Checklist-for-Moodle?label=release)](https://github.com/ManHazz/Task-Checklist-for-Moodle/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Manifest V3](https://img.shields.io/badge/manifest-v3-2ea44f)
![Moodle 4.x](https://img.shields.io/badge/Moodle-4.x-f98012)
![Chromium](https://img.shields.io/badge/browsers-Chrome%20%7C%20Brave%20%7C%20Edge-555)

</div>

```
connect once  ->  sync in the background  ->  tick off tasks  ->  get reminded before it's too late
```

> Stop opening the Dashboard to check what's due. Let the deadlines come to you.

> [!WARNING]
> **Official source only.** Download this extension only from this repository's [Releases](https://github.com/ManHazz/Task-Checklist-for-Moodle/releases) page. Never install a copy someone sends you as a file. A modified copy could steal your Moodle login.

---

## Why

Moodle sends due-date alerts 7 days before, 30 minutes before, and after the deadline. Thirty minutes is not enough time for a lab report, and the alerts sometimes arrive late or not at all.

| Without the extension | With the extension |
|---|---|
| Open Moodle, find the Dashboard, scroll the Timeline | Click the toolbar icon from any tab |
| Alerts at 7 days, 30 minutes, and overdue | Reminders at the times **you** pick |
| Logged out after a timeout, so you see nothing | Keeps syncing after the site logs you out |
| No way to mark work as done before you submit | Tick tasks off yourself |

## What You Get

| Feature | What it does |
|---|---|
| **Checklist** | Open tasks grouped as Overdue, Today, Next 7 days and Later. Submitted tasks move to Done on their own. |
| **Custom reminders** | Desktop notifications at any mix of 7 days, 3 days, 2 days, 1 day, 12 h, 6 h, 3 h, 1 h or 30 min before. |
| **Toolbar badge** | Number of tasks due soon. A red `!` means it needs your attention. |
| **Background sync** | Checks the site every 30 minutes to 4 hours, even when no Moodle tab is open. |
| **Any Moodle site** | One-click setup for uLearn (UTP), or type any Moodle 4.x address. |

---

## Install

Works in Chromium browsers. Takes about one minute.

1. Download `task-checklist-for-moodle-vX.Y.Z.zip` from the [latest release](https://github.com/ManHazz/Task-Checklist-for-Moodle/releases/latest).
2. Unzip it into a folder you will keep. **The browser loads the extension from this folder, so do not move or delete it.**
3. Open your browser's extensions page:

   | Browser | Address |
   |---|---|
   | Chrome | `chrome://extensions` |
   | Brave | `brave://extensions` |
   | Edge | `edge://extensions` |

4. Turn on **Developer mode** and leave it on. Unpacked extensions stop working when it is off.
5. Click **Load unpacked** and choose the unzipped folder.
6. The setup page opens on its own. Continue below.

### First-time setup

1. **Choose your site.** Click **uLearn (UTP)**, or paste your Moodle address (for example `https://moodle.your-university.edu`). Click **Save**.
2. **Allow access.** The browser asks for permission to read that one site. Click **Allow**.
3. **Connect.** Click **Connect** and log in the way you normally do, including Microsoft or Google sign-in. The tab closes on its own when it is done.

Your tasks appear in the popup within a few seconds.

### Updating

Download the new release, replace the files in your folder, then click the reload icon on the extension's card in the extensions page. Your settings and checklist are kept.

---

## Start Using

| I want to... | Do this |
|---|---|
| See what's due | Click the toolbar icon. |
| Refresh now | Click **Sync** in the popup. |
| Mark a task done | Tick its checkbox. Untick to undo. |
| Open a task on Moodle | Click its name. |
| Change reminder times | Popup > **Settings** > *Remind me before each deadline*. |
| Switch to another Moodle site | **Settings** > *Moodle site* > enter the address > **Save**. |
| Sign out | **Settings** > **Disconnect**. To revoke access fully, also remove the key on your Moodle site under *Preferences > Security keys*. |

### What the badge means

| Badge | Meaning |
|---|---|
| *(empty)* | Nothing due soon. |
| `3` | 3 open tasks are due within your badge window (default 3 days), including overdue ones. |
| red `!` | Setup is needed, or the connection expired. Open the popup to fix it. |

---

## How It Works

**Connect (token mode).** The extension opens Moodle's mobile-app launch page (`/admin/tool/mobile/launch.php`), the same sign-in flow the official Moodle app uses. Moodle returns a web service token. Sync then calls `/webservice/rest/server.php` with that token, so it keeps working after your browser session expires.

**Fallback (session mode).** Without a token, the extension uses your logged-in browser session and calls `/lib/ajax/service.php`, the endpoint the Dashboard Timeline block uses.

**Data source.** Both modes call `core_calendar_get_action_events_by_timesort`, so the checklist matches your Dashboard Timeline exactly. When you submit an assignment, Moodle removes it from that list, and the extension moves it to Done.

---

## Privacy and Security

- **Your data stays in your browser.** The extension talks only to the Moodle site you chose. It has no server and no analytics.
- **Your token stays on your computer.** It is stored in the browser's extension storage and never synced or sent anywhere else.
- **No password is stored.** You sign in on your Moodle site's own login page.
- **Minimal permissions.** `storage`, `alarms`, `notifications`, `webRequest` (only to catch the sign-in redirect), and access to your one Moodle site. No site access is requested at install.
- **Hardening.** Moodle's extra `privatetoken` is discarded. Sign-in attempts expire after 10 minutes. Task links open only if they point to your chosen site.

---

## Platform Support

| Platform | Status |
|---|---|
| Brave | Tested |
| Chrome, Edge, other Chromium browsers | Expected to work (same engine) |
| Firefox | Planned |
| Phones and the Moodle mobile app | Planned |
| Moodle 4.x with the mobile app service enabled | Supported |
| Moodle sites with the mobile app turned off | Session mode only (stay logged in) |

---

## What's New

### v1.0.0
- First public release.
- First-run setup screen with a one-click **uLearn (UTP)** preset. No site is built in.
- Works with any Moodle 4.x site.
- Token sign-in that survives session timeouts, with a browser-session fallback.
- Checklist, custom reminders and toolbar badge.

---

## What's Inside

```
Task-Checklist-for-Moodle/
├── manifest.json        Extension manifest (MV3)
├── background.js        Service worker: sync, alarms, badge, messages
├── popup.html / .js     Toolbar popup (the checklist)
├── options.html / .js   Settings and first-run setup
├── ui.css               Shared styles, light and dark
├── src/
│   ├── config.js        Presets, defaults, site address checks
│   ├── auth.js          Connect flow and token check
│   ├── api.js           Moodle web service calls (token, then session)
│   ├── tasks.js         Fetch, normalise, merge and group tasks
│   ├── reminders.js     Reminder notifications
│   ├── storage.js       Settings and storage helpers
│   └── md5.js           Site check for the sign-in token
├── icons/
└── test/run.mjs         Unit tests
```

---

## Development

No build step and no dependencies.

```
node test/run.mjs
```

Requires Node 22 or later. After you edit a file, click the reload icon on the extension's card.

**Adding your university as a preset:** add an entry to `PRESETS` in `src/config.js` and open a pull request.

---

## Disclaimer

This is an unofficial, student-made project. It is not affiliated with, endorsed by, or supported by Universiti Teknologi PETRONAS or Moodle Pty Ltd. Moodle is a registered trademark of Moodle Pty Ltd. "Moodle" and "uLearn" only describe the sites this extension works with.

## License

[MIT](LICENSE) © 2026 ManHazz
