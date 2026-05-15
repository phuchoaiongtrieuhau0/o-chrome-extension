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

// Fixed Variables Management
function renderVars(vars) {
  const container = document.getElementById('vars-container');
  container.innerHTML = '';
  Object.entries(vars).forEach(([k, v]) => {
    addVarRow(k, v);
  });
}

function addVarRow(k = '', v = '') {
  const div = document.createElement('div');
  div.className = 'var-row';
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.style.marginBottom = '8px';
  
  const inputK = document.createElement('input');
  inputK.type = 'text';
  inputK.className = 'var-key';
  inputK.placeholder = 'Key (VD: DEFAULT_PASS)';
  inputK.value = k;
  
  const inputV = document.createElement('input');
  inputV.type = 'text';
  inputV.className = 'var-value';
  inputV.placeholder = 'Value';
  inputV.value = v;
  
  const btnRemove = document.createElement('button');
  btnRemove.textContent = 'Xóa';
  btnRemove.addEventListener('click', () => div.remove());
  
  div.append(inputK, inputV, btnRemove);
  document.getElementById('vars-container').appendChild(div);
}

document.getElementById('btn-add-var').addEventListener('click', () => addVarRow());

document.getElementById('btn-save-vars').addEventListener('click', () => {
  const vars = {};
  document.querySelectorAll('.var-row').forEach(row => {
    const k = row.querySelector('.var-key').value.trim();
    const v = row.querySelector('.var-value').value.trim();
    if (k) vars[k] = v;
  });
  chrome.storage.local.set({ fixed_variables: vars }, () => {
    const status = document.getElementById('vars-status');
    status.textContent = 'Đã lưu!';
    setTimeout(() => status.textContent = '', 2000);
  });
});

chrome.storage.local.get(['fixed_variables'], (res) => {
  renderVars(res.fixed_variables || {});
});
