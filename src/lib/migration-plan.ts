/**
 * خطة «الترحيل الشامل» من القاعدة المحلية إلى السحابة — منطق نقي.
 *
 * الترحيل الشامل يعني: رفع **كل** ما في الجهاز (وليس فقط طابور التغييرات
 * المعلّقة) إلى Supabase دفعة واحدة، على دفعات صغيرة (500 صف كحد أقصى لكل
 * طلب كما تفرض Supabase)، مع:
 *  - إعادة ترقيم الطلاب المُنشئين بدون نت (معرّف مؤقت ← معرّف السحابة).
 *  - اختيار سياسة التعارض (محلي يفوز / الأحدث يفوز / تخطي الموجود).
 *  - تقرير نهائي بالعربية لكل جدول (رُفع / تخطّى / فشل + سبب الفشل).
 *
 * هذا الملف نقي تماماً (لا Supabase ولا SQLite) — اختباراته `npm run test:offline`.
 */

/** نفس الأساس المستعمل في `storage.ts` لمعرّفات الطلاب المؤقتة بدون نت. */
export const TEMP_ID_BASE = 1_000_000_000;

/** هل هذا معرّف طالب مؤقت أُنشئ محلياً أثناء انقطاع النت؟ */
export const isTempStudentId = (id: number | null | undefined): boolean =>
  typeof id === "number" && id >= TEMP_ID_BASE;

/** الحد الأقصى لعدد الصفوف في طلب Supabase واحد (الخدمة تقطع عند 1000). */
export const CLOUD_BATCH_SIZE = 500;

/**
 * سياسة التعارض عند وجود الصف نفسه في السحابة:
 *  - `local-wins`: بيانات الجهاز تُكتب فوق السحابية (الافتراضي في الترحيل الشامل،
 *    لأن المستخدم ضغط الزر صراحةً وهو يعرف أن جهازه هو المرجع).
 *  - `newest-wins`: يُقارن `updated_at` ويُؤخذ الأحدث.
 *  - `skip-existing`: لا يُلمس أي صف موجود في السحابة (يُرفع الجديد فقط).
 */
export type ConflictStrategy = "local-wins" | "newest-wins" | "skip-existing";

export const CONFLICT_STRATEGIES: {
  id: ConflictStrategy;
  label: string;
  description: string;
}[] = [
  {
    id: "local-wins",
    label: "بيانات الجهاز هي المرجع",
    description: "يكتب كل ما في الجهاز فوق السحابة عند التطابق في المعرّف.",
  },
  {
    id: "newest-wins",
    label: "الأحدث يفوز",
    description: "يقارن تاريخ آخر تعديل ويرفع الأحدث فقط (أأمن لجهازين).",
  },
  {
    id: "skip-existing",
    label: "رفع الجديد فقط",
    description: "لا يعدّل أي سجل موجود في السحابة — يضيف الناقص فقط.",
  },
];

/** ترتيب الرفع مهم: الآباء قبل الأبناء (الطلاب قبل بيانات الأعوام والمتابعة). */
export type MigrationTableSpec = {
  /** اسم الجدول في SQLite المحلي وفي Supabase (متطابقان في هذا المشروع). */
  table: string;
  /** اسم عربي للعرض في شريط التقدّم والتقرير. */
  label: string;
  /** أعمدة المفتاح الأساسي محلياً. */
  pk: string[];
  /** هدف التعارض في upsert السحابي. */
  onConflict: string;
  /** هدف بديل إذا رُفض الرفع بسبب قيد فريد ثانوي (مثل اسم المعلم في عام). */
  fallbackConflict?: string;
  /** هل صفوف هذا الجدول مرتبطة بمعرّف طالب يحتاج إعادة ترقيم؟ */
  dependsOnStudentId: boolean;
  /** هل المعرّف رقم تسلسلي من السحابة (يحتاج مطابقة) أم UUID محلي؟ */
  idKind: "serial" | "uuid" | "composite";
  /** حجم الدفعة. */
  batch: number;
};

export const MIGRATION_TABLES: MigrationTableSpec[] = [
  {
    table: "students",
    label: "الطلاب والطالبات",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: false,
    idKind: "serial",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "hifz_history",
    label: "سجل الحفظ السابق",
    pk: ["student_id", "year_key"],
    onConflict: "student_id,year_key",
    dependsOnStudentId: true,
    idKind: "composite",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "year_data",
    label: "بيانات الأعوام",
    pk: ["student_id", "year"],
    onConflict: "student_id,year",
    dependsOnStudentId: true,
    idKind: "composite",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "monthly_tracking",
    label: "المتابعة الشهرية",
    pk: ["student_id", "year", "month"],
    onConflict: "student_id,year,month",
    dependsOnStudentId: true,
    idKind: "composite",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "teachers",
    label: "المعلمون والمعلمات",
    pk: ["id"],
    onConflict: "id",
    fallbackConflict: "user_id,year,name",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "teacher_bonuses",
    label: "إكراميات المعلمين والمعلمات",
    pk: ["id"],
    onConflict: "id",
    fallbackConflict: "user_id,teacher_name,year,month",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "donors",
    label: "الداعمون",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "awards",
    label: "الجوائز والإكراميات السنوية والمساعدات",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "ceremony_expenses",
    label: "مصروفات الحفل",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "certificates",
    label: "الشهادات",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "internal_competitions",
    label: "المسابقات الداخلية",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: true,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "external_competitions",
    label: "المسابقات الخارجية",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: true,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "media",
    label: "الوسائط (البيانات الوصفية)",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "community_records",
    label: "سجل المجتمع (المستفيدون)",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
  {
    table: "exam_questions",
    label: "بنك الأسئلة",
    pk: ["id"],
    onConflict: "id",
    dependsOnStudentId: false,
    idKind: "uuid",
    batch: CLOUD_BATCH_SIZE,
  },
];

/** أسماء الجداول القابلة للترحيل (تُستعمل للتحقق من اللقطات والتقارير). */
export const MIGRATABLE_TABLE_NAMES = MIGRATION_TABLES.map((spec) => spec.table);

const specByTable = new Map(MIGRATION_TABLES.map((spec) => [spec.table, spec]));
export const getTableSpec = (table: string): MigrationTableSpec | undefined =>
  specByTable.get(table);

/** ترتيب الرفع: الطلاب أولاً، ثم ما يعتمد على معرّف الطالب، ثم الباقي. */
export const orderedMigrationTables = (): MigrationTableSpec[] => {
  const students = MIGRATION_TABLES.filter((spec) => spec.table === "students");
  const dependent = MIGRATION_TABLES.filter(
    (spec) => spec.table !== "students" && spec.dependsOnStudentId,
  );
  const rest = MIGRATION_TABLES.filter(
    (spec) => spec.table !== "students" && !spec.dependsOnStudentId,
  );
  return [...students, ...dependent, ...rest];
};

/** يقسّم الصفوف إلى دفعات لا تتجاوز الحجم المحدد. */
export const chunkRows = <T>(rows: T[], size = CLOUD_BATCH_SIZE): T[][] => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const safeSize = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += safeSize) out.push(rows.slice(i, i + safeSize));
  return out;
};

/**
 * يفصل الطلاب ذوي المعرّفات المؤقتة عن الحقيقيين.
 * المؤقتون يُدرَجون في السحابة أولاً للحصول على معرّف حقيقي، ثم تُحدَّث
 * الجداول المرتبطة بهم (سجل الحفظ، بيانات الأعوام، المتابعة، المسابقات).
 */
export const partitionStudentsByTempId = <T extends { id: number }>(
  students: T[],
): { existing: T[]; temporary: T[] } => {
  const existing: T[] = [];
  const temporary: T[] = [];
  for (const student of students) {
    if (isTempStudentId(student.id)) temporary.push(student);
    else existing.push(student);
  }
  return { existing, temporary };
};

/**
 * يعيد ترقيم صفوف مرتبطة بطالب بعد حصوله على معرّف سحابي.
 * `map` هو (المعرّف المؤقت ← المعرّف الحقيقي).
 */
export const remapStudentReferences = <T extends Record<string, unknown>>(
  rows: T[],
  map: Map<number, number>,
  columns: string[] = ["student_id"],
): { rows: T[]; changed: number } => {
  if (map.size === 0) return { rows, changed: 0 };
  let changed = 0;
  const out = rows.map((row) => {
    let next = row;
    for (const column of columns) {
      const value = row[column];
      if (typeof value === "number" && map.has(value)) {
        if (next === row) next = { ...row };
        (next as Record<string, unknown>)[column] = map.get(value) as number;
        changed++;
      }
    }
    return next;
  });
  return { rows: out, changed };
};

const timestampOf = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value) {
    const time = Date.parse(value);
    if (!Number.isNaN(time)) return time;
  }
  return 0;
};

/**
 * قرار رفع صف واحد عند وجود نسخة سحابية منه.
 * `cloudRow` = null تعني أن الصف غير موجود في السحابة → يُرفع دائماً.
 */
export const shouldPushRow = (
  localRow: Record<string, unknown>,
  cloudRow: Record<string, unknown> | null,
  strategy: ConflictStrategy,
): boolean => {
  if (!cloudRow) return true;
  if (strategy === "local-wins") return true;
  if (strategy === "skip-existing") return false;
  // newest-wins — تاريخ الجهاز المحلي له الأولوية لأنه الأدق للكتابات دون نت
  const localTime = timestampOf(
    localRow.local_updated_at ?? localRow.updated_at ?? localRow.created_at,
  );
  const cloudTime = timestampOf(cloudRow.updated_at ?? cloudRow.created_at);
  if (localTime === 0 && cloudTime === 0) return true; // لا مرجّح → نرفع
  return localTime >= cloudTime;
};

/** تحويل عمود قبل رفعه إلى السحابة (مثل نصّ JSON ← jsonb). */
export type CloudColumnTransform = (value: unknown, row: Record<string, unknown>) => unknown;

/** تحويلات الأعمدة لجدول واحد. */
export type CloudTransforms = Record<string, CloudColumnTransform>;

/** تحويلات الأعمدة لكل الجداول (اسم الجدول ← تحويلاته). */
export type CloudTransformMap = Record<string, CloudTransforms>;

/**
 * يبني حمولة الصف للرفع: يفرض `user_id` الصحيح (الحساب السحابي)، ويحذف
 * الحقول المحلية الداخلية التي لا وجود لها في السحابة، ويطبّق تحويلات
 * الأعمدة (المرحلة 5: `choices` نصّ JSON في SQLite ← مصفوفة jsonb في السحابة).
 */
export const buildCloudPayload = (
  row: Record<string, unknown>,
  ownerId: string,
  allowedColumns: string[] | null,
  dropColumns: string[] = [],
  transforms: CloudTransforms = {},
): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...row, user_id: ownerId };
  for (const column of dropColumns) delete payload[column];
  if (allowedColumns) {
    for (const key of Object.keys(payload)) {
      if (!allowedColumns.includes(key)) delete payload[key];
    }
  }
  for (const [column, transform] of Object.entries(transforms)) {
    if (!(column in payload)) continue;
    payload[column] = transform(payload[column], payload);
  }
  return payload;
};

// ============================================================
// التقرير
// ============================================================

export type TableMigrationResult = {
  table: string;
  label: string;
  total: number;
  pushed: number;
  skipped: number;
  failed: number;
  /** أول 5 رسائل خطأ فقط — التقرير يُعرض للمستخدم ولا يجب أن يطول. */
  errors: string[];
};

export type MigrationReport = {
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  owner_id: string;
  strategy: ConflictStrategy;
  remapped_students: number;
  deletes_applied: number;
  /**
   * أخطاء إدخال الطلاب المُنشئين بدون نت. تُحفظ في حقل مستقل (وليس كجدول في
   * `tables`) لأن هؤلاء الطلاب يُرفعون مرة ثانية ضمن جدول `students` — فوضعهم
   * هناك كان سيُضخّم إجماليات التقرير.
   */
  temp_student_errors: string[];
  tables: TableMigrationResult[];
};

export const emptyTableResult = (
  spec: MigrationTableSpec,
  total: number,
): TableMigrationResult => ({
  table: spec.table,
  label: spec.label,
  total,
  pushed: 0,
  skipped: 0,
  failed: 0,
  errors: [],
});

export const pushTableError = (result: TableMigrationResult, message: string) => {
  if (result.errors.length < 5) result.errors.push(message);
};

export const newMigrationReport = (
  ownerId: string,
  strategy: ConflictStrategy,
): MigrationReport => ({
  started_at: new Date().toISOString(),
  finished_at: null,
  ok: true,
  owner_id: ownerId,
  strategy,
  remapped_students: 0,
  deletes_applied: 0,
  temp_student_errors: [],
  tables: [],
});

export const finishMigrationReport = (report: MigrationReport): MigrationReport => {
  report.finished_at = new Date().toISOString();
  report.ok =
    report.tables.every((table) => table.failed === 0) && report.temp_student_errors.length === 0;
  return report;
};

export type ReportTotals = {
  total: number;
  pushed: number;
  skipped: number;
  failed: number;
};

export const reportTotals = (report: MigrationReport): ReportTotals =>
  report.tables.reduce<ReportTotals>(
    (sum, table) => ({
      total: sum.total + table.total,
      pushed: sum.pushed + table.pushed,
      skipped: sum.skipped + table.skipped,
      failed: sum.failed + table.failed,
    }),
    { total: 0, pushed: 0, skipped: 0, failed: 0 },
  );

/** نص عربي مختصر جاهز للعرض/المشاركة بعد انتهاء الترحيل. */
export const summarizeReport = (report: MigrationReport): string => {
  const totals = reportTotals(report);
  const lines: string[] = [];
  lines.push(
    totals.failed === 0
      ? `✅ اكتمل الترحيل إلى السحابة: ${totals.pushed} سجل.`
      : `⚠️ انتهى الترحيل مع أخطاء: ${totals.pushed} سجل مرفوع، ${totals.failed} فشل.`,
  );
  if (totals.skipped > 0) lines.push(`• تخطّى (موجود في السحابة): ${totals.skipped}`);
  if (report.remapped_students > 0)
    lines.push(`• طلاب أُنشئوا بدون نت ورُبطت معرفاتهم: ${report.remapped_students}`);
  for (const error of report.temp_student_errors.slice(0, 3))
    lines.push(`   ✖ طالب جديد تعذّر إدخاله: ${error}`);
  if (report.deletes_applied > 0)
    lines.push(`• عمليات حذف نُفّذت في السحابة: ${report.deletes_applied}`);
  for (const table of report.tables) {
    if (table.total === 0) continue;
    lines.push(`• ${table.label}: ${table.pushed}/${table.total}`);
    for (const error of table.errors) lines.push(`   ✖ ${error}`);
  }
  return lines.join("\n");
};

/** يحوّل خطأ Supabase إلى رسالة عربية مفهومة. */
export const explainCloudError = (error: unknown): string => {
  const err = error as { code?: string; message?: string; details?: string } | null;
  const code = err?.code ?? "";
  const message = err?.message ?? "خطأ غير معروف";
  if (code === "23505") return `تعارض تكرار بيانات: ${err?.details || message}`;
  if (code === "23503") return `سجل مرتبط ببيانات غير موجودة: ${err?.details || message}`;
  if (code === "42501" || code === "PGRST301")
    return "صلاحية مرفوضة من السحابة (RLS) — تحقق من تسجيل الدخول بالحساب الصحيح.";
  if (code === "42P01") return `الجدول غير موجود في السحابة: ${message}`;
  if (code === "42703") return `عمود غير موجود في السحابة (تحتاج ترحيل SQL جديد): ${message}`;
  if (code === "22P02") return `قيمة غير صالحة لعمود: ${message}`;
  return message;
};

/**
 * معاينة الترحيل قبل التنفيذ — تُعرض للمستخدم حتى يعرف حجم العملية.
 * `counts` هو عدد صفوف كل جدول محلياً.
 */
export const previewMigration = (
  counts: Record<string, number>,
  pendingDeletes: number,
): {
  tables: { table: string; label: string; count: number }[];
  total: number;
  pendingDeletes: number;
} => {
  const tables = orderedMigrationTables()
    .map((spec) => ({
      table: spec.table,
      label: spec.label,
      count: counts[spec.table] ?? 0,
    }))
    .filter((entry) => entry.count > 0);
  const total = tables.reduce((sum, entry) => sum + entry.count, 0) + pendingDeletes;
  return { tables, total, pendingDeletes };
};
