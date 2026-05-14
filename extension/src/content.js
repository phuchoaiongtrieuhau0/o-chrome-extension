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

    function parseAccountText(text) {
      const normalized = text.replace(/\s+/g, ' ').trim();
      if (!normalized) return null;

      const emails = normalized.match(emailRegex) || [];
      if (emails.length === 0) return null;

      const email = emails[0];
      const name = normalized.replace(email, '').trim() || email;
      return { email, name };
    }

    function extractAccounts() {
      const fromDataset = [...document.querySelectorAll('[data-email]')].map((el) => ({
        email: el.getAttribute('data-email'),
        name: el.getAttribute('data-name') ?? el.textContent.replace(/\s+/g, ' ').trim()
      }));

      const fromButtons = [...document.querySelectorAll('button[id^="choose-account-"], [role="button"][id^="choose-account-"]')]
        .map((el) => parseAccountText(el.textContent || ''))
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
