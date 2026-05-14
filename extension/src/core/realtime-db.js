import { get, set } from './storage.js';

const CONFIG_KEY = 'realtime:config';
const CURRENT_EMAIL_KEY = 'realtime:currentEmail';
const EMAIL_DATA_PREFIX = 'realtime:emailData:';
const RESTORED_PREFIX = 'realtime:restored:';
const LAST_SYNC_PREFIX = 'realtime:lastSync:';

function nowIso() {
  return new Date().toISOString();
}

function normalizeDbUrl(dbUrl) {
  return String(dbUrl || '').trim().replace(/\/+$/, '');
}

function emailDataKey(key) {
  return `${EMAIL_DATA_PREFIX}${key}`;
}

function restoredKey(key) {
  return `${RESTORED_PREFIX}${key}`;
}

function lastSyncKey(key) {
  return `${LAST_SYNC_PREFIX}${key}`;
}

function buildRemoteUrl(path, config) {
  const dbUrl = normalizeDbUrl(config?.dbUrl);
  const secret = String(config?.secret || '').trim();
  if (!dbUrl || !secret) throw new Error('Thiếu cấu hình Realtime Database.');
  return `${dbUrl}/${path}.json?auth=${encodeURIComponent(secret)}`;
}

async function fetchJson(path, options = {}) {
  const config = await getRealtimeConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(buildRemoteUrl(path, config), {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      return { ok: false, error: data?.error || `HTTP ${response.status}` };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Không gọi được Realtime Database.' };
  } finally {
    clearTimeout(timer);
  }
}

export function sanitizeEmailKey(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'unknown';
}

export async function getRealtimeConfig() {
  const config = await get(CONFIG_KEY, { dbUrl: '', secret: '', updatedAt: null });
  return {
    dbUrl: normalizeDbUrl(config.dbUrl),
    secret: config.secret || '',
    updatedAt: config.updatedAt || null
  };
}

export async function setRealtimeConfig(config) {
  const value = {
    dbUrl: normalizeDbUrl(config?.dbUrl),
    secret: String(config?.secret || '').trim(),
    updatedAt: nowIso()
  };
  await set(CONFIG_KEY, value);
  return { ...value, secret: value.secret ? '***' : '' };
}

export async function getCurrentEmail() {
  return get(CURRENT_EMAIL_KEY, null);
}

export async function getCurrentEmailData() {
  const currentEmail = await getCurrentEmail();
  if (!currentEmail?.key) return { currentEmail: null, data: null, sync: null };
  const data = await get(emailDataKey(currentEmail.key), null);
  const sync = await get(lastSyncKey(currentEmail.key), null);
  return { currentEmail, data, sync };
}

export async function setCurrentEmailFromAccount(account) {
  if (!account?.email) return { currentEmail: null, data: null, sync: { ok: false, error: 'Không có email.' } };

  const key = sanitizeEmailKey(account.email);
  const checkedAt = nowIso();
  const currentEmail = {
    email: account.email,
    key,
    name: account.name || '',
    id: account.id || '',
    imageUrl: account.imageUrl || '',
    checkedAt
  };

  await set(CURRENT_EMAIL_KEY, currentEmail);

  const existing = await get(emailDataKey(key), null);
  let localData = {
    email: account.email,
    key,
    name: account.name || '',
    id: account.id || '',
    imageUrl: account.imageUrl || '',
    data: {},
    pages: [],
    createdAt: existing?.createdAt || checkedAt,
    updatedAt: checkedAt,
    ...(existing || {})
  };

  localData = {
    ...localData,
    email: account.email,
    key,
    name: account.name || localData.name || '',
    id: account.id || localData.id || '',
    imageUrl: account.imageUrl || localData.imageUrl || '',
    updatedAt: checkedAt
  };

  await set(emailDataKey(key), localData);
  const sync = await restoreThenSyncEmail(key, localData);
  const data = await get(emailDataKey(key), localData);
  return { currentEmail, data, sync };
}

async function restoreThenSyncEmail(key, localData) {
  const config = await getRealtimeConfig();
  if (!config.dbUrl || !config.secret) {
    const sync = { ok: false, skipped: true, error: 'Thiếu cấu hình Realtime Database.', syncedAt: nowIso() };
    await set(lastSyncKey(key), sync);
    return sync;
  }

  let data = localData;
  let restored = false;
  const restoreMarker = await get(restoredKey(key), null);
  if (!restoreMarker) {
    const remote = await fetchJson(`emails/${key}`);
    if (remote.ok && remote.data && !hasMeaningfulLocalData(localData)) {
      data = { ...remote.data, key, updatedAt: nowIso() };
      await set(emailDataKey(key), data);
      restored = true;
    }
    await set(restoredKey(key), nowIso());
  }

  const put = await fetchJson(`emails/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ ...data, key, updatedAt: nowIso() })
  });

  const sync = put.ok
    ? { ok: true, restored, remoteUpdated: true, syncedAt: nowIso() }
    : { ok: false, restored, remoteUpdated: false, error: put.error, syncedAt: nowIso() };
  await set(lastSyncKey(key), sync);
  return sync;
}

function hasMeaningfulLocalData(data) {
  return Boolean(
    Object.keys(data?.data || {}).length ||
    (Array.isArray(data?.pages) && data.pages.length)
  );
}

export async function syncCurrentEmailData(patch = {}) {
  const currentEmail = await getCurrentEmail();
  if (!currentEmail?.key) return { ok: false, error: 'Chưa có email hiện tại.' };

  const existing = await get(emailDataKey(currentEmail.key), {});
  const next = {
    ...existing,
    ...patch,
    key: currentEmail.key,
    email: currentEmail.email,
    updatedAt: nowIso()
  };
  await set(emailDataKey(currentEmail.key), next);
  return restoreThenSyncEmail(currentEmail.key, next);
}

export async function listRemoteEmails() {
  const result = await fetchJson('emails');
  if (!result.ok) return result;

  const emails = result.data || {};
  const items = Object.entries(emails).map(([key, value]) => ({
    key,
    email: value?.email || '',
    name: value?.name || '',
    updatedAt: value?.updatedAt || null
  }));

  return { ok: true, count: items.length, items };
}

export async function getRemoteEmailDetails(key) {
  if (!key) return { ok: false, error: 'Thiếu email key.' };
  return fetchJson(`emails/${encodeURIComponent(key)}`);
}
