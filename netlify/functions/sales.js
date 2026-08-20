const { assertDatabaseCustomerAccess, requireDatabaseUser } = require("./shared/auth");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { COMBINED_SALES_CTE, pagination, scope } = require("./shared/reporting");

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  throw error;
}

exports.handler = async (event) => {
  try {
    const user = await requireDatabaseUser(event);
    if (event.httpMethod === "GET") {
      const { page, pageSize, offset, query } = pagination(event);
      const salesScope = scope(user, "s");
      const params = salesScope.params.slice();
      const filters = [salesScope.sql];
      if (/^\d{4}-\d{2}$/.test(query.period || "")) {
        params.push(query.period);
        filters.push(`s.thang_nam=$${params.length}`);
      }
      if (query.search) {
        params.push(`%${String(query.search).trim()}%`);
        filters.push(`(k.ten_khach_hang ilike $${params.length} or p.ten_san_pham ilike $${params.length})`);
      }
      params.push(pageSize, offset);
      const sql = `with ${COMBINED_SALES_CTE}, filtered as (
        select s.*,k.ten_khach_hang,p.ten_san_pham,n.ten_nhan_vien,count(*) over()::int as total
        from combined_sales s
        join tb_khach_hang k on k.id_khach_hang=s.id_khach_hang
        join tb_san_pham p on p.id_san_pham=s.id_san_pham
        join tb_nhan_su n on n.id_nhan_vien=s.id_nhan_vien
        where ${filters.join(" and ")}
      ) select * from filtered order by thang_nam desc,ten_khach_hang,ten_san_pham limit $${params.length - 1} offset $${params.length}`;
      const rows = (await getPool().query(sql, params)).rows;
      return json(200, {
        items: rows.map((r) => ({ period: r.thang_nam, customerId: r.id_khach_hang, customerName: r.ten_khach_hang, productId: r.id_san_pham, productName: r.ten_san_pham, employeeId: r.id_nhan_vien, employeeName: r.ten_nhan_vien, amount: Number(r.amount), source: r.source })),
        total: rows[0]?.total || 0, page, pageSize
      });
    }
    if (event.httpMethod !== "POST") return methodNotAllowed();
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
