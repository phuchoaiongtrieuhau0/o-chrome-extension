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

  const COLLECTOR_BUTTON_ID = '__ext_selector_collector_btn';
  const ATTR_ALLOWLIST = new Set(['value', 'href', 'src', 'alt', 'title', 'aria-label']);

  function getCurrentDomain() {
    return location.hostname;
  }

  function isAllowedAttr(attr) {
    return ATTR_ALLOWLIST.has(attr) || /^data-[\w-]+$/.test(attr || '');
  }

  function readElementValue(el, row) {
    if (row.mode === 'text') return el.textContent || '';
    if (!isAllowedAttr(row.attr)) return null;
    if (row.attr === 'value') return 'value' in el ? el.value : el.getAttribute('value');
    return el.getAttribute(row.attr) || '';
  }

  function collectSelectors(config, source) {
    const fields = {};

    (config.selectors || []).forEach((row) => {
      const id = row.id || row.label || row.selector;
      try {
        const elements = [...document.querySelectorAll(row.selector || '')];
        const targets = row.multiple ? elements : elements.slice(0, 1);
        const values = targets
          .map((el) => readElementValue(el, row))
          .filter((value) => value !== null)
          .map((value) => row.trim === false ? String(value) : String(value).replace(/\s+/g, ' ').trim());

        fields[id] = {
          label: row.label || row.selector,
          selector: row.selector,
          mode: row.mode || 'text',
          attr: row.attr || null,
          values,
          count: values.length,
          error: elements.length === 0 ? 'not_found' : null
        };
      } catch (error) {
        fields[id] = {
          label: row.label || row.selector,
          selector: row.selector,
          mode: row.mode || 'text',
          attr: row.attr || null,
          values: [],
          count: 0,
          error: 'invalid_selector'
        };
      }
    });

    return {
      type: 'selectorCollection',
      domain: getCurrentDomain(),
      url: location.href,
      title: document.title,
      collectedAt: new Date().toISOString(),
      source,
      fields
    };
  }

  async function loadCollectorConfig() {
    try {
      return await sendToBackground('GET_SELECTOR_CONFIG_FOR_DOMAIN', { domain: getCurrentDomain() });
    } catch (error) {
      console.warn(TAG, 'collector config failed', error);
      return null;
    }
  }

  function removeCollectorButton() {
    document.getElementById(COLLECTOR_BUTTON_ID)?.remove();
  }

  function injectCollectorButton(config) {
    removeCollectorButton();
    if (!config?.enabled || !config?.showFloatingButton) return;

    const button = document.createElement('button');
    button.id = COLLECTOR_BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Collect fields';
    button.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 12px;border-radius:999px;border:1px solid #6366f1;background:#4f46e5;color:white;font:12px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer;';
    button.addEventListener('click', async () => {
      button.textContent = 'Collecting...';
      const payload = collectSelectors(config, 'floating-button');
      const result = await sendToBackground('SYNC_SELECTOR_COLLECTION', payload);
      button.textContent = result?.ok ? 'Collected' : 'Collect failed';
      setTimeout(() => { button.textContent = 'Collect fields'; }, 1500);
    });
    document.documentElement.appendChild(button);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'COLLECT_SELECTORS_ON_PAGE') return false;
    const payload = collectSelectors(message.payload?.config || {}, message.payload?.source || 'popup');
    sendResponse({ ok: true, payload });
    return true;
  });

  loadCollectorConfig().then(injectCollectorButton);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes['selectorCollector:configs:v1']) return;
    const config = changes['selectorCollector:configs:v1'].newValue?.[getCurrentDomain()];
    injectCollectorButton(config);
  });

  if (location.hostname === 'accounts.google.com' && location.pathname.includes('/SignOutOptions')) {
    const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;

    function uniqueAccounts(accounts) {
      const seen = new Set();
      return accounts.filter((account) => {
        if (!account?.email) return false;
        const key = account.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getImageUrl(el) {
      const img = el.querySelector('img.account-image[src], img[src]');
      if (img?.getAttribute('src')) return img.getAttribute('src');
      if (img?.currentSrc || img?.src) return img.currentSrc || img.src;

      const imageEl = el.querySelector('[style*="background-image"], [data-profile-picture], [data-photo-url]');
      const attrUrl = imageEl?.getAttribute('data-profile-picture') || imageEl?.getAttribute('data-photo-url');
      if (attrUrl) return attrUrl;

      const backgroundImage = imageEl ? getComputedStyle(imageEl).backgroundImage : '';
      const match = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      return match?.[1] || '';
    }

    function parseAccountElement(el) {
      const normalized = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!normalized) return null;

      const emailFromField = el.value || el.querySelector('.account-email')?.textContent || '';
      const emails = emailFromField.match(emailRegex) || normalized.match(emailRegex) || [];
      if (emails.length === 0) return null;

      const email = emails[0];
      const name = el.querySelector('.account-name')?.textContent?.replace(/\s+/g, ' ').trim() || normalized.replace(email, '').trim() || email;
      return { email, name, imageUrl: getImageUrl(el) };
    }

    function extractAccounts() {
      const fromDataset = [...document.querySelectorAll('[data-email]')].map((el) => ({
        email: el.getAttribute('data-email'),
        name: el.getAttribute('data-name') ?? el.textContent.replace(/\s+/g, ' ').trim(),
        imageUrl: getImageUrl(el)
      }));

      const fromButtons = [...document.querySelectorAll('button[id^="choose-account-"], [role="button"][id^="choose-account-"]')]
        .map(parseAccountElement)
        .filter(Boolean);

      const fromPageText = (document.body.innerText.match(emailRegex) || []).map((email) => ({
        email,
        name: email
      }));

      const accounts = uniqueAccounts([...fromDataset, ...fromButtons, ...fromPageText]);

      if (accounts.length > 0) {
        chrome.runtime.sendMessage({ type: 'ACCOUNTS_RESULT', accounts });
      }
    }

    extractAccounts();
    setTimeout(extractAccounts, 1000);
    setTimeout(extractAccounts, 3000);
  }
})();
