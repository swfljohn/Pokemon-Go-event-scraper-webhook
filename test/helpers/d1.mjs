// Minimal Cloudflare D1 stand-in backed by node:sqlite, with this repo's migrations applied.
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = new URL("../../migrations/", import.meta.url);

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Statement(this.db, this.sql, params.map(value => typeof value === "boolean" ? Number(value) : value));
  }
  async first(column) {
    const row = this.db.prepare(this.sql).get(...this.params);
    if (!row) return null;
    return column ? row[column] : { ...row };
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params).map(row => ({ ...row })), success: true, meta: {} };
  }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
  async raw() {
    return this.db.prepare(this.sql).all(...this.params).map(row => Object.values(row));
  }
}

export function createD1() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter(name => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  const d1 = {
    prepare: sql => new Statement(db, sql),
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql) { db.exec(sql); return { count: 1 }; },
    withSession: () => d1,
    sqlite: db
  };
  return d1;
}
