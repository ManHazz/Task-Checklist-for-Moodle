import { OFFSET_CHOICES, DEFAULT_SITE, normaliseSite, originPattern } from './src/config.js';
import { getSettings } from './src/storage.js';

const $ = (id) => document.getElementById(id);
const send = (cmd, extra = {}) => chrome.runtime.sendMessage({ cmd, ...extra });

let savedSite = DEFAULT_SITE;

async function renderConnection() {
  const { auth, status } = await chrome.storage.local.get(['auth', 'status']);
  const conn = $('conn');
  const host = new URL(savedSite).host;
  if (auth?.token) {
    conn.textContent = `Connected to ${host} since ${new Date(auth.connectedAt).toLocaleString()}.`;
  } else {
    conn.textContent = `Not connected. Sync works only while you are logged in to ${host} in this browser.`;
  }
  if (status && !status.ok) conn.append(Object.assign(document.createElement('div'), { className: 'err', textContent: status.error }));
  $('connect').textContent = auth?.token ? 'Reconnect' : 'Connect';
  $('disconnect').disabled = !auth?.token;
}

async function init() {
  const s = await getSettings();
  savedSite = s.site;
  $('site').value = s.site;
  $('offsets').replaceChildren(...OFFSET_CHOICES.map(({ minutes, label }) => {
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', value: minutes, checked: s.offsets.includes(minutes) });
    const l = document.createElement('label');
    l.append(box, label);
    return l;
  }));
  $('syncMinutes').value = String(s.syncMinutes);
  $('badgeDays').value = String(s.badgeDays);
  renderConnection();
}

function showSaved(text, isError = false) {
  $('saved').textContent = text;
  $('saved').className = isError ? 'err' : '';
  if (!isError) setTimeout(() => { $('saved').textContent = ''; }, 2000);
}

$('save').addEventListener('click', async () => {
  let site;
  try { site = normaliseSite($('site').value); } catch (e) { return showSaved(e.message, true); }

  // Ask for access to a new site while the click still counts as a user gesture.
  if (site !== savedSite) {
    const granted = await chrome.permissions.request({ origins: [originPattern(site)] });
    if (!granted) return showSaved(`Access to ${new URL(site).host} was not allowed.`, true);
  }

  const offsets = [...document.querySelectorAll('#offsets input:checked')].map((b) => Number(b.value));
  const r = await send('saveSettings', {
    settings: { site, offsets, syncMinutes: Number($('syncMinutes').value), badgeDays: Number($('badgeDays').value) },
  });
  if (!r?.ok) return showSaved(r?.error || 'Save failed.', true);
  savedSite = site;
  $('site').value = site;
  showSaved('Saved.');
  renderConnection();
});

$('resetSite').addEventListener('click', () => { $('site').value = DEFAULT_SITE; });
$('connect').addEventListener('click', () => send('connect'));
$('disconnect').addEventListener('click', () => send('disconnect'));
chrome.storage.onChanged.addListener((_c, area) => { if (area === 'local') renderConnection(); });

init();
