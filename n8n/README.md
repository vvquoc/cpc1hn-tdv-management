# n8n Google Sheets Sync

Luồng test cần chứng minh:

1. Nhân viên điền dữ liệu trong Google Sheet.
2. n8n đọc tab tương ứng.
3. n8n gọi `POST /api/v1/import/google-sheet`.
4. Netlify Function kiểm tra `x-automation-secret`.
5. Database upsert dữ liệu theo ID.
6. Dashboard đọc lại API và hiển thị dữ liệu mới.

## API import

Endpoint:

```text
POST https://cpc1hn-tdv-management.netlify.app/api/v1/import/google-sheet
```

Header:

```text
content-type: application/json
x-automation-secret: <N8N_AUTOMATION_SECRET>
```

Body:

```json
{
  "table": "tb_doanh_thu",
  "rows": [
    {
      "thang_nam": "2026-08",
      "id_khach_hang": "KH_PM_DN_01",
      "id_san_pham": "SP_NEB_3",
      "id_nhan_vien": "NV-DN-01",
      "doanh_so_thuc": 2500000,
      "source_note": "Google Sheet"
    }
  ]
}
```

## Thứ tự sync master data

1. `tb_dia_ban`
2. `tb_nhan_su`
3. `employee_territories`
4. `tb_san_pham`
5. `tb_khach_hang`
6. `employee_customers`

Sau đó mới sync giao dịch:

- `tb_ke_don`
- `tb_doanh_thu`
- `tb_thau`
- `daily_reports`
- `kpi_targets`

## Test nhanh

Google Sheet test:

```text
https://docs.google.com/spreadsheets/d/1HUXh_XFKfuT5nbfvox_RX5OR2N9i0lM6aVSBA-PItWI/edit
```

1. Mở Google Sheet template ở link trên.
2. Thêm một dòng vào tab `tb_doanh_thu`.
3. Chạy workflow n8n với `table = tb_doanh_thu`, `sheetName = tb_doanh_thu`.
4. Mở app và chọn đúng user/email.
5. Dashboard cập nhật doanh số.

## Cấu hình secret

Secret đã được tạo local ở:

```text
n8n/.env.local
```

Trong n8n self-hosted, đặt biến môi trường cùng tên:

```text
N8N_AUTOMATION_SECRET=<giá trị trong file local>
```

Nếu dùng n8n cloud, tạo credential/header thủ công trong HTTP Request node với giá trị này.
