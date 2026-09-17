import { config } from "dotenv";
import mysql from "mysql2/promise";

config({ quiet: true });

const { DB_HOST = "localhost", DB_PORT = "3306", DB_USER = "root", DB_PASSWORD = "", DB_NAME = "barangay" } = process.env;

async function ensureDatabase() {
  const conn = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await conn.end();
}

try {
  await ensureDatabase();
} catch (err) {
  console.error(
    `\nCould not connect to MySQL at ${DB_HOST}:${DB_PORT} (user "${DB_USER}").\n` +
      `Make sure MySQL is running and that server/.env has the right DB_HOST/DB_PORT/DB_USER/DB_PASSWORD.\n` +
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
