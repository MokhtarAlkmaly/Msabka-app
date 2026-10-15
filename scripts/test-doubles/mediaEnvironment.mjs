import initSqlJs from "sql.js";
import { readFileSync } from "node:fs";
const SQL = await initSqlJs();
const source = readFileSync(new URL("../../src/utils/sqliteClient.ts", import.meta.url), "utf8");
const schema = source.match(/CREATE TABLE IF NOT EXISTS media_files \([\s\S]*?\);/)[0];
let db = new SQL.Database();
db.run(schema);
db.run(
  "CREATE TABLE pending_changes (key TEXT PRIMARY KEY, entity TEXT, op TEXT, ref TEXT, ts INTEGER)",
);
export const LOCAL_AUDITED_TABLES = [];
export const getDB = async () => ({
  run: async (sql, values) => {
    db.run(sql, values);
    return { changes: { changes: db.getRowsModified() } };
  },
});
export const persist = async () => {};
export const countTableRows = async () => 0;
export const listTableColumns = async () => [];
export const state = {
  rows: new Map(),
  uploads: [],
  error: null,
  download: null,
  downloads: 0,
  persisted: 0,
};
export const runRawSql = async (sql, values) => db.run(sql, values);
export const queryRaw = async (sql, values) => {
  const stmt = db.prepare(sql);
  stmt.bind(values);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
};
export const persistNow = async () => {
  state.persisted++;
};
export const reopen = () => {
  const bytes = db.export();
  db.close();
  db = new SQL.Database(bytes);
};
export const getCachedMediaItem = async (id) => state.rows.get(id);
export const putCachedMedia = async (row) => state.rows.set(row.id, row);
export const supabase = {
  storage: {
    from: () => ({
      upload: async (path, blob, options) => {
        state.uploads.push({ path, blob, options });
        return { error: state.error };
      },
      download: async () => {
        state.downloads++;
        return { data: state.download, error: state.error };
      },
    }),
  },
};
