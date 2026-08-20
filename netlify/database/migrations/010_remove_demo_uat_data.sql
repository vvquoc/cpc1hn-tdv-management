do $$
declare
  demo_employees text[] := array['NV-DN-01','NV-QN-01','NV-SV-01','NV-AD-01','UAT-E2E-NV'];
  demo_customers text[] := array['KH_PM_DN_01','KH_BV_DN_01','KH_PM_QNAM_01','KH_SYT_QNGAI','UAT-E2E-KH','test'];
  demo_products text[] := array['SP_NEB_3','SP_NEB_SPRAY','SP_ZENSALBU','SP_VAGI_ODIN','UAT-E2E-SP','UAT-IMPORT-SP'];
  demo_territories text[] := array['DB_DANANG','DB_QUANGNAM','DB_QUANGNGAI','DB_BINHDINH','DB_GIALAI','UAT-E2E-DB'];
begin
  delete from tender_status_history
  where id_goi_thau in ('GT-DN-2026-01','GT-QNG-2026-01','UAT-E2E-GT')
     or changed_by = any(demo_employees);
  delete from lost_sale_alerts where id_khach_hang = any(demo_customers) or id_nhan_vien = any(demo_employees);
  delete from tb_ke_don where id_khach_hang = any(demo_customers) or id_san_pham = any(demo_products) or id_nhan_vien = any(demo_employees);
  delete from tb_doanh_thu where id_khach_hang = any(demo_customers) or id_san_pham = any(demo_products) or id_nhan_vien = any(demo_employees);
  delete from tb_thau where id_khach_hang = any(demo_customers) or id_san_pham = any(demo_products) or id_nhan_vien = any(demo_employees);
  delete from daily_reports where id_nhan_vien = any(demo_employees);
  delete from kpi_targets where id_nhan_vien = any(demo_employees) or id_san_pham = any(demo_products) or id_dia_ban = any(demo_territories);
  delete from employee_customers where id_nhan_vien = any(demo_employees) or id_khach_hang = any(demo_customers);
  delete from employee_territories where id_nhan_vien = any(demo_employees) or id_dia_ban = any(demo_territories);
  delete from auth_sessions where id_nhan_vien = any(demo_employees);
  delete from auth_credentials where id_nhan_vien = any(demo_employees);
  delete from tb_nhan_su where id_nhan_vien = any(demo_employees);
  delete from tb_khach_hang where id_khach_hang = any(demo_customers);
  delete from tb_san_pham where id_san_pham = any(demo_products);
  delete from tb_dia_ban where id_dia_ban = any(demo_territories);
  update app_state_revision set revision=revision+1,updated_at=now() where id=1;
end $$;
