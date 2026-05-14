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
