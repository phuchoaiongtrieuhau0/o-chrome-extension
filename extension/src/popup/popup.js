import { checkForUpdates, getUpdateStatus } from '../core/updater.js';

const manifest = chrome.runtime.getManifest();

document.getElementById('version-badge').textContent = `v${manifest.version}`;

async function refreshStatus() {
  const status = await getUpdateStatus();
  const dot = document.querySelector('.dot');
  const statusText = document.getElementById('status-text');
  const updateInfo = document.getElementById('update-info');
  const updateActions = document.getElementById('update-actions');

  if (!status.checkedAt) {
    dot.className = 'dot dot--loading';
    statusText.textContent = 'Chưa kiểm tra lần nào';
    updateActions.style.display = 'none';
    return;
  }

  if (status.hasUpdate) {
    dot.className = 'dot dot--update';
    statusText.textContent = `Có phiên bản mới: v${status.latestVersion}`;
    updateInfo.textContent = 'Vào chrome://extensions → bấm ⟳ để cập nhật';
    updateActions.style.display = 'flex';
  } else {
    dot.className = 'dot dot--ok';
    statusText.textContent = 'Đang dùng phiên bản mới nhất';
    const ago = status.checkedAt
      ? Math.round((Date.now() - status.checkedAt) / 60000) + ' phút trước'
      : '';
    updateInfo.textContent = `Kiểm tra lúc: ${ago}`;
    updateActions.style.display = 'none';
  }
}

function getDownloadUrl(format) {
  // Lấy repo URL từ update_url (VD: https://user.github.io/repo/updates.xml)
  const updateUrl = manifest.update_url;
  const match = updateUrl.match(/https:\/\/([^.]+)\.github\.io\/([^/]+)/);
  if (!match) return null;
  const [_, user, repo] = match;
  return `https://github.com/${user}/${repo}/releases/latest/download/extension.${format}`;
}

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
    alert(`Đã chọn: ${fileName}\n\nLƯU Ý: Extension không thể tự ghi đè file hệ thống.\nBạn hãy giải nén nội dung file này vào thư mục extension hiện tại, sau đó bấm nút "Reload Extension" màu xanh.`);
  }
});

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
