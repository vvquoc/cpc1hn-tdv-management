const { query } = require("./shared/db");
const { requireUser, customerScopeSql } = require("./shared/auth");
const { handleError, json, methodNotAllowed } = require("./shared/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return methodNotAllowed();

  try {
    const user = await requireUser(event);
    const scope = customerScopeSql(user, "kh", 1);

    const [territories, employees, products, customers, prescriptions, sales, tenders, dailyReports] = await Promise.all([
      query(
        `select id_dia_ban as id, ten_dia_ban as name, khu_vuc as region
         from tb_dia_ban
         order by ten_dia_ban`
      ),
      query(
        `select ns.id_nhan_vien as id, ns.ten_nhan_vien as name, ns.email, ns.chuc_vu as role,
                ns.trang_thai as status,
                coalesce(array_agg(et.id_dia_ban order by et.id_dia_ban) filter (where et.id_dia_ban is not null), '{}') as "territoryIds"
         from tb_nhan_su ns
         left join employee_territories et on et.id_nhan_vien = ns.id_nhan_vien
         group by ns.id_nhan_vien
         order by ns.ten_nhan_vien`
      ),
      query(
        `select id_san_pham as id, ten_san_pham as name, hoat_chat as "activeIngredient",
                dang_bao_che as "dosageCode", mo_ta_dang_bao_che as "dosageForm",
                quy_cach as "packageSpec", gia_ke_don::float as "prescriptionPrice",
                trang_thai as status
         from tb_san_pham
         order by ten_san_pham`
      ),
      query(
        `select kh.id_khach_hang as id, kh.ten_khach_hang as name, kh.loai_khach_hang as type,
                kh.id_dia_ban as "territoryId",
                kh.dia_chi as address, kh.dien_thoai as phone, kh.trang_thai as status,
                coalesce(ec.id_nhan_vien, '') as "ownerId"
         from tb_khach_hang kh
         left join employee_customers ec on ec.id_khach_hang = kh.id_khach_hang
         where ${scope.clause}
         order by kh.ten_khach_hang`,
        scope.params
      ),
      query(
        `select kd.ngay_bao_cao::text as date, kd.id_nhan_vien as "employeeId",
                kd.id_khach_hang as "customerId", kd.id_san_pham as "productId",
                kd.so_luong_ke_don as quantity
         from tb_ke_don kd
         join tb_khach_hang kh on kh.id_khach_hang = kd.id_khach_hang
         where ${scope.clause}
         order by kd.ngay_bao_cao desc, kd.created_at desc
         limit 100`,
        scope.params
      ),
      query(
        `select dt.thang_nam as period, dt.id_khach_hang as "customerId",
                dt.id_san_pham as "productId", dt.id_nhan_vien as "employeeId",
                dt.doanh_so_thuc::float as amount
         from tb_doanh_thu dt
         join tb_khach_hang kh on kh.id_khach_hang = dt.id_khach_hang
         where ${scope.clause}
         order by dt.thang_nam desc, dt.created_at desc
         limit 120`,
        scope.params
      ),
      query(
        `select th.id_goi_thau as id, th.id_khach_hang as "customerId",
                th.id_san_pham as "productId", th.trang_thai as status,
                th.han_nop::text as "dueDate", th.id_nhan_vien as "employeeId"
         from tb_thau th
         join tb_khach_hang kh on kh.id_khach_hang = th.id_khach_hang
         where ${scope.clause}
         order by th.ngay_cap_nhat desc`,
        scope.params
      ),
      query(
        `select dr.report_date::text as date, dr.id_nhan_vien as "employeeId", dr.summary
         from daily_reports dr
         order by dr.report_date desc
         limit 100`
      )
    ]);

    return json(200, {
      activeUser: {
        id: user.id_nhan_vien,
        name: user.ten_nhan_vien,
        email: user.email,
        role: user.chuc_vu,
        territoryIds: user.territoryIds
      },
      territories,
      employees,
      products,
      customers,
      prescriptions,
      sales,
      tenders,
      dailyReports
    });
  } catch (error) {
    return handleError(error);
  }
};
