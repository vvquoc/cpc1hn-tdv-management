const { one, query } = require("./shared/db");
const { assertCustomerAccess, customerScopeSql, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

exports.handler = async (event) => {
  try {
    const user = await requireUser(event);

    if (event.httpMethod === "POST") {
      const body = parseBody(event);
      if (!body.id || !body.customerId || !body.productId || !body.status) {
        return json(400, { error: "Dữ liệu thầu không hợp lệ." });
      }
      await assertCustomerAccess(user, body.customerId);
      const row = await one(
        `insert into tb_thau (
           id_goi_thau, id_khach_hang, id_san_pham, so_luong_thau, gia_du_thau,
           trang_thai, id_nhan_vien, han_nop, ngay_cap_nhat
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, current_date)
         on conflict (id_goi_thau)
         do update set id_khach_hang = excluded.id_khach_hang,
                       id_san_pham = excluded.id_san_pham,
                       so_luong_thau = excluded.so_luong_thau,
                       gia_du_thau = excluded.gia_du_thau,
                       trang_thai = excluded.trang_thai,
                       id_nhan_vien = excluded.id_nhan_vien,
                       han_nop = excluded.han_nop,
                       ngay_cap_nhat = current_date
         returning id_goi_thau as id`,
        [
          body.id,
          body.customerId,
          body.productId,
          Number(body.quantity || 0),
          Number(body.bidPrice || 0),
          body.status,
          user.id_nhan_vien,
          body.dueDate || null
        ]
      );
      return json(200, { id: row.id });
    }

    if (event.httpMethod !== "GET") return methodNotAllowed();

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
