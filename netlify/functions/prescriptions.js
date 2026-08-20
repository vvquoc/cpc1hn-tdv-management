const { assertDatabaseCustomerAccess, requireDatabaseUser, requireUser } = require("./shared/auth");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { loadData, scopedCustomers } = require("./shared/store");

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  throw error;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const data = await loadData();
      const user = await requireUser(event, data);
      const customerIds = new Set(scopedCustomers(data, user).map((customer) => customer.id));
      return json(200, { prescriptions: data.prescriptions.filter((item) => customerIds.has(item.customerId)) });
    }
    if (event.httpMethod !== "POST") return methodNotAllowed();

    const user = await requireDatabaseUser(event);
    const body = parseBody(event);
    const quantity = Number(body.quantity);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "") || !body.customerId || !body.productId || !Number.isInteger(quantity) || quantity <= 0) {
      return json(400, { error: "Dữ liệu kê đơn không hợp lệ." });
    }

    const client = await getPool().connect();
    try {
      await client.query("begin");
      await assertDatabaseCustomerAccess(user, body.customerId, client);
      const product = await client.query("select gia_ke_don from tb_san_pham where id_san_pham=$1 and trang_thai='Active'", [body.productId]);
      if (!product.rows.length) fail("Sản phẩm không hợp lệ.");
      const amount = quantity * Number(product.rows[0].gia_ke_don || 0);
      const result = await client.query(`insert into tb_ke_don (ngay_bao_cao,id_nhan_vien,id_khach_hang,id_san_pham,so_luong_ke_don,doanh_so_phat_sinh)
        values ($1,$2,$3,$4,$5,$6) returning id_giao_dich`, [body.date, user.id, body.customerId, body.productId, quantity, amount]);
      await client.query("update app_state_revision set revision=revision+1,updated_at=now() where id=1");
      await client.query("commit");
      return json(201, { id: result.rows[0].id_giao_dich, amount });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleError(error);
  }
};
