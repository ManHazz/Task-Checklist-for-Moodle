# Task Checklist for Moodle

A browser extension that lists every due task from your Moodle site as a checklist and reminds you at the times you choose. It was built for **uLearn** (Universiti Teknologi PETRONAS), but works with any Moodle 4.x site that has the Moodle app enabled.

> **Unofficial project.** It is not affiliated with, endorsed by, or supported by Universiti Teknologi PETRONAS or Moodle Pty Ltd. Moodle is a registered trademark of Moodle Pty Ltd; "Moodle" and "uLearn" only describe the sites this extension works with.

## Why
Moodle's own due-date alerts arrive 7 days before, 30 minutes before, and after the deadline, and sometimes late or not at all. This extension gives you:

- **A checklist** of open tasks, grouped as Overdue, Today, Next 7 days and Later. Tick tasks yourself; tasks you submit move to Done on their own.
- **Reminders at times you pick**, for example 3 days, 1 day, 6 hours and 1 hour before.
- **A toolbar badge** with the number of tasks due soon.
- **Sync without opening the site.** After a one-time Connect, sync keeps working even when the site logs your browser out.

## Install (developer mode)
Works in Chrome, Edge, Brave and other Chromium browsers.

1. Download or clone this repository.
2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose this folder.
5. Click the extension icon, then **Connect**, and log in as usual.

### Other universities
Open **Settings**, enter your Moodle site address (for example `https://moodle.example.edu`), and click **Save**. The browser asks you to allow access to that site. Then click **Connect**.

## How it works
- **Token mode (after Connect).** The extension opens Moodle's mobile-app launch page (`/admin/tool/mobile/launch.php`), the same login flow the official Moodle app uses. It works with SSO such as Microsoft 365. Moodle returns a web service token, which the extension keeps in `chrome.storage.local`. Sync calls `/webservice/rest/server.php`.
- **Session mode (fallback).** Without a token, the extension uses your logged-in browser session and calls `/lib/ajax/service.php`, the endpoint the Dashboard Timeline block uses.

Both modes call `core_calendar_get_action_events_by_timesort`, so the list matches the Dashboard Timeline.

## Privacy and security
- No data leaves your browser. The extension talks only to the Moodle site you configured. There is no server and there are no analytics.
- The token is stored only on your computer. **Disconnect** forgets it. To revoke it fully, go to your Moodle site, then **Preferences > Security keys**.
- The extension does not keep Moodle's `privatetoken`. Login attempts expire after 10 minutes. Links only open if they point to your configured site.
- Permissions: `storage`, `alarms`, `notifications`, `webRequest` (to catch the login redirect), and access to your Moodle site only.

## Development
Run the unit tests (Node 22 or later):
```
node test/run.mjs
```

There is no build step. Edit the files, then click the reload icon on `chrome://extensions`.

| Path | Purpose |
|------|---------|
| `background.js` | Service worker: sync, alarms, badge, messages |
| `src/auth.js` | Connect flow and token check |
| `src/api.js` | Moodle web service calls (token, then session) |
| `src/tasks.js` | Fetch, normalise, merge and group tasks |
| `src/reminders.js` | Reminder notifications |
| `popup.*`, `options.*` | User interface |

## License
[MIT](LICENSE)
