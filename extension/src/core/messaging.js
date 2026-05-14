// CORE: messaging — wrapper chrome.runtime messaging
// Gửi: send('ACTION_NAME', { data })
// Nhận: onMessage('ACTION_NAME', async (payload) => { ... })

import { err, log } from './logger.js';

const TAG = 'messaging';
const handlers = new Map();

export function send(action, payload = {}) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action, payload }, (response) => {
        if (chrome.runtime.lastError) {
          err(TAG, 'send error', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response);
      });
    } catch (e) {
      err(TAG, 'send failed', action, e);
      resolve(null);
    }
  });
}

export function onMessage(action, handler) {
  handlers.set(action, handler);
}

// Gọi 1 lần trong background.js
export function initMessageRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, payload } = message || {};
    const handler = handlers.get(action);
    if (!handler) return false;
    log(TAG, 'received', action);
    handler(payload, sender)
      .then(sendResponse)
      .catch((e) => { err(TAG, 'handler error', action, e); sendResponse(null); });
    return true; // async response
  });
}
