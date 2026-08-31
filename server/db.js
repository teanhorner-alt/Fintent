const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's managed Postgres requires SSL; local dev (no DATABASE_URL override) does not.
  ssl: process.env.DATABASE_URL && process.env.PGSSL !== "off" ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      email TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      session_version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_data (
      email TEXT PRIMARY KEY REFERENCES accounts(email) ON DELETE CASCADE,
      transactions JSONB NOT NULL DEFAULT '[]',
      goals JSONB NOT NULL DEFAULT '[]',
      bills JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function rowToAccount(row) {
  if (!row) return null;
  return {
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    passwordHash: row.password_hash,
    sessionVersion: row.session_version,
    createdAt: row.created_at,
  };
}

async function getAccount(email) {
  const { rows } = await pool.query("SELECT * FROM accounts WHERE email = $1", [
    (email || "").trim().toLowerCase(),
  ]);
  return rowToAccount(rows[0]);
}

async function saveAccount(account) {
  await pool.query(
    `INSERT INTO accounts (email, first_name, last_name, password_hash, session_version)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       password_hash = EXCLUDED.password_hash,
       session_version = EXCLUDED.session_version`,
    [account.email, account.firstName, account.lastName, account.passwordHash, account.sessionVersion || 0]
  );
}

async function getUserData(email) {
  const { rows } = await pool.query("SELECT * FROM user_data WHERE email = $1", [
    (email || "").trim().toLowerCase(),
  ]);
  if (!rows[0]) return { transactions: [], goals: [], bills: [] };
  return { transactions: rows[0].transactions, goals: rows[0].goals, bills: rows[0].bills };
}

async function saveUserData(email, data) {
  await pool.query(
    `INSERT INTO user_data (email, transactions, goals, bills, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (email) DO UPDATE SET
       transactions = EXCLUDED.transactions,
       goals = EXCLUDED.goals,
       bills = EXCLUDED.bills,
       updated_at = now()`,
    [
      (email || "").trim().toLowerCase(),
      JSON.stringify(data.transactions || []),
      JSON.stringify(data.goals || []),
      JSON.stringify(data.bills || []),
    ]
  );
}

async function accountCount() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM accounts");
  return rows[0].n;
}

async function totals() {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(jsonb_array_length(transactions)), 0)::int AS transactions,
      COALESCE(SUM(jsonb_array_length(goals)), 0)::int AS goals,
      COALESCE(SUM(jsonb_array_length(bills)), 0)::int AS bills
    FROM user_data
  `);
  return rows[0];
}

async function allAccountsBasic() {
  const { rows } = await pool.query(
    "SELECT email, first_name, last_name, created_at FROM accounts ORDER BY created_at ASC"
  );
  return rows.map((r) => ({ email: r.email, firstName: r.first_name, lastName: r.last_name, createdAt: r.created_at }));
}

module.exports = {
  pool,
  init,
  getAccount,
  saveAccount,
  getUserData,
  saveUserData,
  accountCount,
  totals,
  allAccountsBasic,
};
