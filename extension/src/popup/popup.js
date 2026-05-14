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
    document.getElementById(`tab-${target}`).classList.add('active');
  });
});

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

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Đã copy link vào bộ nhớ!');
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
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

document.getElementById('btn-open-sidepanel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});

document.getElementById('btn-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

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
setInterval(refreshStatus, 30000);
