# Speech Translate Real-Time

Dịch giọng nói **hai chiều** theo thời gian thực bằng Soniox. Một micro cho hai người nói hai thứ tiếng khác nhau — hệ thống tự nhận ai đang nói tiếng gì rồi dịch sang ngôn ngữ còn lại, hiện thành phụ đề lớn trên màn hình.

Có thêm chế độ **phòng trực tiếp**: tạo phòng, gửi mã và mật khẩu cho người khác để họ xem hội thoại đang được dịch từ xa.

---

## 1. Cài Node.js

Dự án cần **Node.js 20.12 trở lên**. Khuyến nghị bản LTS mới nhất.

### Windows

1. Vào <https://nodejs.org> → tải bản **LTS** (nút bên trái) → chạy file `.msi`.
2. Bấm Next hết, giữ nguyên tuỳ chọn mặc định (nhớ để nguyên ô *Add to PATH*).
3. Mở **PowerShell mới** rồi kiểm tra:

```powershell
node --version
npm --version
```

Nếu ra số phiên bản là được. Nếu báo *"node is not recognized"*, đóng hết cửa sổ terminal rồi mở lại — PATH chỉ áp dụng cho tiến trình mới.

### macOS / Linux

```bash
# macOS
brew install node

# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Cài Git

Cần Git để tải code về.

- **Windows:** <https://git-scm.com/download/win> → chạy file cài, giữ mặc định.
- **macOS:** `brew install git`
- **Ubuntu:** `sudo apt install git`

Kiểm tra: `git --version`

Không muốn cài Git cũng được — vào trang GitHub, bấm nút xanh **Code → Download ZIP**, giải nén ra là xong.

---

## 3. Tải code về

```bash
git clone https://github.com/VietDucc/Speech-Translate-Real-Time.git
cd Speech-Translate-Real-Time
```

---

## 4. Cài thư viện

```bash
npm install
```

Lệnh này tải hai gói vào thư mục `node_modules/`: `hono` (web framework) và `@hono/node-server`. Toàn bộ giao diện không cần cài gì thêm — Tailwind và font lấy trực tiếp từ CDN lúc mở trang.

---

## 5. Lấy API key Soniox

1. Đăng ký tài khoản tại <https://soniox.com>.
2. Vào Console → **API Keys** → **Create new key**.
3. Sao chép key vừa tạo.

---

## 6. Tạo file `.env`

Tạo file tên `.env` ngay trong thư mục dự án, nội dung tối thiểu:

```env
SONIOX_API_KEY=dan_key_cua_ban_vao_day
PORT=8787
```

Tạo nhanh bằng dòng lệnh:

```powershell
# Windows PowerShell
"SONIOX_API_KEY=dan_key_cua_ban_vao_day" | Out-File -Encoding utf8 .env
```

```bash
# macOS / Linux
echo "SONIOX_API_KEY=dan_key_cua_ban_vao_day" > .env
```

Xem [mục 11](#11-biến-môi-trường) nếu muốn chỉnh thêm các biến khác.

> `.env` đã nằm trong `.gitignore` nên không bao giờ bị đẩy lên GitHub. **Đừng bao giờ commit key thật.**

---

## 7. Chạy

```bash
npm start
```

Terminal sẽ in ra:

```
  Live Translate  →  http://localhost:8787
```

Mở đường dẫn đó bằng **Chrome** hoặc **Edge**. Bấm **Start**, cho phép truy cập micro, rồi nói.

Đang phát triển thì dùng `npm run dev` — server tự khởi động lại mỗi khi bạn sửa code.

> **Đừng double-click file HTML.** Trang bắt buộc phải được phục vụ bởi server này, vì key được server cấp qua `/api/soniox-token`. Mở bằng `file://` sẽ không lấy được key và app không chạy.

---

## 8. Dùng phòng trực tiếp

**Người chủ trì (host):**

1. Bấm biểu tượng 👥 trên thanh công cụ, hoặc vào thẳng `http://localhost:8787/rooms.html`.
2. Điền tên phòng, mật khẩu, cặp ngôn ngữ → **Tạo phòng**.
3. Màn hình hiện **mã 6 ký tự**. Gửi mã và mật khẩu cho người muốn xem.
4. Bấm **"Mở app dịch và bắt đầu phát"** → chip **LIVE** sáng lên, mọi câu nói từ giờ được đẩy lên phòng.

**Người xem:**

1. Vào `/rooms.html`, chọn phòng trong danh sách.
2. Nhập mật khẩu → xem phụ đề chạy realtime kèm lịch sử hội thoại.

Lưu ý: người xem chỉ **xem**, không nói vào phòng được. Chỉ micro của máy host được thu.

---

## 9. Phím tắt

| Phím | Tác dụng |
|---|---|
| `Space` | Bắt đầu / dừng |
| `Esc` | Thoát chế độ chỉ hiện phụ đề |
| `G` | Nền xanh chroma, để chroma key trong OBS |

---

## 10. Cấu trúc dự án

```
Speech-Translate-Real-Time/
├── public/                 ← chỉ thư mục này ra được internet
│   ├── index.html          app dịch (giao diện + xử lý audio + WebSocket Soniox)
│   ├── rooms.html          lobby: tạo phòng, vào phòng, xem trực tiếp
│   └── theme.js            design token dùng chung
├── server.js               cấp temporary key + phục vụ file tĩnh
├── rooms.js                quản lý phòng + kênh SSE cho người xem
├── .env                    key thật (KHÔNG commit)
└── package.json
```

Thư mục tĩnh trỏ vào `public/` chứ không phải thư mục gốc — nếu trỏ vào gốc thì `.env` sẽ tải về được qua trình duyệt.

---

## 11. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SONIOX_API_KEY` | *(bắt buộc)* | Key thật, chỉ nằm ở server |
| `PORT` | `8787` | Cổng chạy server |
| `ALLOWED_ORIGINS` | *(trống)* | Domain được phép xin token. Để trống thì tự chấp nhận chính domain đang deploy và localhost |
| `TOKEN_TTL_SECONDS` | `60` | Key tạm sống bao lâu (chỉ cần đủ để bấm Start) |

> Không còn trần thời lượng phiên và không giới hạn số request. Thứ duy nhất
> đóng phiên là phía trình duyệt: im lặng 1 phút (`IDLE_MS` trong
> `public/index.html`) thì tự dừng.

---

## 12. Deploy

Deploy **một service duy nhất** — server này phục vụ cả trang lẫn API, nên frontend gọi đường dẫn tương đối, deploy đâu chạy đó.

- **Build command:** `npm install`
- **Start command:** `npm start`
- **Biến môi trường:** đặt `SONIOX_API_KEY` trong phần Environment Variables của nhà cung cấp (Render, Railway, Fly…). Không đẩy file `.env` lên.

Bắt buộc **HTTPS** — micro chỉ hoạt động trên secure context. Các nền tảng trên đều cấp HTTPS sẵn.

> Cảnh báo: bất kỳ ai mở được URL đều xin được token và tiêu credit Soniox của bạn. Hiện chỉ có rate limit và kiểm tra origin. Nếu định để công khai thì cần thêm lớp đăng nhập.

---

## 13. Lỗi thường gặp

| Hiện tượng | Xử lý |
|---|---|
| `node is not recognized` | Đóng hết terminal, mở lại. Chưa được thì cài lại Node và tick *Add to PATH*. |
| `bad option: --env-file-if-exists` | Node quá cũ. Cần từ 20.12 trở lên, kiểm tra bằng `node --version`. |
| `EADDRINUSE: port 8787` | Cổng đang bận. Đổi `PORT` trong `.env` sang số khác, ví dụ `3000`. |
| *"Could not get credentials"* | Chưa điền `SONIOX_API_KEY` trong `.env`, hoặc đang mở file HTML trực tiếp thay vì qua `localhost`. |
| Trình duyệt không hỏi quyền micro | Quyền đã bị chặn. Bấm biểu tượng ổ khoá cạnh thanh địa chỉ → Site settings → Microphone → Allow. |
| Giao diện trắng trơn, mất màu | Tailwind CDN không tải được, kiểm tra mạng hoặc proxy. |
| Báo *Listening* nhưng không ra chữ | Chọn nhầm thiết bị ở ô **Microphone**. |
| Ra chữ nhưng không dịch | Ngôn ngữ A và B đang trùng nhau, hoặc đang nói thứ tiếng thứ ba ngoài cặp đã chọn. |
| Vào phòng báo sai mật khẩu | Mã phòng phân biệt chữ hoa, nhưng server tự chuyển hoa — kiểm tra lại mật khẩu. |
| Phòng biến mất sau khi restart server | Đúng như thiết kế. Phòng lưu trong RAM, mất khi tiến trình khởi động lại. |
