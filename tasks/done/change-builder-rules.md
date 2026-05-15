# Task: change-builder-rules

## User prompt

Thay đổi cấu trúc xây dựng builder rules
1. Xây dựng rule theo url page. Khi load trang page sẽ kiểm tra các match type có lưu hay chưa, nếu chưa thì cho phép tạo rule theo các match type. Các match type bao gồm startsWith, contains, endsWith, startsAndEndsWith,  containsAll (có nhiều giá trị), (không phân biệt hoa thường)
2. Khi load page xong, thì tự động check tất cả match rule trên, nếu có thì hiện rule và hiển thị trạng thái đã lưu. Chưa thì cho phép thêm rule với các match type trên.
3. Thay đổi inject panel UI thành các bước thực hiện, đầu tiên là match url => tìm element => config execute sequence đối với các element tìm được (wait, click, fill (cố định, lấy giá trị trong background), extract, run script, gọi background save data) => save rule
    - Các hành động click, fill, extract được thực hiện theo sequence tìm được khi load page.
    - Các hành động wait có thể insert giữa các hành động click, fill, extract.
    - Lưu ý: vẫn giữ lại chức năng pick selector, xpath, để dùng UI thực hiện chọn các element.

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
- [x] Di chuyển file task vào `tasks/done`, đồng thời cập nhật <tên task ngắn>, đổi tên file <template> thay bằng <tên task ngắn không dấu>

## File liên quan

- `extension/src/content.js`
- `extension/src/background.js`
- `.opushforce.message`
- `tasks/done/change-builder-rules.md`

## Kết quả kiểm tra

- `node --check "h:\nodejs-tester\o-chrome-extension\extension\src\content.js" && node --check "h:\nodejs-tester\o-chrome-extension\extension\src\background.js"` → OK

## Ghi chú cho lần sau

- Builder UI giữ Finder/Pick selector/xpath; rule mới lưu trong `pageRules` của selector config theo domain.
