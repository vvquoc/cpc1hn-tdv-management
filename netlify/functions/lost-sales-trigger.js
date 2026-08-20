const { query } = require("./shared/db");
const { customerScopeSql, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed } = require("./shared/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const user = await requireUser(event);
    const scope = customerScopeSql(user, "kh", 1);
    const alerts = await query(
      `with periods as (
         select distinct thang_nam
         from tb_doanh_thu
         order by thang_nam desc
         limit 4
       ),
       customer_recent as (
         select kh.id_khach_hang, kh.ten_khach_hang, coalesce(sum(dt.doanh_so_thuc), 0) as recent_sales
         from tb_khach_hang kh
         cross join periods p
         left join tb_doanh_thu dt
           on dt.id_khach_hang = kh.id_khach_hang
          and dt.thang_nam = p.thang_nam
         where kh.loai_khach_hang = 'PhongMachTu'
           and ${scope.clause}
         group by kh.id_khach_hang, kh.ten_khach_hang
       )
       select cr.id_khach_hang as "customerId",
              cr.ten_khach_hang as "customerName",
              ec.id_nhan_vien as "ownerId",
              'Không phát sinh doanh số trong 4 tháng liên tục sau khi từng có sale.' as reason
       from customer_recent cr
       left join employee_customers ec on ec.id_khach_hang = cr.id_khach_hang
       where cr.recent_sales = 0
         and exists (
           select 1
           from tb_doanh_thu old_sales
           where old_sales.id_khach_hang = cr.id_khach_hang
             and old_sales.doanh_so_thuc > 0
             and old_sales.thang_nam not in (select thang_nam from periods)
         )
       order by cr.ten_khach_hang`,
      scope.params
    );

    return json(200, { alerts });
  } catch (error) {
    return handleError(error);
  }
};
