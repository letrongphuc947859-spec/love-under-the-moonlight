# BÁO CÁO KIỂM THỬ — LOVE UNDER THE MOONLIGHT

**Ngày kiểm thử:** 24/11/2026  
**Phiên bản mã nguồn kiểm thử:** 2.0.0  
**Phạm vi:** Kiểm tra tĩnh và kiểm thử tương tác trên trình duyệt Chromium tại máy tính, kết hợp mô phỏng viewport tablet/Android và chế độ giảm chuyển động.

## 1. Kết quả tổng quan

- **Lỗi nghiêm trọng còn lại:** Không phát hiện.
- **Lỗi console trong lần tải cuối:** Không có.
- **Tài nguyên cục bộ thiếu:** Không có.
- **Yêu cầu mạng kiểm tra:** Tải thành công (`200` hoặc `304`).
- **Trạng thái dữ liệu sau khi dọn dẹp kiểm thử:** 6 ảnh minh họa, 3 bản nhạc tích hợp, không còn ảnh/nhạc kiểm thử tạm.

## 2. Kiểm tra tĩnh

| Hạng mục | Kết quả |
| --- | --- |
| HTML/CSS/JS | Tải và chạy được trên máy chủ cục bộ |
| Số dòng mã | `index.html` 892; `styles.css` 5.877; `app.js` 2.879; tổng 9.648 |
| Định danh HTML | 151 `id`, không trùng lặp |
| Liên kết `#anchor` | Không có mục tiêu thiếu |
| Tham chiếu `<use href="#...">` | Không có biểu tượng SVG thiếu |
| Tệp cục bộ trong `src`/`href` | Không thiếu |
| Dấu ngoặc CSS | 971 cặp mở/đóng cân bằng |
| JavaScript parse | Đạt; toàn bộ `app.js` được biên dịch bằng `new Function(source)` |
| Ngôn ngữ trang | `lang="vi"` |
| iframe kiểm thử còn sót | Không |
| Hộp thoại đang mở sau kiểm thử | Không |

## 3. Chức năng đã kiểm thử trực tiếp

### Điều hướng và giao diện

- Cuộn mượt tới các mục: Trang chủ, Câu chuyện, Kỷ niệm, Lá thư, Vũ trụ, Âm nhạc và Thông điệp.
- Chuyển đêm/ngày và giữ lựa chọn sau khi tải lại trang.
- Mở/đóng menu di động, đóng bằng Escape và chuyển mục bằng liên kết.
- Mở/đóng hộp thoại, khóa cuộn nền, đóng bằng Escape và hoàn trả tiêu điểm.
- Hiệu ứng xuất hiện, thanh tiến độ và trạng thái điều hướng theo vị trí cuộn.
- Gửi yêu thương tạo trái tim và thông báo; chọn ngôi sao ngẫu nhiên và chuyển tiêu điểm đúng mục tiêu.

### Hiệu ứng vũ trụ và tương tác

- Thiên hà, sao, sao băng, hạt vũ trụ và mặt trăng hiển thị.
- Nhấn thật vào mặt trăng kích hoạt điều ước, trái tim và thông báo.
- Con trỏ, vệt sáng và hạt theo chuột hoạt động.
- Cảm ứng tạo trái tim/hạt tương tác; thao tác vuốt lightbox hoạt động.

### Lá thư

- Phong bì mở được bằng nút chuột và bàn phím.
- Chế độ chuyển động bình thường: gõ đủ **1.030/1.030 ký tự**, bỏ lớp `is-typing` và chuyển `aria-live` sang `polite`.
- Đóng lá thư khi đang gõ sẽ hủy bộ hẹn, không tiếp tục chạy nền.
- Chế độ giảm chuyển động: hiển thị ngay toàn bộ nội dung, không gõ chữ.

### Thư viện ảnh

- Tải nhiều ảnh, xem trước, kiểm tra định dạng và từ chối tệp không hợp lệ bằng thông báo tiếng Việt.
- Lưu tiêu đề/chú thích vào IndexedDB.
- Tải lại trang và dữ liệu vẫn còn.
- Chỉnh sửa tiêu đề/chú thích và lưu lại.
- Sắp xếp thư viện.
- Mở lightbox, xem bài trước/sau, phóng to, toàn màn hình và trình chiếu.
- Phím mũi tên không điều hướng ảnh khi đang nhập liệu.
- Xóa từng ảnh và xóa toàn bộ thư viện sau bước xác nhận.
- Khôi phục lại 6 ảnh minh họa sau khi kiểm thử xóa.

### Chòm sao

- Bảy ngôi sao đều mở được thông điệp.
- Trạng thái đã thăm, đường nối và thanh tiến độ cập nhật.
- Tiến độ được lưu vào `localStorage` và khôi phục sau khi tải lại.

### Âm nhạc

- Ba bản nhạc Web Audio phát được sau tương tác người dùng; không tự phát khi tải trang.
- Phát/tạm dừng, bài trước/sau, tắt tiếng, đổi âm lượng và tua tiến độ.
- Tự chuyển bài khi bản hiện tại kết thúc.
- Nhập tệp WAV cục bộ, đọc thời lượng, phát nhạc và lưu lại sau khi tải trang.
- Thời lượng nhạc nhập cập nhật trong danh sách phát.
- Từ chối định dạng âm thanh không hợp lệ.
- Xóa nhạc kiểm thử sau khi hoàn tất.

### Khả năng truy cập và giảm chuyển động

- Nhãn nút, tiêu điểm bàn phím, liên kết bỏ qua điều hướng và cấu trúc tiêu đề có mặt.
- Phong bì không còn nằm trong vùng bị ẩn khỏi cây khả năng truy cập; các ký tự trang trí được ẩn riêng.
- Nút xóa thư viện có nhãn đúng với hành vi.
- Nhãn nút trình chiếu đổi đúng giữa “Tạm dừng” và “Tiếp tục”.
- Mô phỏng `prefers-reduced-motion: reduce`: lá thư hiển thị tức thời, mặt trăng không tạo hiệu ứng điều ước.

### Responsive

- Kiểm tra desktop, tablet và viewport Android 360 px.
- Kiểm tra viewport hẹp 320 px.
- Sửa lỗi tràn ngang tại 320 px do thanh công cụ kỷ niệm; sau khi sửa, `scrollWidth = 320`.
- Thư viện chuyển một cột trên màn hình nhỏ; thanh công cụ và trình phát xếp chồng phù hợp.
- Chụp và xem trực quan các trạng thái desktop, tablet, ngày, 360 px và 320 px.

## 4. Lỗi đã phát hiện và khắc phục trong vòng kiểm thử cuối

- Nhãn nút trình chiếu không đồng bộ với trạng thái tạm dừng.
- Nhãn nút xóa thư viện không phản ánh đúng việc xóa cả ảnh minh họa.
- Thời lượng bài nhập không cập nhật trong danh sách phát.
- Phong bì có phần bao ngoài `aria-hidden` che khuất nút tương tác.
- Tràn ngang ở viewport 320 px.
- Truy vấn phát hiện bộ nhớ thiết bị dùng sai đơn vị `px`.
- Mặt trăng có thể lập lịch sao băng không cần thiết khi bật giảm chuyển động.
- `AudioContext` chưa được đóng rõ ràng khi dọn dẹp vòng đời ứng dụng.
- Hiệu ứng `transform` của nút từ tính có thể ghi đè trạng thái hover/active.

## 5. Giới hạn còn lại

- Chưa kiểm thử trên điện thoại Android/iOS vật lý; kết quả di động dựa trên mô phỏng kích thước và tương tác cảm ứng trong Chromium.
- Chưa kiểm thử đầy đủ trên Safari, Firefox và các trình duyệt nhúng.
- Dữ liệu ảnh/nhạc chỉ tồn tại trên trình duyệt và địa chỉ website hiện tại; không có đồng bộ đa thiết bị và không có sao lưu đám mây.
- Khả năng phát nhạc nhập phụ thuộc codec mà trình duyệt hỗ trợ.
- Phông chữ trang trí tải từ Google Fonts; khi ngoại tuyến, giao diện dùng phông dự phòng.
- Dự án không có Service Worker/PWA và không cam kết hoạt động ngoại tuyến ngay từ lần tải đầu.
- Hiệu năng thực tế trên thiết bị cấp thấp có thể thấp hơn máy kiểm thử; dự án đã có giới hạn hạt, giảm chất lượng theo thiết bị và tạm dừng khi trang ẩn.
- Kiểm thử tự động không thay thế hoàn toàn đánh giá thủ công về phông chữ tiếng Việt, màu sắc và cảm xúc trên mọi màn hình.

## 6. Kết luận

Bản 2.0.0 giữ đầy đủ chức năng tương tác đã triển khai, khắc phục các lỗi phát hiện được trong lần rà soát cuối và không còn lỗi nghiêm trọng đã biết trong phạm vi kiểm thử. Các giới hạn trình duyệt, thiết bị và lưu trữ được nêu rõ ở trên.
