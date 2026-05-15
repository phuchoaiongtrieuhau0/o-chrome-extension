# Task: <tên task ngắn>

## User prompt

Hãy đọc file `tasks/templates/AGENT_PROMPT_RULE.md` để bổ sung cách xử lý rule vào dự án này, phải tuân thủ cấu trúc codebase hiện tại, chỉ lấy ý tưởng và xử lý cấu hình phần Rule để collect data web page.

Dựa vào file `tasks/templates/AGENT_PROMPT_RULE.md`, nhưng phải bổ sung cách cấu hình vào thu thập theo chức năng UI thế này:

1. Inject vào tất cả page khi truy cập, chèn thêm một panel bottom fix bao gồm các chức năng để `load rule`, `save rule`, `dry-run rule`, `view rule`, `Copy all element active tab để manual find element`, `trace log rule` ...

## Thông tin cần xác nhận

Agent điền mục này nếu prompt thiếu dữ liệu cần thiết để triển khai đúng.

- [ ] Không cần hỏi thêm
- [ ] Cần hỏi user trước khi làm

Câu hỏi cần xác nhận:

-

## Checklist triển khai

Agent tự tạo checklist từ `User prompt`, rồi đánh dấu khi từng bước hoàn tất.

- [ ] Đọc yêu cầu user và xác định phạm vi thay đổi
- [ ] Kiểm tra rule bắt buộc trong `AGENTS.md`
- [ ] Xác định file/thư mục cần chỉnh
- [ ] Triển khai thay đổi cần thiết
- [ ] Kiểm tra lại thay đổi phù hợp yêu cầu
- [ ] Cập nhật `.opushforce.message` đúng format trong `AGENTS.md`
- [ ] Trả lời user ngắn gọn kèm file đã chỉnh
- [ ] Di chuyển file task vào `tasks/done`, đồng thời cập nhật <tên task ngắn>, đổi tên file <template> thay bằng <tên task ngắn không dấu>

## File liên quan

Agent cập nhật danh sách file đã đọc/chỉnh.

-

## Kết quả kiểm tra

Agent ghi command đã chạy hoặc lý do không chạy.

-

## Ghi chú cho lần sau

Chỉ ghi thông tin hữu ích trực tiếp cho task này, không thay cho memory dài hạn.

-
