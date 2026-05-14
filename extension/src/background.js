// SERVICE WORKER — entry point
// Import thêm feature: thêm 1 dòng import + 1 dòng gọi register()

import { log, err } from './core/logger.js';
import { initMessageRouter } from './core/messaging.js';
import { checkForUpdates } from './core/updater.js';

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
  }
  return true;
});

async function getAccountsHeadless() {
  return new Promise((resolve) => {
    chrome.tabs.create(
      { url: 'https://accounts.google.com/SignOutOptions', active: false },
      (tab) => {
        const timer = setTimeout(() => {
          chrome.tabs.remove(tab.id);
          resolve([]);
        }, 8000); // Tăng timeout lên 8s cho chắc

        const handler = (msg, sender) => {
          if (msg.type === 'ACCOUNTS_RESULT' && sender.tab && sender.tab.id === tab.id) {
            clearTimeout(timer);
            chrome.tabs.remove(tab.id);
            chrome.runtime.onMessage.removeListener(handler);
            resolve(msg.accounts);
          }
        };

        chrome.runtime.onMessage.addListener(handler);
      }
    );
  });
}
