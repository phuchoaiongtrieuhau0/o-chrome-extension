# Task: realtime database safe sync

## User prompt

Bổ sung database quản lý dữ liệu, sử dụng realtime database của google, sử dụng `secret` trong url.

Phạm vi đã xác nhận:

- Triển khai lưu config, sync dữ liệu Gmail/current email, popup xem/copy/export JSON, xem realtime list/detail.
- Bổ sung cấu hình selector theo domain để lấy thông tin web page.
- Thu thập selector chỉ chạy khi user bấm thủ công trong popup hoặc nút nổi trên web page.
- Realtime auth dùng DB URL + secret theo yêu cầu user.

## Thông tin cần xác nhận

- [x] Cần hỏi user trước khi làm

Câu hỏi cần xác nhận:

- Phạm vi thu thập secret/2FA: ban đầu chọn an toàn; sau đó user yêu cầu cấu hình lấy web page, có popup + nút nổi, cho phép `value` khi selector cấu hình rõ và bấm thủ công.
- Auth realtime: chọn DB URL + secret.

## Checklist triển khai

- [x] Đọc yêu cầu user và xác định phạm vi thay đổi
- [x] Kiểm tra rule bắt buộc trong `AGENTS.md`
- [x] Xác định file/thư mục cần chỉnh
- [x] Triển khai module realtime database local-first
- [x] Cập nhật background để Gmail check lưu current email và sync realtime
- [x] Thêm UI popup cấu hình DB URL/secret
- [x] Thêm UI xem/copy/export JSON current email
- [x] Thêm UI xem danh sách và chi tiết dữ liệu realtime
- [x] Giữ cấu hình realtime khi bấm `btn-clear-data`
- [x] Loại bỏ copy value nhạy cảm khỏi DOM helper
- [x] Thêm storage config selector theo domain
- [x] Thêm background action get/save/collect/sync selector
- [x] Thêm content script nút nổi collect thủ công
- [x] Thêm popup UI cấu hình selector label/css/mode/attr/multiple
- [x] Lưu kết quả collect vào `data.selectorCollections[domain]` của current email
- [x] Kiểm tra lại thay đổi phù hợp yêu cầu
- [x] Cập nhật `.opushforce.message` đúng format trong `AGENTS.md`
- [x] Di chuyển file task vào `tasks/done`, đồng thời cập nhật tên task

## File liên quan

- `extension/src/core/realtime-db.js`
- `extension/src/core/storage.js`
- `extension/src/background.js`
- `extension/src/content.js`
- `extension/src/popup/popup.html`
- `extension/src/popup/popup.js`
- `extension/src/popup/popup.css`
- `.opushforce.message`
- `tasks/done/realtime-database-safe-sync.md`

## Kết quả kiểm tra

- Đã chạy:
  - `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\core\storage.js"`
  - `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\core\realtime-db.js"`
  - `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\background.js"`
  - `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\content.js"`
  - `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\popup\popup.js"`
- Kết quả: OK.

## Ghi chú cho lần sau

- Collector không tự động quét DOM khi page load; chỉ inject nút nổi nếu domain được bật.
- `mode=text` không lấy input value.
- `mode=attr` + `attr=value` mới lấy `.value`, và chỉ khi user bấm collect.
