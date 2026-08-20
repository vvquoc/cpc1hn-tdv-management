# CPC1HN TDV Management - Core MVP

MVP này bám quy trình Netlify Build from Git:

1. Push repository lên GitHub/GitLab/Bitbucket/Azure DevOps.
2. Tạo project trên Netlify từ Git repository.
3. Netlify chạy `npm run build`.
4. Netlify deploy thư mục `dist`.
5. Netlify đóng gói API trong `netlify/functions`.

## Build settings

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node version: `22`

Các cấu hình trên đã được khai báo trong `netlify.toml`, nên khi deploy từ Git, Netlify sẽ ưu tiên file này hơn cấu hình nhập tay trong UI.

## Core MVP scope

- Dashboard theo vai trò và phạm vi địa bàn.
- Nhập kê đơn hằng ngày.
- Nhập doanh số thực tế theo tháng.
- Theo dõi và cập nhật trạng thái gói thầu.
- Admin/Manager quản trị nhân sự, tài khoản, địa bàn, sản phẩm, khách hàng và phân công.
- Quét phòng mạch mất sale trong 4 tháng liên tục.
- Danh sách TDV chưa gửi báo cáo trong ngày.
- Migration PostgreSQL ban đầu tại `migrations/001_core_schema.sql`.

## Local check

```bash
npm run build
```

Mở `dist/index.html` để xem giao diện tĩnh sau build. Nếu dùng Netlify CLI, chạy:

```bash
npx netlify dev
```

## API MVP

- `/.netlify/functions/health`
- `/.netlify/functions/bootstrap-data`
- `/.netlify/functions/prescriptions`
- `/.netlify/functions/sales`
- `/.netlify/functions/tenders`
- `/.netlify/functions/admin-data`
- `/.netlify/functions/lost-sales-trigger`
- `/.netlify/functions/daily-reminders`

Trong production, các endpoint public route tương ứng là:

- `/api/v1/health`
- `/api/v1/bootstrap-data`
- `/api/v1/prescriptions`
- `/api/v1/sales`
- `/api/v1/tenders`
- `/api/v1/admin-data`
- `/api/v1/lost-sales-trigger`
- `/api/v1/daily-reminders`

## Database

File `migrations/001_core_schema.sql` là schema PostgreSQL lõi. Website là kênh cập nhật dữ liệu chính theo role; Google Sheets chỉ còn là file chuẩn bị/import phụ trợ nếu cần.

## Role workflow

- `MR`: nhập kê đơn, nhập doanh số trong phạm vi khách hàng được phân công, xem KPI/cảnh báo cá nhân.
- `Supervisor`: xem dữ liệu theo địa bàn phụ trách và cập nhật tiến độ thầu thuộc vùng.
- `Manager/Admin`: quản trị dữ liệu thật trực tiếp trên website, gồm tài khoản nhân sự, địa bàn, sản phẩm, khách hàng và phân công.
