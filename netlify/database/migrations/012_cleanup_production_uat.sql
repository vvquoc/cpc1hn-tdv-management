do $$
declare
  uat_employee text := 'UAT-E2E-NV';
  uat_customer text := 'UAT-E2E-KH';
  uat_products text[] := array['UAT-E2E-SP', 'UAT-IMPORT-SP'];
  uat_territory text := 'UAT-E2E-DB';
begin
  delete from tender_status_history where id_goi_thau = 'UAT-E2E-GT' or changed_by = uat_employee;
  delete from lost_sale_alerts where id_khach_hang = uat_customer or id_nhan_vien = uat_employee;
  delete from tb_ke_don where id_khach_hang = uat_customer or id_san_pham = any(uat_products) or id_nhan_vien = uat_employee;
  delete from tb_doanh_thu where id_khach_hang = uat_customer or id_san_pham = any(uat_products) or id_nhan_vien = uat_employee;
  delete from tb_thau where id_goi_thau = 'UAT-E2E-GT' or id_khach_hang = uat_customer or id_san_pham = any(uat_products) or id_nhan_vien = uat_employee;
  delete from daily_reports where id_nhan_vien = uat_employee;
  delete from kpi_targets where id_nhan_vien = uat_employee or id_san_pham = any(uat_products) or id_dia_ban = uat_territory;
  delete from employee_customers where id_nhan_vien = uat_employee or id_khach_hang = uat_customer;
  delete from employee_territories where id_nhan_vien = uat_employee or id_dia_ban = uat_territory;
  delete from auth_sessions where id_nhan_vien = uat_employee;
  delete from auth_credentials where id_nhan_vien = uat_employee or username = 'uat_employee';
  delete from tb_nhan_su where id_nhan_vien = uat_employee;
  delete from tb_khach_hang where id_khach_hang = uat_customer;
  delete from tb_san_pham where id_san_pham = any(uat_products);
  delete from tb_dia_ban where id_dia_ban = uat_territory;
  update app_state_revision set revision = revision + 1, updated_at = now() where id = 1;
end $$;
