/**
 * طبقة التخزين المحلي — تعمل فوق قاعدة بيانات SQLite حقيقية
 * (عبر @capacitor-community/sqlite: محرك SQLite أصلي على أندرويد/iOS، ومحرك
 * sql.js/WASM على المتصفح).
 */

import type { capSQLiteSet } from "@capacitor-community/sqlite";
import {
  getDB,
  persist,
  LOCAL_AUDITED_TABLES,
  countTableRows,
  listTableColumns,
} from "./sqliteClient";
import type { CommunityRecordRow } from "@/lib/community-records";
import type { ExamQuestionRow } from "@/lib/exam-questions";

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
  mediaFiles: "media_files",
  monthly: "monthly_tracking",
  communityRecords: "community_records",
  examQuestions: "exam_questions",
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
  [STORES.mediaFiles]: { columns: ["id", "mime_type", "data"], pk: ["id"] },
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
  [STORES.monthly]: {
    columns: [
      "id",
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
      "created_at",
      "updated_at",
    ],
    pk: ["student_id", "year", "month"],
  },
  [STORES.communityRecords]: {
    columns: [
      "id",
      "user_id",
      "department",
      "program_id",
      "beneficiary_name",
      "beneficiary_type",
      "phone",
      "guardian_name",
      "address",
      "service_date",
      "status",
      "group_name",
      "sponsor_name",
      "amount",
      "currency",
      "quantity",
      "notes",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
  },
  [STORES.examQuestions]: {
    columns: [
      "id",
      "user_id",
      "year",
      "category",
      "subject",
      "question_type",
      "question",
      "choices",
      "correct_answer",
      "difficulty",
      "notes",
      "created_at",
      "updated_at",
    ],
    pk: ["id"],
    // `choices` مصفوفة في الكائن ونصّ JSON في SQLite (jsonb في السحابة).
    toRow: (item) => ({
      ...item,
      choices:
        item.choices === null || item.choices === undefined
          ? null
          : typeof item.choices === "string"
            ? item.choices
            : JSON.stringify(item.choices ?? []),
    }),
    fromRow: (row) => {
      let choices: string[] = [];
      if (typeof row.choices === "string" && row.choices) {
        try {
          const parsed = JSON.parse(row.choices);
          if (Array.isArray(parsed)) choices = parsed.filter((c) => typeof c === "string");
        } catch {
          choices = [];
        }
      } else if (Array.isArray(row.choices)) {
        choices = row.choices.filter((c: unknown) => typeof c === "string");
      }
      return { ...row, choices };
    },
  },
};

/**
 * أعمدة `local_updated_at` تُضاف برمجياً لكل جداول البيانات (نفس القائمة التي
 * تُرحَّل بـ ALTER TABLE في sqliteClient) حتى لا تُكرَّر يدوياً في كل تعريف.
 */
for (const tableName of LOCAL_AUDITED_TABLES) {
  const cfg = TABLES[tableName];
  if (cfg && !cfg.columns.includes("local_updated_at")) cfg.columns.push("local_updated_at");
}

const getTable = (storeName: string): TableConfig => {
  const cfg = TABLES[storeName];
  if (!cfg) throw new Error(`localDB: جدول غير معروف "${storeName}"`);
  return cfg;
};

const toRow = (cfg: TableConfig, item: Row): Row => {
  const raw = cfg.toRow ? cfg.toRow(item) : item;
  const row: Row = {};
  for (const col of cfg.columns) {
    let value = raw[col] ?? null;
    if (col === "local_updated_at" && (value === null || value === "")) {
      // عند الكتابة المحلية: الآن. عند التنزيل من السحابة: تاريخ السحابة نفسه.
      value = typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString();
    }
    row[col] = value;
  }
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

// ========== سجل المجتمع (community_records) ==========

export type CachedCommunityRecord = CommunityRecordRow;

export const cacheCommunityRecords = (rows: CachedCommunityRecord[]) =>
  cacheRecords(STORES.communityRecords, rows);
export const getCachedCommunityRecords = () =>
  getAllItems<CachedCommunityRecord>(STORES.communityRecords);
export const getCachedCommunityRecord = (id: string) =>
  getItem<CachedCommunityRecord>(STORES.communityRecords, id);
export const putCachedCommunityRecord = (row: CachedCommunityRecord) =>
  putItem(STORES.communityRecords, row);
export const deleteCachedCommunityRecord = (id: string) => deleteItem(STORES.communityRecords, id);

/** سجلات قسم واحد لمالك واحد — استعلام محلي مفهرس. */
export const getCachedCommunityRecordsForDepartment = async (
  userId: string,
  department: string,
): Promise<CachedCommunityRecord[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.communityRecords} WHERE user_id = ? AND department = ?`,
    [userId, department],
  );
  return (res.values ?? []).map(
    (row) => fromRow(TABLES[STORES.communityRecords], row) as CachedCommunityRecord,
  );
};

// ========== بنك الأسئلة (exam_questions) ==========

export type CachedExamQuestion = ExamQuestionRow;

export const cacheExamQuestions = (rows: CachedExamQuestion[]) =>
  cacheRecords(STORES.examQuestions, rows);
export const getCachedExamQuestions = () => getAllItems<CachedExamQuestion>(STORES.examQuestions);
export const getCachedExamQuestion = (id: string) =>
  getItem<CachedExamQuestion>(STORES.examQuestions, id);
export const putCachedExamQuestion = (row: CachedExamQuestion) =>
  putItem(STORES.examQuestions, row);
export const deleteCachedExamQuestion = (id: string) => deleteItem(STORES.examQuestions, id);

/** أسئلة عام واحد لمالك واحد — استعلام محلي مفهرس. */
export const getCachedExamQuestionsForYear = async (
  userId: string,
  year: string,
): Promise<CachedExamQuestion[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.examQuestions} WHERE user_id = ? AND year = ?`,
    [userId, year],
  );
  return (res.values ?? []).map(
    (row) => fromRow(TABLES[STORES.examQuestions], row) as CachedExamQuestion,
  );
};

/**
 * تحديث **محصور بنطاق واحد** (مالك + قسم، أو مالك + عام) — جوهر التنزيل
 * المحلي في المرحلة 5.
 *
 * لماذا لا `cacheRecords` (الاستبدال الكامل)؟
 *  - الاستبدال الكامل يمسح الصفوف التي أُنشئت محلياً ولم تُرفع بعد (بيانات
 *    بلا إنترنت). هذا التحديث يحميها: أي معرّف في `protectedIds` لا يُحذف ولا
 *    يُستبدل، مهما كان في السحابة.
 *  - ويمسح ما حُذف في السحابة داخل النطاق نفسه فقط، فلا تتأثر بقية الأقسام.
 *
 * @returns عدد الصفوف المكتوبة والمحذوفة والمحمية (للتشخيص والاختبارات).
 */
export const replaceScopedRows = async <T extends Row & { id: string }>(
  storeName: string,
  scope: Record<string, unknown>,
  rows: T[],
  protectedIds: Set<string> = new Set(),
): Promise<{ written: number; deleted: number; kept: number }> => {
  const cfg = getTable(storeName);
  const db = await getDB();
  const scopeColumns = Object.keys(scope);
  if (scopeColumns.length === 0) throw new Error("replaceScopedRows: نطاق فارغ");
  for (const column of scopeColumns) {
    if (!cfg.columns.includes(column))
      throw new Error(`replaceScopedRows: عمود نطاق غير معروف "${column}"`);
  }
  const scopeWhere = scopeColumns.map((column) => `${column} = ?`).join(" AND ");
  const scopeValues = scopeColumns.map((column) => scope[column]);

  const incoming = rows.filter((row) => !protectedIds.has(row.id));
  const skipped = rows.length - incoming.length;
  const incomingIds = incoming.map((row) => row.id);
  const protectedList = [...protectedIds];

  /** شرط «ليس ضمن قائمة» — يُحذف الشرط تماماً عند فراغ القائمة (SQLite). */
  const notIn = (column: string, ids: (string | number)[]) =>
    ids.length ? ` AND ${column} NOT IN (${ids.map(() => "?").join(", ")})` : "";

  const deleteSql = `DELETE FROM ${storeName} WHERE ${scopeWhere}${notIn(
    "id",
    incomingIds,
  )}${notIn("id", protectedList)}`;
  const deleteValues = [...scopeValues, ...incomingIds, ...protectedList];

  const countRes = await db.query(
    `SELECT COUNT(*) AS n FROM ${storeName} WHERE ${scopeWhere}${notIn(
      "id",
      incomingIds,
    )}${notIn("id", protectedList)}`,
    deleteValues,
  );
  const deleted = Number(countRes.values?.[0]?.n ?? 0);

  const placeholders = cfg.columns.map(() => "?").join(", ");
  const insertSql = `INSERT OR REPLACE INTO ${storeName} (${cfg.columns.join(
    ", ",
  )}) VALUES (${placeholders})`;

  await db.beginTransaction();
  try {
    await db.run(deleteSql, deleteValues, false);
    for (const item of incoming) {
      const row = toRow(cfg, item);
      await db.run(
        insertSql,
        cfg.columns.map((column) => row[column]),
        false,
      );
    }
    await db.commitTransaction();
  } catch (err) {
    await db.rollbackTransaction().catch(() => undefined);
    throw err;
  }
  await persist();

  const keptRes = await db.query(
    `SELECT COUNT(*) AS n FROM ${storeName} WHERE ${scopeWhere}${
      protectedList.length ? ` AND id IN (${protectedList.map(() => "?").join(", ")})` : ""
    }`,
    [...scopeValues, ...protectedList],
  );

  return {
    written: incoming.length,
    deleted,
    kept: skipped + Number(keptRes.values?.[0]?.n ?? 0),
  };
};

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

/** طابع زمني عام في جدول meta (آخر ترحيل شامل، آخر نسخة احتياطية…). */
export const setMetaTime = async (key: string, time = Date.now()) => {
  await putItem(STORES.meta, { key, time });
};

export const getMetaTime = async (key: string): Promise<number | null> => {
  const item = await getItem<{ key: string; time: number }>(STORES.meta, key);
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
  | "media"
  | "monthly"
  | "community_record"
  | "exam_question";

export type PendingChange = {
  key: string;
  entity: PendingEntity;
  op: PendingOp;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any;
  ts: number;
};

/**
 * ref هي بيانات مرجعية متباينة الشكل حسب الكيان (id / student_id / year...)
 * فلا يمكن نمذجتها بنوع واحد دون casts في كل موقع استخدام.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  else if (entity === "internal_competition") key = `internal_comp:${ref.id}`;
  else if (entity === "external_competition") key = `external_comp:${ref.id}`;
  else if (entity === "media") key = `media:${ref.id}`;
  else if (entity === "monthly") key = `monthly:${ref.student_id}|${ref.year}|${ref.month}`;
  else if (entity === "community_record") key = `community:${ref.id}`;
  else if (entity === "exam_question") key = `exam:${ref.id}`;
  return putItem(STORES.pending, { key, entity, op, ref, ts: Date.now() });
};

export const getPendingChanges = () => getAllItems<PendingChange>(STORES.pending);

export const clearPending = async (key: string, expected?: PendingChange) => {
  if (!expected) return deleteItem(STORES.pending, key);
  // A delete/edit can replace the same key while a network request is in flight.
  const db = await getDB();
  await db.run(
    "DELETE FROM pending_changes WHERE key = ? AND ts = ? AND op = ? AND ref = ?",
    [key, expected.ts, expected.op, JSON.stringify(expected.ref)],
    true,
  );
  await persist();
};

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
      (p.entity === "internal_competition" ||
        p.entity === "external_competition" ||
        p.entity === "monthly") &&
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

/** الطلاب المسجلون في عام محدد فقط، مع استعلام JOIN محلي سريع. */
export const getCachedStudentsForYear = async (year: string): Promise<CachedStudent[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT DISTINCT s.* FROM ${STORES.students} s
     INNER JOIN ${STORES.yearData} y ON y.student_id = s.id
     WHERE y.year = ? ORDER BY s.name`,
    [year],
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

/** بحث بالاسم مباشرة داخل SQLite */
export const searchCachedStudentsByName = async (query: string): Promise<CachedStudent[]> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM ${STORES.students} WHERE name LIKE ? ORDER BY name`, [
    `%${query}%`,
  ]);
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

// ========== المتابعة الشهرية (monthly_tracking) ==========

export type CachedMonthly = {
  id: string;
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
  created_at?: string | null;
  updated_at?: string | null;
  local_updated_at?: string | null;
};

/** استبدال كامل لجدول المتابعة (يُستعمل عند التنزيل من السحابة). */
export const cacheMonthlyTracking = (rows: CachedMonthly[]) => cacheRecords(STORES.monthly, rows);

export const getCachedMonthlyTracking = () => getAllItems<CachedMonthly>(STORES.monthly);

export const putCachedMonthly = (row: CachedMonthly) => putItem(STORES.monthly, row);

export const getCachedMonthlyItem = (studentId: number, year: string, month: number) =>
  getItem<CachedMonthly>(STORES.monthly, [studentId, year, month]);

export const deleteCachedMonthly = (studentId: number, year: string, month: number) =>
  deleteItem(STORES.monthly, [studentId, year, month]);

/** متابعة شهر معيّن لكل الطلاب — استعلام محلي مفهرس. */
export const getCachedMonthlyForPeriod = async (
  year: string,
  month: number,
): Promise<CachedMonthly[]> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM ${STORES.monthly} WHERE year = ? AND month = ? ORDER BY student_id`,
    [year, month],
  );
  return (res.values ?? []).map((row) => fromRow(TABLES[STORES.monthly], row) as CachedMonthly);
};

/** متابعة طالب واحد (كل الأشهر أو عام محدد). */
export const getCachedMonthlyForStudent = async (
  studentId: number,
  year?: string,
): Promise<CachedMonthly[]> => {
  const db = await getDB();
  const res = year
    ? await db.query(
        `SELECT * FROM ${STORES.monthly} WHERE student_id = ? AND year = ? ORDER BY month`,
        [studentId, year],
      )
    : await db.query(`SELECT * FROM ${STORES.monthly} WHERE student_id = ? ORDER BY year, month`, [
        studentId,
      ]);
  return (res.values ?? []).map((row) => fromRow(TABLES[STORES.monthly], row) as CachedMonthly);
};

/** أحدث فترة متابعة مسجّلة محلياً (لصفحة المتابعة والتنبيهات). */
export const getLatestCachedMonthlyPeriod = async (): Promise<{
  year: string;
  month: number;
} | null> => {
  const db = await getDB();
  const res = await db.query(
    `SELECT year, month FROM ${STORES.monthly} ORDER BY year DESC, month DESC LIMIT 1`,
  );
  const row = res.values?.[0];
  if (!row) return null;
  return { year: String(row.year), month: Number(row.month) };
};

/** حذف كل متابعة طالب (عند حذف الطالب نهائياً). */
export const deleteCachedMonthlyForStudent = async (studentId: number) => {
  const db = await getDB();
  await db.run(`DELETE FROM ${STORES.monthly} WHERE student_id = ?`, [studentId], true);
  await persist();
};

// ========== أدوات اللقطة والنسخ الاحتياطي والترحيل الشامل ==========

/**
 * جداول البيانات التي تدخل في اللقطة/الترحيل.
 * `settings` و`meta` و`pending_changes` تُضمَّن في اللقطة (لأنها تحمل حالة
 * الجهاز وطابور الحذف) لكنها لا تُرفع إلى السحابة كصفوف.
 */
export const SNAPSHOT_TABLES: string[] = [
  "students",
  "hifz_history",
  "year_data",
  "monthly_tracking",
  "teachers",
  "teacher_bonuses",
  "donors",
  "awards",
  "ceremony_expenses",
  "certificates",
  "internal_competitions",
  "external_competitions",
  "media",
  "community_records",
  "exam_questions",
];

/** الجداول الإدارية المحلية (لا تُرحَّل إلى السحابة كصفوف). */
export const SNAPSHOT_INTERNAL_TABLES: string[] = [
  "settings",
  "meta",
  "pending_changes",
  "media_files",
];

/** عدد صفوف كل جدول محلي — للمعاينة قبل الترحيل أو الاستعادة. */
export const getLocalRowCounts = async (
  tables: string[] = [...SNAPSHOT_TABLES, ...SNAPSHOT_INTERNAL_TABLES],
): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const table of tables) counts[table] = await countTableRows(table);
  return counts;
};

/** قراءة كل صفوف جدول ككائنات JSON (للقطة). */
export const getTableRows = async <T = Row>(storeName: string): Promise<T[]> => {
  getTable(storeName);
  const db = await getDB();
  const res = await db.query(`SELECT * FROM ${storeName}`);
  return (res.values ?? []) as T[];
};

/** كتابة صفوف جدول دفعة واحدة (استبدال كامل) — للاستعادة من لقطة. */
export const replaceTableRows = async <T extends Row>(storeName: string, rows: T[]) =>
  cacheRecords(storeName, rows);

/**
 * إعادة نسب كل صفوف جدول من مالك إلى آخر (ربط «وضع الجهاز» بحساب سحابي).
 * يُرجع عدد الصفوف التي تغيّرت.
 */
export const reassignTableOwner = async (
  storeName: string,
  fromUserId: string,
  toUserId: string,
): Promise<number> => {
  getTable(storeName);
  if (fromUserId === toUserId) return 0;

  // جدولان محليان (hifz_history و year_data) لا يحملان user_id — ارتباطهما
  // بالسحابة يمرّ عبر student_id، فلا شيء يُعاد نسبه فيهما.
  const columns = await listTableColumns(storeName);
  if (!columns.includes("user_id")) return 0;

  const db = await getDB();
  const setClause = columns.includes("local_updated_at")
    ? "user_id = ?, local_updated_at = ?"
    : "user_id = ?";
  const values = columns.includes("local_updated_at")
    ? [toUserId, new Date().toISOString(), fromUserId]
    : [toUserId, fromUserId];
  const result = await db.run(
    `UPDATE ${storeName} SET ${setClause} WHERE user_id = ?`,
    values,
    true,
  );
  await persist();
  return Number(result.changes?.changes ?? 0);
};

/** مفتاح أساسي لجدول (يُستعمل في دمج اللقطات). */
export const getTablePk = (storeName: string): string[] => getTable(storeName).pk;

/**
 * أعمدة جدول محلي — يُستعمل في «اختبار انحراف الأعمدة»: أي عمود سحابي جديد
 * لا يقابله عمود محلي يعني فقدان بيانات صامت عند الترحيل.
 */
export const getTableColumns = (storeName: string): string[] => [...getTable(storeName).columns];

/** هل الجدول معروفاً في الطبقة المحلية؟ */
export const isKnownTable = (storeName: string): boolean => Boolean(TABLES[storeName]);

/**
 * إعادة ترقيم طالب أُنشئ بدون نت (معرّف مؤقت) بعد حصوله على معرّف السحابة.
 * تُحدَّث كل الجداول المرتبطة به في عملية واحدة، ثم طابور التغييرات.
 */
export const remapLocalStudentId = async (oldId: number, newId: number): Promise<void> => {
  if (oldId === newId) return;
  const db = await getDB();
  const stamped = new Date().toISOString();
  const statements: { sql: string; values: Array<string | number> }[] = [
    {
      sql: `UPDATE students SET id = ?, local_updated_at = ? WHERE id = ?`,
      values: [newId, stamped, oldId],
    },
    { sql: `UPDATE hifz_history SET student_id = ? WHERE student_id = ?`, values: [newId, oldId] },
    { sql: `UPDATE year_data SET student_id = ? WHERE student_id = ?`, values: [newId, oldId] },
    {
      sql: `UPDATE monthly_tracking SET student_id = ? WHERE student_id = ?`,
      values: [newId, oldId],
    },
    {
      sql: `UPDATE internal_competitions SET student_id = ? WHERE student_id = ?`,
      values: [newId, oldId],
    },
    {
      sql: `UPDATE external_competitions SET student_id = ? WHERE student_id = ?`,
      values: [newId, oldId],
    },
  ];
  await db.beginTransaction();
  try {
    for (const { sql, values } of statements) await db.run(sql, values, false);
    await db.commitTransaction();
  } catch (err) {
    await db.rollbackTransaction().catch(() => undefined);
    throw err;
  }
  await persist();
  await remapPendingStudentId(oldId, newId);
};

/** عدد الصفوف المحلية المنسوبة لمالك معيّن (يُستعمل لاكتشاف بيانات وضع الجهاز). */
export const countRowsOwnedBy = async (userId: string): Promise<number> => {
  const db = await getDB();
  let total = 0;
  for (const table of SNAPSHOT_TABLES) {
    const columns = await listTableColumns(table);
    if (!columns.includes("user_id")) continue;
    const res = await db.query(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`, [userId]);
    total += Number(res.values?.[0]?.n ?? 0);
  }
  return total;
};
