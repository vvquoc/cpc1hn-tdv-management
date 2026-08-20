const crypto = require("node:crypto");

function hashPassword(password) {
  const value = String(password || "");
  if (value.length < 8) {
    const error = new Error("Password too short");
    error.statusCode = 400;
    error.publicMessage = "Mật khẩu phải có ít nhất 8 ký tự.";
    throw error;
  }
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const passwordHash = crypto.pbkdf2Sync(value, passwordSalt, iterations, 32, "sha256").toString("hex");
  return { passwordSalt, passwordHash, iterations };
}

function verifyPassword(password, credential) {
  const expected = Buffer.from(credential.password_hash || credential.passwordHash, "hex");
  const actual = crypto.pbkdf2Sync(
    String(password || ""),
    credential.password_salt || credential.passwordSalt,
    Number(credential.iterations || 210000),
    expected.length,
    "sha256"
  );
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = { hashPassword, verifyPassword };
