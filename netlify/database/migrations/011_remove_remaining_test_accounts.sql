do $$
declare
  test_employees text[] := array['test', 'test123'];
begin
  delete from tender_status_history
  where changed_by = any(test_employees)
    or id_goi_thau in (select id_goi_thau from tb_thau where id_nhan_vien = any(test_employees));
  delete from tb_ke_don where id_nhan_vien = any(test_employees);
  delete from tb_doanh_thu where id_nhan_vien = any(test_employees);
  delete from tb_thau where id_nhan_vien = any(test_employees);
  delete from daily_reports where id_nhan_vien = any(test_employees);
  delete from kpi_targets where id_nhan_vien = any(test_employees);
  delete from lost_sale_alerts where id_nhan_vien = any(test_employees);
  delete from employee_customers where id_nhan_vien = any(test_employees);
  delete from employee_territories where id_nhan_vien = any(test_employees);
  delete from auth_sessions where id_nhan_vien = any(test_employees);
  delete from auth_credentials where id_nhan_vien = any(test_employees);
  delete from tb_nhan_su where id_nhan_vien = any(test_employees);
  update app_state_revision set revision=revision+1,updated_at=now() where id=1;
end $$;
