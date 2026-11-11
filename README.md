# BAKit — bản gọn

Công cụ cá nhân cho BA, chạy hoàn toàn trên máy (không cloud, không AI, không tự upload):

- **Chụp & sửa ảnh**: chụp vùng màn hình (nhiều màn hình), dán ảnh từ clipboard, kéo thả file; sửa bằng mũi tên, khung, elip, đường, chữ, đánh số, cắt, tẩy, phủ màu, làm mờ, che kín. Ảnh gốc luôn được giữ nguyên.
- **Ghi chú & copy nhanh**: ghi chú và work item Azure cho mỗi ảnh; copy ảnh, ghi chú hoặc cả hai để dán vào Azure DevOps.
- **Hôm nay / Lịch / Việc**: việc và lịch hẹn theo ngày, ghi chú theo ngày, xem theo tuần hoặc tháng, việc còn đọng, nhắc giờ, việc lặp lại.
- **Dự án & checklist**: nhiều dự án, mỗi dự án có checklist Tính năng / Issue / Vấn đề / Bug / Tài liệu (tự thêm được), mỗi mục có trạng thái, người, hạn, ảnh đính kèm, ghi chú và lịch sử. Có tick xong và ghim dự án ra menu bên trái.

---

## 1. Chạy thử ngay (không cần cài gì)

Mở file **`demo/index.html`** bằng Chrome, Edge hoặc Safari (nhấp đúp; trên Mac nếu file mở bằng app khác thì chuột phải → Open With → Chrome/Safari). Dữ liệu được lưu trong trình duyệt của bạn.

Bản web có vài khác biệt so với bản cài:
- "Chụp vùng" sẽ hỏi bạn chọn màn hình hoặc cửa sổ để chia sẻ (quy định của trình duyệt), sau đó bạn kéo chọn vùng như bình thường.
- Phím tắt toàn cục `Ctrl+Shift+S` chỉ hoạt động khi đang ở trong tab BAKit.

Dữ liệu mẫu (3 dự án, việc, lịch hẹn) có sẵn để bạn xem thử. Muốn xóa sạch thì vào **Cài đặt → Xóa toàn bộ dữ liệu (kể cả dữ liệu mẫu)**.

---

## 2. Cài môi trường trên Windows (làm 1 lần)

Làm lần lượt các bước dưới đây, mỗi bước chỉ cần làm một lần.

1. **Node.js LTS**: tải ở https://nodejs.org (chọn bản LTS) và cài với các tùy chọn mặc định.
2. **Visual Studio Build Tools 2022**: tải ở https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Khi cài, tick **"Desktop development with C++"** (bắt buộc phải có MSVC và Windows SDK).
3. **Rust**: tải `rustup-init.exe` ở https://rustup.rs, chạy và chọn mặc định (1).
4. **WebView2**: Windows 10/11 thường đã có sẵn. Nếu thiếu, tải "Evergreen Bootstrapper" ở https://developer.microsoft.com/microsoft-edge/webview2/
5. **Khởi động lại máy**, hoặc ít nhất mở lại cửa sổ PowerShell/Terminal để nhận PATH mới.

Kiểm tra lại bằng PowerShell:

```powershell
node -v      # v20 trở lên
npm -v
rustc -V     # rustc 1.7x trở lên
cargo -V
```

---

## 3. Chạy và đóng gói

Giải nén, mở PowerShell trong thư mục `bakit` rồi chạy:

```powershell
npm install            # tải thư viện giao diện (lần đầu ~1-2 phút)
npm run tauri dev      # chạy bản desktop để dùng/thử (lần đầu Rust biên dịch ~5-10 phút)
```

Đóng gói thành file cài đặt:

```powershell
npm run tauri build
```

File cài nằm ở:
- `src-tauri\target\release\bundle\nsis\BAKit_0.1.0_x64-setup.exe` (khuyên dùng, cài cho riêng user, không cần quyền admin)
- `src-tauri\target\release\bundle\msi\BAKit_0.1.0_x64_en-US.msi`

Các lệnh khác:

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy bản web tại http://localhost:1420 (sửa code thấy ngay) |
| `npm run build:demo` | Tạo lại `demo/index.html` (bản web 1 file) |
| `npm run typecheck` | Kiểm tra lỗi TypeScript |

---

## 3b. Trên macOS

### Cài môi trường (làm 1 lần)

Mở **Terminal** (Cmd+Space, gõ "Terminal") rồi làm lần lượt:

1. **Xcode Command Line Tools** (trình biên dịch của Apple):
   ```bash
   xcode-select --install
   ```
   Bấm **Install** ở hộp thoại hiện ra và chờ khoảng 5–15 phút. Nếu máy báo "already installed" thì bỏ qua bước này.
2. **Node.js LTS**: tải bản macOS Installer (.pkg) ở https://nodejs.org và cài như app thường.
3. **Rust**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   Khi được hỏi, nhấn Enter để chọn mặc định. Xong thì **đóng Terminal và mở lại**.
4. Kiểm tra:
   ```bash
   node -v && npm -v && rustc -V && cargo -V
   ```

Trên Mac không cần WebView2 hay Visual Studio.

### Chạy

```bash
cd ~/Downloads/bakit      # thư mục đã giải nén
npm install
npm run tauri dev         # lần đầu Rust biên dịch ~5-10 phút
```

### Cấp quyền ghi màn hình (bắt buộc để chụp vùng)

Lần đầu bấm **Chụp vùng**, macOS sẽ hỏi quyền **Screen & System Audio Recording** (bản cũ gọi là **Screen Recording**).
- Vào **System Settings → Privacy & Security → Screen & System Audio Recording** và bật quyền:
  - Khi chạy `npm run tauri dev`: bật cho **Terminal**, hoặc app bạn dùng để gõ lệnh (iTerm, VS Code…).
  - Khi dùng bản đã đóng gói: bật cho **BAKit**.
- **Thoát hẳn rồi mở lại** Terminal hoặc BAKit thì quyền mới có hiệu lực.
- Nếu chưa cấp quyền, ảnh chụp chỉ có hình nền, không thấy các cửa sổ.

### Đóng gói

```bash
npm run tauri build
```

- App: `src-tauri/target/release/bundle/macos/BAKit.app`. Kéo app vào thư mục **Applications** để dùng.
- File cài: `src-tauri/target/release/bundle/dmg/BAKit_0.1.0_aarch64.dmg` (chip M) hoặc `_x64.dmg` (chip Intel).
- Nếu bước tạo .dmg báo lỗi, chỉ tạo app là đủ: `npm run tauri build -- --bundles app`

App tự build trên máy mình thì mở bình thường. Nếu copy sang Mac khác mà bị báo "không thể mở vì không xác minh được nhà phát triển":
- **Chuột phải vào app → Open → Open**.
- Hoặc chạy lệnh: `xattr -cr /Applications/BAKit.app`

### Khác biệt trên Mac

- Phím **Ctrl** đổi thành **⌘ (Cmd)**: chụp vùng `⌘⇧S`, dán `⌘V`, việc mới `⌘N`, hoàn tác `⌘Z`… Giao diện tự hiển thị đúng ký hiệu.
- Phóng to ảnh trong trình sửa: chụm 2 ngón trên trackpad, hoặc giữ ⌘ và cuộn.
- Dữ liệu nằm ở `~/Library/Application Support/vn.bakit.app/`.
- Thông báo nhắc việc: lần đầu macOS sẽ hỏi quyền, chọn **Allow**. Khi chạy `npm run tauri dev`, thông báo có thể không hiện; bản đã đóng gói thì hiện bình thường.
- `⌘⇧S` là phím "Save As" của nhiều app. BAKit giữ phím này cho mọi app khi đang chạy. Muốn tránh thì đổi trong **Cài đặt**, ví dụ `Alt+Shift+S` (tức ⌥⇧S).
- Khi chọn vùng, phần sát thanh menu trên cùng có thể bị thanh menu che. Muốn lấy phần đó thì bấm Enter để chụp cả màn hình, rồi cắt bằng phím `C`.

---

## 4. Phím tắt

### Toàn ứng dụng

| Phím | Việc |
|---|---|
| `Ctrl+Shift+S` | Chụp vùng (bản cài: dùng được cả khi BAKit đang ẩn; đổi được trong Cài đặt) |
| `Ctrl+V` | Dán ảnh. Nếu đang mở một mục checklist hoặc việc thì ảnh gắn vào mục đó, nếu không thì tạo ảnh mới |
| `Ctrl+N` | Thêm việc mới |
| Kéo thả file ảnh | Thêm ảnh, hoặc gắn vào mục đang mở |

### Khi chọn vùng chụp

| Phím | Việc |
|---|---|
| Kéo chuột | Chọn vùng |
| `Enter` | Lấy cả màn hình |
| `Esc` | Hủy |

### Trình sửa ảnh

| Phím | Công cụ / việc |
|---|---|
| `V` | Chọn |
| `A` | Mũi tên |
| `R` | Khung |
| `E` | Elip |
| `L` | Đường thẳng |
| `T` | Chữ |
| `N` | Đánh số |
| `C` | Cắt ảnh (`Enter` áp dụng, `Esc` hủy) |
| `X` | Tẩy (trong suốt) |
| `O` | Phủ màu |
| `B` | Làm mờ |
| `D` | Che kín (an toàn khi gửi ra ngoài) |
| `Ctrl+Z` / `Ctrl+Y` | Hoàn tác / Làm lại |
| `Ctrl+D` | Nhân bản hình đang chọn |
| `Del` | Xóa hình đang chọn |
| `Ctrl+C` | Copy hình đang chọn; nếu không chọn hình nào thì copy cả ảnh |
| `Ctrl+Shift+C` | Copy ảnh đã sửa |
| `Ctrl+[` / `Ctrl+]` | Đưa hình xuống dưới / lên trên |
| `Ctrl+0` / `Ctrl+1` | Vừa khung / 100% |
| `Ctrl+cuộn chuột` | Phóng to / thu nhỏ |
| Giữ `Space` + kéo | Di chuyển ảnh |
| Giữ `\` hoặc nút con mắt | Xem ảnh gốc |
| `Esc` | Về công cụ Chọn |

Mẹo: dùng **Che kín (D)** cho thông tin nhạy cảm. Làm mờ (B) có thể bị khôi phục một phần nên không an toàn khi gửi ra ngoài.

---

## 5. Dữ liệu được lưu ở đâu

- **Bản cài**: `%APPDATA%\vn.bakit.app\`, gồm `bakit.db` (SQLite) và thư mục `images\` (ảnh PNG gốc và ảnh đã sửa). Vào **Cài đặt → Dữ liệu → Mở thư mục** để xem.
- **Bản web**: IndexedDB của trình duyệt.
- Sao lưu và chuyển máy: **Cài đặt → Xuất bản sao lưu (.json)**, rồi **Khôi phục từ bản sao lưu…** trên máy mới. File sao lưu có kèm ảnh.

---

## 6. Cấu trúc mã nguồn

```
src/                      Giao diện (React + TypeScript)
  App.tsx                 Khung app, phím tắt toàn cục, dán/kéo thả
  views/                  Hôm nay, Lịch, Việc, Dự án, Checklist, Ảnh chụp, Cài đặt
  editor/                 Trình sửa ảnh (react-konva)
  components/             Sidebar, Topbar, hộp thoại, overlay chụp vùng
  lib/                    store (zustand), db (SQLite/IndexedDB), capture, nhắc việc, dữ liệu mẫu
src-tauri/                Phần desktop (Rust, Tauri 2)
  src/lib.rs              Chụp màn hình (xcap), cắt vùng, dọn file tạm
  capabilities/           Quyền của cửa sổ (chỉ mở đúng những gì app dùng)
  tauri.conf.json         Tên app, cửa sổ, gói cài đặt
demo/index.html           Bản web 1 file để chạy thử
```

---

## 7. Lưu ý

- Mã nguồn được viết và kiểm thử trên **bản web** (giao diện, lưu dữ liệu, dán ảnh, trình sửa ảnh).
- Phần Rust/Tauri chưa được biên dịch hay chạy thử trên Windows lẫn macOS, gồm chụp nhiều màn hình, phím tắt toàn cục, thông báo nhắc việc, SQLite và đóng gói. Lần đầu chạy `npm run tauri dev`, nếu có lỗi biên dịch hãy gửi nguyên văn thông báo lỗi để sửa.
- Nếu `Ctrl+Shift+S` bị app khác chiếm (ví dụ Snipping Tool, OneNote), BAKit sẽ báo lỗi. Đổi phím trong **Cài đặt**.
- Màn hình có scale khác nhau (100% / 150%) được xử lý theo từng màn hình. Nếu vùng chụp bị lệch, hãy báo lại kèm thông tin scale của từng màn hình.

---

## 8. Build tự động trên GitHub (ra file .exe và .dmg, không cần máy Windows)

Thư mục `.github/workflows/build.yml` đã có sẵn. Khi bạn đẩy code lên GitHub, GitHub sẽ tự build trong khoảng 10–20 phút và cho ra 2 file:
- **BAKit-windows**: `BAKit_0.1.0_x64-setup.exe` và `.msi`
- **BAKit-macos**: `BAKit_0.1.0_universal.dmg`, chạy được cả Mac chip M lẫn chip Intel

### Lần đầu
1. Tạo tài khoản GitHub ở https://github.com (đã có thì bỏ qua bước này).
2. Cài **GitHub Desktop** từ https://desktop.github.com, mở app và đăng nhập GitHub.
3. Vào **File → Add Local Repository…** và chọn thư mục `bakit`.
   - App báo "This directory does not appear to be a Git repository" thì bấm **create a repository**.
   - Ở màn hình tạo repo, giữ nguyên tên, bấm **Create Repository**.
4. Bấm **Publish repository**, tick **Keep this code private**, rồi bấm **Publish**.
5. Mở repo trên web: **Repository → View on GitHub**, chọn tab **Actions**. Lần build đầu tiên tự chạy (biểu tượng vàng nghĩa là đang chạy).
6. Khi biểu tượng chuyển xanh ✓, bấm vào lần chạy đó, kéo xuống mục **Artifacts** và tải **BAKit-windows** / **BAKit-macos**. File tải về là .zip, giải nén ra sẽ thấy .exe hoặc .dmg.

### Mỗi lần có code mới
1. Giải nén code mới đè lên thư mục `bakit`.
2. Mở GitHub Desktop: ô dưới bên trái gõ mô tả ngắn (ví dụ "Cập nhật giao diện"), bấm **Commit to main**, rồi bấm **Push origin**.
3. Chờ build xong trong tab Actions và tải file mới về.

### Lưu ý
- Repo private được miễn phí 2.000 phút build mỗi tháng. Phút build trên Mac tính gấp 10 và trên Windows gấp 2, nên mỗi lần build tốn khoảng 120–200 phút, tức khoảng 10–15 lần build mỗi tháng. Repo public thì không giới hạn.
- Mở .exe trên Windows, nếu hiện "Windows protected your PC" thì bấm **More info → Run anyway**. Máy công ty có thể chặn cài app chưa ký, khi đó cần hỏi IT.
- Mở .dmg trên Mac, nếu bị chặn thì vào **System Settings → Privacy & Security**, kéo xuống và bấm **Open Anyway**. Cách khác là chạy lệnh `xattr -cr /Applications/BAKit.app`.
- Nếu build báo đỏ ✗: bấm vào lần chạy → chọn job bị đỏ → mở bước bị lỗi, copy đoạn lỗi gửi lại để sửa.
