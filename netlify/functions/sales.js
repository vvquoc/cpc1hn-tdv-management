const { assertDatabaseCustomerAccess, requireDatabaseUser } = require("./shared/auth");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  throw error;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();
  try {
    const user = await requireDatabaseUser(event);
    const body = parseBody(event);
    const amount = Number(body.amount);
    if (!/^\d{4}-\d{2}$/.test(body.period || "") || !body.customerId || !body.productId || !Number.isFinite(amount) || amount < 0) {
      return json(400, { error: "Dữ liệu doanh số không hợp lệ." });
    }
    const client = await getPool().connect();
    try {
      await client.query("begin");
      await assertDatabaseCustomerAccess(user, body.customerId, client);
      const product = await client.query("select 1 from tb_san_pham where id_san_pham=$1 and trang_thai='Active'", [body.productId]);
      if (!product.rows.length) fail("Sản phẩm không hợp lệ.");
      const result = await client.query(`insert into tb_doanh_thu (thang_nam,id_khach_hang,id_san_pham,id_nhan_vien,doanh_so_thuc,source_note)
        values ($1,$2,$3,$4,$5,'Website') on conflict (thang_nam,id_khach_hang,id_san_pham) do update set
        id_nhan_vien=excluded.id_nhan_vien,doanh_so_thuc=excluded.doanh_so_thuc,source_note='Website' returning id_doanh_thu`,
      [body.period, body.customerId, body.productId, user.id, amount]);
      await client.query("update app_state_revision set revision=revision+1,updated_at=now() where id=1");
      await client.query("commit");
      return json(201, { id: result.rows[0].id_doanh_thu });
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
