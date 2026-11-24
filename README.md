# LOVE UNDER THE MOONLIGHT — TÌNH YÊU DƯỚI ÁNH TRĂNG

Một website tình yêu tĩnh, lãng mạn và tương tác, viết hoàn toàn bằng tiếng Việt. Dự án chỉ sử dụng HTML5, CSS3 và JavaScript thuần, không có backend, cơ sở dữ liệu máy chủ hay quá trình cài đặt phụ thuộc.

## Chạy trên máy tính

### Cách 1 — Mở trực tiếp

Mở `index.html` bằng Google Chrome.

Cách này phù hợp để xem giao diện. Tuy nhiên, để đảm bảo IndexedDB, nhập ảnh, nhạc và khả năng lưu lại ổn định trên mọi trình duyệt, nên dùng máy chủ cục bộ bên dưới.

### Cách 2 — Máy chủ cục bộ (khuyến nghị)

Trong thư mục chứa dự án, chạy:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Sau đó mở Chrome và truy cập:

```text
http://127.0.0.1:4173
```

Dừng máy chủ bằng `Ctrl + C` khi không cần dùng nữa.

## Mở trên điện thoại Android hoặc iOS

### Qua GitHub Pages

Cách đơn giản nhất là xuất bản website theo hướng dẫn ở mục “Triển khai lên GitHub Pages”, sau đó mở địa chỉ trang bằng Chrome trên Android hoặc Safari trên iOS.

### Qua máy tính trong cùng mạng Wi-Fi

Trên máy tính chạy:

```bash
python -m http.server 4173 --bind 0.0.0.0
```

Mở Command Prompt và chạy `ipconfig` để lấy địa chỉ IPv4 của máy tính, ví dụ `192.168.1.20`. Trên điện thoại, mở:

```text
http://192.168.1.20:4173
```

Máy tính và điện thoại phải dùng cùng Wi-Fi. Nếu trình duyệt điện thoại không kết nối được, hãy kiểm tra Windows Firewall và cho phép Python truy cập mạng riêng.

## Triển khai lên GitHub Pages

1. Tạo một repository GitHub mới.
2. Tải toàn bộ các tệp sau lên repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `assets/moon-favicon.svg`
   - `README.md`
   - `TEST-REPORT.md`
3. Mở repository trên GitHub.
4. Vào **Settings → Pages**.
5. Trong **Build and deployment**, chọn **Deploy from a branch**.
6. Chọn nhánh `main` (hoặc nhánh đang dùng) và thư mục `/ (root)`.
7. Nhấn **Save** và chờ GitHub hoàn tất xuất bản.
8. Mở địa chỉ website do GitHub Pages cung cấp.

Website không cần GitHub Actions, dịch vụ API hay cấu hình bí mật.

## Tính năng chính

- Giao diện đêm/ngày với hệ màu tím, xanh vũ trụ, hồng và bạc.
- Thiên hà xoắn, tinh vân, nhiều lớp sao, sao băng, hạt vũ trụ và mặt trăng lưỡi liềm vẽ bằng SVG/Canvas.
- Hiệu ứng con trỏ, vệt sáng, hạt chạm, trái tim, gợn sóng và parallax.
- Phần câu chuyện, kỷ niệm, lá thư, vũ trụ, âm nhạc, thông điệp đặc biệt và chân trang.
- Thư viện ảnh cục bộ: chọn nhiều ảnh, xem trước, kiểm tra định dạng, đặt tiêu đề/chú thích, chỉnh sửa, xóa, phóng to, toàn màn hình và trình chiếu.
- Lá thư với phong bì mở/đóng và hiệu ứng gõ chữ.
- Chòm sao tương tác với bảy thông điệp và tiến độ được lưu lại.
- Ba bản nhạc môi trường được tạo bằng Web Audio API, không vi phạm bản quyền.
- Trình phát nhạc: phát/tạm dừng, bài trước/sau, âm lượng, tắt tiếng, tua tiến độ và tự chuyển bài.
- Nhập nhạc MP3/M4A/WAV/OGG/WEBM từ máy.
- Màn hình tải, cuộn mượt, hiệu ứng xuất hiện, menu di động, thông báo và nút về đầu trang.
- Điều hướng bàn phím, hộp thoại có quản lý tiêu điểm, nhãn tiếng Việt và hỗ trợ giảm chuyển động.

## Ảnh và nhạc được lưu ở đâu?

- Ảnh tải lên và nhạc nhập vào được lưu trong **IndexedDB của cùng trình duyệt và cùng địa chỉ website**.
- Website không gửi ảnh hoặc nhạc của bạn lên máy chủ.
- Dữ liệu không tự đồng bộ giữa các thiết bị, trình duyệt hoặc địa chỉ website khác nhau.
- Xóa dữ liệu trang, dùng chế độ duyệt ẩn danh hoặc thay đổi địa chỉ website có thể làm mất dữ liệu đã lưu.
- Google Fonts được tải từ Google để hiển thị phông chữ; nếu không có mạng, trình duyệt sẽ dùng phông dự phòng. Nội dung ảnh/nhạc người dùng không được gửi đến Google Fonts.

## Nhập ảnh và nhạc

1. Mở mục **Kỷ Niệm Của Chúng Ta**.
2. Chọn **Thêm kỷ niệm** và chọn một hoặc nhiều ảnh JPG, JPEG, PNG hoặc WEBP.
3. Nhập tiêu đề và lời nhắn, sau đó xác nhận lưu.
4. Nhấn vào ảnh để mở lightbox; dùng nút trình chiếu, phóng to hoặc các phím mũi tên.
5. Mở mục **Âm Nhạc Của Chúng Mình**, chọn **Thêm nhạc** và chọn tệp âm thanh trên máy.

Không nên nhập nội dung nhạy cảng nếu thiết bị được nhiều người cùng sử dụng.

## Cấu trúc mã nguồn

| Tệp | Vai trò |
| --- | --- |
| `index.html` | Cấu trúc HTML, nội dung tiếng Việt, SVG và các hộp thoại |
| `styles.css` | Giao diện, chủ đề, hoạt ảnh và bố cục responsive |
| `app.js` | IndexedDB, thư viện, trình chiếu, thư, chòm sao, âm nhạc và hiệu ứng vũ trụ |
| `assets/moon-favicon.svg` | Biểu tượng mặt trăng cục bộ |

Tổng cộng khoảng **9.648 dòng mã nguồn**. Mã được tổ chức theo từng hệ thống chức năng; không có thư viện frontend hoặc bước build.

## Tùy chỉnh nội dung

- Sửa tiêu đề, tên, câu chuyện và các thông điệp trong `index.html`.
- Sửa nội dung lá thư trong biến `letterParagraphs` và dữ liệu bài hát trong `app.js`.
- Sửa màu sắc, khoảng cách, typography và hiệu ứng bằng các biến CSS ở đầu `styles.css`.
- Thay favicon bằng tệp SVG riêng nếu cần, đồng thời cập nhật tham chiếu trong `index.html`.

## Trình duyệt khuyến nghị

- Chrome/Edge phiên bản mới trên Windows, macOS, Linux và Android.
- Safari/iOS phiên bản mới.
- Cần bật JavaScript và IndexedDB để sử dụng đầy đủ chức năng lưu trữ.
- Web Audio API và HTML Audio phải được trình duyệt hỗ trợ.

Chi tiết những gì đã được kiểm thử thực tế và các giới hạn còn lại nằm trong `TEST-REPORT.md`.
