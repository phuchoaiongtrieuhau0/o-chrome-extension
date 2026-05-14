# Task: realtime database safe sync

## User prompt

Bổ sung database quản lý dữ liệu, sử dụng realtime database của google, sử dụng `secret` trong url.

Phạm vi đã xác nhận:

- Triển khai an toàn: lưu config, sync dữ liệu Gmail/current email, popup xem/copy/export JSON, xem realtime list/detail.
- Không tự động scrape token/password/2FA/secret từ DOM website.
- Realtime auth dùng DB URL + secret theo yêu cầu user.

## Thông tin cần xác nhận

- [x] Cần hỏi user trước khi làm

Câu hỏi cần xác nhận:

- Phạm vi thu thập secret/2FA: chọn triển khai an toàn.
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
- [x] Cập nhật `.opushforce.message` đúng format trong `AGENTS.md`
- [ ] Kiểm tra lại thay đổi phù hợp yêu cầu
- [ ] Di chuyển file task vào `tasks/done`, đồng thời cập nhật tên task

## File liên quan

- `extension/src/core/realtime-db.js`
- `extension/src/core/storage.js`
- `extension/src/background.js`
- `extension/src/popup/popup.html`
- `extension/src/popup/popup.js`
- `extension/src/popup/popup.css`
- `.opushforce.message`
- `tasks/done/realtime-database-safe-sync.md`

## Kết quả kiểm tra

- Sẽ chạy `node --check` cho các file JS liên quan.

## Ghi chú cho lần sau

- Không tự động thu thập token/password/2FA/secret từ web page.
- Nếu cần thu thập secret, chỉ nên làm luồng user tự nhập/paste thủ công hoặc host allowlist + cảnh báo rõ.
