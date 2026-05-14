# My Personal Chrome Extension

Extension cá nhân để tự động hóa công việc hằng ngày.

## Cài đặt lần đầu

1. Vào [Releases](../../releases/latest) → tải `extension.crx`
2. Mở `chrome://extensions` → bật **Developer mode**
3. Kéo thả file `.crx` vào trang → bấm "Add extension"
4. Ghi lại **Extension ID** (chuỗi 32 ký tự dưới icon extension)
5. Vào repo → Settings → Secrets → cập nhật `EXTENSION_ID` = ID vừa ghi

## Cập nhật

**Tự động**: Chrome định kỳ kiểm tra và tự cập nhật.

**Thủ công**: `chrome://extensions` → bấm nút ⟳ "Update".

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
