/**
 * قاعدة بيانات محلية حقيقية (SQLite) على الجهاز.
 * لا يوجد أي اتصال بالإنترنت أو سحابة — كل شيء يُقرأ ويُكتب مباشرة
 * إلى ملف قاعدة بيانات SQLite داخل التطبيق نفسه، عبر @capacitor-community/sqlite.
 *
 * ملاحظة: يعمل فقط داخل تطبيق أندرويد/iOS المُثبَّت فعليًا على الجهاز
 * (Capacitor.isNativePlatform() === true). لا يعمل داخل معاينة المتصفح.
 *
 * ملفات الوسائط (صور/فيديوهات) لا تُخزَّن داخل قاعدة البيانات نفسها (غير مناسب
 * لملفات SQL)، بل تُخزَّن كملفات حقيقية على تخزين الجهاز عبر @capacitor/filesystem،
 * وتبقى بياناتها الوصفية (العنوان، السنة، الشهر...) داخل SQLite كالمعتاد.
 */

import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Filesystem, Directory } from "@capacitor/filesystem";

const DB_NAME = "inmaa_db";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  teacher TEXT,
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS hifz_history (
  student_id INTEGER NOT NULL,
  year_key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (student_id, year_key)
);

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
  entity TEXT,
  op TEXT,
  ref TEXT,
  ts INTEGER
);

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  year TEXT,
  name TEXT,
  created_at TEXT,
  updated_at TEXT
);

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

CREATE TABLE IF NOT EXISTS monthly_tracking (
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
  PRIMARY KEY (student_id, year, month)
);
`;

// ========== الاتصال بقاعدة البيانات ==========

let sqliteConn: SQLiteConnection | null = null;
let dbConn: SQLiteDBConnection | null = null;
let initPromise: Promise<SQLiteDBConnection> | null = null;

const getDB = (): Promise<SQLiteDBConnection> => {
  if (dbConn) return Promise.resolve(dbConn);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!Capacitor.isNativePlatform()) {
      throw new Error(
        "قاعدة البيانات المحلية (SQLite) تعمل فقط داخل تطبيق أندرويد/iOS المثبَّت على الجهاز، وليست متاحة داخل معاينة المتصفح."
      );
    }

    sqliteConn = new SQLiteConnection(CapacitorSQLite);

    const consistency = await sqliteConn.checkConnectionsConsistency();
    const existing = await sqliteConn.isConnection(DB_NAME, false);

    const conn: SQLiteDBConnection =
      consistency.result && existing.result
        ? await sqliteConn.retrieveConnection(DB_NAME, false)
        : await sqliteConn.createConnection(DB_NAME, false, "no-encryption", 1, false);

    await conn.open();
    await conn.execute(SCHEMA_SQL);

    dbConn = conn;
    return conn;
  })();

  return initPromise;
};

// ========== أدوات عامة داخلية ==========

const toParams = (row: Record<string, any>, cols: string[]) =>
  cols.map((c) => (row[c] === undefined ? null : row[c]));

const upsert = async (table: string, pk: string[], row: Record<string, any>) => {
  const db = await getDB();
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  const nonPk = cols.filter((c) => !pk.includes(c));
  const updateClause = nonPk.length
    ? nonPk.map((c) => `${c} = excluded.${c}`).join(", ")
    : `${pk[0]} = excluded.${pk[0]}`;
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
    ON CONFLICT(${pk.join(", ")}) DO UPDATE SET ${updateClause}`;
  await db.run(sql, toParams(row, cols));
};

const selectAll = async <T = any>(table: string): Promise<T[]> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM ${table}`);
  return (res.values || []) as T[];
};

const deleteByPk = async (table: string, pk: string[], vals: any[]) => {
  const db = await getDB();
  const where = pk.map((c) => `${c} = ?`).join(" AND ");
  await db.run(`DELETE FROM ${table} WHERE ${where}`, vals);
};

// ========== دوال عامة يستخدمها storage.ts مباشرة ==========

export const deleteItem = async (storeName: string, key: any) => {
  if (storeName === "hifz_history") return deleteByPk("hifz_history", ["student_id", "year_key"], key);
  if (storeName === "year_data") return deleteByPk("year_data", ["student_id", "year"], key);
  if (storeName === "students") return deleteByPk("students", ["id"], [key]);
  throw new Error(`deleteItem: جدول غير مدعوم "${storeName}"`);
};

export const clearStore = async (storeName: string) => {
  const db = await getDB();
  await db.run(`DELETE FROM ${storeName}`);
};

// ========== الطالبات ==========

export interface CachedStudent {
  id: number;
  name: string;
  teacher: string;
  user_id: string;
}

export const getCachedStudents = () => selectAll<CachedStudent>("students");
export const putCachedStudent = (student: CachedStudent) => upsert("students", ["id"], student);
export const deleteCachedStudent = (id: number) => deleteByPk("students", ["id"], [id]);

// ========== سجل الحفظ ==========

export interface CachedHifzRow {
  student_id: number;
  year_key: string;
  value: string;
}

export const getCachedHifzHistory = () => selectAll<CachedHifzRow>("hifz_history");
export const putCachedHifzRow = (row: CachedHifzRow) =>
  upsert("hifz_history", ["student_id", "year_key"], row);

// ========== بيانات السنة ==========

export interface CachedYearData {
  student_id: number;
  year: string;
  base_hifz: string;
  total_hifz: string;
  parts: string;
  annual: string;
  recitation: string;
  memorization: string;
  total: string;
  grade: string;
  prize: string;
  status_prize: string;
  rank: string;
  teacher: string;
}

export const getCachedYearData = () => selectAll<CachedYearData>("year_data");
export const putCachedYearData = (row: CachedYearData) =>
  upsert("year_data", ["student_id", "year"], row);

// ========== المعلمات ==========

export interface CachedTeacher {
  id: string;
  user_id: string;
  year: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export const getCachedTeachers = () => selectAll<CachedTeacher>("teachers");
export const putCachedTeacher = (row: CachedTeacher) => upsert("teachers", ["id"], row);
export const deleteCachedTeacher = (id: string) => deleteByPk("teachers", ["id"], [id]);

// ========== مكافآت المعلمات ==========

export interface CachedTeacherBonus {
  id: string;
  user_id: string;
  teacher_name: string;
  year: string;
  month: number;
  amount: number;
  created_at?: string;
  updated_at?: string;
}

export const getCachedTeacherBonuses = () => selectAll<CachedTeacherBonus>("teacher_bonuses");
export const putCachedTeacherBonus = (row: CachedTeacherBonus) =>
  upsert("teacher_bonuses", ["id"], row);
export const deleteCachedTeacherBonus = (id: string) =>
  deleteByPk("teacher_bonuses", ["id"], [id]);

// ========== الداعمون ==========

export interface CachedDonor {
  id: string;
  user_id: string;
  year: string;
  name: string;
  donor_type: string;
  phone: string | null;
  pledged_amount: number;
  paid_amount: number;
  in_kind: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export const getCachedDonors = () => selectAll<CachedDonor>("donors");
export const putCachedDonor = (row: CachedDonor) => upsert("donors", ["id"], row);
export const deleteCachedDonor = (id: string) => deleteByPk("donors", ["id"], [id]);

// ========== الجوائز ==========

export interface CachedAward {
  id: string;
  user_id: string;
  year: string;
  recipient_type: string;
  recipient_name: string;
  award_type: string;
  award_kind: string;
  amount: number;
  item: string | null;
  student_name: string | null;
  notes: string | null;
  awarded_at: string;
  funded_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export const getCachedAwards = () => selectAll<CachedAward>("awards");
export const putCachedAward = (row: CachedAward) => upsert("awards", ["id"], row);
export const deleteCachedAward = (id: string) => deleteByPk("awards", ["id"], [id]);

// ========== مصروفات الحفلة ==========

export interface CachedCeremonyExpense {
  id: string;
  user_id: string;
  year: string;
  category: string;
  description: string;
  amount: number;
  spent_at: string;
  funded_by: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export const getCachedCeremonyExpenses = () => selectAll<CachedCeremonyExpense>("ceremony_expenses");
export const putCachedCeremonyExpense = (row: CachedCeremonyExpense) =>
  upsert("ceremony_expenses", ["id"], row);
export const deleteCachedCeremonyExpense = (id: string) =>
  deleteByPk("ceremony_expenses", ["id"], [id]);

// ========== الشهادات ==========

export interface CachedCertificate {
  id: string;
  user_id: string;
  year: string;
  recipient_type: string;
  recipient_name: string;
  cert_type: string;
  title: string;
  notes: string | null;
  issued_at: string;
  created_at?: string;
  updated_at?: string;
}

export const getCachedCertificates = () => selectAll<CachedCertificate>("certificates");
export const putCachedCertificate = (row: CachedCertificate) => upsert("certificates", ["id"], row);
export const deleteCachedCertificate = (id: string) => deleteByPk("certificates", ["id"], [id]);

// ========== بيانات الوسائط الوصفية ==========

export interface CachedMedia {
  id: string;
  user_id: string;
  year: string;
  month: number;
  title: string;
  file_path: string;
  file_type: "image" | "video";
  file_size: number;
  created_at?: string;
}

export const getCachedMedia = () => selectAll<CachedMedia>("media");
export const putCachedMedia = (row: CachedMedia) => upsert("media", ["id"], row);
export const deleteCachedMedia = (id: string) => deleteByPk("media", ["id"], [id]);

// ========== الإعدادات (قيمة عامة أي شكل JSON) ==========

export const setCachedSetting = async (key: string, value: any) => {
  const db = await getDB();
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)]
  );
};

export const getCachedSetting = async <T>(key: string): Promise<T | undefined> => {
  const db = await getDB();
  const res = await db.query(`SELECT value FROM settings WHERE key = ?`, [key]);
  const row = (res.values || [])[0];
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return row.value as T;
  }
};

// ========== وقت آخر "حفظ" محلي ==========

export const setLastSyncTime = async () => {
  const db = await getDB();
  await db.run(
    `INSERT INTO meta (key, time) VALUES ('lastSync', ?)
     ON CONFLICT(key) DO UPDATE SET time = excluded.time`,
    [Date.now()]
  );
};

export const isCachePopulated = async (): Promise<boolean> => {
  const db = await getDB();
  const res = await db.query(`SELECT time FROM meta WHERE key = 'lastSync'`);
  return (res.values || []).length > 0;
};

// ========== التغييرات المعلَّقة (بقايا نظام قديم، غير فعّالة الآن) ==========

export type PendingOp = "upsert" | "delete";
export type PendingEntity =
  | "student" | "hifz" | "year" | "teacher" | "teacher_bonus"
  | "donor" | "award" | "expense" | "certificate" | "media";

export interface PendingChange {
  key: string;
  entity: PendingEntity;
  op: PendingOp;
  ref: any;
  ts: number;
}

export const markDirty = async (entity: PendingEntity, op: PendingOp, ref: any) => {
  let key = "";
  if (entity === "student") key = `student:${ref.id}`;
  else if (entity === "hifz") key = `hifz:${ref.student_id}|${ref.year_key}`;
  else if (entity === "year") key = `year:${ref.student_id}|${ref.year}`;
  else if (entity === "teacher") key = `teacher:${ref.id}`;
  else if (entity === "teacher_bonus") key = `teacher_bonus:${ref.id}`;
  else if (entity === "donor") key = `donor:${ref.id}`;
  else if (entity === "award") key = `award:${ref.id}`;
  else if (entity === "expense") key = `expense:${ref.id}`;
  else if (entity === "certificate") key = `certificate:${ref.id}`;
  else if (entity === "media") key = `media:${ref.id}`;

  const db = await getDB();
  await db.run(
    `INSERT INTO pending_changes (key, entity, op, ref, ts) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET entity = excluded.entity, op = excluded.op, ref = excluded.ref, ts = excluded.ts`,
    [key, entity, op, JSON.stringify(ref), Date.now()]
  );
};

export const getPendingChanges = async (): Promise<PendingChange[]> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM pending_changes`);
  return (res.values || []).map((r: any) => ({ ...r, ref: JSON.parse(r.ref) }));
};

export const clearPending = (key: string) => deleteByPk("pending_changes", ["key"], [key]);

// ========== ملفات الوسائط (صور/فيديوهات) — تخزين حقيقي على الجهاز ==========
// تُحفظ كملفات فعلية عبر Filesystem (وليس داخل SQLite) — أنسب وأسرع للملفات
// الكبيرة، وتبقى بياناتها الوصفية (media table) داخل SQLite.

const mediaFilePath = (id: string) => `media/${id}.bin`;

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const base64ToBlob = (base64: string): Blob => {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)]);
};

export const putMediaFile = async (id: string, blob: Blob) => {
  const base64 = await blobToBase64(blob);
  await Filesystem.writeFile({
    path: mediaFilePath(id),
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });
};

export const getMediaFile = async (id: string): Promise<Blob | undefined> => {
  try {
    const res = await Filesystem.readFile({ path: mediaFilePath(id), directory: Directory.Data });
    return base64ToBlob(res.data as string);
  } catch {
    return undefined;
  }
};

export const deleteMediaFile = async (id: string) => {
  try {
    await Filesystem.deleteFile({ path: mediaFilePath(id), directory: Directory.Data });
  } catch {
    // الملف غير موجود أصلاً — تجاهلي
  }
};

// ========== المتابعة الشهرية ==========

export interface CachedMonthlyTracking {
  user_id: string;
  student_id: number;
  year: string;
  month: number;
  memorization_from_surah: number | null;
  memorization_from_ayah: number | null;
  memorization_to_surah: number | null;
  memorization_to_ayah: number | null;
  memorization_hifz_score: number;
  memorization_recitation_score: number;
  review_from_surah: number | null;
  review_from_ayah: number | null;
  review_to_surah: number | null;
  review_to_ayah: number | null;
  review_hifz_score: number;
  review_recitation_score: number;
  attendance_score: number;
  behavior_score: number;
}

export const getAllCachedMonthlyTracking = () =>
  selectAll<CachedMonthlyTracking>("monthly_tracking");

export const putCachedMonthlyTracking = (row: CachedMonthlyTracking) =>
  upsert("monthly_tracking", ["student_id", "year", "month"], row);

// ========== استيراد نسخة احتياطية كاملة (من نسخة IndexedDB القديمة) ==========

export const importFullBackup = async (backup: any) => {
  for (const s of backup.students || []) await putCachedStudent(s);
  for (const h of backup.hifz || []) await putCachedHifzRow(h);
  for (const y of backup.yearData || []) await putCachedYearData(y);
  for (const t of backup.teachers || []) await putCachedTeacher(t);
  for (const b of backup.bonuses || []) await putCachedTeacherBonus(b);
  for (const d of backup.donors || []) await putCachedDonor(d);
  for (const a of backup.awards || []) await putCachedAward(a);
  for (const e of backup.expenses || []) await putCachedCeremonyExpense(e);
  for (const c of backup.certs || []) await putCachedCertificate(c);
  for (const m of backup.monthly || []) await putCachedMonthlyTracking(m);

  for (const m of backup.media || []) {
    const { base64, ...meta } = m;
    await putCachedMedia(meta);
    if (base64) {
      try {
        await putMediaFile(m.id, base64ToBlob(base64));
      } catch (e) {
        console.error(`فشل استيراد ملف الوسائط ${m.id}:`, e);
      }
    }
  }

  if (backup.activeYear) await setCachedSetting("active_year", backup.activeYear);
  if (backup.tableFilters) await setCachedSetting("table_filters", backup.tableFilters);

  await setLastSyncTime();

  return {
    students: (backup.students || []).length,
    hifz: (backup.hifz || []).length,
    yearData: (backup.yearData || []).length,
    teachers: (backup.teachers || []).length,
    donors: (backup.donors || []).length,
    awards: (backup.awards || []).length,
    expenses: (backup.expenses || []).length,
    certs: (backup.certs || []).length,
    media: (backup.media || []).length,
    monthly: (backup.monthly || []).length,
  };
};
