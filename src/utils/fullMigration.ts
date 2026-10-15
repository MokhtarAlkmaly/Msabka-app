/**
 * الترحيل الشامل: رفع **كل** ما في قاعدة الجهاز المحلية إلى Supabase دفعة
 * واحدة — الزر الذي يضغطه المستخدم عندما يتوفر الإنترنت.
 *
 * لماذا هذا الملف منفصل عن `syncToCloud()` الموجود؟
 *  - `syncToCloud()` يرفع **طابور التغييرات المعلّقة** فقط (مزامنة تدريجية).
 *  - الترحيل الشامل يرفع كل الصفوف المحلية حتى لو لم تُعلَّم في الطابور:
 *    بيانات مستوردة من نسخة احتياطية، أو جهاز عمل بلا نت فترة طويلة، أو
 *    «وضع الجهاز» الذي رُبط بحساب للتو.
 *
 * ترتيب العمل (مهم):
 *  1) نسخة أمان تلقائية في مجلد النسخ (شبكة أمان قبل أي كتابة سحابية).
 *  2) تفريغ طابور التغييرات بالمنطق المُختبَر الموجود (`syncToCloud`).
 *  3) إدخال الطلاب ذوي المعرفات المؤقتة وأخذ معرفاتهم الحقيقية وإعادة ترقيم
 *     كل الجداول المرتبطة بها محلياً.
 *  4) رفع بقية الجداول على دفعات (500 صف) حسب سياسة التعارض المختارة.
 *  5) تنفيذ عمليات الحذف المعلّقة في السحابة.
 *  6) رفع إعدادات المستخدم (العام النشط، الأعمدة المخصصة، الحالات، المرشحات).
 *  7) تقرير عربي نهائي بعدد ما رُفع/تُخِط/فشل لكل جدول.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  buildCloudPayload,
  chunkRows,
  emptyTableResult,
  explainCloudError,
  finishMigrationReport,
  isTempStudentId,
  newMigrationReport,
  orderedMigrationTables,
  partitionStudentsByTempId,
  previewMigration,
  pushTableError,
  shouldPushRow,
  summarizeReport,
  type ConflictStrategy,
  type MigrationReport,
  type MigrationTableSpec,
  type TableMigrationResult,
  type CloudTransformMap,
} from "@/lib/migration-plan";
import { DEVICE_OWNER_ID } from "@/lib/offline-auth";
import {
  clearAllPending,
  clearPending,
  getCachedSetting,
  getCachedStudents,
  getLocalRowCounts,
  getPendingChanges,
  getTableRows,
  remapLocalStudentId,
  setLastSyncTime,
  SNAPSHOT_TABLES,
  type PendingChange,
} from "./localDB";
import { createSafetySnapshot } from "./dbBackup";
import { recordMigrationTime } from "./syncStatus";
import { getUserId, syncToCloud } from "./storage";
import { isViewingOtherUser } from "./viewAs";

// ============================================================
// أعمدة السحابة (حتى لا نرفع عموداً محلياً لا وجود له في Supabase)
// ============================================================

/** أعمدة محلية لأغراض التدقيق فقط — لا تُرفع أبداً. */
const LOCAL_ONLY_COLUMNS = ["local_updated_at"];

const CLOUD_COLUMNS: Record<string, string[]> = {
  students: [
    "id",
    "user_id",
    "name",
    "teacher",
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
    "updated_at",
  ],
  hifz_history: ["id", "user_id", "student_id", "year_key", "value"],
  year_data: [
    "id",
    "user_id",
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
    "updated_at",
  ],
  monthly_tracking: [
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
    "updated_at",
  ],
  teachers: ["id", "user_id", "year", "name", "updated_at"],
  teacher_bonuses: ["id", "user_id", "teacher_name", "year", "month", "amount", "updated_at"],
  donors: [
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
    "updated_at",
  ],
  awards: [
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
    "updated_at",
  ],
  ceremony_expenses: [
    "id",
    "user_id",
    "year",
    "category",
    "description",
    "amount",
    "spent_at",
    "funded_by",
    "notes",
    "updated_at",
  ],
  certificates: [
    "id",
    "user_id",
    "year",
    "recipient_type",
    "recipient_name",
    "cert_type",
    "title",
    "notes",
    "issued_at",
    "updated_at",
  ],
  internal_competitions: [
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
    "updated_at",
  ],
  external_competitions: [
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
    "updated_at",
  ],
  media: ["id", "user_id", "year", "month", "title", "file_path", "file_type", "file_size"],
  // المرحلة 5: سجل المجتمع (UUID محلي، بلا مطابقة معرّفات)
  community_records: [
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
    "updated_at",
  ],
  // المرحلة 5: بنك الأسئلة (`choices` نصّ JSON محلياً ← مصفوفة jsonb سحابياً)
  exam_questions: [
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
    "updated_at",
  ],
};

/**
 * تحويلات الأعمدة قبل الرفع (المرحلة 5).
 *
 * `exam_questions.choices` مخزَّن كنصّ JSON في SQLite (لأن SQLite لا يعرف
 * jsonb) بينما العمود السحابي `jsonb`. بدون هذا التحويل يُرفع النصّ كسلسلة
 * نصية فيرفضه Postgres (`22P02`) أو يُخزَّنه كقيمة نصية داخل jsonb.
 */
export const CLOUD_TRANSFORMS: CloudTransformMap = {
  exam_questions: {
    choices: (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value !== "string" || !value.trim()) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
  },
};

/** مفاتيح الإعدادات المحلية المطابقة لأعمدة `user_settings` في السحابة. */
const SETTINGS_COLUMNS = [
  "active_year",
  "student_custom_columns",
  "student_statuses",
  "table_filters",
] as const;

// ============================================================
// عميل سحابي ديناميكي (أسماء الجداول متغيّرة هنا)
// ============================================================

type CloudError = { code?: string; message?: string; details?: string; hint?: string } | null;
type CloudRow = Record<string, unknown>;
type CloudResult<T> = { data: T | null; error: CloudError };

type CloudBuilder = {
  eq: (column: string, value: unknown) => CloudBuilder;
  select: (columns?: string) => CloudBuilder;
  range: (from: number, to: number) => CloudBuilder;
  single: () => Promise<CloudResult<CloudRow>>;
  upsert: (rows: CloudRow[], options?: { onConflict: string }) => Promise<CloudResult<unknown>>;
  insert: (row: CloudRow) => CloudBuilder;
  delete: () => CloudBuilder;
  then: <TResult = CloudResult<CloudRow[]>>(
    onfulfilled?: ((value: CloudResult<CloudRow[]>) => TResult) | null,
    onrejected?: (reason: unknown) => never,
  ) => Promise<TResult>;
};

const cloud = (table: string): CloudBuilder =>
  (supabase as unknown as { from: (name: string) => CloudBuilder }).from(table);

const pkKey = (row: CloudRow, pk: string[]) => pk.map((col) => String(row[col] ?? "")).join("|");

const toCloudRow = (table: string, row: CloudRow, ownerId: string): CloudRow =>
  buildCloudPayload(
    row,
    ownerId,
    CLOUD_COLUMNS[table] ?? null,
    LOCAL_ONLY_COLUMNS,
    CLOUD_TRANSFORMS[table] ?? {},
  );

const isOnlineNow = () => typeof navigator !== "undefined" && navigator.onLine;

// ============================================================
// الفحص المسبق
// ============================================================

export type MigrationReadiness =
  | { ok: true; ownerId: string }
  | { ok: false; reason: string; needsLogin?: boolean; needsLink?: boolean };

/**
 * هل يمكن تنفيذ الترحيل الشامل الآن؟
 * يشترط: اتصالاً، وحساباً سحابياً حقيقياً (ليس «وضع الجهاز»)، وجلسة صالحة
 * (رمز غير منتهي — لأن سياسات RLS ترفض أي كتابة برمز منتهي).
 */
export const canRunFullMigration = async (): Promise<MigrationReadiness> => {
  if (!isOnlineNow()) {
    return {
      ok: false,
      reason:
        "لا يوجد اتصال بالإنترنت الآن. البيانات محفوظة على الجهاز وستُرحَّل عند توفر الاتصال.",
    };
  }
  if (isViewingOtherUser()) {
    return { ok: false, reason: "أنت في وضع الاطلاع على بيانات مستخدم آخر — الترحيل غير مسموح." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const localOwnerId = await getUserId();
  const ownerId = session?.user?.id ?? null;

  if (!ownerId) {
    if (localOwnerId === DEVICE_OWNER_ID) {
      return {
        ok: false,
        needsLink: true,
        reason:
          "جهازك يعمل في «وضع الجهاز» (بلا حساب). سجّل الدخول بحسابك ثم اضغط «اربط هذا الجهاز بحسابي» ليُنسب كل ما فيه إليك قبل الترحيل.",
      };
    }
    return {
      ok: false,
      needsLogin: true,
      reason:
        "يلزم تسجيل الدخول بحساب سحابي لترحيل البيانات (سياسات الحماية في السحابة ترفض الكتابة بلا حساب).",
    };
  }

  // تأكيد أن الرمز صالح فعلاً للكتابة، لا مجرد جلسة محفوظة منتهية.
  const { error } = await supabase.auth.getUser();
  if (error) {
    return {
      ok: false,
      needsLogin: true,
      reason: "انتهت صلاحية الجلسة — أعد تسجيل الدخول ثم أعد محاولة الترحيل.",
    };
  }

  return { ok: true, ownerId };
};

// ============================================================
// المعاينة
// ============================================================

export type MigrationPreview = {
  tables: { table: string; label: string; count: number }[];
  total: number;
  pendingDeletes: number;
  pendingCount: number;
  tempStudents: number;
  settingsKeys: string[];
  counts: Record<string, number>;
};

/** ماذا سيُرفع؟ (بدون أي كتابة — لعرضه للمستخدم قبل التأكيد.) */
export const previewFullMigration = async (): Promise<MigrationPreview> => {
  const counts = await getLocalRowCounts(SNAPSHOT_TABLES);
  const pending = await getPendingChanges();
  const students = await getCachedStudents();
  const settingsKeys: string[] = [];
  for (const key of SETTINGS_COLUMNS) {
    const value = await getCachedSetting(key);
    if (value !== undefined && value !== null) settingsKeys.push(key);
  }

  const base = previewMigration(counts, pending.filter((change) => change.op === "delete").length);

  return {
    ...base,
    pendingCount: pending.length,
    tempStudents: students.filter((student) => isTempStudentId(student.id)).length,
    settingsKeys,
    counts,
  };
};

// ============================================================
// التنفيذ
// ============================================================

export type ProgressCb = (current: number, total: number, label?: string) => void;

export type FullMigrationOptions = {
  strategy?: ConflictStrategy;
  onProgress?: ProgressCb;
  /** أخذ نسخة أمان في مجلد النسخ قبل البدء (افتراضياً: نعم). */
  safetyBackup?: boolean;
};

export type FullMigrationOutcome = {
  ok: boolean;
  report: MigrationReport | null;
  summary: string;
  backupFileName: string | null;
  error?: string;
};

let migrationInFlight: Promise<FullMigrationOutcome> | null = null;

/** ينفّذ الترحيل الشامل (مرة واحدة في كل لحظة — أي نداء متزامن ينتظر نفسه). */
export const runFullMigration = async (
  options: FullMigrationOptions = {},
): Promise<FullMigrationOutcome> => {
  if (migrationInFlight) return migrationInFlight;
  migrationInFlight = executeFullMigration(options).finally(() => {
    migrationInFlight = null;
  });
  return migrationInFlight;
};

const executeFullMigration = async (
  options: FullMigrationOptions,
): Promise<FullMigrationOutcome> => {
  const readiness = await canRunFullMigration();
  if (!readiness.ok) {
    return {
      ok: false,
      report: null,
      summary: readiness.reason,
      backupFileName: null,
      error: readiness.reason,
    };
  }

  const ownerId = readiness.ownerId;
  const strategy = options.strategy ?? "local-wins";
  const report = newMigrationReport(ownerId, strategy);

  const backup = options.safetyBackup === false ? null : await createSafetySnapshot();

  const specs = orderedMigrationTables();
  const steps = specs.length + 3; // + مطابقة الطلاب + الحذف + الإعدادات
  let done = 0;
  const tick = (label?: string) => options.onProgress?.(++done, steps, label);

  try {
    // (1) تفريغ الطابور الموجود أولاً — يتكفّل بالحذف وإعادة الترقيم المُختبَرة.
    options.onProgress?.(0, steps, "تفريغ طابور التغييرات المعلّقة");
    await syncToCloud().catch((err) => console.warn("تعذّر تفريغ الطابور قبل الترحيل:", err));

    // (2) الطلاب المُنشئون بدون نت: إدخالهم وأخذ معرفاتهم الحقيقية.
    // تُسجَّل نتائجهم في `report.remapped_students` و`report.temp_student_errors`
    // لأن الخطوة (3) ترفع جدول الطلاب كاملاً (بمن فيهم من طوبق الآن).
    const students = await getCachedStudents();
    const { temporary } = partitionStudentsByTempId(students);
    for (const student of temporary) {
      const payload = toCloudRow("students", student as CloudRow, ownerId);
      delete payload.id; // السحابة تولّد المعرّف التسلسلي
      const { data, error } = await cloud("students").insert(payload).select("id").single();
      const newId = Number((data as { id?: number } | null)?.id ?? 0);
      if (error || !newId) {
        if (report.temp_student_errors.length < 5) {
          report.temp_student_errors.push(
            `${student.name}: ${explainCloudError(
              error ?? { message: "لم يُرجع الخادم معرّفاً للطالب الجديد" },
            )}`,
          );
        }
        continue;
      }
      await remapLocalStudentId(student.id, newId);
      report.remapped_students++;
    }
    tick("مطابقة الطلاب الجدد");

    // (3) كل الجداول بالترتيب (الطلاب → ما يعتمد عليهم → الباقي).
    for (const spec of specs) {
      await pushTable(spec, ownerId, strategy, report);
      tick(spec.label);
    }

    // (4) عمليات الحذف المعلّقة.
    report.deletes_applied = await applyPendingDeletes(ownerId);
    tick("تنفيذ الحذف المعلّق");

    // (5) إعدادات المستخدم.
    await pushUserSettings(ownerId, report);
    tick("رفع الإعدادات");

    // (6) إنهاء: إن نجح كل شيء نُفرّغ الطابور entirely ونسجّل وقت المزامنة.
    if (
      report.tables.every((table) => table.failed === 0) &&
      report.temp_student_errors.length === 0
    ) {
      await clearAllPending();
      await setLastSyncTime();
      await recordMigrationTime().catch(() => undefined);
    }
    finishMigrationReport(report);

    return {
      ok: report.ok,
      report,
      summary: summarizeReport(report),
      backupFileName: backup?.fileName ?? null,
    };
  } catch (err) {
    finishMigrationReport(report);
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      report,
      summary: `تعثّر الترحيل: ${message}`,
      backupFileName: backup?.fileName ?? null,
      error: message,
    };
  }
};

/** رفع جدول واحد على دفعات مع تطبيق سياسة التعارض. */
const pushTable = async (
  spec: MigrationTableSpec,
  ownerId: string,
  strategy: ConflictStrategy,
  report: MigrationReport,
): Promise<void> => {
  const rows = await getTableRows<CloudRow>(spec.table);
  const result: TableMigrationResult = emptyTableResult(spec, rows.length);
  report.tables.push(result);
  if (rows.length === 0) return;

  // في سياسة «الأحدث يفوز» أو «رفع الجديد فقط» نحتاج مقارنة مع السحابة.
  const cloudIndex = strategy === "local-wins" ? null : await fetchCloudIndex(spec, ownerId);

  const payload: CloudRow[] = [];
  for (const row of rows) {
    // الطلاب المؤقتون الذين فشل إدخالهم لا يُرفعون (معرّفهم غير صالح في السحابة).
    if (spec.table === "students" && isTempStudentId(Number(row.id))) {
      result.skipped++;
      continue;
    }
    // الجداول المرتبطة بطالب مؤقت لم يُطابَق بعد: تُترك للجولة القادمة.
    if (spec.dependsOnStudentId && isTempStudentId(Number(row.student_id))) {
      result.skipped++;
      continue;
    }
    const cloudRow = cloudIndex ? (cloudIndex.get(pkKey(row, spec.pk)) ?? null) : null;
    if (!shouldPushRow(row, cloudRow, strategy)) {
      result.skipped++;
      continue;
    }
    payload.push(toCloudRow(spec.table, row, ownerId));
  }

  for (const chunk of chunkRows(payload, spec.batch)) {
    const error = await upsertChunk(spec, chunk);
    if (error) {
      result.failed += chunk.length;
      pushTableError(result, `${explainCloudError(error)} (${chunk.length} صف)`);
    } else {
      result.pushed += chunk.length;
    }
  }
};

const upsertChunk = async (spec: MigrationTableSpec, chunk: CloudRow[]): Promise<CloudError> => {
  try {
    const { error } = await cloud(spec.table).upsert(chunk, { onConflict: spec.onConflict });
    // قيد فريد ثانوي (مثل: معلم واحد باسم نفسه في العام) → نعيد المحاولة به.
    if (error && spec.fallbackConflict && String(error.code) === "23505") {
      const retry = await cloud(spec.table).upsert(chunk, {
        onConflict: spec.fallbackConflict,
      });
      return retry.error;
    }
    return error;
  } catch (err) {
    return { message: err instanceof Error ? err.message : String(err) };
  }
};

/** فهرس صفوف السحابة (المفاتيح + التواريخ) للمقارنة — مع ترقيم صفحات. */
const fetchCloudIndex = async (
  spec: MigrationTableSpec,
  ownerId: string,
): Promise<Map<string, CloudRow>> => {
  const index = new Map<string, CloudRow>();
  const columns = Array.from(new Set([...spec.pk, "id", "updated_at", "created_at"])).join(",");
  for (let offset = 0; ; offset += 1000) {
    try {
      const { data, error } = await cloud(spec.table)
        .select(columns)
        .eq("user_id", ownerId)
        .range(offset, offset + 999);
      if (error || !data) break;
      for (const row of data) index.set(pkKey(row, spec.pk), row);
      if (data.length < 1000) break;
    } catch {
      break;
    }
  }
  return index;
};

/** تنفيذ عمليات الحذف المعلّقة في السحابة. يُرجع عدد ما نُفّذ. */
const applyPendingDeletes = async (ownerId: string): Promise<number> => {
  const pending = await getPendingChanges();
  const deletes = pending.filter((change) => change.op === "delete");
  let applied = 0;

  for (const change of deletes) {
    const ok = await applyOneDelete(change, ownerId);
    if (ok) {
      await clearPending(change.key);
      applied++;
    }
  }
  return applied;
};

const ENTITY_TABLES: Record<string, string> = {
  teacher: "teachers",
  teacher_bonus: "teacher_bonuses",
  donor: "donors",
  award: "awards",
  expense: "ceremony_expenses",
  certificate: "certificates",
  internal_competition: "internal_competitions",
  external_competition: "external_competitions",
  media: "media",
};

const applyOneDelete = async (change: PendingChange, ownerId: string): Promise<boolean> => {
  const ref = (change.ref ?? {}) as CloudRow;
  try {
    if (change.entity === "student") {
      // طالب أُنشئ بدون نت ثم حُذف: لا وجود له في السحابة أصلاً.
      if (isTempStudentId(Number(ref.id))) return true;
      const { error } = await cloud("students").delete().eq("user_id", ownerId).eq("id", ref.id);
      return !error;
    }
    if (change.entity === "hifz") {
      const { error } = await cloud("hifz_history")
        .delete()
        .eq("user_id", ownerId)
        .eq("student_id", ref.student_id)
        .eq("year_key", ref.year_key);
      return !error;
    }
    if (change.entity === "year") {
      const { error } = await cloud("year_data")
        .delete()
        .eq("user_id", ownerId)
        .eq("student_id", ref.student_id)
        .eq("year", ref.year);
      return !error;
    }
    if (change.entity === "monthly") {
      const { error } = await cloud("monthly_tracking")
        .delete()
        .eq("user_id", ownerId)
        .eq("student_id", ref.student_id)
        .eq("year", ref.year)
        .eq("month", ref.month);
      return !error;
    }

    const table = ENTITY_TABLES[change.entity];
    if (!table || ref.id === undefined) return true; // لا شيء يُحذف
    const { error } = await cloud(table).delete().eq("user_id", ownerId).eq("id", ref.id);
    return !error;
  } catch (err) {
    console.warn(`تعذّر حذف ${change.entity} في السحابة:`, err);
    return false;
  }
};

/** رفع إعدادات المستخدم المحفوظة محلياً إلى `user_settings`. */
const pushUserSettings = async (ownerId: string, report: MigrationReport): Promise<void> => {
  const values: CloudRow = {};
  for (const key of SETTINGS_COLUMNS) {
    const value = await getCachedSetting(key);
    if (value !== undefined && value !== null) values[key] = value;
  }
  if (Object.keys(values).length === 0) return;

  const spec: MigrationTableSpec = {
    table: "user_settings",
    label: "الإعدادات",
    pk: ["user_id"],
    onConflict: "user_id",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: 1,
  };
  const result = emptyTableResult(spec, 1);
  report.tables.push(result);

  const { error } = await cloud("user_settings").upsert([{ user_id: ownerId, ...values }], {
    onConflict: "user_id",
  });
  if (error) {
    result.failed = 1;
    pushTableError(result, explainCloudError(error));
  } else {
    result.pushed = 1;
  }
};

/** هل الجهاز في وضع يسمح بالترحيل التلقائي (متصل + حساب حقيقي)؟ */
export const canAutoMigrate = async (): Promise<boolean> => {
  if (!isOnlineNow()) return false;
  const ownerId = await getUserId();
  return Boolean(ownerId) && ownerId !== DEVICE_OWNER_ID;
};
