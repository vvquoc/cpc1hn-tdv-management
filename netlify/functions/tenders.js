const { query } = require("./shared/db");
const { customerScopeSql, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed } = require("./shared/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return methodNotAllowed();

  try {
    const user = await requireUser(event);
    const scope = customerScopeSql(user, "kh", 1);
    const tenders = await query(
      `select th.id_goi_thau as id, kh.ten_khach_hang as customer,
              sp.ten_san_pham as product, th.trang_thai as status,
              th.han_nop::text as due_date, ns.ten_nhan_vien as owner
       from tb_thau th
       join tb_khach_hang kh on kh.id_khach_hang = th.id_khach_hang
       join tb_san_pham sp on sp.id_san_pham = th.id_san_pham
       join tb_nhan_su ns on ns.id_nhan_vien = th.id_nhan_vien
       where ${scope.clause}
       order by th.ngay_cap_nhat desc`,
      scope.params
    );

    return json(200, { tenders });
  } catch (error) {
    return handleError(error);
  }
};
