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

export const DB_NAME = "markznet_local";
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

-- ===== جداول النسخة المستقلة (بدون سحابة) =====

-- حسابات المستخدمين (تسجيل الدخول محلي بالكامل).
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- أذونات الاطلاع على بيانات مستخدم آخر (قراءة فقط / كتابة).
CREATE TABLE IF NOT EXISTS data_grants (
  owner_id TEXT NOT NULL,
  grantee_id TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read',
  created_at TEXT,
  PRIMARY KEY (owner_id, grantee_id)
);

-- المتابعة الشهرية للطلاب (كانت سحابية — صارت محلية بالكامل).
CREATE TABLE IF NOT EXISTS monthly_tracking (
  user_id TEXT,
  student_id INTEGER NOT NULL,
  year TEXT NOT NULL,
  month INTEGER NOT NULL,
  memorization_from_surah INTEGER,
  memorization_from_ayah INTEGER,
  memorization_to_surah INTEGER,
  memorization_to_ayah INTEGER,
  memorization_hifz_score REAL DEFAULT 0,
  memorization_recitation_score REAL DEFAULT 0,
  review_from_surah INTEGER,
  review_from_ayah INTEGER,
  review_to_surah INTEGER,
  review_to_ayah INTEGER,
  review_hifz_score REAL DEFAULT 0,
  review_recitation_score REAL DEFAULT 0,
  attendance_score REAL DEFAULT 0,
  behavior_score REAL DEFAULT 0,
  PRIMARY KEY (student_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_monthly_tracking_user ON monthly_tracking(user_id, year, month);

-- روابط بوابة المعلمين والمعلمات.
CREATE TABLE IF NOT EXISTS teacher_portals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  teacher_name TEXT,
  code TEXT,
  year TEXT,
  month INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_portals_code ON teacher_portals(code);

-- وارد المعلمين والمعلمات (الترسيلات الشهرية).
CREATE TABLE IF NOT EXISTS monthly_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  portal_id TEXT,
  code TEXT,
  student_id INTEGER NOT NULL,
  student_name TEXT,
  year TEXT,
  month INTEGER,
  memorization_from_surah INTEGER,
  memorization_from_ayah INTEGER,
  memorization_to_surah INTEGER,
  memorization_to_ayah INTEGER,
  memorization_hifz_score REAL DEFAULT 0,
  memorization_recitation_score REAL DEFAULT 0,
  review_from_surah INTEGER,
  review_from_ayah INTEGER,
  review_to_surah INTEGER,
  review_to_ayah INTEGER,
  review_hifz_score REAL DEFAULT 0,
  review_recitation_score REAL DEFAULT 0,
  attendance_score REAL DEFAULT 0,
  behavior_score REAL DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'portal',
  teacher_name TEXT,
  review_note TEXT,
  reviewed_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON monthly_submissions(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_submissions_portal ON monthly_submissions(portal_id, student_id);
`;

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
      for (const sql of MIGRATE_STUDENTS_COLS) {
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
