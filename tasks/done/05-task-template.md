# Task: <store-data>

## User prompt

- Fix lỗi: trên mobile không đè chồng được phiên bản đang cài, mà phát sinh phiên bản mới

## Thông tin cần xác nhận

Agent điền mục này nếu prompt thiếu dữ liệu cần thiết để triển khai đúng.

- [x] Không cần hỏi thêm
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

- `AGENTS.md` — đã đọc rule bắt buộc
- `extension/manifest.json` — thêm `key` public cố định để Chrome/Kiwi giữ nguyên extension ID
- `update-server/updates.xml` — đã kiểm tra appid hiện tại
- `.opushforce.message` — cập nhật tóm tắt task

## Kết quả kiểm tra

Agent ghi command đã chạy hoặc lý do không chạy.

- `node -e "const fs=require('fs');const crypto=require('crypto');const key=crypto.createPublicKey(fs.readFileSync('extension.pem'));process.stdout.write(key.export({type:'spki',format:'der'}).toString('base64'))"`
- `node -e "const fs=require('fs');const crypto=require('crypto');const key=crypto.createPublicKey(fs.readFileSync('extension.pem')).export({type:'spki',format:'der'});const h=crypto.createHash('sha256').update(key).digest();const id=[...h.subarray(0,16)].map(b=>String.fromCharCode(97+(b>>4))+String.fromCharCode(97+(b&15))).join('');console.log(id)"` → `fpbkecaphicbpfefggeeecdlajmmbpog`

## Ghi chú cho lần sau

Chỉ ghi thông tin hữu ích trực tiếp cho task này, không thay cho memory dài hạn.

- Khi cài `.crx` thủ công trên mobile/Kiwi, extension phải có cùng ID mới ghi đè/cập nhật bản cũ; `key` trong manifest giúp ID ổn định theo `extension.pem`.
