const { query } = require("./shared/db");
const { customerScopeSql, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed } = require("./shared/http");

function currentDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const user = await requireUser(event);
    const today = currentDate();
    const scope = customerScopeSql(user, "kh", 1);
    const reminders = await query(
      `select distinct ns.id_nhan_vien as "employeeId",
              ns.ten_nhan_vien as "employeeName",
              ns.email,
              $${scope.nextIndex}::date::text as date,
              'Nhắc ' || ns.ten_nhan_vien || ' gửi báo cáo KPI ngày ' || $${scope.nextIndex}::text || '.' as message
       from tb_nhan_su ns
       join employee_customers ec on ec.id_nhan_vien = ns.id_nhan_vien
       join tb_khach_hang kh on kh.id_khach_hang = ec.id_khach_hang
       where ns.chuc_vu in ('NhanVien', 'MR', 'Supervisor')
         and ns.trang_thai = 'Active'
         and ${scope.clause}
         and not exists (
           select 1
           from daily_reports dr
           where dr.id_nhan_vien = ns.id_nhan_vien
             and dr.report_date = $${scope.nextIndex}::date
         )
       order by ns.ten_nhan_vien`,
      [...scope.params, today]
    );

    return json(200, { reminders });
  } catch (error) {
    return handleError(error);
  }
};
