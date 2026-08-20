-- SQL dump generated using DBML (dbml.dbdiagram.io)
-- Database: PostgreSQL
-- Generated at: 2026-08-20T12:29:04.726Z

CREATE TYPE "employee_role" AS ENUM (
  'NhanVien',
  'QuanLy'
);

CREATE TYPE "customer_type" AS ENUM (
  'BenhVien',
  'SoYTe',
  'PhongMachTu'
);

CREATE TYPE "tender_status" AS ENUM (
  'DangLamHoSo',
  'ChoKetQua',
  'TrungThau',
  'TruotThau'
);

CREATE TABLE "tb_dia_ban" (
  "id_dia_ban" varchar PRIMARY KEY,
  "ten_dia_ban" varchar NOT NULL,
  "khu_vuc" varchar NOT NULL,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "tb_nhan_su" (
  "id_nhan_vien" varchar PRIMARY KEY,
  "ma_nhan_vien_sale" varchar UNIQUE,
  "ten_nhan_vien" varchar NOT NULL,
  "email" varchar UNIQUE NOT NULL,
  "chuc_vu" employee_role NOT NULL,
  "trang_thai" varchar DEFAULT 'Active',
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "employee_territories" (
  "id_nhan_vien" varchar,
  "id_dia_ban" varchar,
  "is_primary" boolean DEFAULT false,
  "assigned_at" timestamp DEFAULT (now()),
  PRIMARY KEY ("id_nhan_vien", "id_dia_ban")
);

CREATE TABLE "tb_san_pham" (
  "id_san_pham" varchar PRIMARY KEY,
  "ma_hang_hoa_sale" varchar UNIQUE,
  "ten_san_pham" varchar NOT NULL,
  "hoat_chat" varchar,
  "dang_bao_che" varchar NOT NULL,
  "quy_cach" varchar,
  "don_vi_tinh_sale" varchar,
  "gia_ke_don" decimal NOT NULL,
  "trang_thai" varchar DEFAULT 'Active'
);

CREATE TABLE "tb_khach_hang" (
  "id_khach_hang" varchar PRIMARY KEY,
  "ma_khach_hang_sale" varchar UNIQUE,
  "ten_khach_hang" varchar NOT NULL,
  "loai_khach_hang" customer_type NOT NULL,
  "dia_chi" text,
  "dien_thoai" varchar,
  "id_dia_ban" varchar NOT NULL,
  "trang_thai" varchar DEFAULT 'Active',
  "nhom_khach_hang_sale" varchar
);

CREATE TABLE "employee_customers" (
  "id_nhan_vien" varchar,
  "id_khach_hang" varchar,
  "assigned_at" timestamp DEFAULT (now()),
  PRIMARY KEY ("id_nhan_vien", "id_khach_hang")
);

CREATE TABLE "tb_ke_don" (
  "id_giao_dich" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "ngay_bao_cao" date NOT NULL,
  "id_nhan_vien" varchar NOT NULL,
  "id_khach_hang" varchar NOT NULL,
  "id_san_pham" varchar NOT NULL,
  "so_luong_ke_don" int NOT NULL,
  "doanh_so_phat_sinh" decimal NOT NULL,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "tb_doanh_thu" (
  "id_doanh_thu" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "thang_nam" varchar NOT NULL,
  "id_khach_hang" varchar NOT NULL,
  "id_san_pham" varchar NOT NULL,
  "id_nhan_vien" varchar NOT NULL,
  "doanh_so_thuc" decimal NOT NULL,
  "source_note" varchar,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "data_sale_import_batches" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "source_spreadsheet_id" varchar NOT NULL,
  "source_sheet_id" bigint NOT NULL,
  "source_title" varchar,
  "imported_by" varchar,
  "status" varchar NOT NULL DEFAULT 'Processing',
  "row_count" int NOT NULL DEFAULT 0,
  "started_at" timestamp NOT NULL DEFAULT (now()),
  "finished_at" timestamp
);

CREATE TABLE "data_sale_transactions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "import_batch_id" uuid NOT NULL,
  "source_spreadsheet_id" varchar NOT NULL,
  "source_sheet_id" bigint NOT NULL,
  "source_row_number" int NOT NULL,
  "row_hash" varchar NOT NULL,
  "ten_quan_ly" varchar NOT NULL,
  "ma_nhan_vien" varchar NOT NULL,
  "ten_nhan_vien" varchar NOT NULL,
  "tinh" varchar NOT NULL,
  "nhom_khach_hang" varchar NOT NULL,
  "thang" smallint NOT NULL,
  "nam" smallint NOT NULL,
  "ma_khach_hang" varchar NOT NULL,
  "ten_khach_hang" varchar NOT NULL,
  "ngay_chung_tu" date NOT NULL,
  "so_chung_tu_ngoai" varchar NOT NULL,
  "ma_hang_hoa" varchar NOT NULL,
  "ten_hang_hoa" varchar NOT NULL,
  "don_vi_tinh" varchar NOT NULL,
  "so_luong" decimal(18,3) NOT NULL,
  "don_gia" decimal(18,3) NOT NULL,
  "doanh_thu" decimal(18,2) NOT NULL,
  "he_so" decimal(10,4) NOT NULL,
  "doanh_so" decimal(18,2) NOT NULL,
  "id_nhan_vien" varchar,
  "id_khach_hang" varchar,
  "id_san_pham" varchar,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "tb_thau" (
  "id_goi_thau" varchar PRIMARY KEY,
  "id_khach_hang" varchar NOT NULL,
  "id_san_pham" varchar NOT NULL,
  "so_luong_thau" int,
  "gia_du_thau" decimal,
  "trang_thai" tender_status NOT NULL,
  "id_nhan_vien" varchar NOT NULL,
  "han_nop" date,
  "ngay_cap_nhat" date
);

CREATE TABLE "daily_reports" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "report_date" date NOT NULL,
  "id_nhan_vien" varchar NOT NULL,
  "summary" text NOT NULL,
  "kpi_note" text,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "lost_sale_alerts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "alert_period" varchar NOT NULL,
  "id_khach_hang" varchar NOT NULL,
  "id_nhan_vien" varchar NOT NULL,
  "reason" text NOT NULL,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT (now())
);

CREATE UNIQUE INDEX "uq_data_sale_source_row" ON "data_sale_transactions" ("source_spreadsheet_id", "source_sheet_id", "source_row_number");

CREATE INDEX "idx_data_sale_employee_period" ON "data_sale_transactions" ("nam", "thang", "ma_nhan_vien");

CREATE INDEX "idx_data_sale_customer_period" ON "data_sale_transactions" ("nam", "thang", "ma_khach_hang");

CREATE INDEX "idx_data_sale_product_period" ON "data_sale_transactions" ("nam", "thang", "ma_hang_hoa");

CREATE INDEX "idx_data_sale_scope_period" ON "data_sale_transactions" ("tinh", "nhom_khach_hang", "nam", "thang");

CREATE INDEX "idx_data_sale_document_date" ON "data_sale_transactions" ("ngay_chung_tu");

COMMENT ON COLUMN "tb_dia_ban"."id_dia_ban" IS 'mã địa bàn';

COMMENT ON COLUMN "tb_nhan_su"."id_nhan_vien" IS 'mã nhân sự nội bộ';

COMMENT ON COLUMN "tb_nhan_su"."ma_nhan_vien_sale" IS 'Mã NV kinh doanh từ DATA SALE, giữ dạng text và số 0 đầu';

COMMENT ON COLUMN "tb_nhan_su"."email" IS 'email đăng nhập để phân quyền';

COMMENT ON COLUMN "tb_san_pham"."ma_hang_hoa_sale" IS 'Mã HH từ DATA SALE';

COMMENT ON COLUMN "tb_san_pham"."dang_bao_che" IS 'BFS, BOV, MDI, viên đặt đổ khuôn hoặc dạng khác';

COMMENT ON COLUMN "tb_san_pham"."don_vi_tinh_sale" IS 'DVT từ DATA SALE';

COMMENT ON COLUMN "tb_khach_hang"."ma_khach_hang_sale" IS 'Mã KH từ DATA SALE';

COMMENT ON COLUMN "tb_khach_hang"."nhom_khach_hang_sale" IS 'Nhóm KH nguyên bản: Phòng mạch, BV Kê đơn, Thầu...';

COMMENT ON COLUMN "tb_doanh_thu"."thang_nam" IS 'YYYY-MM';

COMMENT ON COLUMN "data_sale_import_batches"."source_spreadsheet_id" IS 'Google Spreadsheet ID nguồn';

COMMENT ON COLUMN "data_sale_import_batches"."source_sheet_id" IS 'sheetId/gid nguồn';

COMMENT ON COLUMN "data_sale_import_batches"."status" IS 'Processing, Completed hoặc Failed';

COMMENT ON COLUMN "data_sale_transactions"."source_row_number" IS 'Số dòng thực tế trong Google Sheet, bắt đầu từ 2';

COMMENT ON COLUMN "data_sale_transactions"."row_hash" IS 'SHA-256 của 19 giá trị nguồn để kiểm tra thay đổi';

COMMENT ON COLUMN "data_sale_transactions"."ten_quan_ly" IS 'Cột Quản lý';

COMMENT ON COLUMN "data_sale_transactions"."ma_nhan_vien" IS 'Cột NV kinh doanh, giữ số 0 đầu';

COMMENT ON COLUMN "data_sale_transactions"."ten_nhan_vien" IS 'Cột Tên NV KD';

COMMENT ON COLUMN "data_sale_transactions"."doanh_so" IS 'Giá trị KPI sale sau khi nhân hệ số';

COMMENT ON COLUMN "data_sale_transactions"."id_nhan_vien" IS 'Liên kết nội bộ sau khi đối chiếu mã sale';

ALTER TABLE "employee_territories" ADD FOREIGN KEY ("id_nhan_vien") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "employee_territories" ADD FOREIGN KEY ("id_dia_ban") REFERENCES "tb_dia_ban" ("id_dia_ban") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_khach_hang" ADD FOREIGN KEY ("id_dia_ban") REFERENCES "tb_dia_ban" ("id_dia_ban") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "employee_customers" ADD FOREIGN KEY ("id_nhan_vien") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "employee_customers" ADD FOREIGN KEY ("id_khach_hang") REFERENCES "tb_khach_hang" ("id_khach_hang") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_ke_don" ADD FOREIGN KEY ("id_nhan_vien") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_ke_don" ADD FOREIGN KEY ("id_khach_hang") REFERENCES "tb_khach_hang" ("id_khach_hang") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_ke_don" ADD FOREIGN KEY ("id_san_pham") REFERENCES "tb_san_pham" ("id_san_pham") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_doanh_thu" ADD FOREIGN KEY ("id_khach_hang") REFERENCES "tb_khach_hang" ("id_khach_hang") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_doanh_thu" ADD FOREIGN KEY ("id_san_pham") REFERENCES "tb_san_pham" ("id_san_pham") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_doanh_thu" ADD FOREIGN KEY ("id_nhan_vien") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "data_sale_import_batches" ADD FOREIGN KEY ("imported_by") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "data_sale_transactions" ADD FOREIGN KEY ("import_batch_id") REFERENCES "data_sale_import_batches" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "data_sale_transactions" ADD FOREIGN KEY ("id_nhan_vien") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "data_sale_transactions" ADD FOREIGN KEY ("id_khach_hang") REFERENCES "tb_khach_hang" ("id_khach_hang") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "data_sale_transactions" ADD FOREIGN KEY ("id_san_pham") REFERENCES "tb_san_pham" ("id_san_pham") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_thau" ADD FOREIGN KEY ("id_khach_hang") REFERENCES "tb_khach_hang" ("id_khach_hang") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_thau" ADD FOREIGN KEY ("id_san_pham") REFERENCES "tb_san_pham" ("id_san_pham") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tb_thau" ADD FOREIGN KEY ("id_nhan_vien") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "daily_reports" ADD FOREIGN KEY ("id_nhan_vien") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lost_sale_alerts" ADD FOREIGN KEY ("id_khach_hang") REFERENCES "tb_khach_hang" ("id_khach_hang") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lost_sale_alerts" ADD FOREIGN KEY ("id_nhan_vien") REFERENCES "tb_nhan_su" ("id_nhan_vien") DEFERRABLE INITIALLY IMMEDIATE;
