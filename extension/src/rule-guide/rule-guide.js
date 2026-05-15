const CONFIG_KEY = 'selectorCollector:configs:v1';

const sampleConfig = {
  domain: 'example.com',
  enabled: true,
  showFloatingButton: true,
  selectors: [
    {
      id: 'email-field',
      label: 'Email input value',
      selector: 'input[type="email"]',
      mode: 'attr',
      attr: 'value',
      multiple: false,
      trim: true
    },
    {
      id: 'submit-button',
      label: 'Submit button text',
      selector: 'button[type="submit"]',
      mode: 'text',
      attr: null,
      multiple: false,
      trim: true
    }
  ],
  guideRules: [
    {
      id: 'login-page',
      title: 'Login page collect rule',
      description: 'Dùng Finder để lấy selector input/button, sau đó Builder để thêm vào selectors.'
    }
  ],
  traceLog: []
};

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

async function loadCurrentConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return result[CONFIG_KEY] || {};
}

document.getElementById('sample-json').textContent = pretty(sampleConfig);

document.getElementById('btn-copy-sample').addEventListener('click', async () => {
  await copyText(pretty(sampleConfig));
});

document.getElementById('btn-copy-current').addEventListener('click', async () => {
  const config = await loadCurrentConfig();
  await copyText(pretty(config));
});

loadCurrentConfig().then((config) => {
  document.getElementById('current-json').textContent = pretty(config);
});
