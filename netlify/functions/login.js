const crypto = require("node:crypto");
const { one, query } = require("./shared/db");
const { hashToken, loadUserById } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

function verifyPassword(password, credential) {
  const expected = Buffer.from(credential.password_hash, "hex");
  const actual = crypto.pbkdf2Sync(
    String(password || ""),
    credential.password_salt,
    Number(credential.iterations || 210000),
    expected.length,
    "sha256"
  );
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const body = parseBody(event);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    const credential = await one(
      `select ac.username, ac.id_nhan_vien, ac.password_salt, ac.password_hash, ac.iterations
       from auth_credentials ac
       join tb_nhan_su ns on ns.id_nhan_vien = ac.id_nhan_vien
       where ac.username = $1 and ns.trang_thai = 'Active'`,
      [username]
    );

    if (!credential || !verifyPassword(password, credential)) {
      return json(401, { error: "Sai tài khoản hoặc mật khẩu." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await query(
      `insert into auth_sessions (token_hash, id_nhan_vien, expires_at)
       values ($1, $2, now() + interval '14 days')`,
      [hashToken(token), credential.id_nhan_vien]
    );

    const user = await loadUserById(credential.id_nhan_vien);
    return json(200, {
      token,
      user: {
        id: user.id_nhan_vien,
        name: user.ten_nhan_vien,
        email: user.email,
        role: user.chuc_vu,
        territoryIds: user.territoryIds
      }
    });
  } catch (error) {
    return handleError(error);
  }
};
