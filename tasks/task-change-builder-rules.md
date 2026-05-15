# Task: <tên task ngắn>

## User prompt

Thay đổi cấu trúc xây dựng builder rules
1. Xây dựng rule theo url page. Khi load trang page sẽ kiểm tra các match type có lưu hay chưa, nếu chưa thì cho phép tạo rule theo các match type. Các match type bao gồm startsWith, contains, endsWith, startsAndEndsWith,  containsAll (có nhiều giá trị), (không phân biệt hoa thường)
2. Khi load page xong, thì tự động check tất cả match rule trên, nếu có thì hiện rule và hiển thị trạng thái đã lưu. Chưa thì cho phép thêm rule với các match type trên. 
3. Thay đổi inject panel UI thành các bước thực hiện, đầu tiên là match url => tìm element => config execute sequence đối với các element tìm được (wait, click, fill (cố định, lấy giá trị trong background), extract, run script, gọi background save data) => save rule
    - Các hành động click, fill, extract được thực hiện theo sequence tìm được khi load page.
    - Các hành động wait có thể insert giữa các hành động click, fill, extract. 
    - 

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
