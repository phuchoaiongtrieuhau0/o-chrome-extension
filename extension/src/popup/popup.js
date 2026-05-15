import { checkForUpdates, getUpdateStatus } from '../core/updater.js';

const manifest = chrome.runtime.getManifest();
document.getElementById('version-badge').textContent = `v${manifest.version}`;

// Tab Handling
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    const content = document.getElementById(`tab-${target}`);
    if (content) content.classList.add('active');

    // Save active tab
    chrome.storage.local.set({ activeTab: target });
  });
});

// Restore active tab
chrome.storage.local.get(['activeTab'], (result) => {
  if (result.activeTab) {
    const btn = document.querySelector(`.tab-btn[data-tab="${result.activeTab}"]`);
    if (btn) btn.click();
  }
});

// Theme Management
const selectTheme = document.getElementById('select-theme');
const root = document.documentElement;

function applyTheme(theme) {
  if (theme === 'auto') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('light-theme', !isDark);
  } else {
    root.classList.toggle('light-theme', theme === 'light');
  }
}

// Load and apply saved theme
chrome.storage.local.get(['theme'], (result) => {
  const theme = result.theme || 'dark';
  selectTheme.value = theme;
  applyTheme(theme);
});

selectTheme.addEventListener('change', (e) => {
  const theme = e.target.value;
  chrome.storage.local.set({ theme });
  applyTheme(theme);
});

// Auto-apply theme if system settings change
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  chrome.storage.local.get(['theme'], (result) => {
    if (result.theme === 'auto') applyTheme('auto');
  });
});

// Listen for storage changes to sync theme in real-time
chrome.storage.onChanged.addListener((changes) => {
  if (changes.theme) {
    applyTheme(changes.theme.newValue);
    if (selectTheme) selectTheme.value = changes.theme.newValue;
  }
});

// Extension ID
document.getElementById('ext-id-display').textContent = chrome.runtime.id;

async function refreshStatus() {
  const status = await getUpdateStatus();
  const dot = document.querySelector('.dot');
  const statusText = document.getElementById('status-text');
  const updateInfo = document.getElementById('update-info');

  if (!status.checkedAt) {
    dot.className = 'dot dot--loading';
    statusText.textContent = 'Chưa kiểm tra cập nhật';
    return;
  }

  if (status.hasUpdate) {
    dot.className = 'dot dot--update';
    statusText.textContent = `Có bản v${status.latestVersion}`;
    updateInfo.textContent = 'Vào chrome://extensions → bấm ⟳ để cập nhật';
  } else {
    dot.className = 'dot dot--ok';
    statusText.textContent = 'Đang ở bản mới nhất';
    const ago = status.checkedAt
      ? Math.round((Date.now() - status.checkedAt) / 60000) + ' phút trước'
      : '';
    updateInfo.textContent = `Kiểm tra lúc: ${ago}`;
  }
}

function getDownloadUrl(format) {
  const updateUrl = manifest.update_url;
  if (!updateUrl) return null;
  const match = updateUrl.match(/https:\/\/([^.]+)\.github\.io\/([^/]+)/);
  if (!match) return null;
  const [_, user, repo] = match;
  return `https://github.com/${user}/${repo}/releases/latest/download/extension.${format}`;
}

function showToast(message, duration = 3000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

async function copyToClipboard(text, message = '📋 Đã copy vào bộ nhớ!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
}

function sendMessage(action, payload = {}) {
  return chrome.runtime.sendMessage({ action, payload });
}

function prettyJson(value) {
  return JSON.stringify(value || {}, null, 2);
}

async function loadRealtimeConfig() {
  const config = await sendMessage('GET_REALTIME_CONFIG');
  document.getElementById('realtime-db-url').value = config?.dbUrl || '';
  document.getElementById('realtime-db-secret').value = '';
  document.getElementById('realtime-config-status').textContent = config?.dbUrl
    ? `Đã cấu hình: ${config.dbUrl}`
    : 'Chưa cấu hình realtime.';
}

async function refreshCurrentEmailData() {
  const result = await sendMessage('GET_CURRENT_EMAIL_DATA');
  document.getElementById('current-email-json').textContent = result?.data
    ? prettyJson(result)
    : 'Chưa có dữ liệu email hiện tại.';
  return result;
}

async function exportCurrentEmailData() {
  const result = await refreshCurrentEmailData();
  if (!result?.data) {
    showToast('⚠️ Chưa có dữ liệu để xuất.');
    return;
  }

  const fileName = `${result.currentEmail?.key || 'email-data'}.json`;
  const blob = new Blob([prettyJson(result)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function getActiveTabDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return domainFromUrl(tab?.url || '');
}

function createSelectorRow(row = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'collector-row';
  wrapper.dataset.id = row.id || crypto.randomUUID();

  const label = document.createElement('input');
  label.className = 'text-input';
  label.placeholder = 'Key/label';
  label.value = row.label || '';
  label.dataset.field = 'label';

  const selector = document.createElement('input');
  selector.className = 'text-input';
  selector.placeholder = 'CSS selector';
  selector.value = row.selector || '';
  selector.dataset.field = 'selector';

  const mode = document.createElement('select');
  mode.className = 'select-input';
  mode.dataset.field = 'mode';
  [['text', 'Text'], ['attr', 'Attribute']].forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    mode.appendChild(option);
  });
  mode.value = row.mode || 'text';

  const attr = document.createElement('select');
  attr.className = 'select-input';
  attr.dataset.field = 'attr';
  ['', 'value', 'href', 'src', 'alt', 'title', 'aria-label'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value || '-';
    attr.appendChild(option);
  });
  attr.value = row.attr || '';

  const multipleLabel = document.createElement('label');
  multipleLabel.className = 'checkbox-row';
  const multiple = document.createElement('input');
  multiple.type = 'checkbox';
  multiple.dataset.field = 'multiple';
  multiple.checked = Boolean(row.multiple);
  multipleLabel.append(multiple, ' Multi');

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'mini-btn';
  remove.textContent = 'X';
  remove.addEventListener('click', () => wrapper.remove());

  wrapper.append(label, selector, mode, attr, multipleLabel, remove);
  return wrapper;
}

function readSelectorConfigFromUi() {
  const domain = document.getElementById('collector-domain').textContent;
  const selectors = [...document.querySelectorAll('.collector-row')].map((row) => ({
    id: row.dataset.id,
    label: row.querySelector('[data-field="label"]').value.trim(),
    selector: row.querySelector('[data-field="selector"]').value.trim(),
    mode: row.querySelector('[data-field="mode"]').value,
    attr: row.querySelector('[data-field="attr"]').value || null,
    multiple: row.querySelector('[data-field="multiple"]').checked,
    trim: true
  })).filter((row) => row.label && row.selector);

  return {
    domain,
    enabled: document.getElementById('collector-enabled').checked,
    showFloatingButton: document.getElementById('collector-floating').checked,
    selectors
  };
}

async function loadSelectorConfigUi() {
  const domain = await getActiveTabDomain();
  document.getElementById('collector-domain').textContent = domain || 'unknown';
  const rows = document.getElementById('collector-rows');
  rows.innerHTML = '';

  const config = domain ? await sendMessage('GET_SELECTOR_CONFIG_FOR_DOMAIN', { domain }) : null;
  document.getElementById('collector-enabled').checked = Boolean(config?.enabled);
  document.getElementById('collector-floating').checked = Boolean(config?.showFloatingButton);
  (config?.selectors || []).forEach((row) => rows.appendChild(createSelectorRow(row)));
  if (!config?.selectors?.length) rows.appendChild(createSelectorRow());
}

async function saveSelectorConfigUi() {
  const config = readSelectorConfigFromUi();
  await sendMessage('SAVE_SELECTOR_CONFIG', { domain: config.domain, config });
  showToast('Đã lưu cấu hình collector. Reload web page để hiện nút nổi nếu cần.');
}

async function collectSelectorsNow() {
  await saveSelectorConfigUi();
  const result = await sendMessage('COLLECT_SELECTORS_FROM_ACTIVE_TAB', { source: 'popup' });
  document.getElementById('collector-result-json').textContent = prettyJson(result);
  showToast(result?.ok ? 'Đã collect selector.' : (result?.error || 'Collect lỗi.'));
  if (result?.ok) await refreshCurrentEmailData();
}

async function loadRemoteEmails() {
  const summary = document.getElementById('remote-emails-summary');
  const list = document.getElementById('remote-emails-list');
  const detail = document.getElementById('remote-email-json');
  summary.textContent = 'Đang tải...';
  list.innerHTML = '';
  detail.textContent = 'Chưa chọn email.';

  const result = await sendMessage('LIST_REMOTE_EMAIL_KEYS');
  if (!result?.ok) {
    summary.textContent = result?.error || 'Không tải được realtime.';
    return;
  }

  summary.textContent = `Tổng email: ${result.count}`;
  result.items.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'remote-item';
    btn.textContent = `${item.email || item.key}${item.updatedAt ? ` · ${item.updatedAt}` : ''}`;
    btn.addEventListener('click', async () => {
      detail.textContent = 'Đang tải chi tiết...';
      const data = await sendMessage('GET_REMOTE_EMAIL_DETAILS', { key: item.key });
      detail.textContent = prettyJson(data);
    });
    list.appendChild(btn);
  });
}

async function copyActiveTabDomSummary(format = 'markdown') {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Không tìm thấy tab đang active.');

  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (injectedFormat) => {
      function getXPath(el) {
        if (el.id) return `//*[@id="${el.id}"]`;

        const parts = [];
        let current = el;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let idx = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) idx++;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(`${current.tagName.toLowerCase()}[${idx}]`);
          current = current.parentElement;
        }

        return `/${parts.join('/')}`;
      }

      function getCssSelector(el) {
        if (el.id) return `#${el.id}`;

        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;

        const classes = [...el.classList].slice(0, 2).join('.');
        return classes ? `${el.tagName.toLowerCase()}.${classes}` : el.tagName.toLowerCase();
      }

      const selectors = [
        'a', 'button', 'input', 'select', 'textarea',
        '[role="button"]', '[role="link"]', '[role="menuitem"]',
        '[role="tab"]', '[role="checkbox"]', '[role="radio"]',
        'h1', 'h2', 'h3', 'label', '[aria-label]', '[data-testid]'
      ];

      const seen = new WeakSet();
      const elements = [];

      document.querySelectorAll(selectors.join(',')).forEach((el, idx) => {
        if (seen.has(el)) return;
        seen.add(el);

        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        if (!isVisible) return;

        const sensitivePattern = /password|pass|token|secret|otp|2fa|mfa|auth|credential|api[_-]?key/i;
        const sensitiveText = [
          el.getAttribute('type'),
          el.id,
          el.getAttribute('name'),
          el.getAttribute('autocomplete'),
          el.getAttribute('aria-label'),
          el.getAttribute('placeholder'),
          el.labels?.[0]?.textContent
        ].filter(Boolean).join(' ');
        if (sensitivePattern.test(sensitiveText)) return;

        const text = el.textContent?.replace(/\s+/g, ' ').trim();
        const label = el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('title') ||
          el.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim() ||
          text?.slice(0, 80) ||
          null;

        elements.push({
          idx,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          type: el.getAttribute('type'),
          id: el.id || null,
          name: el.getAttribute('name') || null,
          label,
          href: el.href || null,
          testId: el.getAttribute('data-testid') || null,
          selector: getCssSelector(el),
          xpath: getXPath(el),
          pos: { x: Math.round(rect.x), y: Math.round(rect.y) }
        });
      });

      const payload = {
        url: location.href,
        title: document.title,
        elements
      };

      if (injectedFormat === 'json') {
        return {
          count: elements.length,
          output: JSON.stringify(payload, null, 2)
        };
      }

      const rows = elements.map((e) =>
        `[${e.idx}] ${e.tag}${e.role ? `(${e.role})` : ''} | ${e.label ?? '-'} | ${e.selector}`
      ).join('\n');

      return {
        count: elements.length,
        output: `# ${payload.title}\nURL: ${payload.url}\n\n${rows}`
      };
    },
    args: [format]
  });

  const result = injectionResults?.[0]?.result;
  if (!result?.output) {
    throw new Error('Tab hiện tại không trả về dữ liệu DOM. Có thể đây là trang đặc biệt hoặc inject bị chặn.');
  }

  await copyToClipboard(result.output, `📋 Đã copy ${result.count} phần tử cho AI!`);
  return result.count;
}

// Event Listeners
document.getElementById('btn-copy-zip').addEventListener('click', () => {
  const url = getDownloadUrl('zip');
  if (url) copyToClipboard(url);
});

document.getElementById('btn-copy-crx').addEventListener('click', () => {
  const url = getDownloadUrl('crx');
  if (url) copyToClipboard(url);
});

document.getElementById('btn-download-zip').addEventListener('click', () => {
  const url = getDownloadUrl('zip');
  if (url) window.open(url, '_blank');
});

document.getElementById('btn-download-crx').addEventListener('click', () => {
  const url = getDownloadUrl('crx');
  if (url) window.open(url, '_blank');
});

document.getElementById('link-manage-ext').addEventListener('click', (e) => {
  e.preventDefault();
  const ua = navigator.userAgent.toLowerCase();
  let url = 'chrome://extensions';
  if (ua.includes('kiwi')) url = 'kiwi://extensions';
  else if (ua.includes('edg/')) url = 'edge://extensions';
  chrome.tabs.create({ url });
});

document.getElementById('btn-reload').addEventListener('click', () => {
  chrome.runtime.reload();
});

document.getElementById('btn-choose-file').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    const fileName = e.target.files[0].name;
    showToast(`📁 Đã chọn: ${fileName}. Hãy giải nén và bấm Reload.`, 5000);
  }
});

document.getElementById('btn-check-update').addEventListener('click', async () => {
  const btn = document.getElementById('btn-check-update');
  const span = btn.querySelector('span');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span>⟳</span> Đang check...';
  btn.disabled = true;
  await checkForUpdates();
  await refreshStatus();
  btn.innerHTML = originalText;
  btn.disabled = false;
});

document.getElementById('btn-copy-page-elements').addEventListener('click', async () => {
  const btn = document.getElementById('btn-copy-page-elements');
  const originalText = btn.innerHTML;

  try {
    btn.innerHTML = '<span>⏳</span> Đang lấy DOM...';
    btn.disabled = true;
    const count = await copyActiveTabDomSummary('markdown');
    btn.innerHTML = `<span>✅</span> Đã copy ${count} items`;
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 1200);
  } catch (err) {
    console.error('Copy page elements failed', err);
    showToast(`❌ ${err.message || 'Không copy được DOM tab hiện tại.'}`, 4500);
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

document.getElementById('btn-open-sidepanel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});

document.getElementById('btn-options-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById('btn-clear-data').addEventListener('click', async () => {
  if (confirm('Bạn có chắc chắn muốn xóa cookies, cache, history và local storage của trình duyệt? Cấu hình realtime của extension sẽ được giữ lại.')) {
    const realtimeConfig = await chrome.storage.local.get('realtime:config');
    chrome.browsingData.remove({
      "since": 0
    }, {
      "appcache": true,
      "cache": true,
      "cacheStorage": true,
      "cookies": true,
      "downloads": true,
      "fileSystems": true,
      "formData": true,
      "history": true,
      "indexedDB": true,
      "localStorage": true,
      "serviceWorkers": true,
      "webSQL": true
    }, async () => {
      if (realtimeConfig['realtime:config']) {
        await chrome.storage.local.set({ 'realtime:config': realtimeConfig['realtime:config'] });
      }
      await loadRealtimeConfig();
      showToast('🗑 Đã xóa dữ liệu trình duyệt; cấu hình realtime được giữ lại!');
    });
  }
});

document.getElementById('btn-check-gmail').addEventListener('click', async () => {
  const btn = document.getElementById('btn-check-gmail');
  const gmailList = document.getElementById('gmail-list');
  const gmailItems = document.getElementById('gmail-items');
  const originalText = btn.innerHTML;

  btn.innerHTML = '<span>📧</span> Đang kiểm tra...';
  btn.disabled = true;
  gmailList.style.display = 'none';
  gmailItems.innerHTML = '';

  try {
    const result = await chrome.runtime.sendMessage({ action: 'GET_ACCOUNTS' });
    const accounts = Array.isArray(result) ? result : result?.accounts;
    if (accounts && accounts.length > 0) {
      accounts.forEach(acc => {
        const li = document.createElement('li');
        li.style.padding = '4px 0';
        li.style.borderBottom = '1px solid var(--border-color)';
        li.innerHTML = `<strong>${acc.name}</strong><br><span style="color: var(--text-secondary); font-size: 11px;">${acc.email}</span>`;
        gmailItems.appendChild(li);
      });
      document.getElementById('gmail-sync-status').textContent = result?.sync?.ok
        ? `Đã sync realtime: ${result.currentEmail?.key}`
        : `Đã lưu local${result?.sync?.error ? ` · ${result.sync.error}` : ''}`;
      gmailList.style.display = 'block';
      await refreshCurrentEmailData();
    } else {
      showToast('⚠️ Không tìm thấy tài khoản Gmail nào.');
    }
  } catch (err) {
    console.error('Check gmail failed', err);
    showToast('❌ Lỗi khi kiểm tra tài khoản.');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

document.getElementById('btn-save-realtime-config').addEventListener('click', async () => {
  const dbUrl = document.getElementById('realtime-db-url').value;
  const secret = document.getElementById('realtime-db-secret').value;
  await sendMessage('SET_REALTIME_CONFIG', { dbUrl, secret });
  await loadRealtimeConfig();
  showToast('Đã lưu cấu hình realtime.');
});

document.getElementById('btn-refresh-current-data').addEventListener('click', refreshCurrentEmailData);

document.getElementById('btn-copy-current-data').addEventListener('click', async () => {
  const text = document.getElementById('current-email-json').textContent;
  await copyToClipboard(text, 'Đã copy JSON email hiện tại.');
});

document.getElementById('btn-export-current-data').addEventListener('click', exportCurrentEmailData);

document.getElementById('btn-load-remote-emails').addEventListener('click', loadRemoteEmails);

document.getElementById('btn-add-selector-row').addEventListener('click', () => {
  document.getElementById('collector-rows').appendChild(createSelectorRow());
});

document.getElementById('btn-save-selector-config').addEventListener('click', saveSelectorConfigUi);

document.getElementById('btn-collect-selectors').addEventListener('click', collectSelectorsNow);

// Inspect & Logs
document.getElementById('btn-inspect-popup').addEventListener('click', () => {
  showToast('🔍 Chuột phải vào Popup -> Inspect để xem log.', 4000);
});

document.getElementById('btn-inspect-bg').addEventListener('click', async () => {
  // Gửi message để đánh thức Service Worker trước khi mở trang quản lý
  try {
    await chrome.runtime.sendMessage({ action: 'WAKE_UP' });
  } catch (e) {
    console.log('Background is currently inactive, waking up...');
  }
  
  const extId = chrome.runtime.id;
  chrome.tabs.create({ url: `chrome://extensions/?id=${extId}` });
  showToast('🤖 Đã đánh thức SW. Bấm "service worker" ở tab mới.', 5000);
});

document.getElementById('btn-inspect-options').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') });
  showToast('⚙ Trang Options đã mở. Nhấn F12 để xem log.', 4000);
});

document.getElementById('btn-inspect-sidepanel').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/sidepanel/sidepanel.html') });
  showToast('⊞ Side Panel đã mở. Nhấn F12 để xem log.', 4000);
});

refreshStatus();
loadRealtimeConfig();
loadSelectorConfigUi();
refreshCurrentEmailData();
setInterval(refreshStatus, 30000);
