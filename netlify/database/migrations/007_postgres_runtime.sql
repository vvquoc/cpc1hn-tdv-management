alter table tb_dia_ban
  add column if not exists trang_thai employee_status not null default 'Active';

create table if not exists app_state_revision (
  id smallint primary key check (id = 1),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into app_state_revision (id, revision)
values (1, 0)
on conflict (id) do nothing;

update tb_nhan_su
set ma_nhan_vien_sale = '015795'
where id_nhan_vien = 'QL-15795'
  and ma_nhan_vien_sale is null;

drop view if exists vw_data_sale_monthly;

create view vw_data_sale_monthly as
select
  concat(nam::text, '-', lpad(thang::text, 2, '0')) as thang_nam,
  id_nhan_vien,
  ma_nhan_vien,
  max(ten_nhan_vien) as ten_nhan_vien,
  max(ten_quan_ly) as ten_quan_ly,
  tinh,
  nhom_khach_hang,
  id_khach_hang,
  ma_khach_hang,
  max(ten_khach_hang) as ten_khach_hang,
  id_san_pham,
  ma_hang_hoa,
  max(ten_hang_hoa) as ten_hang_hoa,
  max(don_vi_tinh) as don_vi_tinh,
  sum(so_luong) as tong_so_luong,
  sum(doanh_thu) as tong_doanh_thu,
  sum(doanh_so) as tong_doanh_so,
  count(*) as so_dong_chung_tu
from data_sale_transactions
group by nam, thang, id_nhan_vien, ma_nhan_vien, tinh, nhom_khach_hang,
  id_khach_hang, ma_khach_hang, id_san_pham, ma_hang_hoa;
