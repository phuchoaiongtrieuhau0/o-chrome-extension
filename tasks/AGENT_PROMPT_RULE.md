# AGENT PROMPT — Chrome Extension: Web Automation Config

> **Dùng cho AI coding agent (Claude Code, Cursor, Aider, v.v.)**
> Đọc toàn bộ tài liệu này trước khi bắt đầu viết code.
> Không được bỏ qua hoặc đơn giản hoá bất kỳ mục nào.

---

## 1. Mục tiêu dự án

Xây dựng một **Chrome Extension** (Manifest V3) cho phép người dùng:

1. **Cấu hình rules** — mỗi rule gắn với một URL pattern, chứa danh sách actions (fill input, click, extract data, run custom JS).
2. **Tự động chạy** các actions đó khi trình duyệt load đúng trang.
3. **Tìm và lưu element selector** trên mobile mà **không cần DevTools** — dùng Pick Mode (tap) hoặc Text Search.
4. **Test thử script/action** ngay trên trang trước khi lưu rule.
5. **Chia sẻ biến (variables)** giữa background script và content script để điền form tự động.

**Target browser:** Chrome trên Kiwi Browser (Android) và Chrome Desktop.

---

## 2. Cấu trúc thư mục bắt buộc

```
/
├── manifest.json
├── background/
│   └── service_worker.js
├── content/
│   ├── index.js              # entry, lắng nghe message từ background
│   ├── pageMatcher.js        # so URL với rules
│   ├── actionRunner.js       # thực thi từng action type
│   ├── elementFinder.js      # tìm element theo text/attribute
│   ├── selectorGenerator.js  # sinh CSS selector + XPath tối ưu
│   ├── pickMode.js           # tap-to-pick trên mobile
│   └── overlay/
│       ├── overlay.js        # inject/remove overlay UI
│       └── overlay.css       # style cho overlay (injected vào Shadow DOM)
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── shared/
    ├── storage.js            # wrapper chrome.storage API
    ├── constants.js
    └── utils.js
```

---

## 3. manifest.json

```json
{
  "manifest_version": 3,
  "name": "AutoWeb Config",
  "version": "1.0.0",
  "description": "Tự động hoá thao tác web theo cấu hình rule",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "tabs"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background/service_worker.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/index.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "action": {
    "default_popup": "popup/popup.html"
  },
  "options_page": "options/options.html"
}
```

---

## 4. Data Model (chrome.storage.local)

### 4.1 Rules

```ts
// Key: "rules"  →  Rule[]
interface Rule {
  id: string;           // uuid v4
  name: string;
  enabled: boolean;
  urlPattern: string;   // vd: "https://app.supabase.com/project/*"
  matchType: 'startsWith' | 'contains' | 'exact' | 'regex';
  trigger: 'auto' | 'manual';
  delay: number;        // ms chờ sau page load, default 1500
  actions: Action[];
  createdAt: number;
  updatedAt: number;
}
```

### 4.2 Actions

```ts
type ActionType = 'fill' | 'click' | 'extract' | 'wait' | 'script';

interface Action {
  id: string;
  type: ActionType;
  label: string;

  // Selector (dùng cho fill / click / extract)
  selector?: string;             // CSS selector chính
  selectorFallbacks?: string[];  // CSS hoặc XPath, thử lần lượt khi selector chính thất bại

  // fill
  value?: string;             // giá trị tĩnh hoặc "{{varName}}"
  triggerEvents?: boolean;    // dispatch input + change event, default true

  // extract
  saveAs?: string;            // tên biến lưu vào variables + savedData
  attribute?: string;         // lấy attribute thay vì innerText, vd: "value", "href", "data-x"
  transform?: 'none' | 'trim' | 'parseNumber' | 'regex';
  transformArg?: string;      // nếu transform = 'regex': pattern string

  // wait
  waitFor?: 'time' | 'element' | 'url';
  timeout?: number;           // ms

  // script — custom JS chạy trong content script context của trang
  // Script có thể dùng __awVars__ (object variables từ background)
  // Script PHẢI return một value hoặc Promise<value>
  // Nếu return null hoặc undefined → không lưu
  // Nếu có saveAs → lưu return value vào variables + savedData
  script?: string;

  waitAfter?: number;         // ms chờ sau khi action xong, trước khi chạy action tiếp
}
```

**Ví dụ action script lấy Supabase JWT Expiry Key:**

```json
{
  "id": "act-supabase-key",
  "type": "script",
  "label": "Lấy Expiry JWT key từ Supabase",
  "saveAs": "supabase_expiry_key",
  "script": "const btn = document.querySelector('[data-testid=\"jwt-secret-expiry-toggle\"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Expiry')); if (!btn) throw new Error('Không tìm thấy toggle button'); btn.click(); await new Promise(r => setTimeout(r, 800)); const menuItem = document.querySelector('[role=\"option\"][data-value=\"expiry\"]') || document.querySelector('.dropdown-menu .expiry-key'); if (!menuItem) throw new Error('Không tìm thấy menu item'); menuItem.click(); await new Promise(r => setTimeout(r, 500)); const input = document.querySelector('input[name=\"expiry-key\"]'); return input?.value || null;"
}
```

### 4.3 Variables

```ts
// Key: "variables"  →  Record<string, string>
// Dùng để điền vào action.value qua template {{varName}}
// Ví dụ:
{
  "username": "myuser",
  "password": "s3cr3t",
  "supabase_url": "https://xxx.supabase.co",
  "supabase_expiry_key": ""   // runtime, được extract tự động bởi rule
}
```

### 4.4 Saved Data (lịch sử extract)

```ts
// Key: "savedData"  →  Record<string, SavedEntry[]>
interface SavedEntry {
  value: string;
  url: string;
  timestamp: number;
}
// Giữ tối đa 50 entries mỗi key, xoá entry cũ nhất khi vượt quá.
```

---

## 5. Background Service Worker

File: `background/service_worker.js`

### 5.1 Nhiệm vụ

- Lắng nghe messages từ content script và popup.
- Cung cấp variables cho content script khi được yêu cầu.
- Nhận và lưu extracted data vào `savedData`.
- Mở Options page khi cần.
- Inject overlay script vào active tab khi popup yêu cầu.

### 5.2 Message protocol

Tất cả messages dùng format:

```ts
interface Message {
  type: string;
  payload?: any;
}
```

Các message types background phải handle:

| type | payload | response |
|------|---------|----------|
| `GET_VARIABLES` | — | `Record<string, string>` toàn bộ variables |
| `SET_VARIABLE` | `{ key: string, value: string }` | `{ ok: true }` |
| `SAVE_EXTRACTED` | `{ key: string, value: string, url: string }` | `{ ok: true }` |
| `GET_RULES` | — | `Rule[]` |
| `SAVE_RULE` | `Rule` | `{ ok: true }` |
| `DELETE_RULE` | `{ id: string }` | `{ ok: true }` |
| `OPEN_OPTIONS` | — | — |
| `OPEN_OVERLAY` | — | inject overlay vào active tab nếu chưa có |
| `RULE_MATCHED` | `{ ruleIds: string[] }` | — (chỉ để log/debug) |

### 5.3 Inject content script khi cần

Khi nhận `OPEN_OVERLAY` từ popup:

```js
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['content/index.js']
});
// Sau đó gửi message RUN_OVERLAY đến tab
chrome.tabs.sendMessage(tab.id, { type: 'OPEN_OVERLAY' });
```

---

## 6. Content Script

### 6.1 `content/index.js` — Entry point

Logic khi script load:

```
1. Kiểm tra đã inject chưa (idempotent guard)
   if (window.__autoweb_injected__) return;
   window.__autoweb_injected__ = true;

2. Lấy rules từ background: sendMessage({ type: 'GET_RULES' })

3. Gọi pageMatcher → lấy danh sách rules khớp URL hiện tại

4. Báo background: { type: 'RULE_MATCHED', payload: { ruleIds: matched.map(r => r.id) } }

5. Auto trigger: rules có trigger='auto' → setTimeout(delay) → runRule(rule)

6. Lắng nghe chrome.runtime.onMessage:
   - RUN_RULE    → runRule(ruleFromPayload)
   - OPEN_OVERLAY → overlay.open()
   - ENABLE_PICK_MODE → pickMode.enable(callback)
   - TEST_ACTION → testAction(action) → return result
   - TEST_SCRIPT → testScript(script, saveAs) → return result

7. Lắng nghe SPA navigation (URL đổi không reload):
   window.addEventListener('popstate', reinitialize);
   window.addEventListener('hashchange', reinitialize);
   // Với pushState: patch history.pushState để phát custom event
```

### 6.2 `content/pageMatcher.js`

```ts
function matchRules(url: string, rules: Rule[]): Rule[]
```

- Lọc `rule.enabled === true`
- So khớp theo `rule.matchType`:
  - `startsWith`: `url.startsWith(rule.urlPattern)`
  - `contains`: `url.includes(rule.urlPattern)`
  - `exact`: `url === rule.urlPattern`
  - `regex`: bắt lỗi nếu pattern sai, `new RegExp(rule.urlPattern).test(url)`
- Trả về mảng (có thể nhiều rule khớp cùng lúc)

### 6.3 `content/actionRunner.js`

```ts
async function runRule(rule: Rule): Promise<RunResult>
async function runAction(action: Action, vars: Record<string, string>): Promise<ActionResult>
```

**Quy trình xử lý mỗi action:**

1. Resolve value: `resolveVariables(action.value, vars)` — thay `{{varName}}`
2. Tìm element nếu action cần selector
3. Thực thi action (xem chi tiết từng type bên dưới)
4. Nếu có `saveAs` và có return value → gửi `SAVE_EXTRACTED` + `SET_VARIABLE` về background
5. Nếu có `waitAfter` → `await sleep(action.waitAfter)`
6. Push log entry vào overlay log panel (nếu overlay đang mở)
7. Return `{ success: boolean, value?: string, error?: string }`

**Chi tiết từng action type:**

#### `fill`

```js
const el = await findElement(action.selector, action.selectorFallbacks);

// React/Vue/Angular native setter — bắt buộc, el.value = x không trigger re-render
const proto = el.tagName === 'TEXTAREA'
  ? HTMLTextAreaElement.prototype
  : HTMLInputElement.prototype;
const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
nativeSetter?.call(el, resolvedValue);
el.value = resolvedValue; // fallback

if (action.triggerEvents !== false) {
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true }));
}
```

#### `click`

```js
const el = await findElement(action.selector, action.selectorFallbacks);
el.scrollIntoView({ behavior: 'smooth', block: 'center' });
await sleep(200);
el.focus();
el.click();
// Dispatch riêng để đảm bảo cả listener addEventListener lẫn onclick đều nhận
el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
```

#### `extract`

```js
const el = await findElement(action.selector, action.selectorFallbacks);
let value = action.attribute
  ? el.getAttribute(action.attribute)
  : (el.value || el.innerText?.trim() || el.textContent?.trim() || '');

value = applyTransform(value, action.transform, action.transformArg);

if (action.saveAs) {
  await chrome.runtime.sendMessage({ type: 'SET_VARIABLE',   payload: { key: action.saveAs, value } });
  await chrome.runtime.sendMessage({ type: 'SAVE_EXTRACTED', payload: { key: action.saveAs, value, url: location.href } });
}
return value;
```

#### `wait`

```js
switch (action.waitFor) {
  case 'time':    await sleep(action.timeout ?? 1000); break;
  case 'element': await waitForElement(action.selector, action.timeout ?? 10000); break;
  case 'url':     await waitForUrlChange(action.timeout ?? 10000); break;
}
```

#### `script`

```js
// Bước 1: Lấy variables mới nhất từ background
const vars = await chrome.runtime.sendMessage({ type: 'GET_VARIABLES' });

// Bước 2: Wrap script trong async IIFE có sẵn __awVars__ và sleep helper
const wrappedScript = `
  (async function(__awVars__, sleep) {
    ${action.script}
  })(${JSON.stringify(vars)}, (ms) => new Promise(r => setTimeout(r, ms)))
`;

// Bước 3: eval trong content script context
// Lưu ý: eval trong content script có thể truy cập DOM của trang
// Nếu cần truy cập window/JS runtime của trang (vd: React state), cần inject <script> tag
let result;
try {
  result = await eval(wrappedScript);
} catch (err) {
  throw new Error(`Script error: ${err.message}`);
}

// Bước 4: Lưu kết quả nếu có saveAs
if (action.saveAs && result != null) {
  const stringValue = String(result);
  await chrome.runtime.sendMessage({ type: 'SET_VARIABLE',   payload: { key: action.saveAs, value: stringValue } });
  await chrome.runtime.sendMessage({ type: 'SAVE_EXTRACTED', payload: { key: action.saveAs, value: stringValue, url: location.href } });
}
return result;
```

**Lưu ý quan trọng cho `script` type:**

- Script chạy trong **content script context** — có thể truy cập DOM (`document`, `window`) nhưng KHÔNG truy cập được JS variables/closures của trang (vd: không đọc được biến React component state trực tiếp).
- Nếu cần truy cập `window` object của trang (page context), phải inject `<script>` tag vào DOM và dùng `window.postMessage` để truyền kết quả về content script.
- Script có thể dùng `await` tự do — đã được wrap trong async IIFE.
- Script có thể dùng `__awVars__.varName` để đọc variables đã lưu.
- Script có thể dùng `sleep(ms)` helper đã được inject sẵn.
- Script phải `return` giá trị cần lưu; nếu không cần lưu thì không cần return.

### 6.4 `content/elementFinder.js`

#### Hàm chính: `findElementsByText(searchText, options)`

```ts
interface FindOptions {
  exactMatch?: boolean;    // default false — nếu false thì includes()
  caseSensitive?: boolean; // default false
  visibleOnly?: boolean;   // default true
  limit?: number;          // default 10
}

interface ElementResult {
  element: HTMLElement;
  score: number;              // 0-100, dùng để sort
  matchedAttr: string;        // attribute nào khớp, dùng để hiển thị
  tag: string;                // tagName lowercase
  type?: string;              // input type nếu có
  preview: string;            // text ngắn <= 60 ký tự để hiển thị cho user
  selector: string;           // CSS selector tối ưu nhất
  xpath: string;              // XPath tối ưu nhất
  selectorFallbacks: string[]; // 2-3 selector/xpath bổ sung theo strategy khác
}
```

**Thứ tự attribute kiểm tra và score:**

| Attribute | Score |
|-----------|-------|
| `id` | 100 |
| `name` | 95 |
| `aria-label` | 90 |
| `placeholder` | 85 |
| `title` | 80 |
| `data-testid` | 78 |
| `data-id`, `data-name` | 75 |
| `value` (input hiện tại) | 70 |
| `innerText` / `textContent` | 60 |
| `alt` | 50 |

**Tags cần tìm (querySelector all):**

```
button, a, input, select, textarea, label, span, div, p,
h1, h2, h3, h4, li, td, th, option,
[role="button"], [role="option"], [role="menuitem"],
[role="tab"], [role="checkbox"], [role="radio"]
```

**isVisible check:**

```js
function isVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    rect.width > 0 && rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    !el.hasAttribute('hidden')
  );
}
```

#### Hàm phụ: `findElement(selector, fallbacks, timeout)` — dùng trong actionRunner

```
Thuật toán:
1. Thử selector chính (CSS hoặc XPath detect qua isXPath())
2. Nếu không ra → thử lần lượt từng fallback
3. Nếu không ra → sleep(300ms) → retry từ bước 1
4. Lặp cho đến khi hết timeout (default 5000ms)
5. Return null nếu hết timeout (để caller throw Error với context đủ)

XPath: nếu selector bắt đầu bằng '/' hoặc '//' → dùng document.evaluate()
CSS: dùng document.querySelector(), bắt lỗi SyntaxError nếu selector sai
```

### 6.5 `content/selectorGenerator.js`

#### `generateSelector(el): string`

Thứ tự ưu tiên:

1. `#id` — chỉ dùng nếu ID không phải auto-generated
   - Auto-generated patterns cần loại: `/^\d|:r\d+|ember\d+|react-select-\d+|--\d+|_\d{4,}/`
2. `[data-testid="value"]` — nếu unique trong document
3. `[name="value"]` — nếu unique
4. `[aria-label="value"]` — nếu unique
5. `tag.class1.class2` — tối đa 2 stable classes, kiểm tra uniqueness
   - Dynamic classes cần loại: chứa số, hoặc là: `active`, `hover`, `focus`, `selected`, `open`, `visible`, `disabled`, `loading`, `error`
6. Build CSS path từ ancestors (tối đa 3 cấp, ưu tiên ancestor có stable ID hoặc data attribute)

#### `generateXPath(el): string`

Thứ tự ưu tiên:

1. `//{tag}[@id="{id}"]` — nếu ID stable
2. `//{tag}[@name="{name}"]`
3. `//{tag}[@aria-label="{label}"]`
4. `//{tag}[@placeholder="{placeholder}"]`
5. `//{tag}[normalize-space(text())="{text}"]` — nếu text <= 50 ký tự và unique
6. `//{tag}[contains(text(),"{text}")]` — fallback
7. Full path từ root với index

#### `generateFallbacks(el): string[]`

Trả về 2-3 selectors bổ sung dùng strategy khác với selector chính:

- Nếu selector chính là CSS → thêm 1 XPath và 1 CSS khác
- Nếu selector chính là XPath → thêm 1 CSS và 1 XPath khác
- Không trùng với selector chính

### 6.6 `content/pickMode.js`

Pick Mode cho phép người dùng **chạm ngón tay vào element trên trang** để extension tự lấy selector.

```ts
function enablePickMode(onPick: (result: PickResult) => void): () => void  // trả về cleanup fn
function disablePickMode(): void

interface PickResult {
  selector: string;
  xpath: string;
  selectorFallbacks: string[];
  tag: string;
  type?: string;          // input type
  text: string;           // preview text, tối đa 60 ký tự
  inputValue?: string;    // giá trị hiện tại nếu là input/select/textarea
  attributes: Record<string, string>; // id, name, aria-label, placeholder, data-testid
}
```

**Implementation chi tiết:**

```
Bật Pick Mode:
1. Set flag window.__autoweb_pick_active__ = true
2. Inject một full-screen transparent capture layer:
   - div#__autoweb_pick_layer__
   - position: fixed, top:0, left:0, width:100vw, height:100vh
   - z-index: 2147483646 (dưới overlay một chút)
   - background: transparent
   - cursor: crosshair
3. Inject highlight div#__autoweb_highlight__:
   - position: fixed, pointer-events: none
   - outline: 3px solid #7c3aed
   - background: rgba(124,58,237,0.12)
   - transition: all 80ms ease
   - z-index: 2147483645
4. Lắng nghe events trên capture layer:

   touchmove / mousemove:
   - Lấy toạ độ touch/mouse
   - Ẩn capture layer tạm (pointer-events: none) để elementFromPoint xuyên qua
   - targetEl = document.elementFromPoint(x, y)
   - Hiện lại capture layer
   - Bỏ qua nếu targetEl là một phần của overlay (__autoweb_*)
   - Di chuyển highlight div đến bao quanh targetEl (getBoundingClientRect)
   - Hiện tooltip nhỏ ở góc trên trái: "{tag} | {preview text}"

   touchend / click:
   - preventDefault()
   - Ẩn capture layer
   - targetEl = document.elementFromPoint(x, y)
   - Bỏ qua nếu là overlay element
   - Sinh PickResult từ targetEl
   - Gọi onPick(result)
   - disablePickMode()

5. Keydown ESC → disablePickMode()

Tắt Pick Mode:
1. Xoá capture layer và highlight div khỏi DOM
2. Xoá event listeners
3. Xoá flag
```

---

## 7. Overlay UI (inject vào trang)

File: `content/overlay/overlay.js`

Overlay là **bottom sheet** được inject thẳng vào trang web, **không phải popup extension**. Lý do: trên mobile, bàn phím ảo khi bật lên chỉ đẩy trang scroll chứ không che overlay — UX tốt hơn popup.

### 7.1 Shadow DOM — Bắt buộc

```js
// Kiểm tra đã inject chưa
if (document.getElementById('__autoweb_host__')) return;

const host = document.createElement('div');
host.id = '__autoweb_host__';
Object.assign(host.style, {
  position: 'fixed', bottom: '0', left: '0', right: '0',
  zIndex: '2147483647', pointerEvents: 'none' // host không block trang
});

const shadow = host.attachShadow({ mode: 'open' });

// Inject CSS vào shadow root
const style = document.createElement('style');
style.textContent = overlayCSS; // nội dung overlay.css
shadow.appendChild(style);

// Inject HTML
const container = document.createElement('div');
container.id = 'aw-container';
container.style.pointerEvents = 'auto'; // container nhận events
shadow.appendChild(container);

// Append vào <html> (không phải <body>) để tránh CSS của trang
document.documentElement.appendChild(host);
```

### 7.2 API của overlay module

```ts
const overlay = {
  open(): void,                    // hiện overlay, mặc định screen: main
  close(): void,                   // ẩn overlay, không xoá khỏi DOM
  destroy(): void,                 // xoá hoàn toàn khỏi DOM
  showScreen(screen: string): void, // chuyển screen
  log(entry: LogEntry): void,      // thêm log entry vào log panel
  clearLog(): void,
}

interface LogEntry {
  status: 'pending' | 'success' | 'error';
  message: string;
  detail?: string;  // optional, hiện khi expand
}
```

### 7.3 Các screens trong overlay

Overlay có 4 screens, chuyển qua lại bằng `showScreen(name)`:

#### Screen: `main`

```
┌──────────────────────────────────┐  ← drag handle (8px bar ở trên)
│  ⚡ AutoWeb           [✕ Đóng]   │
├──────────────────────────────────┤
│  Rules khớp trang này:           │
│  ┌────────────────────────────┐  │
│  │ ✅ Tên Rule 1       [▶ Run]│  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ✅ Tên Rule 2       [▶ Run]│  │
│  └────────────────────────────┘  │
│  (Nếu không có rule nào khớp)    │
│  ℹ️ Không có rule cho trang này  │
├──────────────────────────────────┤
│  [🎯 Pick Element]               │
│  [🔍 Tìm theo Text]              │
│  [✏️ Viết Script]               │
│  [⚙️ Mở Options]                │
├──────────────────────────────────┤
│  📋 Log ▾ (collapsible)         │
│  ✅ Fill #username — 120ms       │
│  ✅ Click .btn-login — 80ms      │
│  ❌ Element .dashboard not found │
└──────────────────────────────────┘
```

#### Screen: `text-search`

```
┌──────────────────────────────────┐
│  ← Tìm Element theo Text         │
├──────────────────────────────────┤
│  ┌──────────────────────────┐    │
│  │ Gõ text thấy trên trang  │[🔍]│
│  └──────────────────────────┘    │
│  ○ Gần đúng (includes)           │
│  ● Chính xác (exact)             │
├──────────────────────────────────┤
│  Kết quả (3):                    │
│                                  │
│  ┌────────────────────────────┐  │
│  │ ★★★  <button> "Đăng nhập" │  │
│  │      id: btn-login         │  │
│  │      #btn-login    [Chọn →]│  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ★★   <a> "Đăng nhập" (nav)│  │
│  │      nav > a.login [Chọn →]│  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ★    <span> "Đăng nhập"   │  │
│  │      footer span   [Chọn →]│  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

Khi nhấn [Chọn →] → chuyển sang screen `element-detail` với element đã chọn.

#### Screen: `element-detail`

Hiện sau pick mode hoặc chọn từ text search:

```
┌──────────────────────────────────┐
│  ← Chi tiết Element              │
├──────────────────────────────────┤
│  Tag:      <button>              │
│  Text:     "Đăng nhập"           │
│  ID:       btn-login             │
│                                  │
│  Selector:  #btn-login           │
│  XPath:     //button[@id='...']  │
│                                  │
│  Fallbacks:                      │
│  • [type="submit"].btn           │
│  • //button[contains(text(),...)]│
├──────────────────────────────────┤
│  Action Type: [click         ▼]  │
│                                  │
│  (nếu fill)  Value: [          ] │
│  (nếu extr.) Save As: [        ] │
│  (nếu extr.) Attribute: [      ] │
│                                  │
│  Rule: [Chọn rule để thêm vào ▼] │
├──────────────────────────────────┤
│  [▶ Test ngay]  [💾 Thêm vào Rule]│
│                                  │
│  Kết quả test:                   │
│  ✅ Click thành công (element    │
│     <button#btn-login> found)    │
└──────────────────────────────────┘
```

#### Screen: `script-editor`

```
┌──────────────────────────────────┐
│  ← Script Editor                 │
├──────────────────────────────────┤
│  Label:   [                    ] │
│  Save As: [varName (optional)  ] │
├──────────────────────────────────┤
│  JavaScript:                     │
│  ┌────────────────────────────┐  │
│  │ // Có sẵn:                 │  │
│  │ //   __awVars__  — biến    │  │
│  │ //   sleep(ms)  — helper   │  │
│  │                             │  │
│  │ const btn = document...    │  │
│  │ btn.click();                │  │
│  │ await sleep(500);           │  │
│  │ return document             │  │
│  │   .querySelector('.val')   │  │
│  │   .value;                   │  │
│  └────────────────────────────┘  │
│  [▶ Test Script]                 │
├──────────────────────────────────┤
│  Output:                         │
│  > "eyJhbGciOiJIUzI1NiIs..."    │
│  ✅ Saved → supabase_expiry_key  │
│                                  │
│  Rule: [Chọn rule để thêm vào ▼] │
│  [💾 Thêm vào Rule]             │
└──────────────────────────────────┘
```

### 7.4 Yêu cầu UX overlay

- Overlay là **bottom sheet**, có drag handle ở trên, chiều cao default 55% màn hình, có thể kéo từ drag handle lên đến 85% hoặc xuống để đóng.
- **font-size tối thiểu 16px** cho tất cả input — bắt buộc, tránh iOS auto-zoom khi focus input.
- **min-height: 44px** cho tất cả button và interactive element — touch target chuẩn.
- Khi bàn phím ảo bật lên → overlay không bị che (vì là phần của trang, trang tự scroll).
- Dark theme: background `#1a1a2e`, text `#e2e8f0`, accent `#7c3aed`.
- Mỗi screen transition: slide-in từ phải khi tiến, slide-in từ trái khi quay lại.
- Overlay không block scroll của trang khi pointer ở ngoài overlay bounds.

---

## 8. Options Page

File: `options/options.html` + `options.js`

Single Page App, không reload giữa các tab. Dùng Vanilla JS thuần.

### 8.1 Layout

```
┌───────────────────────────────────────────────────────┐
│  ⚡ AutoWeb Config                                     │
├────────────────┬──────────────────────────────────────┤
│  📋 Rules      │                                       │
│  🔑 Variables  │            Content Area               │
│  📊 Saved Data │                                       │
└────────────────┴──────────────────────────────────────┘
```

Mobile: sidebar thu gọn thành bottom tab bar.

### 8.2 Rules Tab

- Danh sách rules, mỗi item hiển thị: name, urlPattern rút gọn, số actions, enabled toggle
- Nút `+ New Rule` → mở Rule Editor (inline hoặc dialog)
- Click vào rule → mở Rule Editor với data đã có
- Nút Delete với confirm (`"Xoá rule '{name}'?"`)
- Kéo để sắp xếp lại thứ tự (drag handle)

### 8.3 Rule Editor

Fields:

| Field | Input type | Ghi chú |
|-------|-----------|---------|
| Rule Name | text | required |
| URL Pattern | text | required, hiện preview match type |
| Match Type | radio: startsWith / contains / exact / regex | |
| Trigger | radio: auto / manual | |
| Delay (ms) | number | chỉ hiện khi trigger = auto, default 1500 |

Danh sách Actions:

- Hiện thứ tự, label, type badge
- Drag handle để reorder
- Nút edit (✏️) → mở Action Editor dialog
- Nút delete (🗑)
- Nút `+ Add Action`

Nút Save + nút Cancel ở dưới cùng.

### 8.4 Action Editor Dialog

Modal overlay trong Options page. Các field chung:

| Field | Input type |
|-------|-----------|
| Action Type | select: fill / click / extract / wait / script |
| Label | text |
| Selector | text |
| Fallback Selectors | textarea (mỗi dòng 1 selector) |

Fields bổ sung theo type:

**fill:** Value (text, hỗ trợ `{{` autocomplete), Trigger Events (checkbox)

**click:** (không thêm)

**extract:** Save As (text), Attribute (text, optional), Transform (select), Transform Arg (text, chỉ hiện khi transform=regex)

**wait:** Wait For (select: time/element/url), Timeout (number), Selector (text, chỉ hiện khi waitFor=element)

**script:** Script (textarea monospace, min 10 dòng, max-height: 40vh với scroll), Save As (text optional). Hiện hint: `// __awVars__ và sleep(ms) có sẵn`

Wait After (ms) — field chung, optional.

### 8.5 Variables Tab

- Bảng 2 cột: Key | Value
- Giá trị masked (`••••••`) nếu key chứa: `password`, `secret`, `key`, `token`, `pass` (case-insensitive) — có nút toggle show/hide
- Thêm row mới: inline ở cuối bảng
- Double-click để edit
- Nút xoá từng row
- Nút `Export JSON` (download file) và `Import JSON` (chọn file)

### 8.6 Saved Data Tab

- Danh sách theo key
- Mỗi key: hiện value mới nhất + timestamp "X phút trước"
- Click để expand → bảng lịch sử (value, url rút gọn, thời gian)
- Nút `Clear` từng key
- Nút `Clear All` với confirm

---

## 9. Popup

File: `popup/popup.html` + `popup.js`

Popup chỉ làm 2 việc: hiện rules khớp và mở các tool. Không xử lý logic phức tạp.

```
┌──────────────────────────────────┐
│  ⚡ AutoWeb                      │
├──────────────────────────────────┤
│  📄 app.supabase.com/project/... │
├──────────────────────────────────┤
│  Rules khớp (2):                 │
│  ✅ Supabase Auto Key    [▶ Run] │
│  ✅ Supabase Login       [▶ Run] │
│                                  │
│  (nếu không có rule khớp)        │
│  ℹ️ Chưa có rule cho trang này  │
│  → [+ Tạo rule mới]              │
├──────────────────────────────────┤
│  [🎯 Mở Element Picker]          │
│  [⚙️ Options]                   │
└──────────────────────────────────┘
```

**Hành vi:**

- Load: query active tab URL → `chrome.runtime.sendMessage GET_RULES` → lọc matched rules → hiện danh sách
- `[▶ Run]`: `chrome.tabs.sendMessage(tabId, { type: 'RUN_RULE', payload: rule })`
- `[🎯 Mở Element Picker]`: `chrome.runtime.sendMessage({ type: 'OPEN_OVERLAY' })` → `window.close()`
- `[⚙️ Options]`: `chrome.runtime.openOptionsPage()`
- `[+ Tạo rule mới]`: mở Options page với URL pattern đã điền sẵn từ tab hiện tại

---

## 10. Shared Utilities

### `shared/storage.js`

```js
// Tất cả functions đều async, có try/catch, throw Error rõ ràng nếu thất bại
async function getRules(): Promise<Rule[]>
async function saveRule(rule: Rule): Promise<void>       // upsert theo id
async function deleteRule(id: string): Promise<void>
async function reorderRules(ids: string[]): Promise<void> // sắp xếp lại theo mảng id

async function getVariables(): Promise<Record<string, string>>
async function setVariable(key: string, value: string): Promise<void>
async function deleteVariable(key: string): Promise<void>

async function saveExtracted(key: string, value: string, url: string): Promise<void>
// → append vào savedData[key], giữ tối đa 50 entries

async function getSavedData(): Promise<Record<string, SavedEntry[]>>
async function clearSavedData(key?: string): Promise<void>
// nếu key = undefined → xoá tất cả; nếu có key → xoá chỉ key đó
```

### `shared/utils.js`

```js
function sleep(ms: number): Promise<void>
function uuid(): string  // crypto.randomUUID() hoặc fallback
function resolveVariables(template: string, vars: Record<string, string>): string
  // thay "{{varName}}" bằng vars[varName]
  // nếu varName không có trong vars → giữ nguyên placeholder (không throw)
function waitForElement(selector: string, timeout: number): Promise<HTMLElement | null>
  // poll mỗi 300ms, trả về null nếu hết timeout
function waitForUrlChange(timeout: number): Promise<string>
  // resolve khi location.href thay đổi, trả về URL mới
function applyTransform(value: string, transform: string, arg?: string): string
  // none: giữ nguyên
  // trim: value.trim()
  // parseNumber: giữ lại số, dấu phẩy, dấu chấm
  // regex: new RegExp(arg).exec(value)?.[1] ?? value  (lấy capture group 1)
function isXPath(selector: string): boolean
  // return selector.trim().startsWith('/') || selector.trim().startsWith('//')
function truncate(str: string, max: number): string
  // str.length > max ? str.slice(0, max) + '…' : str
function timeAgo(timestamp: number): string
  // "vừa xong", "5 phút trước", "2 giờ trước", v.v.
```

### `shared/constants.js`

```js
export const MAX_SAVED_ENTRIES = 50;
export const DEFAULT_DELAY = 1500;
export const DEFAULT_TIMEOUT = 5000;
export const OVERLAY_HOST_ID = '__autoweb_host__';
export const PICK_LAYER_ID = '__autoweb_pick_layer__';
export const HIGHLIGHT_ID = '__autoweb_highlight__';
export const ACCENT_COLOR = '#7c3aed';
```

---

## 11. Test Action / Test Script — Chi tiết

Khi user nhấn **"▶ Test ngay"** trong overlay (screen element-detail hoặc script-editor):

### Flow

1. Thu thập action object từ form trong overlay hiện tại
2. Validate: nếu thiếu selector (cho fill/click/extract) hoặc thiếu script (cho script) → hiện lỗi, dừng
3. Lấy variables: `chrome.runtime.sendMessage({ type: 'GET_VARIABLES' })`
4. Gọi `runAction(action, vars)`
5. Hiện realtime log trong overlay:
   - Trước khi chạy: `⏳ Đang tìm element...`
   - Tìm thấy: `✅ Found: <button#btn-login>`
   - Sau khi chạy: `✅ Click thành công` hoặc `✅ Value: "5,234,000đ"` (extract/script)
   - Nếu lỗi: `❌ Lỗi: Element not found sau 5s`
6. **Quan trọng: Không lưu vào storage** trong lúc test. Chỉ lưu khi user nhấn "💾 Thêm vào Rule".

### Test script đặc biệt

Script editor cho phép test script độc lập (không thuộc rule nào):

- Lấy script text từ textarea
- Wrap và eval như trong `actionRunner.js`
- Hiện output (return value) ngay trong overlay
- Nếu có `saveAs` → hỏi user: `"Lưu giá trị '...' vào biến '{saveAs}'?"` trước khi thực sự lưu

---

## 12. Quy tắc code — Bắt buộc tuân thủ

### Architecture

- **Không dùng framework** (React/Vue/Angular) cho content script và overlay — Vanilla JS thuần, không bundle nặng.
- Options page có thể dùng framework nếu cần, nhưng phải tự bundle, không CDN external.
- Mọi file content script phải chạy được dưới dạng module ES6 với dynamic import nếu cần.

### Safety

- **Không dùng `innerHTML`** với bất kỳ data nào từ user hoặc từ trang web — dùng `textContent`, `createElement`, `setAttribute`.
- Mọi `document.querySelector` và `document.evaluate` phải trong try/catch.
- Mọi `chrome.storage.*` phải trong try/catch.
- Content script phải **idempotent**: kiểm tra `window.__autoweb_injected__` trước khi chạy.

### Performance

- Element finder chỉ chạy khi user bấm tìm kiếm, **không chạy background polling**.
- Không dùng `MutationObserver` toàn trang trừ khi đang trong `waitForElement`.
- Overlay CSS không được ảnh hưởng đến trang host (Shadow DOM bảo vệ, nhưng vẫn cẩn thận với `position: fixed`).

### Storage

- Dùng `chrome.storage.local` (10MB limit), **không dùng `chrome.storage.sync`** (8KB quá nhỏ cho rules).

### Privacy

- Không gửi bất kỳ data nào ra server ngoài.
- Không log data nhạy cảm (password, token) ra console.

---

## 13. Edge Cases phải xử lý

| Case | Xử lý |
|------|-------|
| SPA navigation không reload | Patch `history.pushState`, lắng nghe `popstate` + `hashchange` → re-run pageMatcher |
| Element render sau AJAX | `waitForElement` với timeout + retry 300ms |
| Selector bị stale sau update trang | Thử fallbacks, nếu hết fallback → throw Error với message rõ ràng kèm selector đã thử |
| iFrame | `all_frames: false` trong manifest — chỉ inject vào top frame |
| Nhiều tab | Background xử lý độc lập mỗi tab, không share state runtime |
| Script async (click dropdown → lấy value) | Script type hỗ trợ `await` và `sleep()` helper |
| Variable chưa có | `resolveVariables` giữ `{{varName}}` nguyên, không throw, không fill gì vào input |
| Overlay trên trang dùng `overflow: hidden` trên body | Inject vào `<html>` thay vì `<body>`, dùng `position: fixed` |
| Pick Mode tap vào overlay | Luôn bỏ qua element có ancestor là `#__autoweb_host__` |
| Rule bị xoá khi đang chạy | Check rule vẫn tồn tại trước khi chạy mỗi action |
| chrome.storage bị đầy | Catch error, hiện thông báo rõ ràng cho user |
| iOS Safari (Kiwi trên iOS) | font-size >= 16px, touch events thay mouse events, không dùng `:hover` chính |

---

## 14. Thứ tự implement khuyến nghị

Implement theo thứ tự này, test sau mỗi bước trên trang thực:

1. `manifest.json` + cấu trúc thư mục rỗng
2. `shared/constants.js` + `shared/utils.js`
3. `shared/storage.js`
4. `background/service_worker.js` — message handler đầy đủ
5. `content/selectorGenerator.js` — unit test bằng console trên trang thực
6. `content/elementFinder.js` — test findElementsByText trên vài trang
7. `content/pickMode.js` — test trên mobile (Kiwi) và desktop
8. `content/actionRunner.js` — test từng action type thủ công
9. `content/pageMatcher.js`
10. `content/overlay/overlay.css` + `content/overlay/overlay.js` — 4 screens đầy đủ
11. `content/index.js` — ghép tất cả
12. `popup/popup.html` + `popup.js`
13. `options/options.html` + `options.js` — làm sau cùng vì phức tạp nhất

**Test checkpoint sau bước 11:** Load extension vào Kiwi Browser (Android), mở một trang web bất kỳ, bật overlay từ popup, dùng Pick Mode tap vào một button, test click action, xác nhận hoạt động trước khi làm Options page.
