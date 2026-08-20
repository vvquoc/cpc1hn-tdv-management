const { getDatabase } = require("@netlify/database");

let cachedPool;

function getPool() {
  if (!cachedPool) {
    const connectionString = process.env.CPC1_DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;
    try {
      cachedPool = getDatabase().pool;
    } catch (error) {
      if (!connectionString || error.name !== "MissingDatabaseConnectionError") throw error;
      cachedPool = getDatabase({ connectionString }).pool;
    }
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
