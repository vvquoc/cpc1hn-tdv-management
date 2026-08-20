# Biên bản QA/QC và UAT - 2026-08-20

Hệ thống: CPC1HN TDV Management MVP  
Production: `https://cpc1hn-tdv-management.netlify.app`
Nhánh kiểm thử: `codex/backend-qa-hardening`

## 1. Kết luận hiện tại

| Nhóm | Kết quả | Ghi chú |
| --- | --- | --- |
| Build ứng dụng | PASS | Sinh `dist/` thành công |
| Netlify production build | PASS | Áp 7 migration, đóng gói đủ 12 Functions |
| Kiểm tra cấu hình/UI | PASS 13/13 | Route, form, PostgreSQL, import template và CRUD |
| Kiểm tra backend cô lập | PASS 18/18 | Auth, role, scope, CRUD và validation |
| Kiểm tra database tích hợp | PASS | Đăng nhập `15795`, đọc PostgreSQL và import DATA SALE idempotent |
| Production health trước sửa | PASS | `/api/v1/health` trả `200` |
| Production login trước sửa | FAIL | Tài khoản quản lý trả `401` do credential trong store bị lệch |
| Production UAT sau sửa | PENDING DEPLOY | Chờ đưa nhánh sửa lỗi lên GitHub/Netlify |

## 2. Lỗi đã xác định và bản sửa

| Mức độ | Lỗi | Nguyên nhân | Xử lý |
| --- | --- | --- | --- |
| Critical | Không đăng nhập được tài khoản quản lý | Credential production lệch khỏi seed, không có migration database | Chuyển credential sang PostgreSQL và seed lại tài khoản quản lý bằng migration |
| High | Lưu xong chưa thấy dữ liệu cập nhật | Netlify Blobs dùng một JSON chung và có thể đọc dữ liệu cũ | Chuyển toàn bộ dữ liệu nghiệp vụ sang PostgreSQL |
| High | Hai người lưu cùng lúc có thể ghi đè dữ liệu | Không có transaction hoặc kiểm tra phiên bản | Thêm transaction, khóa revision và lỗi xung đột `409` |
| High | DATA SALE 35.123 dòng chưa có mô hình chi tiết | Schema cũ chỉ lưu doanh số tổng hợp thủ công | Thêm bảng 19 cột nguồn, batch import, view tháng và upsert idempotent |
| High | Một request đọc store nhiều lần | `requireUser` và handler cùng tải toàn bộ dữ liệu | Tái sử dụng cùng snapshot dữ liệu trong request |
| High | Có thể ghi đè gói thầu ngoài phạm vi | Chỉ kiểm tra khách hàng mới, không kiểm tra bản ghi thầu hiện hữu | Kiểm tra quyền trên cả bản ghi cũ và dữ liệu mới |
| High | Sửa tài khoản có thể làm lệch credential | Form không tải username hiện tại và có nguy cơ giữ dữ liệu autofill | Trả danh sách username an toàn, xóa ô mật khẩu khi mở form sửa |
| Medium | CRUD địa bàn thiếu sửa/xóa trực quan | UI chỉ có form upsert, không có danh sách thao tác | Thêm danh sách địa bàn và nút sửa/xóa |
| Medium | Dữ liệu sai có thể thành lỗi `500` | Thiếu validation và xử lý JSON lỗi | Bổ sung lỗi `400/404/409` và thông báo tiếng Việt |
| Medium | Lỗi mạng làm mất phiên local | Frontend xóa token với mọi loại lỗi | Chỉ xóa phiên khi backend trả `401/403` |
| Medium | Nội dung import có thể chèn HTML | Render dữ liệu động bằng `innerHTML` chưa escape | Escape toàn bộ dữ liệu động trước khi render |

## 3. Kiểm tra backend tự động

Bộ `scripts/backend-uat.mjs` kiểm tra:

1. Từ chối và chấp nhận đăng nhập đúng trường hợp.
3. Từ chối JSON sai định dạng.
4. Quản lý tạo sản phẩm, khách hàng và tài khoản nhân viên.
5. Quản lý phân địa bàn và khách hàng.
6. Nhân viên đăng nhập và chỉ thấy dữ liệu thuộc phạm vi.
7. Nhân viên ghi kê đơn, doanh số và gói thầu.
8. Backend chặn ghi chéo địa bàn và ghi đè gói thầu ngoài quyền.
9. Backend chặn tự xóa tài khoản quản lý đang đăng nhập.
10. Tài khoản nhân viên bị vô hiệu hóa không thể đăng nhập.

Kết quả: `18 backend UAT checks passed.`

Smoke test với Netlify Database development xác nhận:

1. Tài khoản `15795` đăng nhập với role `QuanLy`.
2. Bootstrap đọc đúng dữ liệu PostgreSQL.
3. Nhập cùng một dòng DATA SALE hai lần vẫn chỉ có một giao dịch nguồn.
4. Dòng DATA SALE được liên kết đúng nhân viên `015795`, địa bàn, khách hàng và sản phẩm.

## 4. Lệnh xác minh

```bash
npm run build
npm run uat
netlify build
```

Cả ba lệnh đều PASS trên workspace ngày 2026-08-20.

## 5. UAT production bắt buộc sau deploy

| ID | Kịch bản | Trạng thái |
| --- | --- | --- |
| PROD-01 | Đăng nhập tài khoản quản lý | PENDING DEPLOY |
| PROD-02 | Tạo, sửa, xóa nhân viên/sản phẩm/khách hàng/địa bàn | PENDING DEPLOY |
| PROD-03 | Tạo tài khoản nhân viên và đăng nhập tài khoản mới | PENDING DEPLOY |
| PROD-04 | Phân quyền địa bàn/khách hàng và kiểm tra dữ liệu hiển thị | PENDING DEPLOY |
| PROD-05 | Ghi kê đơn, doanh số, thầu và đọc lại ngay | PENDING DEPLOY |
| PROD-06 | Chặn API ngoài phạm vi bằng tài khoản nhân viên | PENDING DEPLOY |
| PROD-07 | Import CSV và DATA SALE hợp lệ, từ chối file sai | PENDING DEPLOY |
| PROD-08 | Export JSON | PENDING DEPLOY |

## 6. Rủi ro còn lại

1. Chưa deploy nhánh hiện tại nên production vẫn đang chạy bản cũ.
2. Chưa nhập toàn bộ 35.123 dòng DATA SALE vào production; hiện mới xác minh dòng mẫu trên database development.
3. Sau deploy cần chạy lại toàn bộ PROD-01 đến PROD-08 trên URL thật.
