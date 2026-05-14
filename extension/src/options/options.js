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
