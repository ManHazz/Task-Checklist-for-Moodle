import { normaliseSite, originPattern, siteName } from './src/config.js';
import { get, set, remove, getSettings, getSite } from './src/storage.js';
import { AuthError } from './src/api.js';
import { startConnect, handleAppRedirect, disconnect, scrubAuth, LAUNCH_PATH } from './src/auth.js';
import { fetchEvents, normalise, merge, isOpen, safeUrl } from './src/tasks.js';
import { checkReminders } from './src/reminders.js';

const REMIND_MINUTES = 5;

async function scheduleAlarms() {
  const { syncMinutes } = await getSettings();
  await chrome.alarms.create('sync', { delayInMinutes: 0.1, periodInMinutes: syncMinutes });
  await chrome.alarms.create('remind', { periodInMinutes: REMIND_MINUTES });
}

chrome.runtime.onInstalled.addListener(async () => {
  await scrubAuth();
  await scheduleAlarms();
  // First run (or upgrade from a version with a built-in site): open setup.
  if (!(await getSite())) chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(scheduleAlarms);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync') sync();
  else if (alarm.name === 'remind') checkReminders().then(updateBadge);
});

let syncing = null;
function sync() {
  syncing ??= doSync().finally(() => { syncing = null; });
  return syncing;
}

async function doSync() {
  const now = Date.now();
  const site = await getSite();
  if (!site || !(await chrome.permissions.contains({ origins: [originPattern(site)] }))) {
    const error = site ? `Allow access to ${new URL(site).host} in Settings.` : 'Choose your Moodle site in Settings.';
    await set({ status: { ok: false, needsSetup: true, error, at: now } });
    await updateBadge();
    return;
  }
  try {
    const { events, via } = await fetchEvents();
    const tasks = merge(await get('tasks', {}), events.map((e) => normalise(e, site)), now);
    await set({ tasks, status: { ok: true, via, at: now } });
    await checkReminders(now);
  } catch (e) {
    const needsLogin = e instanceof AuthError;
    await set({ status: { ok: false, needsLogin, error: e.message, at: now } });
    if (needsLogin) await notifyOnce('login', 'Task checklist cannot sync', 'Open the extension and click Connect, or log in to your Moodle site.');
  }
  await updateBadge();
}

// Only nag once per login problem, not on every sync.
async function notifyOnce(key, title, message) {
  const shown = await get('nagged', {});
  if (shown[key]) return;
  chrome.notifications.create(`nag:${key}`, { type: 'basic', iconUrl: 'icons/icon128.png', title, message });
  await set({ nagged: { ...shown, [key]: Date.now() } });
}

async function updateBadge() {
  const [status, tasks, { badgeDays }] = await Promise.all([get('status'), get('tasks', {}), getSettings()]);
  if (status && !status.ok && (status.needsLogin || status.needsSetup)) {
    await chrome.action.setBadgeBackgroundColor({ color: '#c62828' });
    await chrome.action.setBadgeText({ text: '!' });
    return;
  }
  if (status?.ok) await set({ nagged: {} });
  const horizon = Date.now() + badgeDays * 86400000;
  const n = Object.values(tasks).filter((t) => isOpen(t) && t.due <= horizon).length;
  await chrome.action.setBadgeBackgroundColor({ color: '#1565c0' });
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
}

async function onAppRedirect(url, tabId) {
  try {
    if (await handleAppRedirect(url, tabId)) {
      chrome.notifications.create('connected', {
        type: 'basic', iconUrl: 'icons/icon128.png',
        title: `Connected to ${siteName(await getSite())}`,
        message: 'Tasks now sync in the background, even after the site logs you out.',
      });
      await sync();
    }
  } catch (e) {
    await set({ status: { ok: false, needsLogin: true, error: e.message, at: Date.now() } });
    await updateBadge();
  }
}

// launch.php answers desktop browsers with `Location: moodlemobile://token=...`.
// The event only fires for hosts the extension has permission for; the
// check below narrows it to the configured site.
chrome.webRequest.onBeforeRedirect.addListener(
  async (d) => {
    if (!d.redirectUrl?.startsWith('moodlemobile://')) return;
    const site = await getSite();
    if (!site || !d.url.startsWith(`${site}${LAUNCH_PATH}`)) return;
    onAppRedirect(d.redirectUrl, d.tabId);
  },
  { urls: [`https://*/*${LAUNCH_PATH}*`] },
);

chrome.notifications.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  if (id.startsWith('task:')) {
    const t = (await get('tasks', {}))[id.slice(5)];
    const site = await getSite();
    if (t && site) chrome.tabs.create({ url: safeUrl(t.url, site) });
  } else if (id.startsWith('nag:')) {
    chrome.runtime.openOptionsPage();
  }
});

async function setDone(id, done) {
  const tasks = await get('tasks', {});
  if (!tasks[id]) return;
  tasks[id].done = done;
  await set({ tasks });
  await updateBadge();
}

// Switching sites drops everything tied to the old one: token, tasks,
// reminder history, and the optional host permission.
async function switchSite(oldSite, newSite) {
  if (!(await chrome.permissions.contains({ origins: [originPattern(newSite)] }))) {
    throw new Error(`Permission for ${new URL(newSite).host} was not granted.`);
  }
  await remove(['auth', 'tasks', 'sent', 'status', 'nagged']);
  if (oldSite && new URL(oldSite).origin !== new URL(newSite).origin) {
    await chrome.permissions.remove({ origins: [originPattern(oldSite)] }).catch(() => {});
  }
}

async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  next.site = normaliseSite(next.site);
  const siteChanged = next.site !== current.site;
  if (siteChanged) await switchSite(current.site, next.site);
  await set({ settings: next });
  await scheduleAlarms();
  if (siteChanged) await sync();
  else await updateBadge();
}

const handlers = {
  sync: () => sync(),
  connect: () => startConnect(),
  disconnect: async () => { await disconnect(); await sync(); },
  setDone: ({ id, done }) => setDone(id, done),
  saveSettings: ({ settings }) => saveSettings(settings),
};

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const h = handlers[msg?.cmd];
  if (!h) return false;
  Promise.resolve(h(msg)).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: e.message }));
  return true;
});
