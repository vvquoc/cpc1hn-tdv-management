create extension if not exists pgcrypto;

create type employee_role as enum ('MR', 'Supervisor', 'Manager', 'Admin');
create type employee_status as enum ('Active', 'Inactive');
create type customer_type as enum ('BenhVien', 'SoYTe', 'PhongMachTu');
create type tender_status as enum ('DangLamHoSo', 'ChoKetQua', 'TrungThau', 'TruotThau');
create type dosage_form as enum ('BFS', 'BOV', 'MDI', 'VienDatDoKhuon', 'Khac');

create table tb_dia_ban (
  id_dia_ban varchar(40) primary key,
  ten_dia_ban varchar(120) not null,
  khu_vuc varchar(120) not null,
  created_at timestamptz not null default now()
);

create table tb_nhan_su (
  id_nhan_vien varchar(40) primary key,
  ten_nhan_vien varchar(160) not null,
  email varchar(255) not null unique,
  chuc_vu employee_role not null,
  trang_thai employee_status not null default 'Active',
  created_at timestamptz not null default now()
);

create table employee_territories (
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  id_dia_ban varchar(40) not null references tb_dia_ban(id_dia_ban),
  is_primary boolean not null default false,
  assigned_at timestamptz not null default now(),
  primary key (id_nhan_vien, id_dia_ban)
);

create table tb_san_pham (
  id_san_pham varchar(60) primary key,
  ten_san_pham varchar(180) not null,
  hoat_chat varchar(240),
  dang_bao_che dosage_form not null,
  mo_ta_dang_bao_che varchar(240) not null,
  quy_cach varchar(180),
  gia_ke_don numeric(14, 2) not null check (gia_ke_don >= 0),
  trang_thai employee_status not null default 'Active',
  created_at timestamptz not null default now()
);

create table tb_khach_hang (
  id_khach_hang varchar(60) primary key,
  ten_khach_hang varchar(220) not null,
  loai_khach_hang customer_type not null,
  dia_chi text,
  dien_thoai varchar(40),
  id_dia_ban varchar(40) not null references tb_dia_ban(id_dia_ban),
  trang_thai employee_status not null default 'Active',
  created_at timestamptz not null default now()
);

create table employee_customers (
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  id_khach_hang varchar(60) not null references tb_khach_hang(id_khach_hang),
  assigned_at timestamptz not null default now(),
  primary key (id_nhan_vien, id_khach_hang)
);

create table tb_ke_don (
  id_giao_dich uuid primary key default gen_random_uuid(),
  ngay_bao_cao date not null,
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  id_khach_hang varchar(60) not null references tb_khach_hang(id_khach_hang),
  id_san_pham varchar(60) not null references tb_san_pham(id_san_pham),
  so_luong_ke_don integer not null check (so_luong_ke_don > 0),
  doanh_so_phat_sinh numeric(14, 2) not null check (doanh_so_phat_sinh >= 0),
  created_at timestamptz not null default now()
);

create table tb_doanh_thu (
  id_doanh_thu uuid primary key default gen_random_uuid(),
  thang_nam char(7) not null,
  id_khach_hang varchar(60) not null references tb_khach_hang(id_khach_hang),
  id_san_pham varchar(60) not null references tb_san_pham(id_san_pham),
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  doanh_so_thuc numeric(14, 2) not null check (doanh_so_thuc >= 0),
  source_note varchar(160),
  created_at timestamptz not null default now(),
  unique (thang_nam, id_khach_hang, id_san_pham)
);

create table tb_thau (
  id_goi_thau varchar(80) primary key,
  id_khach_hang varchar(60) not null references tb_khach_hang(id_khach_hang),
  id_san_pham varchar(60) not null references tb_san_pham(id_san_pham),
  so_luong_thau integer check (so_luong_thau is null or so_luong_thau >= 0),
  gia_du_thau numeric(14, 2) check (gia_du_thau is null or gia_du_thau >= 0),
  trang_thai tender_status not null default 'DangLamHoSo',
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  han_nop date,
  ngay_cap_nhat date not null default current_date,
  created_at timestamptz not null default now()
);

create table tender_status_history (
  id uuid primary key default gen_random_uuid(),
  id_goi_thau varchar(80) not null references tb_thau(id_goi_thau),
  old_status tender_status,
  new_status tender_status not null,
  changed_by varchar(40) not null references tb_nhan_su(id_nhan_vien),
  changed_at timestamptz not null default now(),
  note text
);

create table daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  summary text not null,
  kpi_note text,
  created_at timestamptz not null default now(),
  unique (report_date, id_nhan_vien)
);

create table kpi_targets (
  id uuid primary key default gen_random_uuid(),
  thang_nam char(7) not null,
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  id_dia_ban varchar(40) references tb_dia_ban(id_dia_ban),
  id_san_pham varchar(60) references tb_san_pham(id_san_pham),
  target_sales numeric(14, 2) not null default 0 check (target_sales >= 0),
  target_prescriptions integer not null default 0 check (target_prescriptions >= 0),
  created_at timestamptz not null default now(),
  unique (thang_nam, id_nhan_vien, id_san_pham)
);

create table lost_sale_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_period char(7) not null,
  id_khach_hang varchar(60) not null references tb_khach_hang(id_khach_hang),
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  reason text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (alert_period, id_khach_hang)
);

create index idx_employee_territories_territory on employee_territories(id_dia_ban);
create index idx_employee_customers_customer on employee_customers(id_khach_hang);
create index idx_ke_don_scope_date on tb_ke_don(id_nhan_vien, ngay_bao_cao);
create index idx_ke_don_customer_date on tb_ke_don(id_khach_hang, ngay_bao_cao);
create index idx_doanh_thu_customer_period on tb_doanh_thu(id_khach_hang, thang_nam);
create index idx_thau_status_due on tb_thau(trang_thai, han_nop);

insert into tb_dia_ban (id_dia_ban, ten_dia_ban, khu_vuc) values
  ('DB_DANANG', 'Đà Nẵng', 'Miền Trung'),
  ('DB_QUANGNAM', 'Quảng Nam', 'Miền Trung'),
  ('DB_QUANGNGAI', 'Quảng Ngãi', 'Miền Trung'),
  ('DB_BINHDINH', 'Bình Định', 'Miền Trung'),
  ('DB_GIALAI', 'Gia Lai', 'Tây Nguyên');

insert into tb_nhan_su (id_nhan_vien, ten_nhan_vien, email, chuc_vu) values
  ('NV-DN-01', 'Nguyễn Minh Anh', 'mr.danang@cpc1hn.vn', 'MR'),
  ('NV-QN-01', 'Trần Hồng Phúc', 'mr.quangnam@cpc1hn.vn', 'MR'),
  ('NV-SV-01', 'Lê Thu Hà', 'supervisor.mt@cpc1hn.vn', 'Supervisor'),
  ('NV-AD-01', 'Phạm Quốc Bảo', 'admin@cpc1hn.vn', 'Admin');

insert into employee_territories (id_nhan_vien, id_dia_ban, is_primary) values
  ('NV-DN-01', 'DB_DANANG', true),
  ('NV-QN-01', 'DB_QUANGNAM', true),
  ('NV-SV-01', 'DB_DANANG', true),
  ('NV-SV-01', 'DB_QUANGNAM', false),
  ('NV-SV-01', 'DB_QUANGNGAI', false),
  ('NV-AD-01', 'DB_DANANG', false),
  ('NV-AD-01', 'DB_QUANGNAM', false),
  ('NV-AD-01', 'DB_QUANGNGAI', false),
  ('NV-AD-01', 'DB_BINHDINH', false),
  ('NV-AD-01', 'DB_GIALAI', false);
