# CPC1HN Data Templates

Bộ file mẫu chuẩn bị dữ liệu thật cho hệ thống quản lý trình dược viên CPC1 Hà Nội.

## File chính

- `cpc1hn_data_import_template.xlsx`: workbook nhiều sheet để nhập liệu.
- `csv/`: từng bảng ở dạng CSV để import vào database hoặc Google Sheets.

## Thứ tự nhập dữ liệu

1. `tb_dia_ban`
2. `tb_nhan_su`
3. `employee_territories`
4. `tb_san_pham`
5. `tb_khach_hang`
6. `employee_customers`
7. `tb_ke_don`, `tb_doanh_thu`, `tb_thau`, `daily_reports`, `kpi_targets`

## Quy tắc

- Không đổi tên cột.
- ID giữ dạng text.
- Ngày dùng `yyyy-mm-dd`.
- Tháng dùng `yyyy-mm`.
- Tiền và số lượng nhập số, không nhập ký hiệu VND.
- Không bỏ qua hai bảng phân quyền `employee_territories` và `employee_customers`.