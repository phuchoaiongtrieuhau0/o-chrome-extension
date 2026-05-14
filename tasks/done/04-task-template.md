# Task: <detect-gmail-account-and clear browser data>

## User prompt

1. Trong tab ` Cài đặt` của extension, thêm 1 nút `Xóa dữ liệu trình duyệt`, thực hiện giống như xóa cookie, local storage (giống như `clear data browser` trên các app)
2. Trong tab `Home` Bổ sung chức năng kiểm tra tài khoản gmail nào đã đăng nhập, bằng cách mở một tab ẩn để lấy tài khoản đã đăng nhập theo: 

accounts.google.com/SignOutOptions — cực nhẹ, load ngay
Trang này liệt kê tất cả accounts đang đăng nhập, DOM rất đơn giản:
javascript// content.js
if (location.pathname === '/SignOutOptions') {
  const accounts = [...document.querySelectorAll('[data-email]')]
    .map(el => ({
      email: el.getAttribute('data-email'),
      name: el.getAttribute('data-name') ?? el.textContent.trim()
    }));

  chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, (tabId) => {
    chrome.runtime.sendMessage({ type: 'ACCOUNTS_RESULT', tabId, accounts });
  });
}
javascript// background.js
async function getAccountsHeadless() {
  return new Promise((resolve) => {
    chrome.tabs.create(
      { url: 'https://accounts.google.com/SignOutOptions', active: false },
      (tab) => {
        const timer = setTimeout(() => {
          chrome.tabs.remove(tab.id);
          resolve([]);
        }, 5000);

        chrome.runtime.onMessage.addListener(function handler(msg) {
          if (msg.type === 'ACCOUNTS_RESULT' && msg.tabId === tab.id) {
            clearTimeout(timer);
            chrome.tabs.remove(tab.id);
            chrome.runtime.onMessage.removeListener(handler);
            resolve(msg.accounts);
          }
        });
      }
    );
  });
}


Selector [data-email] có thể thay đổi tùy phiên bản — nên log DOM ra kiểm tra trước. Nếu không có data-email, fallback sang fetch ListAccounts từ trang này (same-origin, không bị block). 
 

## Thông tin cần xác nhận

Agent điền mục này nếu prompt thiếu dữ liệu cần thiết để triển khai đúng.

- [ ] Không cần hỏi thêm
- [ ] Cần hỏi user trước khi làm

Câu hỏi cần xác nhận:

-

## Checklist triển khai

Agent tự tạo checklist từ `User prompt`, rồi đánh dấu khi từng bước hoàn tất.

- [x] Đọc yêu cầu user và xác định phạm vi thay đổi
- [x] Kiểm tra rule bắt buộc trong `AGENTS.md`
- [x] Xác định file/thư mục cần chỉnh
- [x] Triển khai thay đổi cần thiết
- [x] Kiểm tra lại thay đổi phù hợp yêu cầu
- [x] Cập nhật `.opushforce.message` đúng format trong `AGENTS.md`
- [x] Trả lời user ngắn gọn kèm file đã chỉnh

## File liên quan

Agent cập nhật danh sách file đã đọc/chỉnh.

- AGENTS.md
- .opushforce.message
- extension/src/background.js
- extension/src/content.js
- tasks/04-task-template copy.md

## Kết quả kiểm tra

Agent ghi command đã chạy hoặc lý do không chạy.

- Đã chạy: `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\content.js"`
- Kết quả: pass, không có lỗi syntax.

## Ghi chú cho lần sau

Chỉ ghi thông tin hữu ích trực tiếp cho task này, không thay cho memory dài hạn.

- Trang `SignOutOptions` không ổn định selector; ưu tiên fallback parse text của `button[id^="choose-account-"]` và regex email toàn trang.
- Nếu Google đổi DOM tiếp, có thể cần thêm fallback network/API cùng origin.
