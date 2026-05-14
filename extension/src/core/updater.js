// CORE: updater — kiểm tra và thông báo update
// URL updates.xml lấy từ manifest.update_url (Chrome inject sẵn khi dùng update_url)
// Dùng thủ công: import { checkForUpdates, getUpdateStatus } from '../core/updater.js'

import { log, warn, err } from './logger.js';
import { get, set } from './storage.js';

const TAG = 'updater';
const STORAGE_KEY = 'core:update_status';

// Parse XML trả về version string hoặc null
function parseVersion(xmlText) {
  try {
    // Không dùng DOMParser vì Service Worker (background.js) không hỗ trợ
    const match = xmlText.match(/<updatecheck[\s\S]+?version=['"]([^'"]+)['"]/);
    if (match && match[1]) {
      return match[1];
    }
    
    warn(TAG, 'updatecheck version not found in XML using regex. Content snippet:', xmlText.substring(0, 100));
    return null;
  } catch (e) {
    err(TAG, 'parse XML failed', e);
    return null;
  }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForUpdates() {
  const manifest = chrome.runtime.getManifest();
  const updateUrl = manifest.update_url;

  if (!updateUrl) {
    err(TAG, 'update_url not set in manifest');
    return { hasUpdate: false, currentVersion: manifest.version, latestVersion: null };
  }

  try {
    const res = await fetch(updateUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const latestVersion = parseVersion(xml);

    if (!latestVersion) throw new Error('Could not parse version from XML');

    const currentVersion = manifest.version;
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    const status = { hasUpdate, currentVersion, latestVersion, checkedAt: Date.now() };
    await set(STORAGE_KEY, status);
    log(TAG, `current=${currentVersion} latest=${latestVersion} hasUpdate=${hasUpdate}`);

    if (hasUpdate) {
      chrome.notifications.create('ext-update', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.svg'),
        title: 'Có phiên bản mới!',
        message: `Cập nhật từ v${currentVersion} lên v${latestVersion}. Vào chrome://extensions để cập nhật.`,
      });
    }

    return status;
  } catch (e) {
    err(TAG, 'checkForUpdates failed', e);
    return { hasUpdate: false, error: e.message };
  }
}

export async function getUpdateStatus() {
  return await get(STORAGE_KEY, { hasUpdate: false, checkedAt: null });
}
