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
- Node version: `20`

Các cấu hình trên đã được khai báo trong `netlify.toml`, nên khi deploy từ Git, Netlify sẽ ưu tiên file này hơn cấu hình nhập tay trong UI.

## Core MVP scope

- Dashboard theo vai trò và phạm vi địa bàn.
- Nhập kê đơn hằng ngày.
- Nhập doanh số thực tế theo tháng.
- Theo dõi trạng thái gói thầu.
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
- `/.netlify/functions/lost-sales-trigger`
- `/.netlify/functions/daily-reminders`

Trong production, các endpoint public route tương ứng là:

- `/api/v1/health`
- `/api/v1/lost-sales-trigger`
- `/api/v1/daily-reminders`

## Database

File `migrations/001_core_schema.sql` là schema PostgreSQL lõi. Google Sheets nên được dùng làm kênh nhập/xuất phụ trợ hoặc báo cáo, không làm nguồn dữ liệu chính cho phân quyền và giao dịch.
