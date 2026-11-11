# BAKit — bản gọn

Công cụ cá nhân cho BA, chạy hoàn toàn trên máy (không cloud, không AI, không tự upload):

- **Chụp & sửa ảnh**: chụp vùng màn hình (nhiều màn hình), dán ảnh từ clipboard, kéo thả file; sửa bằng mũi tên, khung, elip, đường, chữ, đánh số, cắt, tẩy, phủ màu, làm mờ, che kín. Ảnh gốc luôn được giữ nguyên.
- **Ghi chú & copy nhanh**: ghi chú và work item Azure cho mỗi ảnh; copy ảnh, ghi chú hoặc cả hai để dán vào Azure DevOps.
- **Hôm nay / Lịch / Việc**: việc và lịch hẹn theo ngày, ghi chú theo ngày, xem theo tuần hoặc tháng, việc còn đọng, nhắc giờ, việc lặp lại.
- **Dự án & checklist**: nhiều dự án, mỗi dự án có checklist Tính năng / Issue / Vấn đề / Bug / Tài liệu (tự thêm được), mỗi mục có trạng thái, người, hạn, ảnh đính kèm, ghi chú và lịch sử. Có tick xong và ghim dự án ra menu bên trái.

---

## 1. Chạy thử ngay (không cần cài gì)

Mở file **`demo/index.html`** bằng Chrome hoặc Edge (nhấp đúp). Dữ liệu được lưu trong trình duyệt của bạn.

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
- Phần Rust/Tauri chưa được biên dịch hay chạy thử trên Windows, gồm chụp nhiều màn hình, phím tắt toàn cục, thông báo nhắc việc, SQLite và đóng gói. Lần đầu chạy `npm run tauri dev`, nếu có lỗi biên dịch hãy gửi nguyên văn thông báo lỗi để sửa.
- Nếu `Ctrl+Shift+S` bị app khác chiếm (ví dụ Snipping Tool, OneNote), BAKit sẽ báo lỗi. Đổi phím trong **Cài đặt**.
- Màn hình có scale khác nhau (100% / 150%) được xử lý theo từng màn hình. Nếu vùng chụp bị lệch, hãy báo lại kèm thông tin scale của từng màn hình.
