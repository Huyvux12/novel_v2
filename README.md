# 📚 DocLN Clone - Nền Tảng Đọc Light Novel

Một website đọc Light Novel tĩnh, được xây dựng bằng HTML, CSS và JavaScript thuần.

![Demo](https://img.shields.io/badge/Status-Demo-blue) ![Version](https://img.shields.io/badge/Version-1.0-green)

## ✨ Tính Năng

- 🌙 **Dark/Light Mode** - Chuyển đổi giao diện sáng/tối
- 📖 **Trình đọc tùy chỉnh** - Điều chỉnh cỡ chữ, font chữ, và màu nền (sáng/vàng/tối)
- 🔍 **Tìm kiếm** - Tìm truyện theo tên hoặc tác giả
- 📱 **Responsive** - Tương thích mọi thiết bị
- 📝 **Nội dung Markdown** - Viết chương truyện bằng định dạng Markdown

## 🗂️ Cấu Trúc Thư Mục

```
novel/
├── index.html              # Trang chủ (danh sách truyện)
├── reader.html             # Trang đọc chương
├── css/
│   ├── style.css           # CSS chung
│   └── reader.css          # CSS cho trang đọc
├── js/
│   ├── app.js              # Logic trang chủ
│   └── reader.js           # Logic trang đọc
└── novels/
    ├── index.json          # Danh sách tất cả truyện
    ├── thien-su-nha-ben/
    │   ├── info.json       # Thông tin truyện
    │   ├── chap1.md        # Nội dung chương 1
    │   ├── chap2.md        # Nội dung chương 2
    │   └── ...
    ├── shadow-eminence/
    │   └── ...
    └── mushoku-tensei/
        └── ...
```

## 🚀 Cách Sử Dụng

### Chạy Local

1. **Cài đặt Live Server** (VS Code extension) hoặc serve tĩnh

2. **Mở bằng Live Server:**
   - Click chuột phải vào `index.html`
   - Chọn "Open with Live Server"

3. **Hoặc sử dụng Python:**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```

4. **Hoặc sử dụng Node.js:**
   ```bash
   npx serve .
   ```

5. Mở trình duyệt và truy cập `http://localhost:8000`

## 📖 Cách Thêm Truyện Mới

### Bước 1: Tạo thư mục truyện

Tạo thư mục mới trong `novels/` với tên dạng slug (không dấu, dùng dấu gạch ngang):

```
novels/ten-truyen-moi/
```

### Bước 2: Tạo file `info.json`

```json
{
  "id": "ten-truyen-moi",
  "title": "Tên Truyện Mới",
  "author": "Tên Tác Giả",
  "description": "Mô tả ngắn về truyện...",
  "cover": "https://link-anh-bia.jpg",
  "genres": ["Genre1", "Genre2"],
  "status": "Đang tiến hành",
  "views": "0",
  "follows": "0",
  "chapters": [
    {
      "number": 1,
      "title": "Chương 1: Tiêu đề chương",
      "file": "chap1.md",
      "date": "2025-01-01"
    }
  ]
}
```

### Bước 3: Thêm vào `novels/index.json`

Thêm object truyện mới vào mảng `novels` trong file `novels/index.json`.

### Bước 4: Viết nội dung chương

Tạo các file chương với định dạng Markdown (`.md`):

```markdown
Đây là nội dung chương.

Bạn có thể sử dụng **bold**, *italic*, và các định dạng Markdown khác.

> Đây là trích dẫn

---

Chia đoạn bằng dấu gạch ngang.
```

## ⚙️ Cài Đặt Đọc Truyện

Trang đọc (`reader.html`) hỗ trợ các tùy chỉnh:

| Tính năng | Mô tả |
|-----------|-------|
| **Màu nền** | Sáng / Vàng (Sepia) / Tối |
| **Cỡ chữ** | 14px - 28px |
| **Font chữ** | Sans Serif / Serif / Monospace |

Các cài đặt được lưu vào `localStorage` và tự động áp dụng khi quay lại.

## 🛠️ Công Nghệ Sử Dụng

- **HTML5** - Cấu trúc trang
- **CSS3** - Styling với CSS Variables
- **JavaScript ES6+** - Logic ứng dụng
- **[markdown-it](https://github.com/markdown-it/markdown-it)** - Parse Markdown
- **Google Fonts** - Inter, Merriweather, JetBrains Mono

## 📌 Ghi Chú

- Đây là phiên bản demo/static, không có backend
- Các nút Đăng nhập/Đăng ký chỉ là giao diện mẫu
- Dữ liệu truyện được lưu trữ dưới dạng file JSON và Markdown

## 📄 License

MIT License - Sử dụng tự do cho mục đích học tập và phi thương mại.

---

Made with ❤️ by DocLN Clone Team
