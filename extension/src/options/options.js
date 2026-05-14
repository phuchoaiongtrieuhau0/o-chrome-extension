import { checkForUpdates, getUpdateStatus } from '../core/updater.js';

// Theme Management
const root = document.documentElement;
function applyTheme(theme) {
  if (theme === 'auto') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('light-theme', !isDark);
  } else {
    root.classList.toggle('light-theme', theme === 'light');
  }
}

chrome.storage.local.get(['theme'], (result) => {
  applyTheme(result.theme || 'dark');
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
  }
});

const manifest = chrome.runtime.getManifest();
document.getElementById('current-version').textContent = `v${manifest.version}`;

getUpdateStatus().then((s) => {
  if (s.latestVersion) {
    document.getElementById('latest-version').textContent = `v${s.latestVersion}`;
  }
});

document.getElementById('btn-check').addEventListener('click', async () => {
  const btn = document.getElementById('btn-check');
  const originalText = btn.textContent;
  btn.textContent = 'Đang check...';
  btn.disabled = true;
  const status = await checkForUpdates();
  document.getElementById('latest-version').textContent = `v${status.latestVersion || '?'}`;
  btn.textContent = originalText;
  btn.disabled = false;
});

