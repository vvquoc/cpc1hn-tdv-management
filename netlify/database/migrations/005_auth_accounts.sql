create table if not exists auth_credentials (
  username varchar(80) primary key,
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  password_salt varchar(64) not null,
  password_hash varchar(128) not null,
  iterations integer not null default 210000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  token_hash varchar(128) primary key,
  id_nhan_vien varchar(40) not null references tb_nhan_su(id_nhan_vien),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

insert into tb_nhan_su (id_nhan_vien, ten_nhan_vien, email, chuc_vu, trang_thai)
values ('QL-15795', 'Quản lý CPC1HN', '15795@cpc1hn.local', 'QuanLy', 'Active')
on conflict (id_nhan_vien)
do update set ten_nhan_vien = excluded.ten_nhan_vien,
              email = excluded.email,
              chuc_vu = excluded.chuc_vu,
              trang_thai = excluded.trang_thai;

insert into auth_credentials (username, id_nhan_vien, password_salt, password_hash, iterations)
values (
  '15795',
  'QL-15795',
  '3e2cb766bd2aca4afbab29099f0f75c4',
  '01db890a71e4a330f2fa77347ff27ed201814ae817a92f4a146c76ee9912a19b',
  210000
)
on conflict (username)
do update set id_nhan_vien = excluded.id_nhan_vien,
              password_salt = excluded.password_salt,
              password_hash = excluded.password_hash,
              iterations = excluded.iterations,
              updated_at = now();
