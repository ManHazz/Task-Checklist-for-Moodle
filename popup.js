import { group, relative, safeUrl } from './src/tasks.js';
import { getSite } from './src/storage.js';
import { DEFAULT_SITE } from './src/config.js';

const $ = (id) => document.getElementById(id);
const send = (cmd, extra = {}) => chrome.runtime.sendMessage({ cmd, ...extra });

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

let site = '';

function item(t, now) {
  const done = t.done || !t.onTimeline;
  const box = el('input', { type: 'checkbox', checked: done, disabled: !t.onTimeline, title: t.onTimeline ? 'Mark done' : 'Cleared on the site' });
  box.addEventListener('change', () => send('setDone', { id: t.id, done: box.checked }));

  const soon = t.due - now < 86400000;
  const dueCls = t.due < now ? 'due overdue' : soon ? 'due soon' : 'due';
  const meta = el('div', { className: 'meta' },
    `${t.course} · `,
    el('span', { className: dueCls, textContent: done ? new Date(t.due).toLocaleDateString() : relative(t.due, now) }),
    !t.onTimeline ? ' · cleared on the site' : null);

  return el('li', { className: done ? 'done' : '' }, box,
    el('div', { className: 'body' },
      el('a', { className: 'name', href: safeUrl(t.url, site), target: '_blank', textContent: t.name, title: `${t.name}\n${new Date(t.due).toLocaleString()}` }),
      meta));
}

function section(title, tasks, now, cls = '') {
  if (!tasks.length) return null;
  return el('section', {}, el('h2', { className: cls, textContent: `${title} (${tasks.length})` }), el('ul', {}, ...tasks.map((t) => item(t, now))));
}

async function render() {
  const { tasks = {}, status, auth } = await chrome.storage.local.get(['tasks', 'status', 'auth']);
  site = await getSite();
  const host = new URL(site).host;
  $('title').textContent = host === new URL(DEFAULT_SITE).host ? 'uLearn tasks' : `${host} tasks`;
  const now = Date.now();
  const g = group(tasks, now);
  const list = $('list');
  list.replaceChildren();

  const parts = [
    section('Overdue', g.overdue, now, 'overdue'),
    section('Today', g.today, now),
    section('Next 7 days', g.week, now),
    section('Later', g.later, now),
  ].filter(Boolean);
  if (parts.length) list.append(...parts);
  else list.append(el('div', { className: 'empty muted', textContent: status?.ok ? 'Nothing due. Nice.' : 'No tasks yet.' }));

  if (g.done.length) {
    list.append(el('details', {}, el('summary', { textContent: `Done (${g.done.length})` }), el('ul', {}, ...g.done.map((t) => item(t, now)))));
  }

  const banner = $('banner');
  banner.replaceChildren();
  if (!auth?.token) {
    const btn = el('button', { className: 'primary', textContent: 'Connect' });
    btn.addEventListener('click', () => send('connect'));
    const msg = status?.needsLogin
      ? `${host} session expired. Connect once so sync keeps working after logouts.`
      : `Connect once to keep syncing after ${host} logs you out.`;
    banner.append(el('div', { className: status?.needsLogin ? 'err' : 'muted', textContent: msg }), el('div', { style: 'margin-top:6px' }, btn));
    banner.hidden = false;
  } else if (status && !status.ok) {
    banner.append(el('div', { className: 'err', textContent: status.error }));
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }

  $('status').textContent = status?.at
    ? `${status.ok ? 'Synced' : 'Failed'} ${new Date(status.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${status.via ? ` via ${status.via}` : ''}`
    : 'Not synced yet';
}

$('sync').addEventListener('click', async () => {
  $('sync').disabled = true;
  $('sync').textContent = 'Syncing…';
  await send('sync');
  $('sync').disabled = false;
  $('sync').textContent = 'Sync';
});

chrome.storage.onChanged.addListener((_c, area) => { if (area === 'local') render(); });
render();
