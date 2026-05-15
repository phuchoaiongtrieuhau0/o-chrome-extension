# Task: rule panel collect web page

## User prompt

Hãy đọc file `tasks/templates/AGENT_PROMPT_RULE.md` để bổ sung cách xử lý rule vào dự án này, phải tuân thủ cấu trúc codebase hiện tại, chỉ lấy ý tưởng và xử lý cấu hình phần Rule để collect data web page.

Dựa vào file `tasks/templates/AGENT_PROMPT_RULE.md`, nhưng phải bổ sung cách cấu hình vào thu thập theo chức năng UI thế này:

==> Inject vào tất cả page khi truy cập, chèn thêm một panel bottom fix bao gồm các chức năng để `load rule`, `save rule`, `dry-run rule`, `view rule`, `Copy all element active tab để manual find element`, `trace log rule` ...

Bổ sung thêm:

1. Hướng dẫn cấu hình rule, mở một html mới để xem cách cấu hình.
2. Tìm element theo loại như input/button/link/text và theo giá trị hiển thị trên page, show selector/xpath để copy.
3. Bổ sung form build rule trực tiếp trên panel.

## Thông tin cần xác nhận

- [x] Không cần hỏi thêm
- [ ] Cần hỏi user trước khi làm

Câu hỏi cần xác nhận:

- Không có

## Checklist triển khai

- [x] Đọc yêu cầu user và xác định phạm vi thay đổi
- [x] Kiểm tra rule bắt buộc trong `AGENTS.md`
- [x] Xác định file/thư mục cần chỉnh
- [x] Triển khai thay đổi cần thiết
- [x] Kiểm tra lại thay đổi phù hợp yêu cầu
- [x] Cập nhật `.opushforce.message` đúng format trong `AGENTS.md`
- [x] Trả lời user ngắn gọn kèm file đã chỉnh
- [x] Di chuyển file task vào `tasks/done`, đồng thời cập nhật tên task ngắn, đổi tên file template thay bằng tên task ngắn không dấu

## File liên quan

- `extension/src/content.js`
- `extension/manifest.json`
- `extension/src/rule-guide/rule-guide.html`
- `extension/src/rule-guide/rule-guide.js`
- `tasks/done/rule-panel-collect-web-page.md`
- `.opushforce.message`

## Kết quả kiểm tra

- `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\content.js"`
- `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\rule-guide\rule-guide.js"`
- `node -e "JSON.parse(require('fs').readFileSync('h:/nodejs-tester/o-chrome-extension/extension/manifest.json','utf8')); console.log('manifest ok')"`

## Ghi chú cho lần sau

- Rule panel dùng Shadow DOM trong content script để tránh CSS của web page ảnh hưởng UI.
- Config vẫn dùng schema hiện có `selectorCollector:configs:v1`, thêm `traceLog` và `guideRules` trong config domain.
- Finder cap 100 kết quả visible, dùng selector/xpath từ page hiện tại để copy hoặc đưa vào Builder.
- Guide mở `extension/src/rule-guide/rule-guide.html` qua `chrome.runtime.getURL`.
- Panel bottom fixed tạo spacer cuối `body` và CSS variable height để page tự có scrollbar, tránh che element cuối trang.
- Cần reload extension rồi reload page web để content script inject lại panel.
