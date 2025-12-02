// src/utils/storage.js
export function readLS(key, defaultValue = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error('LS parse error', key, e);
    return defaultValue;
  }
}
export function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.error('LS write error', e); }
}
