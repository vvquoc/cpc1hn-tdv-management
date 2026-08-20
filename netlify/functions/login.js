const crypto = require("node:crypto");
const { createToken } = require("./shared/auth");
const { loadData, withTerritories } = require("./shared/store");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

function verifyPassword(password, credential) {
  const expected = Buffer.from(credential.passwordHash, "hex");
  const actual = crypto.pbkdf2Sync(
    String(password || ""),
    credential.passwordSalt,
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
    const data = await loadData(event);
    const credential = data.credentials.find((item) => item.username === username);
    const employee = credential && data.employees.find((item) => item.id === credential.employeeId && item.status !== "Inactive");

    if (!credential || !employee || !verifyPassword(password, credential)) {
      return json(401, { error: "Sai tài khoản hoặc mật khẩu." });
    }

    const token = createToken(employee.id);
    const user = withTerritories(data, employee);
    return json(200, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        territoryIds: user.territoryIds
      }
    });
  } catch (error) {
    return handleError(error);
  }
};
