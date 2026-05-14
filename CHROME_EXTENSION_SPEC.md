# Chrome Extension — Agent Build Spec

> **Đọc hết file này trước khi tạo bất kỳ file nào.**  
> File này đủ để implement hoàn chỉnh. Thực hiện theo đúng thứ tự các bước.

---

## Tổng quan

Xây dựng một Chrome Extension (Manifest V3) cá nhân với các đặc điểm:

- Chạy trên **Chrome desktop** và **Chrome Android** (v128+)
- **Auto-update**: mỗi khi push lên `main` → GitHub Actions tự build → overwrite release `latest` → Chrome client tự cập nhật
- **Không quản lý tag**: version tự tăng theo `GITHUB_RUN_NUMBER`, client chỉ cần trỏ đến một URL cố định duy nhất
- Kiến trúc **module-based**: thêm tính năng = tạo folder mới, không đụng code cũ
- Có sẵn **toàn bộ permissions** Chrome MV3 hỗ trợ

---

## Cơ chế update (quan trọng, đọc kỹ)

```
Push code lên main
       │
       ▼
GitHub Actions
  1. Đọc GITHUB_RUN_NUMBER → version = "1.0.<RUN_NUMBER>"
  2. Ghi version mới vào manifest.json
  3. Ký extension bằng PEM key (lưu trong GitHub Secrets)
  4. Build ra extension.crx + extension.zip
  5. Xoá GitHub Release có tag "latest" (nếu tồn tại)
  6. Tạo lại Release tag "latest" với 2 asset: extension.crx, extension.zip
  7. Ghi version mới vào updates.xml
  8. Deploy updates.xml lên GitHub Pages (branch gh-pages)
       │
       ▼
URL cố định không đổi:
  updates.xml : https://<USER>.github.io/<REPO>/updates.xml
  crx download: https://github.com/<USER>/<REPO>/releases/latest/download/extension.crx
  zip download: https://github.com/<USER>/<REPO>/releases/latest/download/extension.zip
       │
       ▼
Chrome client: định kỳ fetch updates.xml → thấy version cao hơn → tự tải .crx mới
```

**Lần đầu cài đặt**: download `extension.crx` từ URL trên → kéo thả vào `chrome://extensions` (đã bật Developer Mode).  
**Các lần sau**: Chrome có chức năng UI để cập nhật, hoặc vào `chrome://extensions` → bấm nút ⟳.

---

## Cấu trúc thư mục — tạo đúng như sau

```
<repo-root>/
├── extension/                          ← toàn bộ source extension nằm đây
│   ├── manifest.json
│   ├── icons/
│   │   ├── icon16.svg
│   │   ├── icon32.svg
│   │   ├── icon48.svg
│   │   └── icon128.svg
│   └── src/
│       ├── background.js               ← service worker entry point
│       ├── content.js                  ← content script
│       ├── core/
│       │   ├── storage.js              ← wrapper chrome.storage
│       │   ├── messaging.js            ← sendMessage/onMessage helper
│       │   ├── logger.js               ← log wrapper
│       │   └── updater.js              ← check update thủ công
│       ├── features/
│       │   └── hello-world/
│       │       └── index.js            ← feature mẫu (template)
│       ├── popup/
│       │   ├── popup.html
│       │   ├── popup.js
│       │   └── popup.css
│       ├── options/
│       │   ├── options.html
│       │   ├── options.js
│       │   └── options.css
│       └── sidepanel/
│           ├── sidepanel.html
│           └── sidepanel.js
├── update-server/                      ← deploy lên GitHub Pages
│   └── updates.xml
├── scripts/
│   └── set-version.js                  ← Node script cập nhật version vào manifest + updates.xml
├── .github/
│   └── workflows/
│       └── release.yml
├── .gitignore
└── README.md
```

---

## Bước 1 — Thiết lập GitHub Repository

Trước khi code, agent cần hướng dẫn user thực hiện:

### 1.1 Tạo repo và bật GitHub Pages

```
1. Tạo GitHub repo (public hoặc private đều được)
2. Vào Settings → Pages → Source: Deploy from branch → Branch: gh-pages / root
3. Ghi nhớ: <USER> = GitHub username, <REPO> = tên repo
```

### 1.2 Tạo PEM key cho signing CRX (tạo các lệnh này trong package.json)

```bash
# Chạy lệnh này trên máy local (chỉ cần 1 lần)
openssl genrsa -out extension.pem 2048

# Copy toàn bộ nội dung file extension.pem
cat extension.pem
```

### 1.3 Lưu Secrets vào GitHub

```
Settings → Secrets and variables → Actions → New repository secret

Tạo 2 secrets:
  CRX_PRIVATE_KEY  = nội dung file extension.pem (toàn bộ, bao gồm -----BEGIN...-----)
  EXTENSION_ID     = để trống tạm, sẽ điền sau bước cài lần đầu (xem README)
```

> **Lưu ý**: `extension.pem` KHÔNG commit lên git. Thêm vào `.gitignore`.

---

## Bước 2 — Tạo các file

Tạo theo đúng thứ tự dưới đây.

---

### 2.1 `.gitignore`

```gitignore
extension.pem
*.crx
*.zip
node_modules/
dist/
```

---

### 2.2 `extension/manifest.json`

> `update_url` phải trỏ đúng domain GitHub Pages. Thay `<USER>` và `<REPO>`.

```json
{
  "manifest_version": 3,
  "name": "My Personal Extension",
  "short_name": "MyExt",
  "description": "Personal automation extension",
  "version": "1.0.0",
  "update_url": "https://<USER>.github.io/<REPO>/updates.xml",

  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.svg",
      "32": "icons/icon32.svg",
      "48": "icons/icon48.svg",
      "128": "icons/icon128.svg"
    },
    "default_title": "My Extension"
  },

  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],

  "options_page": "src/options/options.html",

  "side_panel": {
    "default_path": "src/sidepanel/sidepanel.html"
  },

  "permissions": [
    "activeTab",
    "tabs",
    "windows",
    "history",
    "bookmarks",
    "storage",
    "unlimitedStorage",
    "cookies",
    "sessions",
    "scripting",
    "webNavigation",
    "webRequest",
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess",
    "declarativeNetRequestFeedback",
    "downloads",
    "notifications",
    "alarms",
    "contextMenus",
    "clipboardRead",
    "clipboardWrite",
    "idle",
    "management",
    "sidePanel",
    "offscreen",
    "tabGroups",
    "readingList",
    "search",
    "topSites",
    "browsingData",
    "privacy",
    "proxy",
    "fontSettings",
    "contentSettings",
    "debugger",
    "pageCapture",
    "tabCapture",
    "desktopCapture",
    "tts",
    "ttsEngine",
    "gcm",
    "geolocation",
    "identity",
    "nativeMessaging",
    "processes",
    "system.cpu",
    "system.memory",
    "system.display",
    "system.storage",
    "power",
    "webAuthenticationProxy"
  ],

  "host_permissions": ["<all_urls>"],

  "web_accessible_resources": [
    {
      "resources": ["src/content.js", "icons/*"],
      "matches": ["<all_urls>"]
    }
  ],

  "icons": {
    "16": "icons/icon16.svg",
    "32": "icons/icon32.svg",
    "48": "icons/icon48.svg",
    "128": "icons/icon128.svg"
  }
}
```

---

### 2.3 `extension/icons/icon128.svg` (và 3 size còn lại)

Tạo 4 file SVG. Thay `width/height` tương ứng: 16, 32, 48, 128.

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#4F46E5"/>
  <text x="64" y="82" text-anchor="middle" font-family="system-ui,sans-serif"
        font-size="64" font-weight="700" fill="white">E</text>
</svg>
```

---

### 2.4 `extension/src/core/logger.js`

```js
// CORE: logger — wrapper console với prefix [EXT] và feature tag
// Dùng: import { log, warn, err } from '../core/logger.js'

const PREFIX = '[EXT]';

export const log  = (tag, ...args) => console.log( `${PREFIX}[${tag}]`, ...args);
export const warn = (tag, ...args) => console.warn(`${PREFIX}[${tag}]`, ...args);
export const err  = (tag, ...args) => console.error(`${PREFIX}[${tag}]`, ...args);
```

---

### 2.5 `extension/src/core/storage.js`

```js
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
```

---

### 2.6 `extension/src/core/messaging.js`

```js
// CORE: messaging — wrapper chrome.runtime messaging
// Gửi: send('ACTION_NAME', { data })
// Nhận: onMessage('ACTION_NAME', async (payload) => { ... })

import { err, log } from './logger.js';

const TAG = 'messaging';
const handlers = new Map();

export function send(action, payload = {}) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action, payload }, (response) => {
        if (chrome.runtime.lastError) {
          err(TAG, 'send error', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response);
      });
    } catch (e) {
      err(TAG, 'send failed', action, e);
      resolve(null);
    }
  });
}

export function onMessage(action, handler) {
  handlers.set(action, handler);
}

// Gọi 1 lần trong background.js
export function initMessageRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, payload } = message || {};
    const handler = handlers.get(action);
    if (!handler) return false;
    log(TAG, 'received', action);
    handler(payload, sender)
      .then(sendResponse)
      .catch((e) => { err(TAG, 'handler error', action, e); sendResponse(null); });
    return true; // async response
  });
}
```

---

### 2.7 `extension/src/core/updater.js`

```js
// CORE: updater — kiểm tra và thông báo update
// URL updates.xml lấy từ manifest.update_url (Chrome inject sẵn khi dùng update_url)
// Dùng thủ công: import { checkForUpdates, getUpdateStatus } from '../core/updater.js'

import { log, err } from './logger.js';
import { get, set } from './storage.js';

const TAG = 'updater';
const STORAGE_KEY = 'core:update_status';

// Parse XML trả về version string hoặc null
function parseVersion(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const node = doc.querySelector('updatecheck');
    return node ? node.getAttribute('version') : null;
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
```

---

### 2.8 `extension/src/features/hello-world/index.js`

```js
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
      iconUrl: chrome.runtime.getURL('icons/icon48.svg'),
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
```

---

### 2.9 `extension/src/background.js`

```js
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
```

---

### 2.10 `extension/src/content.js`

```js
// CONTENT SCRIPT — chạy trên mọi trang
// Thêm logic tương tác trang web tại đây
// Giao tiếp với background: chrome.runtime.sendMessage(...)

(function () {
  'use strict';

  const TAG = '[EXT][content]';

  // Gửi tin nhắn lên background khi cần
  function sendToBackground(action, payload = {}) {
    return chrome.runtime.sendMessage({ action, payload });
  }

  // Ví dụ: log URL hiện tại vào background
  // sendToBackground('PAGE_LOADED', { url: location.href });

  console.log(TAG, 'content script loaded on', location.hostname);
})();
```

---

### 2.11 `extension/src/popup/popup.html`

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header>
      <div class="title-row">
        <span class="name">My Extension</span>
        <span class="version-badge" id="version-badge">v1.0.0</span>
      </div>
      <div class="status-row" id="status-row">
        <span class="dot dot--ok"></span>
        <span id="status-text">Kiểm tra cập nhật...</span>
      </div>
    </header>

    <main>
      <button class="btn btn--secondary" id="btn-check-update">
        ⟳ Kiểm tra cập nhật
      </button>
      <button class="btn btn--secondary" id="btn-open-sidepanel">
        ⊞ Mở Side Panel
      </button>
      <button class="btn btn--ghost" id="btn-options">
        ⚙ Cài đặt
      </button>
    </main>

    <footer>
      <span id="update-info"></span>
    </footer>
  </div>
  <script src="popup.js" type="module"></script>
</body>
</html>
```

---

### 2.12 `extension/src/popup/popup.css`

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 300px;
  min-height: 180px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  background: #0f0f13;
  color: #e2e2e6;
}

.container { display: flex; flex-direction: column; gap: 0; }

header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid #1e1e28;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.name { font-size: 15px; font-weight: 600; color: #f0f0f5; }

.version-badge {
  font-size: 11px;
  font-weight: 500;
  background: #1e1e30;
  color: #818cf8;
  border: 1px solid #2d2d50;
  border-radius: 20px;
  padding: 2px 8px;
}

.status-row { display: flex; align-items: center; gap: 6px; color: #6b7280; font-size: 11px; }

.dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--ok      { background: #22c55e; }
.dot--update  { background: #f59e0b; }
.dot--loading { background: #6b7280; }

main {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn {
  width: 100%;
  padding: 7px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  transition: background 0.15s;
}
.btn--secondary { background: #1a1a24; color: #c4c4d0; }
.btn--secondary:hover { background: #22222e; }
.btn--ghost { background: transparent; color: #6b7280; border: 1px solid #1e1e28; }
.btn--ghost:hover { background: #15151f; }

footer {
  padding: 8px 16px 12px;
  font-size: 11px;
  color: #4b5563;
  min-height: 28px;
}
```

---

### 2.13 `extension/src/popup/popup.js`

```js
import { checkForUpdates, getUpdateStatus } from '../core/updater.js';

const manifest = chrome.runtime.getManifest();

document.getElementById('version-badge').textContent = `v${manifest.version}`;

async function refreshStatus() {
  const status = await getUpdateStatus();
  const dot = document.querySelector('.dot');
  const statusText = document.getElementById('status-text');
  const updateInfo = document.getElementById('update-info');

  if (!status.checkedAt) {
    dot.className = 'dot dot--loading';
    statusText.textContent = 'Chưa kiểm tra lần nào';
    return;
  }

  if (status.hasUpdate) {
    dot.className = 'dot dot--update';
    statusText.textContent = `Có phiên bản mới: v${status.latestVersion}`;
    updateInfo.textContent = 'Vào chrome://extensions → bấm ⟳ để cập nhật';
  } else {
    dot.className = 'dot dot--ok';
    statusText.textContent = 'Đang dùng phiên bản mới nhất';
    const ago = status.checkedAt
      ? Math.round((Date.now() - status.checkedAt) / 60000) + ' phút trước'
      : '';
    updateInfo.textContent = `Kiểm tra lúc: ${ago}`;
  }
}

document.getElementById('btn-check-update').addEventListener('click', async () => {
  const btn = document.getElementById('btn-check-update');
  btn.textContent = '⟳ Đang kiểm tra...';
  btn.disabled = true;
  await checkForUpdates();
  await refreshStatus();
  btn.textContent = '⟳ Kiểm tra cập nhật';
  btn.disabled = false;
});

document.getElementById('btn-open-sidepanel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});

document.getElementById('btn-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

refreshStatus();
```

---

### 2.14 `extension/src/options/options.html`

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Cài đặt Extension</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <h1>Cài đặt</h1>
    <section>
      <h2>Thông tin phiên bản</h2>
      <p>Phiên bản hiện tại: <strong id="current-version"></strong></p>
      <p>Phiên bản mới nhất: <strong id="latest-version">—</strong></p>
      <button id="btn-check">Kiểm tra cập nhật</button>
    </section>
    <!-- Thêm section cài đặt cho từng feature vào đây -->
  </div>
  <script src="options.js" type="module"></script>
</body>
</html>
```

---

### 2.15 `extension/src/options/options.css`

```css
body { font-family: system-ui, sans-serif; max-width: 600px; margin: 32px auto; padding: 0 20px; }
h1 { font-size: 20px; margin-bottom: 24px; }
h2 { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
p { margin-bottom: 8px; font-size: 14px; color: #374151; }
button { padding: 6px 14px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
button:hover { background: #4338ca; }
```

---

### 2.16 `extension/src/options/options.js`

```js
import { checkForUpdates, getUpdateStatus } from '../core/updater.js';

const manifest = chrome.runtime.getManifest();
document.getElementById('current-version').textContent = `v${manifest.version}`;

getUpdateStatus().then((s) => {
  if (s.latestVersion) {
    document.getElementById('latest-version').textContent = `v${s.latestVersion}`;
  }
});

document.getElementById('btn-check').addEventListener('click', async () => {
  const status = await checkForUpdates();
  document.getElementById('latest-version').textContent = `v${status.latestVersion || '?'}`;
});
```

---

### 2.17 `extension/src/sidepanel/sidepanel.html`

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Side Panel</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; background: #0f0f13; color: #e2e2e6; }
    h2 { font-size: 16px; margin-bottom: 12px; }
    p { font-size: 13px; color: #9ca3af; }
  </style>
</head>
<body>
  <h2>Side Panel</h2>
  <p id="info">Thêm tính năng vào sidepanel.js</p>
  <script src="sidepanel.js" type="module"></script>
</body>
</html>
```

---

### 2.18 `extension/src/sidepanel/sidepanel.js`

```js
const manifest = chrome.runtime.getManifest();
document.getElementById('info').textContent = `Extension v${manifest.version} — Side Panel ready`;
```

---

### 2.19 `update-server/updates.xml`

> Thay `<USER>` và `<REPO>`. `appid` để là `__EXTENSION_ID__` tạm — CI sẽ cập nhật tự động sau.  
> Chrome chấp nhận bất kỳ appid nào khi extension được install từ CRX đúng key.

```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='__EXTENSION_ID__'>
    <updatecheck
      codebase='https://github.com/<USER>/<REPO>/releases/latest/download/extension.crx'
      version='1.0.0' />
  </app>
</gupdate>
```

---

### 2.20 `scripts/set-version.js`

```js
// Node.js script — cập nhật version vào manifest.json và updates.xml
// Chạy: node scripts/set-version.js 1.0.42

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/set-version.js X.Y.Z');
  process.exit(1);
}

// Cập nhật manifest.json
const manifestPath = resolve(__dir, '../extension/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.version = version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json → ${version}`);

// Cập nhật updates.xml
const xmlPath = resolve(__dir, '../update-server/updates.xml');
let xml = readFileSync(xmlPath, 'utf8');
xml = xml.replace(/version='[^']*'/, `version='${version}'`);
writeFileSync(xmlPath, xml);
console.log(`updates.xml → ${version}`);
```

---

### 2.21 `.github/workflows/release.yml`

```yaml
name: Build & Release Latest

on:
  push:
    branches: [main]

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      # ── Version tự động: 1.0.<RUN_NUMBER> ──────────────────────────
      - name: Set version
        id: version
        run: |
          VERSION="1.0.${{ github.run_number }}"
          echo "VERSION=$VERSION" >> $GITHUB_ENV
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          node scripts/set-version.js $VERSION

      # ── Đặt Extension ID từ Secret (nếu đã có) vào updates.xml ─────
      - name: Patch Extension ID in updates.xml
        if: ${{ secrets.EXTENSION_ID != '' }}
        run: |
          sed -i "s/__EXTENSION_ID__/${{ secrets.EXTENSION_ID }}/g" update-server/updates.xml

      # ── Tạo extension.zip (dùng để load unpacked hoặc backup) ──────
      - name: Build extension.zip
        run: |
          cd extension
          zip -r ../extension.zip . -x "*.DS_Store"
          cd ..
          echo "Built extension.zip"

      # ── Ký và tạo extension.crx (dùng cho auto-update) ─────────────
      - name: Install crx3 tool
        run: npm install -g crx3

      - name: Write PEM key
        run: echo "${{ secrets.CRX_PRIVATE_KEY }}" > extension.pem

      - name: Build extension.crx
        run: |
          crx3 pack extension --private-key=extension.pem --output=extension.crx
          echo "Built extension.crx"

      - name: Remove PEM key
        if: always()
        run: rm -f extension.pem

      # ── Overwrite release "latest" ──────────────────────────────────
      - name: Delete existing latest release
        run: gh release delete latest --yes --cleanup-tag || true
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Create latest release
        run: |
          gh release create latest \
            --title "Latest Build — v${{ env.VERSION }}" \
            --notes "Auto-built từ commit ${{ github.sha }} — v${{ env.VERSION }}" \
            --prerelease \
            extension.crx \
            extension.zip
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # ── Deploy updates.xml lên GitHub Pages ─────────────────────────
      - name: Deploy update-server to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./update-server
          publish_branch: gh-pages
          force_orphan: true
```

---

### 2.22 `README.md`

```markdown
# My Personal Chrome Extension

Extension cá nhân để tự động hóa công việc hằng ngày.

## Cài đặt lần đầu

1. Vào [Releases](../../releases/latest) → tải `extension.crx`
2. Mở `chrome://extensions` → bật **Developer mode**
3. Kéo thả file `.crx` vào trang → bấm "Add extension"
4. Ghi lại **Extension ID** (chuỗi 32 ký tự dưới icon extension)
5. Vào repo → Settings → Secrets → cập nhật `EXTENSION_ID` = ID vừa ghi

## Cập nhật

**Tự động**: Chrome định kỳ kiểm tra và tự cập nhật.

**Thủ công**: `chrome://extensions` → bấm nút ⟳ "Update".

## Thêm tính năng mới

```bash
# 1. Tạo folder feature mới
cp -r extension/src/features/hello-world extension/src/features/my-new-feature

# 2. Sửa FEATURE_NAME và logic trong index.js

# 3. Đăng ký trong background.js (thêm 2 dòng):
#    import { register as registerMyNewFeature } from './features/my-new-feature/index.js';
#    await registerMyNewFeature();

# 4. Commit và push lên main → tự động build + release
git add .
git commit -m "feat: add my-new-feature"
git push origin main
```

## Release tự động

Mỗi push lên `main`:
- Version tăng tự động (`1.0.<BUILD_NUMBER>`)
- Build `.crx` + `.zip`
- Overwrite GitHub Release `latest`
- Deploy `updates.xml` lên GitHub Pages
- Chrome client tự cập nhật trong ~6 giờ

## URL cố định (không bao giờ thay đổi)

| Mục đích | URL |
|---|---|
| Update manifest | `https://<USER>.github.io/<REPO>/updates.xml` |
| Tải CRX mới nhất | `https://github.com/<USER>/<REPO>/releases/latest/download/extension.crx` |
| Tải ZIP mới nhất | `https://github.com/<USER>/<REPO>/releases/latest/download/extension.zip` |
```

---

## Bước 3 — Checklist sau khi tạo xong file

Agent kiểm tra lần lượt:

- [ ] `manifest.json`: đã thay `<USER>` và `<REPO>` trong `update_url`
- [ ] `updates.xml`: đã thay `<USER>` và `<REPO>` trong `codebase`
- [ ] `extension.pem` KHÔNG có trong git (đã có trong `.gitignore`)
- [ ] GitHub Secret `CRX_PRIVATE_KEY` đã được set
- [ ] GitHub Pages đã bật trên branch `gh-pages`
- [ ] Push lên `main` lần đầu → kiểm tra Actions tab không có lỗi
- [ ] Tải `extension.crx` từ release `latest` → cài thử → ghi lại Extension ID → update Secret

---

## Bước 4 — Thêm tính năng (hướng dẫn cho agent sau này)

Khi user yêu cầu thêm tính năng mới, agent chỉ cần:

1. Tạo file `extension/src/features/<tên>/index.js` với pattern:
   ```js
   const FEATURE_NAME = '<tên>';
   export async function register() { /* logic */ }
   ```
2. Thêm 2 dòng vào `background.js` (import + gọi register)
3. Nếu cần UI trong popup: thêm vào `popup.html` / `popup.js`
4. Nếu cần storage: dùng key `<tên>:<key>` qua `core/storage.js`
5. Nếu cần nhận message từ popup: dùng `onMessage('<ACTION>', handler)` qua `core/messaging.js`
6. Push lên main → tự động deploy

**Không cần** sửa `manifest.json`, `release.yml`, hay bất kỳ core file nào.
```
