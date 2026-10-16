// Token login through Moodle's mobile-app launch flow. Same flow the official
// Moodle app uses, so it works with SSO (e.g. UTP's Office 365) and gives a
// long-lived web service token that survives browser session timeouts.
import { md5 } from './md5.js';
import { get, set, remove, getSite } from './storage.js';

export const LAUNCH_PATH = '/admin/tool/mobile/launch.php';

function randomPassport() {
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => n.toString(36)).join('');
}

export async function startConnect() {
  const site = await getSite();
  if (!site) {
    chrome.runtime.openOptionsPage();
    return;
  }
  const passport = randomPassport();
  // Write the pending state before opening the tab: an already logged-in user
  // is redirected almost instantly.
  await chrome.storage.session.set({ pendingAuth: { passport, site, started: Date.now() } });
  const url = `${site}${LAUNCH_PATH}?service=moodle_mobile_app&passport=${passport}&urlscheme=moodlemobile`;
  await chrome.tabs.create({ url });
}

// Parse `moodlemobile://token=<base64(sitehash:::token[:::privatetoken])>`.
// The privatetoken is dropped on purpose: it can mint website login keys
// and the extension never needs it.
export function parseAppRedirect(url) {
  const m = url.match(/token=([^&#]+)/);
  if (!m) return null;
  const [sitehash, token] = atob(decodeURIComponent(m[1])).split(':::');
  if (!sitehash || !token) return null;
  return { sitehash, token };
}

export const PENDING_TTL_MS = 10 * 60 * 1000;

export function isPendingFresh(pending, now = Date.now()) {
  return Boolean(pending?.passport) && now - pending.started <= PENDING_TTL_MS;
}

export function siteHashMatches(sitehash, passport, site) {
  return [site, `${site}/`].some((root) => md5(root + passport) === sitehash);
}

// Returns true when a token was stored. Throws on a bad or forged redirect.
export async function handleAppRedirect(url, tabId) {
  if (!url?.startsWith('moodlemobile://')) return false;
  const { pendingAuth } = await chrome.storage.session.get('pendingAuth');
  if (!pendingAuth) return false;
  await chrome.storage.session.remove('pendingAuth');
  if (tabId >= 0) chrome.tabs.remove(tabId).catch(() => {});

  if (!isPendingFresh(pendingAuth)) throw new Error('Connect took longer than 10 minutes. Click Connect again.');
  if (pendingAuth.site !== (await getSite())) throw new Error('Site changed during Connect. Click Connect again.');
  const parsed = parseAppRedirect(url);
  if (!parsed) throw new Error('The site did not return a token.');
  if (!siteHashMatches(parsed.sitehash, pendingAuth.passport, pendingAuth.site)) {
    throw new Error('Site check failed. Token rejected.');
  }
  await set({ auth: { token: parsed.token, site: pendingAuth.site, connectedAt: Date.now() } });
  return true;
}

// Remove the privatetoken that version 0.1.0 stored.
export async function scrubAuth() {
  const auth = await get('auth');
  if (auth && 'privatetoken' in auth) {
    const { privatetoken, ...rest } = auth;
    await set({ auth: rest });
  }
}

// Forget the token locally. The user revokes it on the site under
// Preferences > Security keys.
export function disconnect() {
  return remove('auth');
}
