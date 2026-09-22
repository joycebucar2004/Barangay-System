import { config } from "dotenv";
import mysql from "mysql2/promise";

config({ quiet: true });

const { DB_HOST = "localhost", DB_PORT = "3306", DB_USER = "root", DB_PASSWORD = "", DB_NAME = "barangay" } = process.env;

// Hosted MySQL (e.g. Hostinger) usually forbids CREATE DATABASE, so only try it when the DB is missing.
async function ensureDatabase() {
  try {
    const conn = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    await conn.end();
  } catch (err) {
    if (err.code !== "ER_BAD_DB_ERROR") throw err;
    const conn = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await conn.end();
  }
}

try {
  await ensureDatabase();
} catch (err) {
  console.error(
    `\nCould not connect to MySQL at ${DB_HOST}:${DB_PORT} (user "${DB_USER}").\n` +
      `Make sure MySQL is running and that server/.env has the right DB_HOST/DB_PORT/DB_USER/DB_PASSWORD.\n` +
      (err.code === "ER_ACCESS_DENIED_ERROR" && DB_HOST !== "localhost" && DB_HOST !== "127.0.0.1"
        ? `For a hosted database, also allow your IP under the host's "Remote MySQL" settings.\n`
        : "") +
      `Original error: ${err.code || err.message}\n`
  );
  process.exit(1);
}

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATE/DATETIME/TIMESTAMP columns as plain strings ("2026-08-17", "2026-08-17 10:30:00")
  // instead of JS Date objects — avoids local-timezone off-by-one-day conversion bugs.
  dateStrings: true,
});
