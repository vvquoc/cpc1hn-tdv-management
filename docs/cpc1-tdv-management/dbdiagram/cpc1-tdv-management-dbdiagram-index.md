# CPC1 TDV Management - Database Diagram

Nguồn mô hình: nghiệp vụ hệ thống và Google Sheet `DATA SALE TỪ 01.01.2025 ĐẾN 31.06.2026`, tab `Sheet1`, cột `A:S`.

## Artifact

- `cpc1-tdv-management.dbml`: schema DBML để import vào dbdiagram.io.
- `cpc1-tdv-management.sql`: PostgreSQL schema sinh tự động từ DBML.
- `netlify/database/migrations/006_data_sale_detail.sql`: migration triển khai riêng cho dữ liệu sale chi tiết.

## Bảng chính

| Bảng | Mục đích |
| --- | --- |
| `tb_nhan_su` | Nhân viên, vai trò và mã NV kinh doanh từ DATA SALE |
| `tb_dia_ban` | Địa bàn/tỉnh phụ trách |
| `tb_khach_hang` | Khách hàng nội bộ và mã KH từ DATA SALE |
| `tb_san_pham` | Sản phẩm nội bộ và mã HH từ DATA SALE |
| `data_sale_import_batches` | Nhật ký từng lần import/sync nguồn sale |
| `data_sale_transactions` | 19 trường giao dịch chi tiết, khóa dòng nguồn và hash chống trùng |
| `tb_doanh_thu` | Dữ liệu doanh số tháng nhập tay cũ, giữ để tương thích MVP |
| `tb_ke_don` | Nhật ký kê đơn |
| `tb_thau` | Tiến độ gói thầu |

## Quan hệ sale

- Một batch import có nhiều giao dịch sale.
- Giao dịch sale có thể liên kết với một nhân viên, khách hàng và sản phẩm nội bộ sau khi đối chiếu mã nguồn.
- View `vw_data_sale_monthly` tổng hợp giao dịch theo tháng, nhân viên, khách hàng và sản phẩm.
