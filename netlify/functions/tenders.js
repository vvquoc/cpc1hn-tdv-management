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
      return json(200, { tenders: data.tenders.filter((item) => customerIds.has(item.customerId)) });
    }
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const body = parseBody(event);
    if (!body.id || !body.customerId || !body.productId || !body.status) return json(400, { error: "Dữ liệu thầu không hợp lệ." });
    const quantity = Number(body.quantity || 0);
    const bidPrice = Number(body.bidPrice || 0);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(bidPrice) || bidPrice < 0) return json(400, { error: "Dữ liệu thầu không hợp lệ." });

    const user = await requireDatabaseUser(event);
    const client = await getPool().connect();
    try {
      await client.query("begin");
      await assertDatabaseCustomerAccess(user, body.customerId, client);
      const existing = await client.query("select id_khach_hang from tb_thau where id_goi_thau=$1 for update", [body.id]);
      if (existing.rows.length) await assertDatabaseCustomerAccess(user, existing.rows[0].id_khach_hang, client);
      const product = await client.query("select 1 from tb_san_pham where id_san_pham=$1 and trang_thai='Active'", [body.productId]);
      if (!product.rows.length) fail("Sản phẩm không hợp lệ.");
      await client.query(`insert into tb_thau (id_goi_thau,id_khach_hang,id_san_pham,so_luong_thau,gia_du_thau,trang_thai,id_nhan_vien,han_nop,ngay_cap_nhat)
        values ($1,$2,$3,$4,$5,$6,$7,$8,current_date) on conflict (id_goi_thau) do update set
        id_khach_hang=excluded.id_khach_hang,id_san_pham=excluded.id_san_pham,so_luong_thau=excluded.so_luong_thau,
        gia_du_thau=excluded.gia_du_thau,trang_thai=excluded.trang_thai,id_nhan_vien=excluded.id_nhan_vien,
        han_nop=excluded.han_nop,ngay_cap_nhat=current_date`,
      [body.id, body.customerId, body.productId, quantity, bidPrice, body.status, user.id, body.dueDate || null]);
      await client.query("update app_state_revision set revision=revision+1,updated_at=now() where id=1");
      await client.query("commit");
      return json(200, { id: body.id });
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
