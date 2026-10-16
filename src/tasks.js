import { callWs } from './api.js';

const FN = 'core_calendar_get_action_events_by_timesort';
const PAGE = 50; // Moodle's max limitnum for this function.
const LOOKBACK_DAYS = 14; // Keep recent overdue items visible.
const PRUNE_DAYS = 30;
const DAY = 86400000;

export async function fetchEvents() {
  const timesortfrom = Math.floor((Date.now() - LOOKBACK_DAYS * DAY) / 1000);
  const events = [];
  let via;
  let aftereventid;
  for (let page = 0; page < 10; page++) {
    const args = { timesortfrom, limitnum: PAGE, limittononsuspendedevents: true };
    if (aftereventid) args.aftereventid = aftereventid;
    const r = await callWs(FN, args);
    via = r.via;
    const batch = r.data?.events ?? [];
    events.push(...batch);
    if (batch.length < PAGE) break;
    aftereventid = batch[batch.length - 1].id;
  }
  return { events, via };
}

const decode = (s) => (s ? s.replace(/&amp;/g, '&') : s);

// Only ever open pages under the configured Moodle site. Anything else (other
// hosts, look-alike hosts, javascript:, data:) falls back to the Dashboard.
export function safeUrl(url, site) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && u.href.startsWith(`${site}/`)) return u.href;
  } catch {}
  return `${site}/my/`;
}

export function normalise(e, site) {
  return {
    id: String(e.id),
    name: e.activityname || e.name,
    course: e.course?.shortname || e.course?.fullname || '',
    courseName: e.course?.fullname || '',
    url: safeUrl(decode(e.url || e.action?.url || e.viewurl), site),
    due: (e.timesort || e.timestart) * 1000,
    type: e.modulename || e.eventtype || '',
    actionName: e.action?.name || '',
    actionable: Boolean(e.action?.actionable),
  };
}

// Moodle drops an action event from the timeline once the action is done
// (assignment submitted, quiz attempted). An event that vanishes from the
// timeline is therefore shown as cleared, not deleted.
export function merge(stored, fresh, now = Date.now()) {
  const next = {};
  const seen = new Set();
  for (const t of fresh) {
    seen.add(t.id);
    const old = stored[t.id];
    next[t.id] = { ...old, ...t, onTimeline: true, firstSeen: old?.firstSeen ?? now };
  }
  for (const [id, t] of Object.entries(stored)) {
    if (seen.has(id) || t.due < now - PRUNE_DAYS * DAY) continue;
    next[id] = { ...t, onTimeline: false };
  }
  return next;
}

export const isOpen = (t) => !t.done && t.onTimeline;

export function group(tasks, now = Date.now()) {
  const endOfToday = new Date(now).setHours(23, 59, 59, 999);
  const groups = { overdue: [], today: [], week: [], later: [], done: [] };
  for (const t of Object.values(tasks)) {
    if (!isOpen(t)) groups.done.push(t);
    else if (t.due < now) groups.overdue.push(t);
    else if (t.due <= endOfToday) groups.today.push(t);
    else if (t.due <= now + 7 * DAY) groups.week.push(t);
    else groups.later.push(t);
  }
  for (const list of Object.values(groups)) list.sort((a, b) => a.due - b.due);
  groups.done.reverse();
  return groups;
}

export function relative(due, now = Date.now()) {
  const diff = due - now;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const text = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  return diff < 0 ? `${text} overdue` : `in ${text}`;
}
