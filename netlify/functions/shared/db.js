const { getDatabase } = require("@netlify/database");

let cachedPool;

function getPool() {
  if (!cachedPool) {
    cachedPool = getDatabase().pool;
  }
  return cachedPool;
}

async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result.rows;
}

async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

module.exports = {
  getPool,
  query,
  one
};
