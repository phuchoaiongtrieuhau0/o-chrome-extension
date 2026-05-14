// FEATURE: hello-world — feature mẫu, dùng làm template
// ─────────────────────────────────────────────────────
// Để tạo feature mới:
//   1. Copy folder này thành /features/<tên-feature>/
//   2. Sửa FEATURE_NAME và logic bên dưới
//   3. Thêm 1 dòng import vào background.js: import { register } from './features/<tên>/index.js'
//   4. Gọi register() trong initFeatures()
// ─────────────────────────────────────────────────────

import { log } from '../../core/logger.js';
import { get, set } from '../../core/storage.js';
import { onMessage } from '../../core/messaging.js';

const FEATURE_NAME = 'hello-world';

export async function register() {
  log(FEATURE_NAME, 'registering...');

  // Context menu
  chrome.contextMenus.create({
    id: FEATURE_NAME,
    title: 'Hello World 👋',
    contexts: ['all'],
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== FEATURE_NAME) return;
    const version = chrome.runtime.getManifest().version;
    await chrome.notifications.create(`${FEATURE_NAME}-notify`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: 'Hello World!',
      message: `Extension đang chạy tốt — v${version}`,
    });
    await set(`${FEATURE_NAME}:last_used`, Date.now());
    log(FEATURE_NAME, 'notification sent');
  });

  // Message handler (để popup gọi)
  onMessage('HELLO_WORLD_PING', async () => {
    const lastUsed = await get(`${FEATURE_NAME}:last_used`, null);
    return { ok: true, lastUsed };
  });

  log(FEATURE_NAME, 'registered ✓');
}
