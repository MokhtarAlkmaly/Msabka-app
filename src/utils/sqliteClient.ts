/**
 * طبقة اتصال SQLite حقيقية (بديل IndexedDB).
 *
 * - على أندرويد/iOS (تطبيق Capacitor الأصلي): يُستخدم محرك SQLite الأصلي عبر
 *   @capacitor-community/sqlite (ملف قاعدة بيانات حقيقي على الجهاز).
 * - على المتصفح (npm run dev / نسخة الويب المستضافة): نفس الحزمة تعمل عبر
 *   مكوّن jeep-sqlite (محرك sql.js/WASM) وتُخزَّن البيانات داخل IndexedDB
 *   بشكل شفاف — تجربة SQLite حقيقية أيضًا، فقط بآلية تخزين مختلفة.
 *
 * كل الاستيرادات هنا ديناميكية ومحمية بفحص `typeof window`، حتى لا يتأثر
 * الريندر على السيرفر (SSR) في TanStack Start بأي شكل.
 */

import type {
  SQLiteConnection as SQLiteConnectionType,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";

export const DB_NAME = "inmaa_local";
const DB_VERSION = 1;

// ========== إنشاء الجداول (سكيمة حقيقية بأعمدة نموذجية، وليست JSON مبهم) ==========

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  teacher TEXT,
  user_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher);

CREATE TABLE IF NOT EXISTS hifz_history (
  student_id INTEGER NOT NULL,
  year_key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (student_id, year_key)
);
CREATE INDEX IF NOT EXISTS idx_hifz_student ON hifz_history(student_id);

CREATE TABLE IF NOT EXISTS year_data (
  student_id INTEGER NOT NULL,
  year TEXT NOT NULL,
  base_hifz TEXT,
  total_hifz TEXT,
  parts TEXT,
  annual TEXT,
  recitation TEXT,
  memorization TEXT,
  total TEXT,
  grade TEXT,
  prize TEXT,
  status_prize TEXT,
  rank TEXT,
  teacher TEXT,
  PRIMARY KEY (student_id, year)
);
CREATE INDEX IF NOT EXISTS idx_year_student ON year_data(student_id);
CREATE INDEX IF NOT EXISTS idx_year_year ON year_data(year);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  time INTEGER
);

CREATE TABLE IF NOT EXISTS pending_changes (
  key TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  op TEXT NOT NULL,
  ref TEXT,
  ts INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pending_entity ON pending_changes(entity);

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  year TEXT,
  name TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_teachers_year ON teachers(year);

CREATE TABLE IF NOT EXISTS teacher_bonuses (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  teacher_name TEXT,
  year TEXT,
  month INTEGER,
  amount REAL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bonuses_year ON teacher_bonuses(year);
CREATE INDEX IF NOT EXISTS idx_bonuses_teacher ON teacher_bonuses(teacher_name);

CREATE TABLE IF NOT EXISTS donors (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  year TEXT,
  name TEXT,
  donor_type TEXT,
  phone TEXT,
  pledged_amount REAL,
  paid_amount REAL,
  in_kind TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_donors_year ON donors(year);

CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  year TEXT,
  recipient_type TEXT,
  recipient_name TEXT,
  award_type TEXT,
  award_kind TEXT,
  amount REAL,
  item TEXT,
  student_name TEXT,
  notes TEXT,
  awarded_at TEXT,
  funded_by TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_awards_year ON awards(year);

CREATE TABLE IF NOT EXISTS ceremony_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  year TEXT,
  category TEXT,
  description TEXT,
  amount REAL,
  spent_at TEXT,
  funded_by TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_year ON ceremony_expenses(year);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  year TEXT,
  recipient_type TEXT,
  recipient_name TEXT,
  cert_type TEXT,
  title TEXT,
  notes TEXT,
  issued_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_certificates_year ON certificates(year);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  year TEXT,
  month INTEGER,
  title TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_media_year_month ON media(year, month);
`;

let sqliteConn: SQLiteConnectionType | null = null;
let dbConn: SQLiteDBConnection | null = null;
let initPromise: Promise<SQLiteDBConnection> | null = null;
let platformCache: string | null = null;

const assertBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("sqliteClient: لا يمكن استخدام قاعدة البيانات المحلية إلا داخل المتصفح (client-side فقط).");
  }
};

const getPlatform = async (): Promise<string> => {
  if (platformCache) return platformCache;
  const { Capacitor } = await import("@capacitor/core");
  platformCache = Capacitor.getPlatform();
  return platformCache;
};

/** يسجّل مكوّن <jeep-sqlite> ويهيّئ مخزن الويب (مطلوب فقط عند التشغيل داخل متصفح عادي). */
const ensureWebStore = async (sqlite: SQLiteConnectionType) => {
  const platform = await getPlatform();
  if (platform !== "web") return;

  const { defineCustomElements } = await import("jeep-sqlite/loader");
  await defineCustomElements(window);

  if (!document.querySelector("jeep-sqlite")) {
    const el = document.createElement("jeep-sqlite");
    document.body.appendChild(el);
  }
  await customElements.whenDefined("jeep-sqlite");
  // انتظار جاهزية المكوّن فعليًا (وليس فقط تعريفه) قبل تهيئة المخزن
  await new Promise((resolve) => setTimeout(resolve, 0));
  await sqlite.initWebStore();
};

/** يحفظ قاعدة البيانات في مخزن IndexedDB الدائم عند التشغيل على الويب (على الجوال الأصلي لا حاجة لذلك). */
export const persist = async () => {
  try {
    const platform = await getPlatform();
    if (platform !== "web" || !sqliteConn) return;
    await sqliteConn.saveToStore(DB_NAME);
  } catch (err) {
    console.error("sqliteClient: فشل حفظ قاعدة البيانات المحلية إلى المتصفح", err);
  }
};

/** يفتح (أو يعيد استخدام) اتصال SQLite واحد مع تطبيق السكيمة مرة واحدة فقط. */
export const getDB = (): Promise<SQLiteDBConnection> => {
  assertBrowser();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      sqliteConn = sqlite;

      await ensureWebStore(sqlite);

      const { result: alreadyOpen } = await sqlite.isConnection(DB_NAME, false);
      const db = alreadyOpen
        ? await sqlite.retrieveConnection(DB_NAME, false)
        : await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);

      await db.open();
      await db.execute(SCHEMA_SQL, true);

      dbConn = db;
      return db;
    } catch (err) {
      // إعادة تعيين initPromise حتى تُتاح محاولة جديدة لاحقًا بدل تجميد الخطأ للأبد
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
};
