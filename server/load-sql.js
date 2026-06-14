// Load a .sql file into the SQLite database.
// Usage: node server/load-sql.js <path-to-sql-file>
//   e.g. node server/load-sql.js seed-employees.sql

import { readFileSync } from "node:fs";
import { getDb } from "./db.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node server/load-sql.js <path-to-sql-file>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const db = getDb();
db.exec(sql);
console.log(`Loaded SQL from ${file}`);
