// Moodle web service calls. Token REST endpoint first; browser-session AJAX
// endpoint (the one the Dashboard Timeline block uses) as fallback.
import { get, remove, getSite } from './storage.js';

export class AuthError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind; // 'token' | 'session'
  }
}

// Moodle REST expects PHP-style nested form keys: args[key][0]=...
export function flatten(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') flatten(v, key, out);
    else out.append(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return out;
}

async function callWithToken(site, token, fn, args) {
  const body = flatten(args);
  body.set('wstoken', token);
  body.set('wsfunction', fn);
  body.set('moodlewsrestformat', 'json');
  const res = await fetch(`${site}/webservice/rest/server.php`, { method: 'POST', body, credentials: 'omit' });
  if (!res.ok) throw new Error(`Moodle returned HTTP ${res.status}`);
  const data = await res.json();
  if (data?.exception) {
    if (data.errorcode === 'invalidtoken') throw new AuthError(data.message, 'token');
    throw new Error(data.message || data.errorcode);
  }
  return data;
}

// { site, key } so a site change never reuses the old sesskey.
let cachedSesskey = null;

async function fetchSesskey(site) {
  const res = await fetch(`${site}/my/`, { credentials: 'include' });
  const html = await res.text();
  const m = html.match(/"sesskey":"([^"]+)"/);
  if (!m || res.url.includes('/login/')) throw new AuthError('Not logged in to Moodle.', 'session');
  return m[1];
}

const SESSION_ERRORS = ['servicerequireslogin', 'invalidsesskey', 'requireloginerror', 'sitepolicynotagreed'];

async function callWithSession(site, fn, args, retried = false) {
  if (cachedSesskey?.site !== site) cachedSesskey = { site, key: await fetchSesskey(site) };
  const url = `${site}/lib/ajax/service.php?sesskey=${encodeURIComponent(cachedSesskey.key)}&info=${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ index: 0, methodname: fn, args }]),
  });
  if (!res.ok) throw new Error(`Moodle returned HTTP ${res.status}`);
  const json = await res.json();
  const r = Array.isArray(json) ? json[0] : json;
  if (r.error) {
    const code = r.exception?.errorcode ?? r.errorcode;
    if (SESSION_ERRORS.includes(code)) {
      cachedSesskey = null;
      if (!retried) return callWithSession(site, fn, args, true);
      throw new AuthError('Moodle session expired.', 'session');
    }
    throw new Error(r.exception?.message || r.error || code);
  }
  return r.data;
}

// Returns { data, via: 'token' | 'session' }.
export async function callWs(fn, args) {
  const site = await getSite();
  if (!site) throw new Error('Choose your Moodle site in Settings.');
  const auth = await get('auth');
  // A token is only valid for the site that issued it.
  if (auth?.token && (!auth.site || auth.site === site)) {
    try {
      return { data: await callWithToken(site, auth.token, fn, args), via: 'token' };
    } catch (e) {
      if (!(e instanceof AuthError)) throw e;
      // Token revoked or expired: drop it and try the browser session.
      await remove('auth');
    }
  }
  return { data: await callWithSession(site, fn, args), via: 'session' };
}
