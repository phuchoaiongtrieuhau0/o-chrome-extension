# Task: Thay đổi UI phần pop-up của chrome extension

## User prompt

> Thay đổi phần giao diện của pop-up 

- Làm giao diện pop-up đẹp hơn, hiện đại hơn.
- Tổ chức thành nhiều tab để quản lý theo chức năng, các chức năng hiện tại, đưa vào tab quản trị. Phần name và phiên bản, link để click quản lý Extension vẫn giữ nguyên ở trên cùng, bất kỳ chọn tab nào thì nó vẫn hiện.
- Các tab có emoij ở các tab để thể hiện chức năng.
- trong tab quản trị này bổ sung các link check update, download zip và crx, không thể hiện đầy đủ, chỉ tên file thôi, nhưng khi click vào đầy đủ, và có nút copy link, tải file crx

## Thông tin cần xác nhận

Agent điền mục này nếu prompt thiếu dữ liệu cần thiết để triển khai đúng.

- [x] Không cần hỏi thêm
- [ ] Cần hỏi user trước khi làm

Câu hỏi cần xác nhận:

- Không cần. Spec đã đủ thông tin. `<USER>` và `<REPO>` để placeholder, user tự thay sau.

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

- `CHROME_EXTENSION_SPEC.md` — đọc toàn bộ
- `.gitignore` — tạo mới
- `extension/manifest.json` — tạo mới
- `extension/icons/icon16.svg` — tạo mới
- `extension/icons/icon32.svg` — tạo mới
- `extension/icons/icon48.svg` — tạo mới
- `extension/icons/icon128.svg` — tạo mới
- `extension/src/core/logger.js` — tạo mới
- `extension/src/core/storage.js` — tạo mới
- `extension/src/core/messaging.js` — tạo mới
- `extension/src/core/updater.js` — tạo mới
- `extension/src/features/hello-world/index.js` — tạo mới
- `extension/src/background.js` — tạo mới
- `extension/src/content.js` — tạo mới
- `extension/src/popup/popup.html` — tạo mới
- `extension/src/popup/popup.css` — tạo mới
- `extension/src/popup/popup.js` — tạo mới
- `extension/src/options/options.html` — tạo mới
- `extension/src/options/options.css` — tạo mới
- `extension/src/options/options.js` — tạo mới
- `extension/src/sidepanel/sidepanel.html` — tạo mới
- `extension/src/sidepanel/sidepanel.js` — tạo mới
- `update-server/updates.xml` — tạo mới
- `scripts/set-version.js` — tạo mới
- `.github/workflows/release.yml` — tạo mới
- `README.md` — tạo mới

## Kết quả kiểm tra

- Toàn bộ 25 file tạo thành công theo đúng cấu trúc spec
- `<USER>` và `<REPO>` còn là placeholder trong `manifest.json`, `updates.xml`, `README.md` — user tự thay sau khi có repo
- `extension.pem` đã có trong `.gitignore`, không commit
- GitHub Secrets (`CRX_PRIVATE_KEY`, `EXTENSION_ID`) cần user tự set — xem README

## Ghi chú cho lần sau

- Khi thêm feature mới: tạo `extension/src/features/<tên>/index.js` + thêm 2 dòng vào `background.js`
- KHÔNG sửa `manifest.json` hay `release.yml` khi thêm feature
- Nhớ thay `<USER>/<REPO>` trong `manifest.json` và `update-server/updates.xml` trước khi push lần đầu
