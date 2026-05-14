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
