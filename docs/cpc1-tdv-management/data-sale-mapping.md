# Mapping DATA SALE

Nguồn: Google Spreadsheet `1hyw8e_UNJyfihxJjGcLUOPph_tc2gJm885F5pQabp0U`, tab `Sheet1`, `sheetId=990869057`.

Sheet có 35.124 dòng, 102 cột trong grid nhưng chỉ vùng `A:S` gồm 19 cột dữ liệu được sử dụng.

## Mapping cột

| Cột | Header nguồn | Cột database | Kiểu dữ liệu | Ghi chú |
| --- | --- | --- | --- | --- |
| A | Quản lý | `ten_quan_ly` | varchar(160) | Tên quản lý từ nguồn, chưa có mã |
| B | NV kinh doanh | `ma_nhan_vien` | varchar(20) | Giữ dạng text, ví dụ `015795` |
| C | Tên NV KD | `ten_nhan_vien` | varchar(160) | Tên tại thời điểm phát sinh sale |
| D | Tỉnh | `tinh` | varchar(100) | Dùng cho phạm vi địa bàn |
| E | Nhóm KH | `nhom_khach_hang` | varchar(80) | Ví dụ Phòng mạch, BV Kê đơn, Thầu |
| F | Tháng | `thang` | smallint | 1-12 |
| G | Năm | `nam` | smallint | Năm chứng từ |
| H | Mã Kh | `ma_khach_hang` | varchar(40) | Mã khách hàng nguồn |
| I | Tên KH | `ten_khach_hang` | varchar(240) | Tên tại thời điểm chứng từ |
| J | Ngày chứng từ | `ngay_chung_tu` | date | Sheet đang dùng format `M/D/YYYY` |
| K | Số Chứng từ ngoại | `so_chung_tu_ngoai` | varchar(80) | Số hóa đơn/chứng từ nguồn |
| L | Mã HH | `ma_hang_hoa` | varchar(40) | Mã hàng hóa nguồn |
| M | Tên HH | `ten_hang_hoa` | varchar(300) | Tên hàng hóa tại thời điểm sale |
| N | DVT | `don_vi_tinh` | varchar(30) | Ống, Lọ, Bình, Gói... |
| O | Số Lượng | `so_luong` | numeric(18,3) | Cho phép 0 và số điều chỉnh |
| P | Đơn giá | `don_gia` | numeric(18,3) | Giữ phần thập phân nguồn |
| Q | Doanh thu | `doanh_thu` | numeric(18,2) | Trước hệ số |
| R | Hệ số | `he_so` | numeric(10,4) | Có thể khác 1, ví dụ 0.3 hoặc 1.5 |
| S | DOANH SỐ | `doanh_so` | numeric(18,2) | Giá trị dùng cho KPI sale |

## Quy tắc import

1. Không chuyển mã nhân viên, khách hàng hoặc hàng hóa sang số.
2. Ưu tiên đọc effective value/serial của ngày từ Google Sheets. Nếu dùng CSV, chuẩn hóa ngày về `YYYY-MM-DD` trước khi import.
3. Dùng bộ ba `source_spreadsheet_id + source_sheet_id + source_row_number` để upsert một dòng nguồn.
4. Lưu `row_hash` SHA-256 của 19 trường để phát hiện dòng đã thay đổi.
5. Dashboard và KPI cộng cột `DOANH SỐ`; cột `Doanh thu` chỉ phục vụ đối soát.
6. Không gộp dữ liệu trước khi lưu. Tổng hợp tháng thực hiện qua view `vw_data_sale_monthly`.

## Liên kết danh mục

- `ma_nhan_vien` đối chiếu `tb_nhan_su.ma_nhan_vien_sale`.
- `ma_khach_hang` đối chiếu `tb_khach_hang.ma_khach_hang_sale`.
- `ma_hang_hoa` đối chiếu `tb_san_pham.ma_hang_hoa_sale`.
- Giao dịch chưa đối chiếu được vẫn được lưu; các khóa nội bộ cho phép null để quản lý xử lý mapping sau.
