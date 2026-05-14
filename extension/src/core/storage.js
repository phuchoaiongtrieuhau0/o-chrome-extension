// CORE: storage — wrapper chrome.storage với namespace theo feature
// Dùng: import { get, set, remove, clear } from '../core/storage.js'
// Key convention: "featureName:keyName"

import { err } from './logger.js';

const TAG = 'storage';

export async function get(key, defaultValue = null) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? defaultValue;
  } catch (e) {
    err(TAG, 'get failed', key, e);
    return defaultValue;
  }
}

export async function set(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (e) {
    err(TAG, 'set failed', key, e);
  }
}

export async function remove(key) {
  try {
    await chrome.storage.local.remove(key);
  } catch (e) {
    err(TAG, 'remove failed', key, e);
  }
}

export async function getSync(key, defaultValue = null) {
  try {
    const result = await chrome.storage.sync.get(key);
    return result[key] ?? defaultValue;
  } catch (e) {
    err(TAG, 'getSync failed', key, e);
    return defaultValue;
  }
}

export async function setSync(key, value) {
  try {
    await chrome.storage.sync.set({ [key]: value });
  } catch (e) {
    err(TAG, 'setSync failed', key, e);
  }
}
