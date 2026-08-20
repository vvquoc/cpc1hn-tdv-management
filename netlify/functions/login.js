const { createToken } = require("./shared/auth");
const { verifyPassword } = require("./shared/credentials");
const { one, query } = require("./shared/db");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const body = parseBody(event);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const credential = await one(`select c.username,c.password_salt,c.password_hash,c.iterations,
        n.id_nhan_vien,n.ten_nhan_vien,n.email,n.chuc_vu,n.trang_thai
      from auth_credentials c
      join tb_nhan_su n on n.id_nhan_vien=c.id_nhan_vien
      where c.username=$1`, [username]);

    if (!credential || credential.trang_thai !== "Active" || !verifyPassword(password, credential)) {
      return json(401, { error: "Sai tài khoản hoặc mật khẩu." });
    }

    const territories = await query("select id_dia_ban from employee_territories where id_nhan_vien=$1 order by id_dia_ban", [credential.id_nhan_vien]);
    const token = createToken(credential.id_nhan_vien);
    return json(200, {
      token,
      user: {
        id: credential.id_nhan_vien,
        name: credential.ten_nhan_vien,
        email: credential.email || "",
        role: credential.chuc_vu,
        territoryIds: territories.map((item) => item.id_dia_ban)
      }
    });
  } catch (error) {
    return handleError(error);
  }
};
