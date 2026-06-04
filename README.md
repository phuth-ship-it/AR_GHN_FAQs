# Dynamic FAQ Knowledge Base (Google Sheets CMS)

Hệ thống Website câu hỏi thường gặp (FAQ) động, tải dữ liệu trực tiếp và cập nhật thời gian thực từ Google Sheets thông qua Google Apps Script Web App. 

## 🌟 Tính năng nổi bật
* **Google Sheet làm CMS**: Thay đổi nội dung, thêm sửa xóa danh mục hoặc câu hỏi ngay trên Google Sheets mà không cần chỉnh sửa code hay deploy lại website.
* **Module hóa ES6**: Code được tổ chức thành các module JS riêng biệt (`api`, `router`, `theme`, `markdown`, `app`).
* **Hỗ trợ Markdown & XSS Safe**: Trình biên dịch Markdown siêu nhẹ tích hợp sẵn, hiển thị định dạng đẹp (heading, list, bảng, callout dạng GitHub) đi kèm bộ lọc mã độc bảo mật (XSS Sanitizer).
* **Giao diện Glassmorphism**: Thiết kế UI hiện đại theo phong cách Notion/Help Center, bo góc mềm, đổ bóng mịn.
* **Dark/Light Mode nâng cao**: Tự động nhận diện và đồng bộ theo chế độ sáng tối của hệ điều hành, cho phép ghi đè thủ công và lưu lại tùy chọn.
* **Bộ định tuyến kép (SPA Router)**: Hỗ trợ linh hoạt cả URL đẹp phục vụ SEO (History API) lẫn chế độ Hash-routing để chạy được trên bất kỳ hosting tĩnh nào mà không cần cấu hình.
* **Tốc độ tải tối đa & Caching**: Cache dữ liệu trên Session Storage với cơ chế TTL (Time-to-Live) 5 phút giúp tối ưu băng thông và giảm số lần gọi tới Google API.
* **Tìm kiếm thông minh**: Tìm kiếm tức thì trong danh mục kết hợp cơ chế Debounce chống giật lag và hiển thị trạng thái rỗng (Empty State) bắt mắt.

---

## 📂 Cấu trúc dự án
```text
e:/Antigravity/Web link sheet/
├── index.html                   # Giao diện chính (SPA Shell & Thẻ SEO)
├── style.css                    # Toàn bộ CSS Design System (Responsive & Animations)
├── google-apps-script.js        # Script chạy trên Google Sheets
├── README.md                    # Tài liệu hướng dẫn sử dụng
└── js/
    ├── api.js                   # Xử lý kết nối API, Caching, Mock Data dự phòng
    ├── router.js                # Định tuyến trang chủ, danh mục và chi tiết FAQ
    ├── theme.js                 # Điều khiển giao diện sáng/tối và đồng bộ hệ thống
    ├── markdown.js              # Trình phân tích cú pháp Markdown & chống mã độc XSS
    └── app.js                   # Kết nối các module và điều khiển DOM chính
```

---

## 📊 Thiết kế cấu trúc Google Sheets
Tạo một Google Sheet mới với các tiêu đề cột ở dòng số 1 đúng như sau (Viết hoa chữ cái đầu):

| A (Category) | B (Topic) | C (Description) | D (Content) | E (Icon) | F (Slug) |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Nhân sự** | Xin nghỉ phép | Hướng dẫn xin nghỉ phép năm | Nội dung chi tiết bằng Markdown... | file-text | xin-nghi-phep |
| **IT** | Reset mật khẩu | Cách đổi mật khẩu hệ thống | Nội dung chi tiết bằng Markdown... | lock | reset-password |

### 💡 Cơ chế nâng cao quản lý Danh mục (Category Config)
Mặc định hệ thống tự động gom nhóm các dòng có chung `Category`. Để tùy chỉnh **Mô tả ngắn** và **Icon** riêng cho từng danh mục hiển thị ở trang chủ, bạn chỉ cần tạo 1 dòng có điền `Category`, `Description`, `Icon` và **để trống** cột `Topic`, `Content`, `Slug`:

| Category | Topic | Description | Content | Icon | Slug |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Nhân sự** | *(Để trống)* | Cổng thông tin chế độ, nghỉ phép và chính sách bảo hiểm xã hội. | *(Để trống)* | users | *(Để trống)* |
| **Nhân sự** | Xin nghỉ phép | Hướng dẫn xin nghỉ phép năm | Để xin nghỉ phép... | file-text | xin-nghi-phep |

*Nếu không khai báo dòng cấu hình riêng này, hệ thống sẽ tự động dùng mô tả mặc định và lấy icon của câu hỏi đầu tiên thuộc nhóm đó.*

> [!TIP]
> Cột **Icon** nhận giá trị là **tên dạng chữ của Lucide icon** (ví dụ: `users`, `lock`, `file-text`, `help-circle`, `settings`, `phone`, `info`, `credit-card`...).
> * **Không** cần chèn hình ảnh, file vẽ hay emoji phức tạp vào ô tính. Chỉ cần gõ tên icon bằng chữ thường.
> * Bạn có thể tìm kiếm tên tất cả các icon có sẵn tại: [Lucide Icons](https://lucide.dev/icons).
> * Nếu để trống hoặc nhập sai tên, hệ thống sẽ tự động sử dụng icon mặc định là `help-circle`.

---

## 🚀 Hướng dẫn kết nối Google Sheet (Step-by-Step)

### Bước 1: Thiết lập Google Apps Script
1. Mở Google Sheet chứa dữ liệu FAQ của bạn.
2. Trên thanh công cụ, chọn **Tiện ích mở rộng** (Extensions) -> **Apps Script**.
3. Xóa toàn bộ mã code mặc định hiển thị trong khung soạn thảo.
4. Mở file [google-apps-script.js](file:///e:/Antigravity/Web%20link%20sheet/google-apps-script.js) trong dự án này, copy toàn bộ nội dung và paste vào trang Apps Script.
5. Nhấn biểu tượng **Lưu** (Disk icon) hoặc tổ hợp phím `Ctrl + S`.

### Bước 2: Deploy dịch vụ Web App
1. Nhấp vào nút **Triển khai** (Deploy) màu xanh ở góc trên bên phải -> Chọn **Triển khai mới** (New deployment).
2. Ở cửa sổ hiện lên, nhấp vào biểu tượng bánh răng cài đặt ở mục "Chọn loại cấu hình" (Select type) -> Chọn **Ứng dụng web** (Web app).
3. Điền các thông tin:
   * **Mô tả**: `FAQ API`
   * **Thực thi dưới dạng** (Execute as): Chọn **Tôi** (Địa chỉ email của bạn)
   * **Ai có quyền truy cập** (Who has access): Chọn **Bất kỳ ai** (Anyone) *(Điều này vô cùng quan trọng để website có thể đọc được dữ liệu mà không cần xác thực tài khoản)*.
4. Nhấp nút **Triển khai** (Deploy).
5. Hệ thống có thể yêu cầu bạn cấp quyền truy cập (Authorize Access) đối với tài khoản Google. Hãy bấm đồng ý.
6. Sau khi deploy hoàn tất, copy đường link tại mục **Ứng dụng web** (URL có dạng `https://script.google.com/macros/s/.../exec`).

### Bước 3: Liên kết URL vào Code Frontend
1. Mở file [js/api.js](file:///e:/Antigravity/Web%20link%20sheet/js/api.js) trên IDE/Editor của bạn.
2. Tìm dòng khai báo đối tượng `API_CONFIG`:
   ```javascript
   export const API_CONFIG = {
       url: 'DÁN_LINK_WEB_APP_URL_VÀO_ĐÂY'
   };
   ```
3. Lưu file lại. Giờ đây trang web sẽ tự động chuyển sang tải dữ liệu từ Google Sheets thay vì dữ liệu mock dự phòng.

---

## 📝 Hướng dẫn định dạng nội dung FAQ (Markdown)
Trong cột **Content** của Google Sheet, bạn có thể viết văn bản thường hoặc sử dụng định dạng Markdown phong phú:

### 1. Phân cấp đề mục
```markdown
# Đề mục lớn (h1)
## Đề mục vừa (h2)
### Đề mục nhỏ (h3)
```

### 2. Định dạng chữ & Liên kết
* Chữ đậm: `Đây là **chữ đậm** quan trọng.`
* Chữ nghiêng: `Đoạn này *in nghiêng* nhấn mạnh.`
* Link liên kết: `Truy cập [Trang nhân sự](https://hrm.company.com) để đăng ký.`
* Code inline: `Nhập lệnh \`git clone\` để tải mã nguồn.`

### 3. Tạo bảng thông tin (Tables)
```markdown
| Cột 1 | Cột 2 | Cột 3 |
| :--- | :---: | ---: |
| Trái | Giữa | Phải |
| Dòng 1 | Nội dung | 120.000đ |
```

### 4. Hộp cảnh báo / Lưu ý (GitHub-style callouts)
Đặt các thẻ cảnh báo trong blockquote để kích hoạt giao diện chuyên nghiệp:
```markdown
> [!NOTE]
> Đây là thông tin lưu ý hữu ích dạng ghi chú.

> [!IMPORTANT]
> Đây là thông báo vô cùng quan trọng bắt buộc phải đọc.

> [!WARNING]
> Đây là khuyến cáo tránh làm sai quy định.

> [!DANGER]
> Đây là nội dung cảnh cáo.
```

---

## 🌐 Deploy Website lên môi trường Internet

### Cách 1: Sử dụng GitHub Pages (Miễn phí & Phổ biến)
1. Tạo 1 repository mới trên GitHub và push toàn bộ source code lên.
2. Vào **Settings** của repo -> Tìm mục **Pages** ở thanh sidebar bên trái.
3. Tại phần "Build and deployment", mục **Source** chọn **Deploy from a branch**.
4. Tại phần **Branch**, chọn nhánh chính (`main` hoặc `master`) và thư mục `/ (root)` -> Nhấn **Save**.
5. Đợi 1-2 phút, GitHub sẽ cung cấp link website của bạn.

### Cách 2: Deploy lên Vercel / Netlify (Hỗ trợ URL đẹp SEO)
Nếu muốn sử dụng URL đẹp không có dấu `#` (ví dụ: `domain.com/category/nhan-su` thay vì `domain.com/#/category/nhan-su`):
1. Chỉnh cấu hình `useHistory: true` trong file [js/router.js](file:///e:/Antigravity/Web%20link%20sheet/js/router.js).
2. Tạo file cấu hình chuyển hướng (rewrite rules) ở thư mục gốc của dự án để máy chủ chuyển hướng mọi request về `index.html`:
   * **Đối với Netlify** (`_redirects`):
     ```text
     /*   /index.html   200
     ```
   * **Đối với Vercel** (`vercel.json`):
     ```json
     {
       "rewrites": [
         { "source": "/(.*)", "destination": "/index.html" }
       ]
     }
     ```
3. Tiến hành liên kết Git và deploy trên trang quản trị của Netlify hoặc Vercel.
