# CPC1HN TDV Management

Hệ thống nội bộ quản lý trình dược viên, kê đơn, doanh số, thầu và cảnh báo mất sale. Website cập nhật trực tiếp vào PostgreSQL theo hai vai trò: `Nhân viên` và `Quản lý`.

## Triển khai bằng tài khoản Netlify mới

1. Trong Netlify, chọn **Add new project > Import an existing project** và kết nối repository này.
2. Trong project vừa tạo, mở **Database** và tạo Netlify Database cho production.
3. Mở **Project configuration > Environment variables**, thêm:
   - Key: `AUTH_TOKEN_SECRET`
   - Value: chuỗi ngẫu nhiên tối thiểu 32 ký tự.
   - Scope: `All scopes`.
   - Deploy contexts: cùng một giá trị cho tất cả context.
4. Trigger production deploy. Netlify tự đọc `netlify.toml`, chạy migration và build website.
5. Kiểm tra `/api/v1/health`, sau đó đăng nhập bằng tài khoản quản lý ban đầu.

Không cần tự nhập `NETLIFY_DB_URL` khi dùng Netlify Database. Nếu dùng PostgreSQL bên ngoài, đặt connection string vào `CPC1_DATABASE_URL`.

## Cấu hình build

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions-v2`
- Node.js: `22`
- Database migrations: `netlify/database/migrations`

Toàn bộ cấu hình đã nằm trong `netlify.toml`; không cần nhập lại Build settings trên giao diện Netlify.

## Dữ liệu khi đổi tài khoản Netlify

Database của project Netlify mới là database mới. Repo chỉ chứa schema, migration, tài khoản quản lý ban đầu và file mẫu; không chứa DATA SALE thật hoặc secret.

Sau khi deploy:

1. Đăng nhập tài khoản quản lý.
2. Mở **Quản trị > Import dữ liệu**.
3. Tải file mẫu Excel/CSV nếu cần.
4. Import DATA SALE hoặc các danh mục thật.

DATA SALE import đầy đủ hoạt động theo snapshot: dòng cùng nguồn được cập nhật, dòng không còn trong snapshot mới được loại bỏ sau khi import hoàn tất. Dữ liệu website tại cùng tháng + khách hàng + sản phẩm được ưu tiên hơn dữ liệu DATA SALE.

## Kiểm tra trước deploy

```bash
npm ci
npm run uat
npm run build
```

Chạy local với Netlify Functions:

```bash
netlify dev
```

## Chức năng chính

- Dashboard theo kỳ và phạm vi được phân quyền.
- Nhập, lọc và phân trang kê đơn.
- Nhập, lọc và phân trang doanh số.
- Theo dõi, lọc và cập nhật gói thầu.
- Cảnh báo phòng mạch mất sale bốn tháng liên tục.
- Quản lý tài khoản, nhân sự, địa bàn, sản phẩm, khách hàng và phân công.
- Import dữ liệu bằng file mẫu ngay trên website.

Nhân sự được import không tự động trở thành tài khoản đăng nhập. Chỉ hồ sơ có `username` và mật khẩu trong `auth_credentials` mới đăng nhập được.
