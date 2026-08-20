const { assertDatabaseCustomerAccess, requireDatabaseUser } = require("./shared/auth");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { pagination, scope } = require("./shared/reporting");

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  throw error;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const user = await requireDatabaseUser(event);
      const { page, pageSize, offset, query } = pagination(event);
      const itemScope = scope(user, "r");
      const params = itemScope.params.slice();
      const filters = [itemScope.sql];
      if (/^\d{4}-\d{2}$/.test(query.period || "")) {
        params.push(query.period);
        filters.push(`to_char(r.ngay_bao_cao,'YYYY-MM')=$${params.length}`);
      }
      if (query.search) {
        params.push(`%${String(query.search).trim()}%`);
        filters.push(`(k.ten_khach_hang ilike $${params.length} or p.ten_san_pham ilike $${params.length} or n.ten_nhan_vien ilike $${params.length})`);
      }
      params.push(pageSize, offset);
      const rows = (await getPool().query(`select r.*,to_char(r.ngay_bao_cao,'YYYY-MM-DD') as report_date,k.ten_khach_hang,p.ten_san_pham,n.ten_nhan_vien,count(*) over()::int as total
        from tb_ke_don r join tb_khach_hang k on k.id_khach_hang=r.id_khach_hang
        join tb_san_pham p on p.id_san_pham=r.id_san_pham join tb_nhan_su n on n.id_nhan_vien=r.id_nhan_vien
        where ${filters.join(" and ")} order by r.ngay_bao_cao desc,r.created_at desc limit $${params.length - 1} offset $${params.length}`, params)).rows;
      return json(200, { items: rows.map((r) => ({ id: r.id_giao_dich, date: r.report_date, employeeId: r.id_nhan_vien, employeeName: r.ten_nhan_vien, customerId: r.id_khach_hang, customerName: r.ten_khach_hang, productId: r.id_san_pham, productName: r.ten_san_pham, quantity: r.so_luong_ke_don, amount: Number(r.doanh_so_phat_sinh) })), total: rows[0]?.total || 0, page, pageSize });
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
