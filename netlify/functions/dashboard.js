const { requireDatabaseUser } = require("./shared/auth");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed } = require("./shared/http");
const { COMBINED_SALES_CTE, scope } = require("./shared/reporting");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return methodNotAllowed();
  try {
    const user = await requireDatabaseUser(event);
    const salesScope = scope(user, "s");
    const rxScope = scope(user, "r");
    const tenderScope = scope(user, "t");
    const queryPeriod = String(event.queryStringParameters?.period || "");
    const sql = `with ${COMBINED_SALES_CTE},
      available_periods as (
        select distinct thang_nam as period from combined_sales s where ${salesScope.sql}
        union select distinct to_char(ngay_bao_cao,'YYYY-MM') from tb_ke_don r where ${rxScope.sql}
      ),
      chosen as (
        select case when $${salesScope.nextIndex} ~ '^\\d{4}-\\d{2}$' then $${salesScope.nextIndex}
          else coalesce((select max(period) from available_periods),to_char(current_date,'YYYY-MM')) end as period
      ),
      bounds as (
        select period,(to_date(period || '-01','YYYY-MM-DD') - interval '3 months')::date as start_date,
          (to_date(period || '-01','YYYY-MM-DD') + interval '1 month')::date as end_date
        from chosen
      ),
      lost as (
        select k.id_khach_hang
        from tb_khach_hang k cross join bounds b
        where k.loai_khach_hang='PhongMachTu' and k.trang_thai='Active'
          and (${isManagerSql(user, "k")})
          and exists (
            select 1 from combined_sales old
            where old.id_khach_hang=k.id_khach_hang and old.amount>0
              and old.thang_nam < to_char(b.start_date,'YYYY-MM')
              and (${isEmployeeOwnerSql(user, "old")})
          )
          and not exists (
            select 1 from combined_sales recent
            where recent.id_khach_hang=k.id_khach_hang and recent.amount<>0
              and recent.thang_nam >= to_char(b.start_date,'YYYY-MM')
              and recent.thang_nam < to_char(b.end_date,'YYYY-MM')
              and (${isEmployeeOwnerSql(user, "recent")})
          )
      )
      select c.period,
        coalesce((select sum(s.amount) from combined_sales s where ${salesScope.sql} and s.thang_nam=c.period),0)::numeric as sales,
        coalesce((select sum(r.so_luong_ke_don) from tb_ke_don r where ${rxScope.sql} and to_char(r.ngay_bao_cao,'YYYY-MM')=c.period),0)::int as prescription_quantity,
        coalesce((select sum(r.doanh_so_phat_sinh) from tb_ke_don r where ${rxScope.sql} and to_char(r.ngay_bao_cao,'YYYY-MM')=c.period),0)::numeric as prescription_amount,
        (select count(*)::int from tb_thau t where ${tenderScope.sql} and t.trang_thai in ('DangLamHoSo','ChoKetQua')) as open_tenders,
        (select count(*)::int from lost) as lost_sales,
        (select coalesce(json_agg(period order by period desc),'[]'::json) from available_periods) as available_periods
      from chosen c`;
    const params = [...salesScope.params, queryPeriod];
    const row = (await getPool().query(sql, params)).rows[0];
    return json(200, {
      period: row.period,
      availablePeriods: row.available_periods,
      metrics: {
        sales: Number(row.sales),
        prescriptionQuantity: row.prescription_quantity,
        prescriptionAmount: Number(row.prescription_amount),
        openTenders: row.open_tenders,
        lostSales: row.lost_sales
      }
    });
  } catch (error) {
    return handleError(error);
  }
};

function isManagerSql(user, customerAlias) {
  return ["QuanLy", "Admin", "Manager"].includes(user.role)
    ? "true"
    : `exists (select 1 from employee_customers ec where ec.id_nhan_vien='${String(user.id).replace(/'/g, "''")}' and ec.id_khach_hang=${customerAlias}.id_khach_hang)`;
}

function isEmployeeOwnerSql(user, salesAlias) {
  return ["QuanLy", "Admin", "Manager"].includes(user.role)
    ? "true"
    : `${salesAlias}.id_nhan_vien='${String(user.id).replace(/'/g, "''")}'`;
}
