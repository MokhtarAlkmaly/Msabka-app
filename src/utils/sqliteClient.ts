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

// ========== إنشاء الجداول (سكيمة حقيقية بأعمدة نموذجية) ==========

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  teacher TEXT,
  user_id TEXT,
  gender TEXT,
  hijri_join_date TEXT,
  initial_hifz TEXT,
  first_competition_year TEXT,
  status TEXT,
  school_grade TEXT,
  guardian_phone TEXT,
  student_phone TEXT,
  custom_fields TEXT,
  notes TEXT
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

CREATE TABLE IF NOT EXISTS internal_competitions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  student_id INTEGER,
  student_name TEXT,
  year TEXT,
  competition_name TEXT,
  category TEXT,
  score REAL,
  rank TEXT,
  prize TEXT,
  notes TEXT,
  date TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_internal_comp_student ON internal_competitions(student_id);
CREATE INDEX IF NOT EXISTS idx_internal_comp_year ON internal_competitions(year);

CREATE TABLE IF NOT EXISTS external_competitions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  student_id INTEGER,
  student_name TEXT,
  year TEXT,
  competition_name TEXT,
  organizer TEXT,
  category TEXT,
  score REAL,
  rank TEXT,
  prize TEXT,
  notes TEXT,
  date TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_external_comp_student ON external_competitions(student_id);
CREATE INDEX IF NOT EXISTS idx_external_comp_year ON external_competitions(year);

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

CREATE TABLE IF NOT EXISTS monthly_tracking (
  id TEXT,
  user_id TEXT,
  student_id INTEGER NOT NULL,
  year TEXT NOT NULL,
  month INTEGER NOT NULL,
  memorization_from_surah INTEGER,
  memorization_from_ayah INTEGER,
  memorization_to_surah INTEGER,
  memorization_to_ayah INTEGER,
  memorization_hifz_score REAL,
  memorization_recitation_score REAL,
  review_from_surah INTEGER,
  review_from_ayah INTEGER,
  review_to_surah INTEGER,
  review_to_ayah INTEGER,
  review_hifz_score REAL,
  review_recitation_score REAL,
  attendance_score REAL,
  behavior_score REAL,
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (student_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_monthly_student ON monthly_tracking(student_id);
CREATE INDEX IF NOT EXISTS idx_monthly_year_month ON monthly_tracking(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_user ON monthly_tracking(user_id);
`;

/**
 * كل جداول البيانات تحمل عمود `local_updated_at` — تاريخ آخر تعديل **على هذا
 * الجهاز**. لا نستعمل اسم `updated_at` حتى لا يتعارض مع عمود السحابة عند الرفع،
 * وهو المرجّح في سياسة «الأحدث يفوز» وفي دمج النسخ الاحتياطية.
 *
 * الإضافة تُنفَّذ بـ ALTER (وليس داخل CREATE TABLE) حتى تنطبق على القواعد
 * الموجودة مسبقاً بنفس الطريقة التي تنطبق بها على الجديدة، وتُبتلع أخطاء
 * «العمود موجود» بشكل آمن.
 */
export const LOCAL_AUDITED_TABLES = [
  "students",
  "hifz_history",
  "year_data",
  "teachers",
  "teacher_bonuses",
  "donors",
  "awards",
  "ceremony_expenses",
  "certificates",
  "internal_competitions",
  "external_competitions",
  "media",
  "monthly_tracking",
];

const MIGRATE_LOCAL_AUDIT_COLS = LOCAL_AUDITED_TABLES.map(
  (table) => `ALTER TABLE ${table} ADD COLUMN local_updated_at TEXT;`,
);

const MIGRATE_STUDENTS_COLS = [
  "ALTER TABLE students ADD COLUMN gender TEXT;",
  "ALTER TABLE students ADD COLUMN hijri_join_date TEXT;",
  "ALTER TABLE students ADD COLUMN initial_hifz TEXT;",
  "ALTER TABLE students ADD COLUMN first_competition_year TEXT;",
  "ALTER TABLE students ADD COLUMN status TEXT;",
  "ALTER TABLE students ADD COLUMN school_grade TEXT;",
  "ALTER TABLE students ADD COLUMN guardian_phone TEXT;",
  "ALTER TABLE students ADD COLUMN student_phone TEXT;",
  "ALTER TABLE students ADD COLUMN custom_fields TEXT;",
  "ALTER TABLE students ADD COLUMN notes TEXT;",
];

let sqliteConn: SQLiteConnectionType | null = null;
let dbConn: SQLiteDBConnection | null = null;
let initPromise: Promise<SQLiteDBConnection> | null = null;
let platformCache: string | null = null;

const assertBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error(
      "sqliteClient: لا يمكن استخدام قاعدة البيانات المحلية إلا داخل المتصفح (client-side فقط).",
    );
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

/**
 * حفظ فعلي فوري لقاعدة البيانات في مخزن IndexedDB (الويب فقط).
 * لا تستدعِها مباشرة من دوال الكتابة — استخدم persist() المؤجَّلة.
 */
const flushToStore = async () => {
  try {
    const platform = await getPlatform();
    if (platform !== "web" || !sqliteConn) return;
    await sqliteConn.saveToStore(DB_NAME);
  } catch (err) {
    console.error("sqliteClient: فشل حفظ قاعدة البيانات المحلية إلى المتصفح", err);
  }
};

// ========== حفظ مؤجَّل (أهم تحسين أداء في طبقة التخزين) ==========
//
// saveToStore يُسلسِل قاعدة البيانات **بالكامل** ثم يكتبها في IndexedDB.
// استدعاؤها بعد كل صف (كما كان سابقًا) يعني أن استيراد/مزامنة 500 طالب
// تكتب القاعدة كاملة 500 مرة — وهذا السبب الأول لتجمّد الواجهة.
// الآن نجمع عمليات الكتابة المتتالية ونحفظ مرة واحدة بعد توقّفها.

const PERSIST_DEBOUNCE_MS = 400;
/** أقصى مدة نسمح فيها بتأجيل الحفظ حتى مع تدفّق كتابات متواصل. */
const PERSIST_MAX_WAIT_MS = 3000;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistDeadline = 0;
let persistInFlight: Promise<void> | null = null;
let persistPendingAfterFlush = false;

const runPersist = async () => {
  persistTimer = null;
  persistDeadline = 0;

  if (persistInFlight) {
    // حفظ جارٍ بالفعل: نعلّم أن هناك تغييرات أحدث تحتاج حفظًا بعده.
    persistPendingAfterFlush = true;
    return;
  }

  persistInFlight = flushToStore().finally(() => {
    persistInFlight = null;
    if (persistPendingAfterFlush) {
      persistPendingAfterFlush = false;
      schedulePersist();
    }
  });
  await persistInFlight;
};

const schedulePersist = () => {
  const now = Date.now();
  if (persistTimer) {
    // مع استمرار الكتابة نمدّد المهلة، لكن دون تجاوز السقف الأقصى.
    if (persistDeadline && now + PERSIST_DEBOUNCE_MS > persistDeadline) return;
    clearTimeout(persistTimer);
  } else {
    persistDeadline = now + PERSIST_MAX_WAIT_MS;
  }
  persistTimer = setTimeout(() => void runPersist(), PERSIST_DEBOUNCE_MS);
};

/**
 * يطلب حفظ قاعدة البيانات إلى المخزن الدائم (الويب). الحفظ مؤجَّل ومجمَّع،
 * والدالة ترجع فورًا حتى لا تُعطِّل الواجهة بعد كل عملية.
 */
export const persist = async () => {
  if (typeof window === "undefined" || !sqliteConn) return;
  schedulePersist();
};

/** حفظ فوري مضمون — يُستخدم قبل مغادرة الصفحة أو عند إخفائها. */
export const persistNow = async () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    persistDeadline = 0;
  }
  if (persistInFlight) await persistInFlight;
  await flushToStore();
};

let lifecycleHooksBound = false;
/** يضمن ألا تضيع الكتابات المؤجَّلة عند إغلاق التبويب أو تصغير التطبيق. */
const bindLifecycleFlush = () => {
  if (lifecycleHooksBound || typeof document === "undefined") return;
  lifecycleHooksBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void persistNow();
  });
  window.addEventListener("pagehide", () => {
    void persistNow();
  });
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

      // Migrations for existing tables
      for (const sql of [...MIGRATE_STUDENTS_COLS, ...MIGRATE_LOCAL_AUDIT_COLS]) {
        try {
          await db.run(sql, [], true);
        } catch {
          // column already exists, ignore
        }
      }

      dbConn = db;
      bindLifecycleFlush();
      return db;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
};

// ========== أدوات النسخ الاحتياطي والاستعادة (ملفات حقيقية) ==========

/** اسم المنصة الحالية: `android` / `ios` / `web`. */
export const getPlatformName = async (): Promise<string> => getPlatform();

/** هل نعمل داخل تطبيق أصلي (ملفات حقيقية على الجهاز) وليس في متصفح؟ */
export const isNativePlatform = async (): Promise<boolean> => (await getPlatform()) !== "web";

/** ينفّذ SQL خاماً على الاتصال الحالي — لأدوات النسخ/الاستعادة/الفحص فقط. */
export const runRawSql = async (sql: string, values: unknown[] = []): Promise<void> => {
  assertBrowser();
  const db = await getDB();
  await db.run(sql, values as never[], true);
  await persist();
};

/** استعلام خام يرجع الصفوف كما هي. */
export const queryRaw = async (sql: string, values: unknown[] = []): Promise<Row[]> => {
  assertBrowser();
  const db = await getDB();
  const res = await db.query(sql, values as never[]);
  return (res.values ?? []) as Row[];
};

type Row = Record<string, unknown>;

/** أسماء الجداول الفعلية الموجودة في القاعدة المحلية. */
export const listTableNames = async (): Promise<string[]> => {
  const rows = await queryRaw(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  return rows.map((row) => String(row.name));
};

/** عدد صفوف جدول (بدون تحميلها في الذاكرة). */
export const countTableRows = async (table: string): Promise<number> => {
  const rows = await queryRaw(`SELECT COUNT(*) AS n FROM ${table}`);
  return Number(rows[0]?.n ?? 0);
};

/** أعمدة جدول بترتيبها الفعلي. */
export const listTableColumns = async (qualifiedTable: string): Promise<string[]> => {
  const rows = await queryRaw(`PRAGMA table_info(${qualifiedTable})`);
  return rows.map((row) => String(row.name));
};

const escapeSqlPath = (path: string) => path.replace(/'/g, "''");

/**
 * نسخة طبق الأصل من ملف القاعدة في مسار حرّ عبر `VACUUM INTO`
 * (أندرويد/iOS فقط — في المتصفح تُستعمل لقطة JSON بدلاً منها).
 *
 * `VACUUM INTO` لا يقبل معاملات مربوطة (?)، لذلك يُبنى المسار داخل النص مع
 * تضاعف علامات الاقتباس لمنع كسر الجملة.
 */
export const exportDatabaseFile = async (destPath: string): Promise<string> => {
  assertBrowser();
  if (!(await isNativePlatform())) {
    throw new Error("نسخ ملف القاعدة متاح في تطبيق أندرويد فقط — استخدم لقطة JSON في المتصفح.");
  }
  const db = await getDB();
  await db.run(`VACUUM INTO '${escapeSqlPath(destPath)}'`, [], true);
  return destPath;
};

/**
 * استعادة من ملف قاعدة بيانات: يُربط الملف كقاعدة قراءة (`ATTACH`) ثم تُنسخ
 * صفوف الجداول المشتركة إلى قاعدتنا — بلا أي لمس لملف التطبيق نفسه، وهذا آمن
 * ولا يحتاج إغلاق الاتصالات ولا أذونات إضافية.
 */
export const importDatabaseFile = async (
  srcPath: string,
  tables: string[],
  mode: "replace" | "merge" = "replace",
): Promise<{ table: string; rows: number }[]> => {
  assertBrowser();
  if (!(await isNativePlatform())) {
    throw new Error("استعادة ملف القاعدة متاح في تطبيق أندرويد فقط — استخدم لقطة JSON في المتصفح.");
  }
  const db = await getDB();
  const alias = "restore_src";
  const report: { table: string; rows: number }[] = [];

  await db.run(`ATTACH DATABASE '${escapeSqlPath(srcPath)}' AS ${alias}`, [], false);
  try {
    const localTables = await listTableNames();
    await db.beginTransaction();
    try {
      for (const table of tables) {
        if (!localTables.includes(table)) continue;
        const [mainCols, srcCols] = await Promise.all([
          listTableColumns(`main.${table}`),
          listTableColumns(`${alias}.${table}`),
        ]);
        const common = mainCols.filter((col) => srcCols.includes(col));
        if (common.length === 0) continue;

        const cols = common.join(", ");
        if (mode === "replace") await db.run(`DELETE FROM main.${table}`, [], false);
        await db.run(
          `INSERT OR REPLACE INTO main.${table} (${cols}) SELECT ${cols} FROM ${alias}.${table}`,
          [],
          false,
        );
        const countRows = await db.query(`SELECT COUNT(*) AS n FROM ${alias}.${table}`);
        report.push({ table, rows: Number(countRows.values?.[0]?.n ?? 0) });
      }
      await db.commitTransaction();
    } catch (err) {
      await db.rollbackTransaction().catch(() => undefined);
      throw err;
    }
  } finally {
    await db.run(`DETACH DATABASE ${alias}`, [], false).catch(() => undefined);
  }

  await persist();
  return report;
};
