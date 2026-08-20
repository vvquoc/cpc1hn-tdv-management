const { one } = require("./shared/db");
const { assertCustomerAccess, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const user = await requireUser(event);
    const body = parseBody(event);
    const period = body.period;
    const customerId = body.customerId;
    const productId = body.productId;
    const amount = Number(body.amount);

    if (!/^\d{4}-\d{2}$/.test(period || "") || !customerId || !productId || !Number.isFinite(amount) || amount < 0) {
      return json(400, { error: "Dữ liệu doanh số không hợp lệ." });
    }

    await assertCustomerAccess(user, customerId);

    const row = await one(
      `insert into tb_doanh_thu (
         thang_nam, id_khach_hang, id_san_pham, id_nhan_vien, doanh_so_thuc, source_note
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (thang_nam, id_khach_hang, id_san_pham)
       do update set doanh_so_thuc = excluded.doanh_so_thuc,
                     id_nhan_vien = excluded.id_nhan_vien,
                     source_note = excluded.source_note
       returning id_doanh_thu as id`,
      [period, customerId, productId, user.id_nhan_vien, amount, "Manual MVP entry"]
    );

    return json(201, { id: row.id });
  } catch (error) {
    return handleError(error);
  }
};
