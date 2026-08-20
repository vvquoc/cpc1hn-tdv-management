# Biên bản UAT - 2026-08-20

Hệ thống: CPC1HN TDV Management MVP  
Môi trường kiểm tra: local workspace + Netlify CLI production build + production URL  
Production URL: `https://cpc1hn-tdv-management.netlify.app`

## 1. Tóm tắt kết quả

| Nhóm kiểm tra | Trạng thái | Ghi chú |
| --- | --- | --- |
| Build local | PASS | `npm run build` hoàn tất, sinh `dist/` |
| UAT tự động | PASS | 9/9 kiểm tra pass |
| Netlify build | PASS | Netlify CLI build production pass, đóng gói đủ 8 functions |
| GitHub push | PASS | Commit `fb044c0` đã được đẩy lên `main` |
| Netlify CI/CD deploy | PASS | Deploy production commit `fb044c0` trạng thái `ready` |
| Function health local | PASS | Handler trả `200 {"ok":true,...}` |
| Production HTTP | BLOCKED EXPECTED | Production trả `401` do Netlify Edge Access/SSO đang bật |
| UI UAT production bằng terminal | NOT RUN | Không mở trình duyệt theo yêu cầu tiết kiệm token; cần phiên đăng nhập Netlify để test UI |

## 2. Kết quả kiểm tra tự động

Lệnh đã chạy:

```bash
npm run uat
```

Kết quả:

| ID | Nội dung | Trạng thái |
| --- | --- | --- |
| UAT-AUTO-01 | Netlify build config publish `dist` và dùng Node 22 | PASS |
| UAT-AUTO-02 | Route API public map đúng Netlify Functions | PASS |
| UAT-AUTO-03 | Migration có đủ bảng nghiệp vụ cốt lõi | PASS |
| UAT-AUTO-04 | Helper phân quyền có đủ `requireUser`, `isAdmin`, `customerScopeSql`, `assertCustomerAccess` | PASS |
| UAT-AUTO-05 | UI có đủ form quản trị | PASS |
| UAT-AUTO-06 | Website ghi dữ liệu qua các API role-scoped | PASS |
| UAT-AUTO-07 | Luồng n8n không còn trong app path | PASS |
| UAT-AUTO-08 | File mẫu data thật tồn tại | PASS |
| UAT-AUTO-09 | Netlify Functions load được trong Node | PASS |

## 3. Kết quả build

Lệnh đã chạy:

```bash
npm run build
netlify build
```

Kết quả:

- `npm run build`: PASS, build static app vào `dist/`.
- `netlify build`: PASS.
- Netlify đóng gói đủ functions:
  - `admin-data.js`
  - `bootstrap-data.js`
  - `daily-reminders.js`
  - `health.js`
  - `lost-sales-trigger.js`
  - `prescriptions.js`
  - `sales.js`
  - `tenders.js`

## 4. Kết quả kiểm tra production URL

Kiểm tra:

- `https://cpc1hn-tdv-management.netlify.app`
- `https://cpc1hn-tdv-management.netlify.app/api/v1/health`

Kết quả:

- Cả hai trả `401`.
- Đây là trạng thái phù hợp khi Netlify Edge Access/SSO đang bật.
- Chưa thể xác nhận UI production bằng terminal nếu không có phiên đăng nhập.

## 5. UAT nghiệp vụ cần test tay sau khi đăng nhập Netlify

| ID | Kịch bản | Trạng thái hiện tại |
| --- | --- | --- |
| UAT-01 | Mở production URL sau đăng nhập Netlify | PENDING MANUAL |
| UAT-02 | Admin thấy dashboard và menu Quản trị | PENDING MANUAL |
| UAT-03 | MR không thấy menu Quản trị | PENDING MANUAL |
| UAT-04 | MR chỉ thấy khách hàng được phân công | PENDING MANUAL |
| UAT-05 | MR nhập kê đơn, dữ liệu hiện lại trên danh sách | PENDING MANUAL |
| UAT-06 | MR nhập doanh số, dashboard cập nhật | PENDING MANUAL |
| UAT-07 | Cập nhật tiến độ thầu | PENDING MANUAL |
| UAT-08 | Cảnh báo mất sale 4 tháng | PENDING MANUAL |
| UAT-09 | Nhắc nhân viên chưa báo cáo ngày | PENDING MANUAL |
| UAT-10 | Admin thêm tài khoản nhân viên | PENDING MANUAL |
| UAT-11 | Admin sửa tài khoản nhân viên | PENDING MANUAL |
| UAT-12 | Admin ngừng kích hoạt tài khoản | PENDING MANUAL |
| UAT-13 | Admin thêm/sửa địa bàn | PENDING MANUAL |
| UAT-14 | Admin thêm/sửa sản phẩm | PENDING MANUAL |
| UAT-15 | Admin thêm/sửa khách hàng | PENDING MANUAL |
| UAT-16 | Admin phân công địa bàn | PENDING MANUAL |
| UAT-17 | Admin phân công khách hàng cho MR | PENDING MANUAL |
| UAT-18 | MR gọi API quản trị bị chặn | PENDING API WITH DB |
| UAT-19 | MR nhập khách hàng ngoài quyền bị chặn | PENDING API WITH DB |
| UAT-20 | Mở workbook/CSV mẫu data thật | PASS FILE EXISTS |
| UAT-21 | Push GitHub để Netlify CI/CD deploy | PASS |

## 6. Phát hiện và rủi ro

| Mức độ | Nội dung | Ảnh hưởng | Đề xuất |
| --- | --- | --- | --- |
| High | Production bật Netlify Edge Access/SSO nên terminal không thể UAT UI/API trực tiếp | Không thể tự động xác nhận màn hình sau deploy nếu không có phiên đăng nhập | Test tay sau đăng nhập hoặc tạo deploy preview tạm thời không SSO |
| Medium | Selector tài khoản trong app hiện là cơ chế demo | Chưa phải xác thực production thật theo email đăng nhập | Giai đoạn sau nối Netlify Identity/OAuth và bỏ selector demo |
| Fixed | Dashboard từng dùng tháng demo `2026-08` | Có thể sai khi qua tháng khác | Đã chuyển sang tháng hiện tại theo giờ Việt Nam |
| Fixed | Nhắc báo cáo từng cố định ngày `2026-08-20` | Có thể sai khi qua ngày khác | Đã chuyển sang ngày hiện tại theo giờ Việt Nam |
| Low | UAT local DB chưa chạy end-to-end vì local Netlify DB khác production ở extension migration | Không ảnh hưởng build production đã pass, nhưng hạn chế dev offline | Tạo migration local-compatible hoặc seed test DB riêng |

## 7. Kết luận

MVP đạt các kiểm tra kỹ thuật nền tảng: build, routing, functions, dữ liệu mẫu, form quản trị, và loại bỏ n8n khỏi app path.

UAT nghiệp vụ đầy đủ trên production cần bước đăng nhập Netlify để xác nhận thao tác UI thật. Trạng thái `401` hiện tại là hợp lệ với cấu hình SSO đang bật, không phải lỗi build.
