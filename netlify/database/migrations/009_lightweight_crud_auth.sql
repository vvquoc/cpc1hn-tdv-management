alter table tb_nhan_su
  alter column email drop not null;

delete from auth_credentials older
using auth_credentials newer
where older.id_nhan_vien = newer.id_nhan_vien
  and (older.updated_at, older.username) < (newer.updated_at, newer.username);

create unique index if not exists uq_auth_credentials_employee
  on auth_credentials (id_nhan_vien);
