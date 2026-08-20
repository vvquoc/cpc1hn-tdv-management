update tb_nhan_su
set chuc_vu = 'NhanVien'
where chuc_vu in ('MR', 'Supervisor');

update tb_nhan_su
set chuc_vu = 'QuanLy'
where chuc_vu in ('Manager', 'Admin');
