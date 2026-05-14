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
})();
