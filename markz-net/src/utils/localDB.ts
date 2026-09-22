/**
 * طبقة التخزين المحلي — تعمل فوق قاعدة بيانات SQLite حقيقية
 * (عبر @capacitor-community/sqlite: محرك SQLite أصلي على أندرويد/iOS، ومحرك
 * sql.js/WASM على المتصفح).
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
  internalCompetitions: "internal_competitions",
  externalCompetitions: "external_competitions",
  media: "media",
  monthlyTracking: "monthly_tracking",
  teacherPortals: "teacher_portals",
  submissions: "monthly_submissions",
} as const;

// ========== سجلّ الجداول ==========

/** صف SQLite ديناميكي: الأعمدة معرّفة في جدول TABLES أدناه. */
export type Row = Record<string, unknown>;

type PrimaryKey = string | number | Array<string | number>;

interface TableConfig {
  columns: string[];
  pk: string[];
  toRow?: (item: Row) => Row;
  fromRow?: (row: Row) => Row;
}

const TABLES: Record<string, TableConfig> = {
  [STORES.students]: {
    columns: [
      "id",
      "name",
      "teacher",
      "user_id",
      "gender",
      "hijri_join_date",
      "initial_hifz",
      "first_competition_year",
      "status",
      "school_grade",
      "guardian_phone",
      "student_phone",
      "custom_fields",
      "notes",
    ],
    pk: ["id"],
    toRow: (item) => ({
      ...item,
      custom_fields:
        typeof item.custom_fields === "object" && item.custom_fields !== null
          ? JSON.stringify(item.custom_fields)
          : (item.custom_fields ?? null),
    }),
    fromRow: (row) => {
      let customFieldsObj = {};
      if (row.custom_fields) {
        try {
          customFieldsObj = JSON.parse(row.custom_fields as string);
        } catch {
          customFieldsObj = {};
        }
      }
      return {
        ...row,
        custom_fields: customFieldsObj,
      };
    },
  },
  [STORES.hifzHistory]: {
    columns: ["student_id", "year_key", "value"],
    pk: ["student_id", "year_key"],
  },
  [STORES.yearData]: {
    columns: [
      "student_id",
      "year",
      "base_hifz",
      "total_hifz",
      "parts",
      "annual",
      "recitation",
      "memorization",
      "total",
      "grade",
      "prize",
      "status_prize",
      "rank",
      "teacher",
    ],
    pk: ["student_id", "year"],
  },
  [STORES.settings]: {
    columns: ["key", "value"],
    pk: ["key"],
    toRow: (item) => ({ key: item.key, value: JSON.stringify(item.value ?? null) }),
    fromRow: (row) => ({
      key: row.key,
      value: row.value != null ? JSON.parse(row.value as string) : undefined,
    }),
  },
  [STORES.meta]: {
    columns: ["key", "time"],
    pk: ["key"],
  },
  [STORES.pending]: {
    columns: ["key", "entity", "op", "ref", "ts"],
    pk: ["key"],
    toRow: (item) => ({ ...item, ref: JSON.stringify(item.ref ?? null) }),
    fromRow: (row) => ({ ...row, ref: row.ref != null ? JSON.parse(row.ref as string) : null }),
  },
  [STORES.teachers]: {
    columns: ["id", "user_id", "year", "name", "created_at", "updated_at"],
    pk: ["id"],
  },
  [STORES.teacherBonuses]: {
    columns: [
      "id",
      "user_id",
      "teacher_name",
      "year",
      "month",
      "amount",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.donors]: {
    columns: [
      "id",
      "user_id",
      "year",
      "name",
      "donor_type",
      "phone",
      "pledged_amount",
      "paid_amount",
      "in_kind",
      "notes",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.awards]: {
    columns: [
      "id",
      "user_id",
      "year",
      "recipient_type",
      "recipient_name",
      "award_type",
      "award_kind",
      "amount",
      "item",
      "student_name",
      "notes",
      "awarded_at",
      "funded_by",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.ceremonyExpenses]: {
    columns: [
      "id",
      "user_id",
      "year",
      "category",
      "description",
      "amount",
      "spent_at",
      "funded_by",
      "notes",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.certificates]: {
    columns: [
      "id",
      "user_id",
      "year",
      "recipient_type",
      "recipient_name",
      "cert_type",
      "title",
      "notes",
      "issued_at",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.internalCompetitions]: {
    columns: [
      "id",
      "user_id",
      "student_id",
      "student_name",
      "year",
      "competition_name",
      "category",
      "score",
      "rank",
      "prize",
      "notes",
      "date",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.externalCompetitions]: {
    columns: [
      "id",
      "user_id",
      "student_id",
      "student_name",
      "year",
      "competition_name",
      "organizer",
      "category",
      "score",
      "rank",
      "prize",
      "notes",
      "date",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.media]: {
    columns: [
      "id",
      "user_id",
      "year",
      "month",
      "title",
      "file_path",
      "file_type",
      "file_size",
      "created_at",
    ],
    pk: ["id"],
  },
  [STORES.monthlyTracking]: {
    columns: [
      "user_id",
      "student_id",
      "year",
      "month",
      "memorization_from_surah",
      "memorization_from_ayah",
      "memorization_to_surah",
      "memorization_to_ayah",
      "memorization_hifz_score",
      "memorization_recitation_score",
      "review_from_surah",
      "review_from_ayah",
      "review_to_surah",
      "review_to_ayah",
      "review_hifz_score",
      "review_recitation_score",
      "attendance_score",
      "behavior_score",
    ],
    pk: ["student_id", "year", "month"],
  },
  [STORES.teacherPortals]: {
    columns: [
      "id",
      "user_id",
      "teacher_name",
      "code",
      "year",
      "month",
      "active",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
    toRow: (item) => ({ ...item, active: item.active ? 1 : 0 }),
    fromRow: (row) => ({ ...row, active: Number(row.active) === 1 }),
  },
  [STORES.submissions]: {
    columns: [
      "id",
      "user_id",
      "portal_id",
      "code",
      "student_id",
      "student_name",
      "year",
      "month",
      "memorization_from_surah",
      "memorization_from_ayah",
      "memorization_to_surah",
      "memorization_to_ayah",
      "memorization_hifz_score",
      "memorization_recitation_score",
      "review_from_surah",
      "review_from_ayah",
      "review_to_surah",
      "review_to_ayah",
      "review_hifz_score",
      "review_recitation_score",
      "attendance_score",
      "behavior_score",
      "notes",
      "status",
      "source",
      "teacher_name",
      "review_note",
      "reviewed_at",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
};

const getTable = (storeName: string): TableConfig => {
  const cfg = TABLES[storeName];
  if (!cfg) throw new Error(`localDB: جدول غير معروف "${storeName}"`);
  return cfg;
};

const toRow = (cfg: TableConfig, item: Row): Row => {
  const raw = cfg.toRow ? cfg.toRow(item) : item;
  const row: Row = {};
  for (const col of cfg.columns) row[col] = raw[col] ?? null;
  return row;
};

const fromRow = (cfg: TableConfig, row: Row): Row => (cfg.fromRow ? cfg.fromRow(row) : row);

const keyValues = (key: PrimaryKey): Array<string | number> => (Array.isArray(key) ? key : [key]);

// ========== دوال CRUD العامة ==========

export const putItem = async (storeName: string, item: Row) => {
  const cfg = getTable(storeName);
  const row = toRow(cfg, item);
  const db = await getDB();
  const placeholders = cfg.columns.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${storeName} (${cfg.columns.join(", ")}) VALUES (${placeholders})`;
  await db.run(
    sql,
    cfg.columns.map((c) => row[c]),
    true,
  );
  await persist();
};

export const getItem = async <T>(storeName: string, key: PrimaryKey): Promise<T | undefined> => {
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

export const deleteItem = async (storeName: string, key: PrimaryKey) => {
  const cfg = getTable(storeName);
  const db = await getDB();
  const where = cfg.pk.map((c) => `${c} = ?`).join(" AND ");
  await db.run(`DELETE FROM ${storeName} WHERE ${where}`, keyValues(key), true);
  await persist();
};

export const clearStore = async (storeName: string) => {
  getTable(storeName);
  const db = await getDB();
  await db.run(`DELETE FROM ${storeName}`, [], true);
  await persist();
};

/** استبدال كامل محتوى جدول دفعة واحدة */
const cacheRecords = async <T extends Row>(storeName: string, rows: T[]) => {
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

export type CachedStudent = {
  id: number;
  name: string;
  teacher: string;
  user_id: string;
  gender?: string | null;
  hijri_join_date?: string | null;
  initial_hifz?: string | null;
  first_competition_year?: string | null;
  status?: string | null;
  school_grade?: string | null;
  guardian_phone?: string | null;
  student_phone?: string | null;
  custom_fields?: Record<string, string> | null;
  notes?: string | null;
};

export const cacheStudents = async (students: CachedStudent[]) =>
  cacheRecords(STORES.students, students);
export const getCachedStudents = () => getAllItems<CachedStudent>(STORES.students);
export const deleteCachedStudent = (id: number) => deleteItem(STORES.students, id);
export const putCachedStudent = (student: CachedStudent) => putItem(STORES.students, student);

// ========== Hifz History ==========

export type CachedHifzRow = {
  student_id: number;
  year_key: string;
  value: string;
};

export const cacheHifzHistory = async (rows: CachedHifzRow[]) =>
  cacheRecords(STORES.hifzHistory, rows);
export const getCachedHifzHistory = () => getAllItems<CachedHifzRow>(STORES.hifzHistory);
export const putCachedHifzRow = (row: CachedHifzRow) => putItem(STORES.hifzHistory, row);

// ========== Year Data ==========

export type CachedYearData = {
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
};

export const cacheYearData = async (rows: CachedYearData[]) => cacheRecords(STORES.yearData, rows);
export const getCachedYearData = () => getAllItems<CachedYearData>(STORES.yearData);
export const putCachedYearData = (row: CachedYearData) => putItem(STORES.yearData, row);

// ========== Teachers ==========

export type CachedTeacher = {
  id: string;
  user_id: string;
  year: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export const cacheTeachers = (rows: CachedTeacher[]) => cacheRecords(STORES.teachers, rows);
export const getCachedTeachers = () => getAllItems<CachedTeacher>(STORES.teachers);
export const getCachedTeacher = (id: string) => getItem<CachedTeacher>(STORES.teachers, id);
export const putCachedTeacher = (row: CachedTeacher) => putItem(STORES.teachers, row);
export const deleteCachedTeacher = (id: string) => deleteItem(STORES.teachers, id);

// ========== Teacher Bonuses ==========

export type CachedTeacherBonus = {
  id: string;
  user_id: string;
  teacher_name: string;
  year: string;
  month: number;
  amount: number;
  created_at?: string;
  updated_at?: string;
};

export const cacheTeacherBonuses = (rows: CachedTeacherBonus[]) =>
  cacheRecords(STORES.teacherBonuses, rows);
export const getCachedTeacherBonuses = () => getAllItems<CachedTeacherBonus>(STORES.teacherBonuses);
export const getCachedTeacherBonus = (id: string) =>
  getItem<CachedTeacherBonus>(STORES.teacherBonuses, id);
export const putCachedTeacherBonus = (row: CachedTeacherBonus) =>
  putItem(STORES.teacherBonuses, row);
export const deleteCachedTeacherBonus = (id: string) => deleteItem(STORES.teacherBonuses, id);

// ========== Donors ==========

export type CachedDonor = {
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
};

export const cacheDonors = (rows: CachedDonor[]) => cacheRecords(STORES.donors, rows);
export const getCachedDonors = () => getAllItems<CachedDonor>(STORES.donors);
export const getCachedDonor = (id: string) => getItem<CachedDonor>(STORES.donors, id);
export const putCachedDonor = (row: CachedDonor) => putItem(STORES.donors, row);
export const deleteCachedDonor = (id: string) => deleteItem(STORES.donors, id);

// ========== Awards ==========

export type CachedAward = {
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
};

export const cacheAwards = (rows: CachedAward[]) => cacheRecords(STORES.awards, rows);
export const getCachedAwards = () => getAllItems<CachedAward>(STORES.awards);
export const getCachedAward = (id: string) => getItem<CachedAward>(STORES.awards, id);
export const putCachedAward = (row: CachedAward) => putItem(STORES.awards, row);
export const deleteCachedAward = (id: string) => deleteItem(STORES.awards, id);

// ========== Ceremony Expenses ==========

export type CachedCeremonyExpense = {
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
};

export const cacheCeremonyExpenses = (rows: CachedCeremonyExpense[]) =>
  cacheRecords(STORES.ceremonyExpenses, rows);
export const getCachedCeremonyExpenses = () =>
  getAllItems<CachedCeremonyExpense>(STORES.ceremonyExpenses);
export const getCachedCeremonyExpense = (id: string) =>
  getItem<CachedCeremonyExpense>(STORES.ceremonyExpenses, id);
export const putCachedCeremonyExpense = (row: CachedCeremonyExpense) =>
  putItem(STORES.ceremonyExpenses, row);
export const deleteCachedCeremonyExpense = (id: string) => deleteItem(STORES.ceremonyExpenses, id);

// ========== Certificates ==========

export type CachedCertificate = {
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
};

export const cacheCertificates = (rows: CachedCertificate[]) =>
  cacheRecords(STORES.certificates, rows);
export const getCachedCertificates = () => getAllItems<CachedCertificate>(STORES.certificates);
export const getCachedCertificate = (id: string) =>
  getItem<CachedCertificate>(STORES.certificates, id);
export const putCachedCertificate = (row: CachedCertificate) => putItem(STORES.certificates, row);
export const deleteCachedCertificate = (id: string) => deleteItem(STORES.certificates, id);

// ========== Internal Competitions ==========

export type CachedInternalCompetition = {
  id: string;
  user_id: string;
  student_id: number;
  student_name: string;
  year: string;
  competition_name: string;
  category: string;
  score: number | string;
  rank: string;
  prize: string;
  notes: string | null;
  date?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const cacheInternalCompetitions = (rows: CachedInternalCompetition[]) =>
  cacheRecords(STORES.internalCompetitions, rows);
export const getCachedInternalCompetitions = () =>
  getAllItems<CachedInternalCompetition>(STORES.internalCompetitions);
export const getCachedInternalCompetition = (id: string) =>
  getItem<CachedInternalCompetition>(STORES.internalCompetitions, id);
export const putCachedInternalCompetition = (row: CachedInternalCompetition) =>
  putItem(STORES.internalCompetitions, row);
export const deleteCachedInternalCompetition = (id: string) =>
  deleteItem(STORES.internalCompetitions, id);

// ========== External Competitions ==========

export type CachedExternalCompetition = {
  id: string;
  user_id: string;
  student_id: number;
  student_name: string;
  year: string;
  competition_name: string;
  organizer: string;
  category: string;
  score: number | string;
  rank: string;
  prize: string;
  notes: string | null;
  date?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const cacheExternalCompetitions = (rows: CachedExternalCompetition[]) =>
  cacheRecords(STORES.externalCompetitions, rows);
export const getCachedExternalCompetitions = () =>
  getAllItems<CachedExternalCompetition>(STORES.externalCompetitions);
export const getCachedExternalCompetition = (id: string) =>
  getItem<CachedExternalCompetition>(STORES.externalCompetitions, id);
export const putCachedExternalCompetition = (row: CachedExternalCompetition) =>
  putItem(STORES.externalCompetitions, row);
export const deleteCachedExternalCompetition = (id: string) =>
  deleteItem(STORES.externalCompetitions, id);

// ========== Media Metadata ==========

export type CachedMedia = {
  id: string;
  user_id: string;
  year: string;
  month: number;
  title: string;
  file_path: string;
  file_type: "image" | "video";
  file_size: number;
  created_at?: string;
};

export const cacheMedia = (rows: CachedMedia[]) => cacheRecords(STORES.media, rows);
export const getCachedMedia = () => getAllItems<CachedMedia>(STORES.media);
export const getCachedMediaItem = (id: string) => getItem<CachedMedia>(STORES.media, id);
export const putCachedMedia = (row: CachedMedia) => putItem(STORES.media, row);
export const deleteCachedMedia = (id: string) => deleteItem(STORES.media, id);

// ========== Settings ==========

export const setCachedSetting = async (key: string, value: unknown) => {
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
  const set: capSQLiteSet[] = Object.values(STORES).map((name) => ({
    statement: `DELETE FROM ${name}`,
    values: [],
  }));
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
  | "internal_competition"
  | "external_competition"
  | "media";

export type PendingChange = {
  key: string;
  entity: PendingEntity;
  op: PendingOp;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any;
  ts: number;
};

/**
 * النسخة المستقلة (markz-net) لا تزامن مع أي سحابة، لذا لم يعد هناك
 * "تغييرات معلقة" تُرفع لاحقًا. نبقي الدالة كعملية فارغة حتى تبقى
 * استدعاءاتها في طبقة التخزين غير مؤذية.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const markDirty = (_entity: PendingEntity, _op: PendingOp, _ref: any) => {
  return Promise.resolve();
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
    } else if (
      (p.entity === "internal_competition" || p.entity === "external_competition") &&
      p.ref?.student_id === oldId
    ) {
      p.ref.student_id = newId;
      touched = true;
    }
    if (touched) {
      await deleteItem(STORES.pending, p.key);
      await markDirty(p.entity, p.op, p.ref);
    }
  }
};

/** بيانات عام محدد فقط — لا نحمّل كل صفوف year_data عند فتح صفحة عام واحد. */
export const getCachedYearDataForYear = async (year: string): Promise<CachedYearData[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.yearData} WHERE year = ? ORDER BY student_id`,
    [year],
  );
  return (res.values ?? []).map((row) => fromRow(TABLES[STORES.yearData], row) as CachedYearData);
};

/** الطلاب المسجلون في عام محدد فقط، مع استعلام JOIN محلي سريع (مع عزل بيانات كل مستخدم). */
export const getCachedStudentsForYear = async (
  year: string,
  userId?: string,
): Promise<CachedStudent[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT DISTINCT s.* FROM ${STORES.students} s
     INNER JOIN ${STORES.yearData} y ON y.student_id = s.id
     WHERE y.year = ? ${userId ? "AND s.user_id = ?" : ""} ORDER BY s.name`,
    userId ? [year, userId] : [year],
  );
  return (res.values ?? []).map((row) => fromRow(TABLES[STORES.students], row) as CachedStudent);
};

/** سجل الحفظ للطلاب الظاهرين فقط في العام المختار. */
export const getCachedHifzHistoryForStudents = async (
  studentIds: number[],
): Promise<CachedHifzRow[]> => {
  if (studentIds.length === 0) return [];
  const db = await getDB();
  const placeholders = studentIds.map(() => "?").join(", ");
  const res = await db.query(
    `SELECT * FROM ${STORES.hifzHistory} WHERE student_id IN (${placeholders}) ORDER BY student_id, year_key`,
    studentIds,
  );
  return (res.values ?? []).map((row) => fromRow(TABLES[STORES.hifzHistory], row) as CachedHifzRow);
};

/** بحث بالاسم مباشرة داخل SQLite (مع عزل بيانات كل مستخدم). */
export const searchCachedStudentsByName = async (
  query: string,
  userId?: string,
): Promise<CachedStudent[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.students} WHERE name LIKE ? ${userId ? "AND user_id = ?" : ""} ORDER BY name`,
    userId ? [`%${query}%`, userId] : [`%${query}%`],
  );
  return (res.values ?? []).map((row) => fromRow(TABLES[STORES.students], row) as CachedStudent);
};

/** بيانات الأعوام لعدة طلاب دفعة واحدة. */
export const getCachedYearDataForStudents = async (
  studentIds: number[],
): Promise<CachedYearData[]> => {
  if (studentIds.length === 0) return [];
  const db = await getDB();
  const placeholders = studentIds.map(() => "?").join(", ");
  const res = await db.query(
    `SELECT * FROM ${STORES.yearData} WHERE student_id IN (${placeholders}) ORDER BY student_id, year`,
    studentIds,
  );
  return (res.values ?? []).map((row) => fromRow(TABLES[STORES.yearData], row) as CachedYearData);
};

/** بيانات سنة معيّنة لطالب واحد فقط */
export const getCachedYearDataForStudent = async (studentId: number): Promise<CachedYearData[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.yearData} WHERE student_id = ? ORDER BY year`,
    [studentId],
  );
  return (res.values ?? []) as CachedYearData[];
};

/**
 * فحص سريع: هل يوجد في الكاش طالب واحد على الأقل يخص مستخدماً آخر؟
 *
 * كان ensureCache() يجلب جدول الطلاب كاملاً (getCachedStudents) في كل نداء
 * بيانات فقط ليفحص الملكية — أي تحويل آلاف الصفوف إلى كائنات JS وتحليل JSON
 * لكل صف، عشرات المرات في كل شاشة. هذا الاستعلام يكلّف صفاً واحداً فقط.
 */
export const hasForeignCachedStudents = async (userId: string): Promise<boolean> => {
  const db = await getDB();
  const res = await db.query(`SELECT 1 FROM ${STORES.students} WHERE user_id IS NOT ? LIMIT 1`, [
    userId,
  ]);
  return (res.values?.length ?? 0) > 0;
};

/** هل جدول الطلاب غير فارغ؟ (بدون تحميل أي صف فعلياً). */
export const hasAnyCachedStudent = async (): Promise<boolean> => {
  const db = await getDB();
  const res = await db.query(`SELECT 1 FROM ${STORES.students} LIMIT 1`);
  return (res.values?.length ?? 0) > 0;
};

// ========== المتابعة الشهرية (محلية بالكامل في النسخة المستقلة) ==========

export type CachedMonthlyTracking = {
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
};

export const putMonthlyTracking = (row: CachedMonthlyTracking) =>
  putItem(STORES.monthlyTracking, { ...row });

export const getMonthlyTrackingForMonth = async (
  userId: string,
  year: string,
  month: number,
): Promise<CachedMonthlyTracking[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.monthlyTracking} WHERE user_id = ? AND year = ? AND month = ?`,
    [userId, year, month],
  );
  return (res.values ?? []) as CachedMonthlyTracking[];
};

export const getMonthlyTrackingForStudent = async (
  userId: string,
  year: string,
  studentId: number,
): Promise<CachedMonthlyTracking[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.monthlyTracking} WHERE user_id = ? AND year = ? AND student_id = ? ORDER BY month`,
    [userId, year, studentId],
  );
  return (res.values ?? []) as CachedMonthlyTracking[];
};

export const getLatestMonthlyTrackingPeriod = async (
  userId: string,
): Promise<{ year: string; month: number } | null> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT year, month FROM ${STORES.monthlyTracking} WHERE user_id = ? ORDER BY year DESC, month DESC LIMIT 1`,
    [userId],
  );
  const row = res.values?.[0] as { year: string; month: number } | undefined;
  return row ? { year: row.year, month: row.month } : null;
};

export const deleteMonthlyTrackingForYear = async (userId: string, year: string) => {
  const db = await getDB();
  await db.run(
    `DELETE FROM ${STORES.monthlyTracking} WHERE user_id = ? AND year = ?`,
    [userId, year],
    true,
  );
  await persist();
};

export const deleteMonthlyTrackingForStudentYear = async (
  userId: string,
  year: string,
  studentId: number,
) => {
  const db = await getDB();
  await db.run(
    `DELETE FROM ${STORES.monthlyTracking} WHERE user_id = ? AND year = ? AND student_id = ?`,
    [userId, year, studentId],
    true,
  );
  await persist();
};

// ========== روابط بوابة المعلمين والمعلمات ==========

export type CachedTeacherPortal = {
  id: string;
  user_id: string;
  teacher_name: string;
  code: string;
  year: string;
  month: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export const putTeacherPortal = (row: CachedTeacherPortal) => putItem(STORES.teacherPortals, row);
export const getTeacherPortals = async (userId: string): Promise<CachedTeacherPortal[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.teacherPortals} WHERE user_id = ? ORDER BY year, month`,
    [userId],
  );
  return (res.values ?? []).map(
    (row) => fromRow(TABLES[STORES.teacherPortals], row) as CachedTeacherPortal,
  );
};
export const getTeacherPortalByCode = async (code: string): Promise<CachedTeacherPortal | null> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM ${STORES.teacherPortals} WHERE code = ? LIMIT 1`, [
    code,
  ]);
  const row = res.values?.[0];
  return row ? (fromRow(TABLES[STORES.teacherPortals], row) as CachedTeacherPortal) : null;
};
export const deleteTeacherPortal = (id: string) => deleteItem(STORES.teacherPortals, id);

// ========== وارد المعلمين والمعلمات (الترسيلات) ==========

export type CachedSubmission = {
  id: string;
  user_id: string;
  portal_id: string | null;
  code: string | null;
  student_id: number;
  student_name: string;
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
  notes: string | null;
  status: string;
  source: string;
  teacher_name: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const putSubmission = (row: CachedSubmission) => putItem(STORES.submissions, row);

export const getSubmissions = async (
  userId: string,
  filters?: { year?: string; month?: number; status?: string },
): Promise<CachedSubmission[]> => {
  const db = await getDB();
  const conditions = ["user_id = ?"];
  const params: Array<string | number> = [userId];
  if (filters?.year) {
    conditions.push("year = ?");
    params.push(filters.year);
  }
  if (filters?.month) {
    conditions.push("month = ?");
    params.push(filters.month);
  }
  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  const res = await db.query(
    `SELECT * FROM ${STORES.submissions} WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
    params,
  );
  return (res.values ?? []) as CachedSubmission[];
};

export const getSubmissionByPortalAndStudent = async (
  portalId: string,
  studentId: number,
): Promise<CachedSubmission | null> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.submissions} WHERE portal_id = ? AND student_id = ? LIMIT 1`,
    [portalId, studentId],
  );
  return (res.values?.[0] as CachedSubmission | undefined) ?? null;
};

export const getManualSubmission = async (
  userId: string,
  studentId: number,
  year: string,
  month: number,
): Promise<CachedSubmission | null> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.submissions}
     WHERE user_id = ? AND student_id = ? AND year = ? AND month = ? AND portal_id IS NULL
     LIMIT 1`,
    [userId, studentId, year, month],
  );
  return (res.values?.[0] as CachedSubmission | undefined) ?? null;
};

export const deleteSubmission = (id: string) => deleteItem(STORES.submissions, id);

/** حذف كل بيانات مستخدم معين من كل جداول البيانات (وليس جداول الحسابات). */
export const deleteAllRowsForUser = async (userId: string) => {
  const db = await getDB();
  // الطلاب أولاً (لأخذ معرفاتهم قبل الحذف) ثم الجداول المرتبطة بهم.
  const studentsRes = await db.query(`SELECT id FROM ${STORES.students} WHERE user_id = ?`, [
    userId,
  ]);
  const studentIds = (studentsRes.values ?? []).map((r) => Number((r as { id: number }).id));

  const set: capSQLiteSet[] = [];
  const push = (statement: string, values: Array<string | number> = []) =>
    set.push({ statement, values });

  push(`DELETE FROM ${STORES.submissions} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.teacherPortals} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.monthlyTracking} WHERE user_id = ?`, [userId]);

  if (studentIds.length > 0) {
    const inList = studentIds.map(() => "?").join(", ");
    push(`DELETE FROM ${STORES.yearData} WHERE student_id IN (${inList})`, studentIds);
    push(`DELETE FROM ${STORES.hifzHistory} WHERE student_id IN (${inList})`, studentIds);
    push(`DELETE FROM ${STORES.internalCompetitions} WHERE student_id IN (${inList})`, studentIds);
    push(`DELETE FROM ${STORES.externalCompetitions} WHERE student_id IN (${inList})`, studentIds);
    push(`DELETE FROM ${STORES.submissions} WHERE student_id IN (${inList})`, studentIds);
  }

  push(`DELETE FROM ${STORES.students} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.teachers} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.teacherBonuses} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.donors} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.awards} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.ceremonyExpenses} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.certificates} WHERE user_id = ?`, [userId]);
  push(`DELETE FROM ${STORES.media} WHERE user_id = ?`, [userId]);

  // إعدادات المستخدم (مفاتيح مقيدة بالمعرف) — تبقى إعدادات غيره كما هي.
  push(`DELETE FROM ${STORES.settings} WHERE key LIKE ?`, [`${userId}:%`]);
  push(`DELETE FROM ${STORES.pending}`);

  await db.executeSet(set, true);
  await persist();
};
