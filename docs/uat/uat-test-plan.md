# Kịch bản UAT - CPC1HN TDV Management MVP

Ngày lập: 2026-08-20  
Phạm vi: Website quản lý nội bộ cho trình dược viên, bỏ n8n khỏi luồng chính. Dữ liệu được nhập và cập nhật trực tiếp trên website theo quyền.

## 1. Vai trò test

| Vai trò | Mục tiêu kiểm tra |
| --- | --- |
| Admin | Xem toàn bộ dữ liệu, thêm/sửa/ngừng kích hoạt tài khoản, quản lý địa bàn, sản phẩm, khách hàng, phân công |
| Manager | Quyền quản trị tương đương Admin trong MVP |
| Supervisor | Xem dữ liệu theo địa bàn phụ trách |
| MR | Chỉ xem và nhập dữ liệu khách hàng được phân công |

## 2. Dữ liệu demo dùng để test

| Nhóm | Dữ liệu |
| --- | --- |
| Admin | `admin@cpc1hn.vn` |
| MR Đà Nẵng | `linh.nguyen@cpc1hn.vn` |
| MR Quảng Nam | `minh.tran@cpc1hn.vn` |
| Sản phẩm | Dữ liệu demo trong website và file `data-templates` |
| Khách hàng | Bệnh viện, Sở Y tế, phòng mạch demo theo địa bàn |

## 3. Kịch bản UAT chức năng

| ID | Nhóm | Kịch bản | Bước test | Kết quả mong đợi |
| --- | --- | --- | --- | --- |
| UAT-01 | Truy cập | Mở website production | Vào `https://cpc1hn-tdv-management.netlify.app` | Nếu Netlify Edge Access bật, người dùng phải đăng nhập Netlify trước khi vào app |
| UAT-02 | Phân quyền | Admin xem toàn bộ hệ thống | Chọn `admin@cpc1hn.vn` trong selector demo | Thấy menu Quản trị, dashboard tổng hợp toàn hệ thống |
| UAT-03 | Phân quyền | MR không thấy màn Quản trị | Chọn tài khoản MR | Menu Quản trị bị ẩn, không có form thêm/sửa master data |
| UAT-04 | Phân quyền | MR chỉ thấy khách hàng được phân công | Chọn MR Đà Nẵng, kiểm danh sách khách hàng | Không thấy khách hàng ngoài phạm vi phụ trách |
| UAT-05 | Kê đơn | MR nhập kê đơn mới | Chọn khách hàng, sản phẩm, số lượng, ngày, gửi form | Bản ghi xuất hiện trong danh sách và dashboard cập nhật |
| UAT-06 | Doanh số | MR nhập doanh số mới | Chọn khách hàng, sản phẩm, số tiền, ngày, gửi form | Doanh số tháng tăng, danh sách doanh số cập nhật |
| UAT-07 | Thầu | Cập nhật tiến độ gói thầu | Chọn khách hàng bệnh viện/sở, nhập mã gói thầu và trạng thái | Danh sách thầu hiển thị trạng thái mới |
| UAT-08 | Cảnh báo | Tính phòng mạch mất sale | Gọi nút/lệnh cảnh báo hoặc xem dashboard | Khách hàng không có doanh số 4 tháng liên tục được đưa vào danh sách cảnh báo |
| UAT-09 | Nhắc báo cáo | Tính nhân viên chưa báo cáo ngày | Gọi nhắc nhở báo cáo | Nhân viên MR chưa có báo cáo ngày hiện tại xuất hiện trong danh sách |
| UAT-10 | Quản trị nhân sự | Admin thêm tài khoản MR | Vào Quản trị, nhập ID, tên, email, vai trò, trạng thái | Tài khoản mới xuất hiện trong danh sách nhân sự và selector demo |
| UAT-11 | Quản trị nhân sự | Admin sửa tài khoản MR | Bấm Sửa, đổi tên/vai trò/trạng thái, lưu | Danh sách nhân sự cập nhật đúng |
| UAT-12 | Quản trị nhân sự | Admin ngừng kích hoạt tài khoản | Bấm Ngừng kích hoạt với một tài khoản test | Tài khoản chuyển trạng thái inactive và không được xác thực API |
| UAT-13 | Quản trị địa bàn | Admin thêm/sửa địa bàn | Nhập mã, tên địa bàn, vùng | Địa bàn mới xuất hiện để phân công |
| UAT-14 | Quản trị sản phẩm | Admin thêm/sửa sản phẩm | Nhập mã, tên, nhóm, dạng bào chế, trạng thái | Sản phẩm xuất hiện trong danh mục và form nghiệp vụ |
| UAT-15 | Quản trị khách hàng | Admin thêm/sửa khách hàng | Nhập mã, tên, loại, địa bàn, trạng thái | Khách hàng xuất hiện trong danh mục và có thể phân công |
| UAT-16 | Phân công | Admin phân công địa bàn cho nhân viên | Chọn nhân viên và địa bàn, lưu | Nhân viên có quyền xem dữ liệu địa bàn đó theo vai trò |
| UAT-17 | Phân công | Admin phân công khách hàng cho MR | Chọn MR và khách hàng, lưu | MR xem/nhập được dữ liệu của khách hàng đó |
| UAT-18 | API âm | MR gọi API quản trị | Gửi request `POST /api/v1/admin-data` bằng email MR | API trả lỗi 403 |
| UAT-19 | API âm | MR nhập dữ liệu cho khách hàng ngoài quyền | Gửi request kê đơn/doanh số với khách hàng ngoài phạm vi | API trả lỗi 403 |
| UAT-20 | Mẫu data thật | Kiểm file import mẫu | Mở workbook và CSV trong `data-templates` | Có đủ sheet/cột cho nhân sự, địa bàn, sản phẩm, khách hàng, kê đơn, doanh thu, thầu, KPI |
| UAT-21 | CI/CD | Push code lên GitHub | Commit/push vào `main` | Netlify tự build/deploy từ GitHub |

## 4. Kịch bản kiểm tra kỹ thuật tự động

Chạy:

```bash
npm run uat
npm run build
```

Các kiểm tra tự động bao gồm:

- Cấu hình Netlify build và Node 22.
- Redirect API public sang Netlify Functions.
- Migration có đủ bảng nghiệp vụ.
- Hàm phân quyền có đủ helper chính.
- UI có đủ form quản trị.
- Frontend gọi đúng API ghi dữ liệu.
- Luồng n8n không còn trong app path.
- File mẫu data thật tồn tại.
- Các Netlify Functions load được trong Node.

## 5. Điều kiện chấp nhận MVP

MVP được xem là đạt UAT khi:

- Admin/Manager quản trị được tài khoản, địa bàn, sản phẩm, khách hàng và phân công trên website.
- MR nhập được kê đơn và doanh số trực tiếp trên website.
- Dữ liệu sau khi nhập được đọc lại và phản ánh lên dashboard/danh sách.
- MR không xem hoặc nhập được dữ liệu ngoài phạm vi phụ trách.
- Cảnh báo mất sale và nhắc báo cáo chạy được.
- Netlify build thành công và deploy từ GitHub.

## 6. Rủi ro còn lại cần xác nhận trước production thật

- Selector tài khoản hiện là cơ chế demo để test nhanh; bản production thật cần nối với đăng nhập thật và lấy email từ identity provider.
- Production đang bật Netlify Edge Access/SSO, nên test UI tự động từ terminal không vào được nếu không có phiên đăng nhập.
- Local database của Netlify có khác biệt extension so với production database, nên migration local có thể cần chỉnh riêng nếu muốn dev offline hoàn toàn.
