# Báo Cáo: Hook Mục Tiêu Vào BeEF Bằng Phương Pháp Man-in-the-Middle

## Tóm Tắt

Báo cáo này trình bày phương pháp nâng cao để hook mục tiêu vào BeEF (Browser Exploitation Framework) thông qua kỹ thuật man-in-the-middle, sử dụng công cụ bettercap. Phương pháp này cho phép chèn mã JavaScript của BeEF vào mọi trang web mà mục tiêu truy cập mà không cần tương tác trực tiếp với mục tiêu.

## Mục Đích

- Hook mục tiêu vào BeEF thông qua kỹ thuật chặn kết nối (man-in-the-middle)
- Chèn mã JavaScript của BeEF vào mọi trang web mà mục tiêu tải
- Duy trì kết nối với mục tiêu mà không cần giao tiếp trực tiếp

## Công Cụ Sử Dụng

1. **BeEF (Browser Exploitation Framework)**: Framework khai thác trình duyệt
2. **bettercap**: Công cụ thực hiện tấn công man-in-the-middle
3. **hstshijack.cap**: Caplet của bettercap để bypass HSTS và chèn mã JavaScript

## Quy Trình Thực Hiện

### 1. Chuẩn Bị Mã JavaScript Hook

- Tải mã JavaScript tùy chỉnh (`injectionbeef.js`) từ tài nguyên bài giảng
- Mã này có chức năng:
  - Tạo một phần tử mới trong mỗi trang
  - Tải mã BeEF hook
  - Nối phần tử này vào đầu trang

### 2. Cấu Hình Mã JavaScript

**Các bước cấu hình:**

1. Mở file `injectionbeef.js`
2. Thay thế địa chỉ IP trong file bằng IP của máy Kali đang chạy BeEF
   - Ví dụ: `10.20.14.207`
3. Lưu file và đóng

### 3. Cấu Hình bettercap Caplet

**Các bước:**

1. Mở file `hstshijack.cap` (phiên bản đã sửa đổi, không phải phiên bản mặc định của bettercap)
2. Tìm phần tải trọng (payload) hiện tại (đã có `keylogger.js`)
3. Thêm mã JavaScript tùy chỉnh:
   - Thêm dấu phẩy sau `keylogger.js`
   - Thêm cú pháp: `:injectionbeef.js` (để chèn vào mọi trang)
   - Đường dẫn đầy đủ: `/root/downloads/injectionbeef.js`
4. Lưu file và đóng

### 4. Chạy bettercap

**Lệnh thực thi:**

```bash
bettercap -iface <interface> -caplet hstshijack.cap
```

**Giải thích:**
- `-iface`: Chỉ định giao diện mạng kết nối với mạng mục tiêu
- `-caplet`: Tải caplet `hstshijack.cap` để:
  - Chạy tấn công ARP spoofing (đặt attacker vào vị trí man-in-the-middle)
  - Bypass HTTPS và HSTS
  - Chèn mã JavaScript đã cấu hình

### 5. Kích Hoạt HSTS Hijack

Sau khi bettercap chạy thành công:
- Gõ `hstshijack` trong giao diện bettercap
- Nhấn Tab để tự động hoàn thành
- Nhấn Enter để kích hoạt

### 6. Xác Minh Kết Quả

**Trên máy mục tiêu:**

1. Xóa dữ liệu duyệt web (khuyến nghị)
2. Truy cập bất kỳ trang web nào (HTTP hoặc HTTPS)
3. Quan sát:
   - Trang HTTPS sẽ bị hạ cấp xuống HTTP (do HSTS hijack)
   - Mã BeEF hook sẽ được chèn vào trang

**Trên BeEF:**

1. Kiểm tra giao diện BeEF
2. Xác nhận có trình duyệt mới xuất hiện trong danh sách mục tiêu
3. Có thể giao tiếp và chạy lệnh trên trình duyệt đã hook

## Kết Quả

- ✅ Hook thành công mục tiêu vào BeEF
- ✅ Mã hook được chèn vào mọi trang web mà mục tiêu truy cập
- ✅ Hoạt động với cả trang HTTP và HTTPS
- ✅ Một phần hoạt động với trang HSTS (khi truy cập qua công cụ tìm kiếm sử dụng HTTPS thông thường)

## Lưu Ý Quan Trọng

1. **Phiên bản caplet**: Sử dụng phiên bản `hstshijack.cap` đã sửa đổi, không phải phiên bản mặc định của bettercap (phiên bản mặc định không hoạt động như mong đợi)

2. **Kiểm tra ban đầu**: Nên kiểm tra với trang HTTP trước để đảm bảo hoạt động, sau đó mới thử với HTTPS

3. **Xóa dữ liệu duyệt web**: Nên xóa cache và dữ liệu duyệt web trên máy mục tiêu trước khi test

4. **Hạn chế với HSTS**: Phương pháp này hoạt động một phần với trang HSTS, đặc biệt khi mục tiêu truy cập qua công cụ tìm kiếm chỉ sử dụng HTTPS

## So Sánh Với Phương Pháp Cơ Bản

| Đặc Điểm | Phương Pháp Cơ Bản (HTML) | Phương Pháp Man-in-the-Middle |
|----------|---------------------------|-------------------------------|
| Tương tác trực tiếp | Cần | Không cần |
| Phạm vi hook | Chỉ trang HTML tùy chỉnh | Mọi trang web mục tiêu truy cập |
| Duy trì kết nối | Khó | Dễ dàng |
| Yêu cầu | Trang HTML | Quyền truy cập mạng |

## Kết Luận

Phương pháp hook mục tiêu vào BeEF thông qua man-in-the-middle sử dụng bettercap là một kỹ thuật hiệu quả và linh hoạt hơn so với phương pháp hook cơ bản. Nó cho phép tự động chèn mã hook vào mọi trang web mà mục tiêu truy cập, giúp duy trì kết nối lâu dài và không cần tương tác trực tiếp với mục tiêu.

---

**Lưu ý**: Báo cáo này chỉ phục vụ mục đích giáo dục và nghiên cứu bảo mật. Việc sử dụng các kỹ thuật này chỉ được phép trong môi trường được phép và có sự đồng ý.

