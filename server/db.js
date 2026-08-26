/**
 * Hybrid Database Connection Handler (PostgreSQL / Supabase or Fallback MySQL)
 */
import pg from "pg";
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const isSupabase = connectionString && connectionString.includes("supabase.co");

// Detect if we should use local MySQL fallback
// Fallback if no connectionString, or if connection string is pointing to localhost postgres which we know is not running.
const useMySQL =
  !connectionString ||
  connectionString.includes("127.0.0.1:5432") ||
  connectionString.includes("localhost:5432") ||
  process.env.DB_TYPE === "mysql";

let pgPool = null;
let mysqlPool = null;

if (useMySQL) {
  console.log(
    "Database Client: Local PostgreSQL is not running. Activating fallback to local MySQL (port 3306)...",
  );
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT_MYSQL || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "devinquire_db",
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX || "20", 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || "0", 10),
    multipleStatements: false,
  });
} else {
  console.log("Database Client: Activating PostgreSQL/Supabase driver...");
  pgPool = new Pool({
    connectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX || "20", 10),
    idleTimeoutMillis: parseInt(
      process.env.DB_POOL_IDLE_TIMEOUT || "30000",
      10,
    ),
    connectionTimeoutMillis: parseInt(
      process.env.DB_POOL_CONN_TIMEOUT || "2000",
      10,
    ),
  });

  pgPool.on("error", (err) => {
    console.error("Unexpected error on inactive Postgres client", err);
  });
}

export const db = {
  /**
   * Execute a SQL query on either PostgreSQL or MySQL depending on active driver
   * @param {string} text - SQL query string with $1, $2, etc. placeholders
   * @param {Array} params - parameters array
   */
  async query(text, params = []) {
    const start = Date.now();

    if (useMySQL) {
      // Translate PostgreSQL syntax to MySQL
      let translatedText = text;

      // 1. Strip PL/pgSQL DO blocks
      translatedText = translatedText.replace(/DO \$\$[\s\S]*?END \$\$;/gi, "");

      // 2. Translate table creation primary key formats
      translatedText = translatedText.replace(
        /\bSERIAL PRIMARY KEY\b/gi,
        "INT AUTO_INCREMENT PRIMARY KEY",
      );

      // 3. Translate timestamps
      translatedText = translatedText.replace(
        /\bTIMESTAMP WITH TIME ZONE\b/gi,
        "TIMESTAMP",
      );

      // 4. Translate enums to varchar
      translatedText = translatedText.replace(
        /\b(user_role|user_status|project_status|task_status|task_priority|blog_status|notification_type|contact_status|contact_priority)\b/gi,
        "VARCHAR(50)",
      );

      // 5. Translate jsonb to json
      translatedText = translatedText.replace(/\bJSONB\b/gi, "JSON");

      // 6. Replace $1, $2, etc with ?
      translatedText = translatedText.replace(/\$\d+/g, "?");

      // 7. Strip Postgres type casts (e.g. ::task_status)
      translatedText = translatedText.replace(/::[a-zA-Z_0-9]+/g, "");

      // 8. Replace ILIKE with LIKE
      translatedText = translatedText.replace(/\bILIKE\b/gi, "LIKE");

      // 9. Strip Postgres-specific index creation statements (MySQL already handles index via CREATE TABLE UNIQUE)
      translatedText = translatedText.replace(
        /CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s*\([^)]+\);/gi,
        "",
      );

      // 10. Strip Postgres-specific default values for JSON columns (which MySQL does not support)
      translatedText = translatedText.replace(
        /DEFAULT\s+'\[\]'(::jsonb)?/gi,
        "",
      );

      // 11. Strip PostgreSQL RETURNING clause (MySQL uses insertId/affectedRows instead)
      // Detect what columns were being returned (typically RETURNING id)
      const returningMatch = translatedText.match(
        /RETURNING\s+([\w,\s*]+?);?$/i,
      );
      const returningColumns = returningMatch
        ? returningMatch[1]
            .split(",")
            .map((c) => c.trim().replace(/^["`]|["`]$/g, ""))
        : null;
      translatedText = translatedText
        .replace(/\s+RETURNING\s+[\w,\s*]+?;?$/i, ";")
        .trim();
      if (!translatedText.endsWith(";")) translatedText += ";";

      try {
        // Use .query instead of .execute to support multi-statement schema executions
        const result = await mysqlPool.query(translatedText, params);
        const rawRows = result[0];
        const meta = result[1];
        const duration = Date.now() - start;

        if (process.env.NODE_ENV !== "production") {
          console.log("Executed MySQL query", {
            original: text.trim().substring(0, 80) + "...",
            translated: translatedText.trim().substring(0, 80) + "...",
            duration,
            rows: Array.isArray(rawRows)
              ? rawRows.length
              : typeof rawRows === "object" && rawRows.insertId !== undefined
                ? "insert:" + rawRows.insertId
                : rawRows,
          });
        }

        // If original SQL had RETURNING columns, map MySQL insertId to a rows array with those columns
        if (
          returningColumns &&
          !Array.isArray(rawRows) &&
          rawRows.insertId !== undefined
        ) {
          const returnedRow = {};
          for (const col of returningColumns) {
            if (col === "*") continue;
            if (col.toLowerCase() === "id") {
              returnedRow[col] = rawRows.insertId;
            }
          }
          return {
            rows: Object.keys(returnedRow).length ? [returnedRow] : [],
            rowCount: rawRows.affectedRows || 1,
          };
        }

        // Return structure compatible with pg output (rows array)
        return {
          rows: Array.isArray(rawRows) ? rawRows : [rawRows],
          rowCount: Array.isArray(rawRows)
            ? rawRows.length
            : rawRows.affectedRows !== undefined
              ? rawRows.affectedRows
              : 1,
        };
      } catch (err) {
        const duration = Date.now() - start;
        const isProd = process.env.NODE_ENV === "production";
        const ip = "n/a";
        console.error(
          "[DB][MySQL] Query execution error",
          JSON.stringify({
            ts: new Date().toISOString(),
            original: text.trim().substring(0, 200),
            translated: translatedText.trim().substring(0, 200),
            duration,
            errno: err.errno,
            code: err.code,
            sqlState: err.sqlState,
            message: err.message,
            stack: err && err.stack,
          }),
        );
        // Return sanitized error — never expose raw MySQL errors/SQL to clients in prod
        const sanitized = new Error(
          isProd
            ? "Database query failed."
            : `[MySQL] ${err.code || err.errno || "DBError"}: ${err.message}`,
        );
        sanitized.code = err.code || "DB_ERROR";
        sanitized.errno = err.errno;
        throw sanitized;
      }
    } else {
      // PostgreSQL execution
      try {
        const res = await pgPool.query(text, params);
        const duration = Date.now() - start;

        if (process.env.NODE_ENV !== "production") {
          console.log("Executed PostgreSQL query", {
            text: text.trim().substring(0, 80) + "...",
            duration,
            rows: res.rowCount,
          });
        }
        return res;
      } catch (err) {
        const duration = Date.now() - start;
        const isProd = process.env.NODE_ENV === "production";
        console.error(
          "[DB][PostgreSQL] Query execution error",
          JSON.stringify({
            ts: new Date().toISOString(),
            original: text.trim().substring(0, 200),
            duration,
            code: err.code,
            message: err.message,
            stack: err && err.stack,
          }),
        );
        const sanitized = new Error(
          isProd
            ? "Database query failed."
            : `[PostgreSQL] ${err.code || "DBError"}: ${err.message}`,
        );
        sanitized.code = err.code || "DB_ERROR";
        throw sanitized;
      }
    }
  },
};

// Supabase client instance (for storage, auth, realtime etc. if needed)
// Uses service role key in backend if available to bypass RLS policies
export const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "placeholder",
);

export default db;
