const { isAdmin } = require("./auth");

const COMBINED_SALES_CTE = `
  data_sale_monthly as (
    select thang_nam,id_khach_hang,id_san_pham,id_nhan_vien,sum(tong_doanh_so)::numeric as amount
    from vw_data_sale_monthly ds
    where not exists (
      select 1 from tb_doanh_thu m
      where m.thang_nam=ds.thang_nam
        and m.id_khach_hang=ds.id_khach_hang
        and m.id_san_pham=ds.id_san_pham
    )
    group by thang_nam,id_khach_hang,id_san_pham,id_nhan_vien
  ),
  combined_sales as (
    select thang_nam,id_khach_hang,id_san_pham,id_nhan_vien,amount,'DATA_SALE'::text as source
    from data_sale_monthly
    union all
    select thang_nam,id_khach_hang,id_san_pham,id_nhan_vien,doanh_so_thuc::numeric as amount,'WEBSITE'::text as source
    from tb_doanh_thu
  )`;

function pagination(event) {
  const query = event.queryStringParameters || {};
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize, query };
}

function scope(user, alias, startIndex = 1) {
  if (isAdmin(user)) return { sql: "true", params: [], nextIndex: startIndex };
  return {
    sql: `${alias}.id_nhan_vien=$${startIndex} and exists (
      select 1 from employee_customers scope_ec
      where scope_ec.id_nhan_vien=$${startIndex} and scope_ec.id_khach_hang=${alias}.id_khach_hang
    )`,
    params: [user.id],
    nextIndex: startIndex + 1
  };
}

module.exports = { COMBINED_SALES_CTE, pagination, scope };
