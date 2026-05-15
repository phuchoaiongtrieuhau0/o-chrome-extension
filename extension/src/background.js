// SERVICE WORKER — entry point
// Import thêm feature: thêm 1 dòng import + 1 dòng gọi register()

import { log, err } from './core/logger.js';
import { initMessageRouter } from './core/messaging.js';
import { checkForUpdates } from './core/updater.js';
import {
  appendSelectorCollection,
  getCurrentEmailData,
  getRealtimeConfig,
  getRemoteEmailDetails,
  listRemoteEmails,
  setCurrentEmailFromAccount,
  setRealtimeConfig,
  syncCurrentEmailData
} from './core/realtime-db.js';
import { getSelectorConfig, saveSelectorConfig } from './core/storage.js';

// ── Import features ──────────────────────────────────
import { register as registerHelloWorld } from './features/hello-world/index.js';
// import { register as registerXxx } from './features/xxx/index.js';  ← thêm vào đây
// ─────────────────────────────────────────────────────

const TAG = 'background';

async function initFeatures() {
  // Clear cũ để tránh lỗi "Duplicate ID" khi Service Worker khởi động lại
  chrome.contextMenus.removeAll();
  
  await registerHelloWorld();
  // await registerXxx();  ← gọi thêm vào đây
}

// Khởi động
(async () => {
  try {
    log(TAG, `starting v${chrome.runtime.getManifest().version}...`);
    initMessageRouter();
    await initFeatures();

    // Check update mỗi 6 giờ
    chrome.alarms.create('check-update', { periodInMinutes: 360 });
    log(TAG, 'ready ✓');
  } catch (e) {
    err(TAG, 'init failed', e);
  }
})();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'check-update') {
    await checkForUpdates();
  }
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  log(TAG, 'onInstalled', reason);
  if (reason === 'install') {
    await checkForUpdates();
  }
});

// Lắng nghe message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'WAKE_UP') {
    log(TAG, 'Service worker is awake for inspection.');
    sendResponse({ status: 'awake' });
  } else if (message.action === 'GET_ACCOUNTS') {
    getAccountsHeadless().then(sendResponse);
    return true; // Giữ channel mở cho async response
  } else if (message.action === 'GET_REALTIME_CONFIG') {
    getRealtimeConfig().then((config) => sendResponse({ ...config, secret: config.secret ? '***' : '' }));
    return true;
  } else if (message.action === 'SET_REALTIME_CONFIG') {
    setRealtimeConfig(message.payload || {}).then(sendResponse);
    return true;
  } else if (message.action === 'GET_CURRENT_EMAIL_DATA') {
    getCurrentEmailData().then(sendResponse);
    return true;
  } else if (message.action === 'LIST_REMOTE_EMAIL_KEYS') {
    listRemoteEmails().then(sendResponse);
    return true;
  } else if (message.action === 'GET_REMOTE_EMAIL_DETAILS') {
    getRemoteEmailDetails(message.payload?.key).then(sendResponse);
    return true;
  } else if (message.action === 'SYNC_CURRENT_EMAIL_DATA') {
    syncCurrentEmailData(message.payload || {}).then(sendResponse);
    return true;
  } else if (message.action === 'GET_SELECTOR_CONFIG_FOR_DOMAIN') {
    Promise.all([
      getSelectorConfig(message.payload?.domain),
      getCurrentEmailData(),
      chrome.storage.local.get(['fixed_variables'])
    ]).then(([config, emailData, fixedVars]) => {
      const email = emailData?.currentEmail?.email || '';
      const emailKey = emailData?.currentEmail?.key || '';
      const emailUsername = email ? email.split('@')[0] : '';
      
      const envVars = {
        CURRENT_EMAIL: email,
        CURRENT_EMAIL_KEY: emailKey,
        CURRENT_EMAIL_USERNAME: emailUsername,
        ...(fixedVars.fixed_variables || {})
      };
      
      sendResponse({ ...(config || {}), envVars });
    });
    return true;
  } else if (message.action === 'SAVE_SELECTOR_CONFIG') {
    saveSelectorConfig(message.payload?.domain, message.payload?.config || {}).then(sendResponse);
    return true;
  } else if (message.action === 'COLLECT_SELECTORS_FROM_ACTIVE_TAB') {
    collectSelectorsFromActiveTab(message.payload || {}).then(sendResponse);
    return true;
  } else if (message.action === 'SYNC_SELECTOR_COLLECTION') {
    appendSelectorCollection(message.payload).then(sendResponse);
    return true;
  }
  return true;
});

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function collectSelectorsFromActiveTab(payload = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = getDomainFromUrl(tab?.url || '');
  if (!tab?.id || !domain) return { ok: false, error: 'Không tìm thấy tab/domain hiện tại.' };

  const config = await getSelectorConfig(domain);
  if (!config?.enabled || !Array.isArray(config.selectors) || config.selectors.length === 0) {
    return { ok: false, error: 'Chưa có cấu hình selector cho domain này.' };
  }

  try {
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: 'COLLECT_SELECTORS_ON_PAGE',
      payload: { config, source: payload.source || 'popup' }
    });
    if (result?.ok && result.payload) {
      const sync = await appendSelectorCollection(result.payload);
      return { ...result, sync };
    }
    return result || { ok: false, error: 'Content script không trả dữ liệu.' };
  } catch (error) {
    return { ok: false, error: error.message || 'Không gửi được lệnh collect vào tab.' };
  }
}

async function getAccountsHeadless() {
  const accounts = await new Promise((resolve) => {
    chrome.tabs.create(
      { url: 'https://accounts.google.com/SignOutOptions', active: false },
      (tab) => {
        let resolved = false;
        const finish = (value) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(handler);
          if (tab?.id) chrome.tabs.remove(tab.id);
          resolve(value);
        };

        const timer = setTimeout(() => finish([]), 8000); // Tăng timeout lên 8s cho chắc

        const handler = (msg, sender) => {
          if (msg.type === 'ACCOUNTS_RESULT' && sender.tab && sender.tab.id === tab?.id) {
            finish(Array.isArray(msg.accounts) ? msg.accounts : []);
          }
        };

        chrome.runtime.onMessage.addListener(handler);
      }
    );
  });

  const accountResult = accounts[0]
    ? await setCurrentEmailFromAccount(accounts[0])
    : { currentEmail: null, data: null, sync: { ok: false, skipped: true, error: 'Không tìm thấy Gmail.' } };

  return {
    accounts,
    currentEmail: accountResult.currentEmail,
    data: accountResult.data,
    sync: accountResult.sync
  };
}
