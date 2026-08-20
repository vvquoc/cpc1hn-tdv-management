const { one, query } = require("./shared/db");
const { assertCustomerAccess, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

exports.handler = async (event) => {
  try {
    const user = await requireUser(event);

    if (event.httpMethod === "GET") {
      const rows = await query(
        `select kd.id_giao_dich as id, kd.ngay_bao_cao::text as date,
                kd.id_nhan_vien as "employeeId", kd.id_khach_hang as "customerId",
                kd.id_san_pham as "productId", kd.so_luong_ke_don as quantity,
                kd.doanh_so_phat_sinh::float as amount
         from tb_ke_don kd
         join tb_khach_hang kh on kh.id_khach_hang = kd.id_khach_hang
         where exists (
           select 1
           from employee_customers ec
           where ec.id_khach_hang = kh.id_khach_hang
             and ec.id_nhan_vien = $1
         )
         order by kd.ngay_bao_cao desc, kd.created_at desc
         limit 100`,
        [user.id_nhan_vien]
      );
      return json(200, { prescriptions: rows });
    }

    if (event.httpMethod !== "POST") return methodNotAllowed();

    const body = parseBody(event);
    const date = body.date;
    const customerId = body.customerId;
    const productId = body.productId;
    const quantity = Number(body.quantity);

    if (!date || !customerId || !productId || !Number.isInteger(quantity) || quantity <= 0) {
      return json(400, { error: "Dữ liệu kê đơn không hợp lệ." });
    }

    await assertCustomerAccess(user, customerId);

    const product = await one(
      `select gia_ke_don::float as price
       from tb_san_pham
       where id_san_pham = $1 and trang_thai = 'Active'`,
      [productId]
    );

    if (!product) return json(400, { error: "Sản phẩm không hợp lệ." });

    const amount = quantity * Number(product.price);
    const created = await one(
      `insert into tb_ke_don (
         ngay_bao_cao, id_nhan_vien, id_khach_hang, id_san_pham, so_luong_ke_don, doanh_so_phat_sinh
       ) values ($1, $2, $3, $4, $5, $6)
       returning id_giao_dich as id`,
      [date, user.id_nhan_vien, customerId, productId, quantity, amount]
    );

    return json(201, { id: created.id, amount });
  } catch (error) {
    return handleError(error);
  }
};
