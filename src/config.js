// Default Moodle site. Users can point the extension at any Moodle 4.x site
// in Settings; the value must match that site's $CFG->wwwroot.
export const DEFAULT_SITE = 'https://ulearn.utp.edu.my';

export const DEFAULT_SETTINGS = {
  site: DEFAULT_SITE,
  // Reminder offsets in minutes before the due time.
  offsets: [4320, 1440, 360, 60],
  // How often to pull tasks from the site.
  syncMinutes: 60,
  // Badge counts open tasks due within this many days (plus overdue ones).
  badgeDays: 3,
};

export const OFFSET_CHOICES = [
  { minutes: 10080, label: '7 days' },
  { minutes: 4320, label: '3 days' },
  { minutes: 2880, label: '2 days' },
  { minutes: 1440, label: '1 day' },
  { minutes: 720, label: '12 hours' },
  { minutes: 360, label: '6 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 60, label: '1 hour' },
  { minutes: 30, label: '30 minutes' },
];

// Moodle page paths people tend to paste along with the site address.
const PAGE_SUFFIX = /\/(?:my|login|course|mod|user|calendar|admin|blocks|grade|message)(?:\/.*)?$|\/index\.php$/;

// Turn user input into a wwwroot-style address: https only, no query,
// no trailing slash, known Moodle page paths stripped. Throws on bad input.
export function normaliseSite(input) {
  let s = String(input ?? '').trim();
  if (!s) throw new Error('Enter your Moodle site address.');
  if (!/^[a-z]+:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try { u = new URL(s); } catch { throw new Error('That is not a valid web address.'); }
  if (u.protocol !== 'https:') throw new Error('The site must use https.');
  const path = u.pathname.replace(PAGE_SUFFIX, '').replace(/\/+$/, '');
  return `${u.origin}${path}`;
}

// Host permission pattern for a site, e.g. https://moodle.example.edu/*
export function originPattern(site) {
  return `${new URL(site).origin}/*`;
}
