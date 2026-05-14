# My Personal Chrome Extension

Extension cá nhân để tự động hóa công việc hằng ngày.

## Cài đặt & Tự động cập nhật (Windows)

Do Chrome chặn cài file `.crx` trực tiếp, bạn nên dùng cơ chế **Registry** để Chrome tự cài và tự cập nhật (không bị hiện cảnh báo Developer mode):

1. **Lấy ID**: Cài thử bản folder ("Load unpacked") một lần để lấy **Extension ID**.
2. **Tạo file `.reg`**: Tạo file `install.reg` với nội dung:
   ```reg
   Windows Registry Editor Version 5.00
   [HKEY_CURRENT_USER\Software\Google\Chrome\Extensions\<ID_CUA_BAN>]
   "update_url"="https://phuchoaiongtrieuhau0.github.io/o-chrome-extension/updates.xml"
   ```
3. **Chạy file `.reg`**: Click đúp -> Yes -> Khởi động lại Chrome.
4. **Xóa bản cũ**: Xóa bản "Load unpacked" đi. Chrome sẽ tự tải bản chính thức từ GitHub về.

## Cài đặt thủ công (cho Developer)
1. Vào [Releases](../../releases/latest) → tải `extension.zip`
2. Giải nén vào một folder.
3. Mở `chrome://extensions` → bật **Developer mode**
4. Chọn **Load unpacked** → chọn folder vừa giải nén.
   *Lưu ý: Cách này không hỗ trợ tự động cập nhật của Chrome.*

## Cài đặt trên Android (Kiwi Browser)

1. Tải **Kiwi Browser** từ Play Store.
2. Tải file **`extension.crx`** từ GitHub Release (không dùng file .zip nếu muốn tự động cập nhật).
3. Mở Kiwi, vào menu (3 chấm) -> **Extensions**.
4. Bật **Developer mode**.
5. Bấm **+ (from .zip/.crx/.user.js)** -> chọn file `extension.crx` vừa tải.
6. **Tự động cập nhật**: Khi cài bằng file `.crx`, Kiwi sẽ tự động kiểm tra và cập nhật bản mới từ GitHub y hệt trên máy tính.

## Cập nhật
...

## Thêm tính năng mới

```bash
# 1. Tạo folder feature mới
cp -r extension/src/features/hello-world extension/src/features/my-new-feature

# 2. Sửa FEATURE_NAME và logic trong index.js

# 3. Đăng ký trong background.js (thêm 2 dòng):
#    import { register as registerMyNewFeature } from './features/my-new-feature/index.js';
#    await registerMyNewFeature();

# 4. Commit và push lên main → tự động build + release
git add .
git commit -m "feat: add my-new-feature"
git push origin main
```

## Release tự động

Mỗi push lên `main`:
- Version tăng tự động (`1.0.<BUILD_NUMBER>`)
- Build `.crx` + `.zip`
- Overwrite GitHub Release `latest`
- Deploy `updates.xml` lên GitHub Pages
- Chrome client tự cập nhật trong ~6 giờ

## URL cố định (không bao giờ thay đổi)

| Mục đích | URL |
|---|---|
| Update manifest | `https://<USER>.github.io/<REPO>/updates.xml` |
| Tải CRX mới nhất | `https://github.com/<USER>/<REPO>/releases/latest/download/extension.crx` |
| Tải ZIP mới nhất | `https://github.com/<USER>/<REPO>/releases/latest/download/extension.zip` |

## Thiết lập GitHub (lần đầu)

### 1. Bật GitHub Pages
```
Settings → Pages → Source: Deploy from branch → Branch: gh-pages / root
```

### 2. Tạo PEM key
```bash
openssl genrsa -out extension.pem 2048
cat extension.pem
```

### 3. Lưu Secrets vào GitHub
```
Settings → Secrets and variables → Actions → New repository secret

CRX_PRIVATE_KEY  = nội dung file extension.pem
EXTENSION_ID     = để trống tạm, điền sau bước cài lần đầu
```

> ⚠️ `extension.pem` KHÔNG commit lên git (đã có trong `.gitignore`)
