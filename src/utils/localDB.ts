/**
 * طبقة التخزين المحلي — تعمل الآن فوق قاعدة بيانات SQLite حقيقية بدل IndexedDB
 * (عبر @capacitor-community/sqlite: محرك SQLite أصلي على أندرويد/iOS، ومحرك
 * sql.js/WASM على المتصفح). البيانات تُخزَّن محليًا وتتزامن مع السحابة فقط
 * عند الضغط على "حفظ" (كما كان الحال سابقًا).
 *
 * ملاحظة مهمة: كل الدوال المُصدَّرة من هذا الملف تحمل نفس الأسماء والتوقيعات
 * التي كانت موجودة في نسخة IndexedDB السابقة، حتى لا يحتاج أي ملف آخر في
 * المشروع (storage.ts والصفحات) إلى أي تعديل.
 */

import type { capSQLiteSet } from "@capacitor-community/sqlite";
import { getDB, persist } from "./sqliteClient";

const STORES = {
  students: "students",
  hifzHistory: "hifz_history",
  yearData: "year_data",
  settings: "settings",
  meta: "meta",
  pending: "pending_changes",
  teachers: "teachers",
  teacherBonuses: "teacher_bonuses",
  donors: "donors",
  awards: "awards",
  ceremonyExpenses: "ceremony_expenses",
  certificates: "certificates",
  media: "media",
} as const;

// ========== سجلّ الجداول: يصف كل جدول (أعمدته ومفتاحه الأساسي) لتبقى دوال
// CRUD العامة أدناه صالحة لأي جدول دون تكرار كود SQL يدويًا ==========

interface TableConfig {
  columns: string[];
  pk: string[];
  /** تحويل الكائن القادم من الاستدعاء إلى صف أعمدة مسطّح (افتراضيًا: أخذ نفس الحقول) */
  toRow?: (item: any) => Record<string, any>;
  /** تحويل الصف القادم من SQLite إلى الشكل الذي يتوقعه بقية الكود */
  fromRow?: (row: any) => any;
}

const TABLES: Record<string, TableConfig> = {
  [STORES.students]: {
    columns: ["id", "name", "teacher", "user_id"],
    pk: ["id"],
  },
  [STORES.hifzHistory]: {
    columns: ["student_id", "year_key", "value"],
    pk: ["student_id", "year_key"],
  },
  [STORES.yearData]: {
    columns: [
      "student_id", "year", "base_hifz", "total_hifz", "parts", "annual",
      "recitation", "memorization", "total", "grade", "prize", "status_prize",
      "rank", "teacher",
    ],
    pk: ["student_id", "year"],
  },
  [STORES.settings]: {
    columns: ["key", "value"],
    pk: ["key"],
    toRow: (item) => ({ key: item.key, value: JSON.stringify(item.value ?? null) }),
    fromRow: (row) => ({ key: row.key, value: row.value != null ? JSON.parse(row.value) : undefined }),
  },
  [STORES.meta]: {
    columns: ["key", "time"],
    pk: ["key"],
  },
  [STORES.pending]: {
    columns: ["key", "entity", "op", "ref", "ts"],
    pk: ["key"],
    toRow: (item) => ({ ...item, ref: JSON.stringify(item.ref ?? null) }),
    fromRow: (row) => ({ ...row, ref: row.ref != null ? JSON.parse(row.ref) : null }),
  },
  [STORES.teachers]: {
    columns: ["id", "user_id", "year", "name", "created_at", "updated_at"],
    pk: ["id"],
  },
  [STORES.teacherBonuses]: {
    columns: ["id", "user_id", "teacher_name", "year", "month", "amount", "created_at", "updated_at"],
    pk: ["id"],
  },
  [STORES.donors]: {
    columns: [
      "id", "user_id", "year", "name", "donor_type", "phone", "pledged_amount",
      "paid_amount", "in_kind", "notes", "created_at", "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.awards]: {
    columns: [
      "id", "user_id", "year", "recipient_type", "recipient_name", "award_type",
      "award_kind", "amount", "item", "student_name", "notes", "awarded_at",
      "funded_by", "created_at", "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.ceremonyExpenses]: {
    columns: [
      "id", "user_id", "year", "category", "description", "amount", "spent_at",
      "funded_by", "notes", "created_at", "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.certificates]: {
    columns: [
      "id", "user_id", "year", "recipient_type", "recipient_name", "cert_type",
      "title", "notes", "issued_at", "created_at", "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.media]: {
    columns: ["id", "user_id", "year", "month", "title", "file_path", "file_type", "file_size", "created_at"],
    pk: ["id"],
  },
};

const getTable = (storeName: string): TableConfig => {
  const cfg = TABLES[storeName];
  if (!cfg) throw new Error(`localDB: جدول غير معروف "${storeName}"`);
  return cfg;
};

const toRow = (cfg: TableConfig, item: any): Record<string, any> => {
  const raw = cfg.toRow ? cfg.toRow(item) : item;
  const row: Record<string, any> = {};
  for (const col of cfg.columns) row[col] = raw[col] ?? null;
  return row;
};

const fromRow = (cfg: TableConfig, row: any): any => (cfg.fromRow ? cfg.fromRow(row) : row);

const keyValues = (key: any): any[] => (Array.isArray(key) ? key : [key]);

// ========== دوال CRUD العامة (نفس توقيعات IndexedDB السابقة تمامًا) ==========

export const putItem = async (storeName: string, item: any) => {
  const cfg = getTable(storeName);
  const row = toRow(cfg, item);
  const db = await getDB();
  const placeholders = cfg.columns.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${storeName} (${cfg.columns.join(", ")}) VALUES (${placeholders})`;
  await db.run(sql, cfg.columns.map((c) => row[c]), true);
  await persist();
};

export const getItem = async <T>(storeName: string, key: any): Promise<T | undefined> => {
  const cfg = getTable(storeName);
  const db = await getDB();
  const where = cfg.pk.map((c) => `${c} = ?`).join(" AND ");
  const res = await db.query(`SELECT * FROM ${storeName} WHERE ${where} LIMIT 1`, keyValues(key));
  const row = res.values?.[0];
  return row ? (fromRow(cfg, row) as T) : undefined;
};

export const getAllItems = async <T>(storeName: string): Promise<T[]> => {
  const cfg = getTable(storeName);
  const db = await getDB();
  const res = await db.query(`SELECT * FROM ${storeName}`);
  return (res.values ?? []).map((row) => fromRow(cfg, row) as T);
};

export const deleteItem = async (storeName: string, key: any) => {
  const cfg = getTable(storeName);
  const db = await getDB();
  const where = cfg.pk.map((c) => `${c} = ?`).join(" AND ");
  await db.run(`DELETE FROM ${storeName} WHERE ${where}`, keyValues(key), true);
  await persist();
};

export const clearStore = async (storeName: string) => {
  getTable(storeName); // يتحقق أن الاسم معروف
  const db = await getDB();
  await db.run(`DELETE FROM ${storeName}`, [], true);
  await persist();
};

/** استبدال كامل محتوى جدول دفعة واحدة (حذف ثم إدراج) ضمن معاملة واحدة ذرّية */
const cacheRecords = async <T>(storeName: string, rows: T[]) => {
  const cfg = getTable(storeName);
  const db = await getDB();
  const set: capSQLiteSet[] = [{ statement: `DELETE FROM ${storeName}`, values: [] }];
  const placeholders = cfg.columns.map(() => "?").join(", ");
  const insertSql = `INSERT OR REPLACE INTO ${storeName} (${cfg.columns.join(", ")}) VALUES (${placeholders})`;
  for (const item of rows) {
    const row = toRow(cfg, item);
    set.push({ statement: insertSql, values: cfg.columns.map((c) => row[c]) });
  }
  await db.executeSet(set, true);
  await persist();
};

// ========== Students ==========

export interface CachedStudent {
  id: number;
  name: string;
  teacher: string;
  user_id: string;
}

export const cacheStudents = async (students: CachedStudent[]) => cacheRecords(STORES.students, students);
export const getCachedStudents = () => getAllItems<CachedStudent>(STORES.students);
export const deleteCachedStudent = (id: number) => deleteItem(STORES.students, id);
export const putCachedStudent = (student: CachedStudent) => putItem(STORES.students, student);

// ========== Hifz History ==========

export interface CachedHifzRow {
  student_id: number;
  year_key: string;
  value: string;
}

export const cacheHifzHistory = async (rows: CachedHifzRow[]) => cacheRecords(STORES.hifzHistory, rows);
export const getCachedHifzHistory = () => getAllItems<CachedHifzRow>(STORES.hifzHistory);
export const putCachedHifzRow = (row: CachedHifzRow) => putItem(STORES.hifzHistory, row);

// ========== Year Data ==========

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

export const cacheYearData = async (rows: CachedYearData[]) => cacheRecords(STORES.yearData, rows);
export const getCachedYearData = () => getAllItems<CachedYearData>(STORES.yearData);
export const putCachedYearData = (row: CachedYearData) => putItem(STORES.yearData, row);

// ========== Teachers ==========

export interface CachedTeacher {
  id: string;
  user_id: string;
  year: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export const cacheTeachers = (rows: CachedTeacher[]) => cacheRecords(STORES.teachers, rows);
export const getCachedTeachers = () => getAllItems<CachedTeacher>(STORES.teachers);
export const getCachedTeacher = (id: string) => getItem<CachedTeacher>(STORES.teachers, id);
export const putCachedTeacher = (row: CachedTeacher) => putItem(STORES.teachers, row);
export const deleteCachedTeacher = (id: string) => deleteItem(STORES.teachers, id);

// ========== Teacher Bonuses ==========

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

export const cacheTeacherBonuses = (rows: CachedTeacherBonus[]) => cacheRecords(STORES.teacherBonuses, rows);
export const getCachedTeacherBonuses = () => getAllItems<CachedTeacherBonus>(STORES.teacherBonuses);
export const getCachedTeacherBonus = (id: string) => getItem<CachedTeacherBonus>(STORES.teacherBonuses, id);
export const putCachedTeacherBonus = (row: CachedTeacherBonus) => putItem(STORES.teacherBonuses, row);
export const deleteCachedTeacherBonus = (id: string) => deleteItem(STORES.teacherBonuses, id);

// ========== Donors ==========

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

export const cacheDonors = (rows: CachedDonor[]) => cacheRecords(STORES.donors, rows);
export const getCachedDonors = () => getAllItems<CachedDonor>(STORES.donors);
export const getCachedDonor = (id: string) => getItem<CachedDonor>(STORES.donors, id);
export const putCachedDonor = (row: CachedDonor) => putItem(STORES.donors, row);
export const deleteCachedDonor = (id: string) => deleteItem(STORES.donors, id);

// ========== Awards ==========

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

export const cacheAwards = (rows: CachedAward[]) => cacheRecords(STORES.awards, rows);
export const getCachedAwards = () => getAllItems<CachedAward>(STORES.awards);
export const getCachedAward = (id: string) => getItem<CachedAward>(STORES.awards, id);
export const putCachedAward = (row: CachedAward) => putItem(STORES.awards, row);
export const deleteCachedAward = (id: string) => deleteItem(STORES.awards, id);

// ========== Ceremony Expenses ==========

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

export const cacheCeremonyExpenses = (rows: CachedCeremonyExpense[]) => cacheRecords(STORES.ceremonyExpenses, rows);
export const getCachedCeremonyExpenses = () => getAllItems<CachedCeremonyExpense>(STORES.ceremonyExpenses);
export const getCachedCeremonyExpense = (id: string) => getItem<CachedCeremonyExpense>(STORES.ceremonyExpenses, id);
export const putCachedCeremonyExpense = (row: CachedCeremonyExpense) => putItem(STORES.ceremonyExpenses, row);
export const deleteCachedCeremonyExpense = (id: string) => deleteItem(STORES.ceremonyExpenses, id);

// ========== Certificates ==========

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

export const cacheCertificates = (rows: CachedCertificate[]) => cacheRecords(STORES.certificates, rows);
export const getCachedCertificates = () => getAllItems<CachedCertificate>(STORES.certificates);
export const getCachedCertificate = (id: string) => getItem<CachedCertificate>(STORES.certificates, id);
export const putCachedCertificate = (row: CachedCertificate) => putItem(STORES.certificates, row);
export const deleteCachedCertificate = (id: string) => deleteItem(STORES.certificates, id);

// ========== Media Metadata ==========

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

export const cacheMedia = (rows: CachedMedia[]) => cacheRecords(STORES.media, rows);
export const getCachedMedia = () => getAllItems<CachedMedia>(STORES.media);
export const getCachedMediaItem = (id: string) => getItem<CachedMedia>(STORES.media, id);
export const putCachedMedia = (row: CachedMedia) => putItem(STORES.media, row);
export const deleteCachedMedia = (id: string) => deleteItem(STORES.media, id);

// ========== Settings ==========

export const setCachedSetting = async (key: string, value: any) => {
  await putItem(STORES.settings, { key, value });
};

export const getCachedSetting = async <T>(key: string): Promise<T | undefined> => {
  const item = await getItem<{ key: string; value: T }>(STORES.settings, key);
  return item?.value;
};

// ========== Meta (last sync time etc) ==========

export const setLastSyncTime = async () => {
  await putItem(STORES.meta, { key: "lastSync", time: Date.now() });
};

export const getLastSyncTime = async (): Promise<number | null> => {
  const item = await getItem<{ key: string; time: number }>(STORES.meta, "lastSync");
  return item?.time || null;
};

export const isCachePopulated = async (): Promise<boolean> => {
  const lastSync = await getLastSyncTime();
  return lastSync !== null;
};

// ========== Clear all ==========

export const clearAllCache = async () => {
  const db = await getDB();
  const set: capSQLiteSet[] = Object.values(STORES).map((name) => ({ statement: `DELETE FROM ${name}`, values: [] }));
  await db.executeSet(set, true);
  await persist();
};

// ========== Pending Changes (incremental sync) ==========

export type PendingOp = "upsert" | "delete";
export type PendingEntity =
  | "student"
  | "hifz"
  | "year"
  | "teacher"
  | "teacher_bonus"
  | "donor"
  | "award"
  | "expense"
  | "certificate"
  | "media";

export interface PendingChange {
  key: string; // e.g. "student:5", "hifz:5|h1441", "year:5|1447"
  entity: PendingEntity;
  op: PendingOp;
  ref: any; // identifier(s) needed to resolve the record
  ts: number;
}

export const markDirty = (entity: PendingEntity, op: PendingOp, ref: any) => {
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
  return putItem(STORES.pending, { key, entity, op, ref, ts: Date.now() } as PendingChange);
};

export const getPendingChanges = () => getAllItems<PendingChange>(STORES.pending);

export const clearPending = (key: string) => deleteItem(STORES.pending, key);

export const clearAllPending = () => clearStore(STORES.pending);

// Re-key pending entries when a temp student id is replaced by the real cloud id
export const remapPendingStudentId = async (oldId: number, newId: number) => {
  const all = await getPendingChanges();
  for (const p of all) {
    let touched = false;
    if (p.entity === "student" && p.ref?.id === oldId) {
      p.ref.id = newId;
      touched = true;
    } else if ((p.entity === "hifz" || p.entity === "year") && p.ref?.student_id === oldId) {
      p.ref.student_id = newId;
      touched = true;
    }
    if (touched) {
      await deleteItem(STORES.pending, p.key);
      await markDirty(p.entity, p.op, p.ref);
    }
  }
};

// ========== استعلامات إضافية مستفيدة من SQL حقيقي (إضافات "متقدمة" فوق نفس الواجهة) ==========

/** بحث بالاسم مباشرة داخل SQLite (بدل تحميل كل الطلاب وفلترتهم في الجافاسكربت) */
export const searchCachedStudentsByName = async (query: string): Promise<CachedStudent[]> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM ${STORES.students} WHERE name LIKE ? ORDER BY name`, [`%${query}%`]);
  return (res.values ?? []) as CachedStudent[];
};

/** بيانات سنة معيّنة لطالب واحد فقط، عبر فهرس student_id بدل مسح الجدول كاملاً */
export const getCachedYearDataForStudent = async (studentId: number): Promise<CachedYearData[]> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM ${STORES.yearData} WHERE student_id = ? ORDER BY year`, [studentId]);
  return (res.values ?? []) as CachedYearData[];
};
