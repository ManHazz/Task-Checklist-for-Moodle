import { DEFAULT_SETTINGS } from './config.js';

// Everything lives in storage.local. Never storage.sync: the token is a credential.
export async function get(key, fallback) {
  const r = await chrome.storage.local.get(key);
  return r[key] ?? fallback;
}

export function set(obj) {
  return chrome.storage.local.set(obj);
}

export function remove(keys) {
  return chrome.storage.local.remove(keys);
}

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await get('settings', {})) };
}

export async function getSite() {
  return (await getSettings()).site;
}
