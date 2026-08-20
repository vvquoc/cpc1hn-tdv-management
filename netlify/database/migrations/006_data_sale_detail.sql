alter table tb_nhan_su
  add column if not exists ma_nhan_vien_sale varchar(20);

alter table tb_khach_hang
  add column if not exists ma_khach_hang_sale varchar(40),
  add column if not exists nhom_khach_hang_sale varchar(80);

alter table tb_san_pham
  add column if not exists ma_hang_hoa_sale varchar(40),
  add column if not exists don_vi_tinh_sale varchar(30);

create unique index if not exists uq_nhan_su_ma_sale
  on tb_nhan_su (ma_nhan_vien_sale)
  where ma_nhan_vien_sale is not null;

create unique index if not exists uq_khach_hang_ma_sale
  on tb_khach_hang (ma_khach_hang_sale)
  where ma_khach_hang_sale is not null;

create unique index if not exists uq_san_pham_ma_sale
  on tb_san_pham (ma_hang_hoa_sale)
  where ma_hang_hoa_sale is not null;

create table if not exists data_sale_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_spreadsheet_id varchar(120) not null,
  source_sheet_id bigint not null,
  source_title varchar(240),
  imported_by varchar(40) references tb_nhan_su(id_nhan_vien),
  status varchar(20) not null default 'Processing'
    check (status in ('Processing', 'Completed', 'Failed')),
  row_count integer not null default 0 check (row_count >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists data_sale_transactions (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references data_sale_import_batches(id),
  source_spreadsheet_id varchar(120) not null,
  source_sheet_id bigint not null,
  source_row_number integer not null check (source_row_number >= 2),
  row_hash char(64) not null,

  ten_quan_ly varchar(160) not null,
  ma_nhan_vien varchar(20) not null,
  ten_nhan_vien varchar(160) not null,
  tinh varchar(100) not null,
  nhom_khach_hang varchar(80) not null,
  thang smallint not null check (thang between 1 and 12),
  nam smallint not null check (nam between 2000 and 2100),
  ma_khach_hang varchar(40) not null,
  ten_khach_hang varchar(240) not null,
  ngay_chung_tu date not null,
  so_chung_tu_ngoai varchar(80) not null,
  ma_hang_hoa varchar(40) not null,
  ten_hang_hoa varchar(300) not null,
  don_vi_tinh varchar(30) not null,
  so_luong numeric(18, 3) not null,
  don_gia numeric(18, 3) not null,
  doanh_thu numeric(18, 2) not null,
  he_so numeric(10, 4) not null,
  doanh_so numeric(18, 2) not null,

  id_nhan_vien varchar(40) references tb_nhan_su(id_nhan_vien),
  id_khach_hang varchar(60) references tb_khach_hang(id_khach_hang),
  id_san_pham varchar(60) references tb_san_pham(id_san_pham),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_spreadsheet_id, source_sheet_id, source_row_number)
);

create index if not exists idx_data_sale_employee_period
  on data_sale_transactions (nam, thang, ma_nhan_vien);

create index if not exists idx_data_sale_customer_period
  on data_sale_transactions (nam, thang, ma_khach_hang);

create index if not exists idx_data_sale_product_period
  on data_sale_transactions (nam, thang, ma_hang_hoa);

create index if not exists idx_data_sale_scope_period
  on data_sale_transactions (tinh, nhom_khach_hang, nam, thang);

create index if not exists idx_data_sale_document_date
  on data_sale_transactions (ngay_chung_tu);

create or replace view vw_data_sale_monthly as
select
  concat(nam::text, '-', lpad(thang::text, 2, '0')) as thang_nam,
  ma_nhan_vien,
  max(ten_nhan_vien) as ten_nhan_vien,
  max(ten_quan_ly) as ten_quan_ly,
  tinh,
  nhom_khach_hang,
  ma_khach_hang,
  max(ten_khach_hang) as ten_khach_hang,
  ma_hang_hoa,
  max(ten_hang_hoa) as ten_hang_hoa,
  max(don_vi_tinh) as don_vi_tinh,
  sum(so_luong) as tong_so_luong,
  sum(doanh_thu) as tong_doanh_thu,
  sum(doanh_so) as tong_doanh_so,
  count(*) as so_dong_chung_tu
from data_sale_transactions
group by
  nam,
  thang,
  ma_nhan_vien,
  tinh,
  nhom_khach_hang,
  ma_khach_hang,
  ma_hang_hoa;

comment on table data_sale_transactions is
  'Dữ liệu chi tiết từ Google Sheet DATA SALE, giữ nguyên 19 cột nguồn A:S.';

comment on column data_sale_transactions.doanh_so is
  'Giá trị dùng cho KPI sale sau khi áp dụng hệ số; không đồng nhất với doanh_thu khi hệ số khác 1.';
