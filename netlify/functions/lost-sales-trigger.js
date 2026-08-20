const { isAdmin, requireDatabaseUser } = require("./shared/auth");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed } = require("./shared/http");
const { COMBINED_SALES_CTE } = require("./shared/reporting");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return methodNotAllowed();
  try {
    const user = await requireDatabaseUser(event);
    const manager = isAdmin(user);
    const params = manager ? [] : [user.id];
    const owner = (alias) => manager ? "true" : `${alias}.id_nhan_vien=$1`;
    const customerScope = manager ? "true" : `exists (
      select 1 from employee_customers ec where ec.id_nhan_vien=$1 and ec.id_khach_hang=k.id_khach_hang
    )`;
    const rows = (await getPool().query(`with ${COMBINED_SALES_CTE}, latest as (
        select max(thang_nam) as period from combined_sales s where ${owner("s")}
      ), bounds as (
        select period,(to_date(period || '-01','YYYY-MM-DD') - interval '3 months')::date start_date,
          (to_date(period || '-01','YYYY-MM-DD') + interval '1 month')::date end_date from latest
      )
      select k.id_khach_hang,k.ten_khach_hang,b.period
      from tb_khach_hang k cross join bounds b
      where k.loai_khach_hang='PhongMachTu' and k.trang_thai='Active' and ${customerScope}
        and b.period is not null
        and exists (select 1 from combined_sales old where old.id_khach_hang=k.id_khach_hang
          and old.amount>0 and old.thang_nam<to_char(b.start_date,'YYYY-MM') and ${owner("old")})
        and not exists (select 1 from combined_sales recent where recent.id_khach_hang=k.id_khach_hang
          and recent.amount<>0 and recent.thang_nam>=to_char(b.start_date,'YYYY-MM')
          and recent.thang_nam<to_char(b.end_date,'YYYY-MM') and ${owner("recent")})
      order by k.ten_khach_hang`, params)).rows;
    return json(200, {
      period: rows[0]?.period || null,
      alerts: rows.map((row) => ({
        customerId: row.id_khach_hang,
        customerName: row.ten_khach_hang,
        reason: "Không phát sinh doanh số trong 4 tháng liên tục sau khi từng có sale."
      }))
    });
  } catch (error) {
    return handleError(error);
  }
};
