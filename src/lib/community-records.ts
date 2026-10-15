import { z } from "zod";
import { departmentDetails, type CommunityDepartment } from "./center-programs";
import { newLocalId, sortRows } from "./local-ids";

export const recordStatuses = {
  training: {
    registered: "مسجّل",
    in_progress: "قيد التدريب",
    completed: "أتم البرنامج",
    cancelled: "ملغي",
  },
  care: {
    registered: "مسجّل / بانتظار الخدمة",
    in_progress: "قيد التنفيذ / رعاية مستمرة",
    completed: "تم تقديم الخدمة",
    cancelled: "ملغي",
  },
} as const;
export const beneficiaryTypes = {
  individual: "فرد",
  child: "طفل",
  family: "أسرة",
  orphan: "يتيم",
} as const;
export const currencies = { YER: "ريال يمني", SAR: "ريال سعودي", USD: "دولار أمريكي" } as const;
export const isMoneyProgram = (program: string) =>
  ["cash-assistance", "orphan-sponsorship"].includes(program);
export const isChildProgram = (program: string) => ["kindergarten", "preschool"].includes(program);
export const isOrphanProgram = (program: string) =>
  ["orphan-education", "orphan-sponsorship"].includes(program);
export function getDepartmentPrograms(department: CommunityDepartment) {
  return departmentDetails[department].areas.flatMap((area) => area.programs);
}

const optionalText = (max: number) => z.string().trim().max(max).nullable();
export const communityRecordSchema = z
  .object({
    department: z.enum(["training", "care"]),
    program_id: z.string(),
    beneficiary_name: z.string().trim().min(2, "أدخل اسم المستفيد (حرفان على الأقل)").max(200),
    beneficiary_type: z.enum(["individual", "child", "family", "orphan"]),
    phone: optionalText(40),
    guardian_name: optionalText(200),
    address: optionalText(300),
    service_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "أدخل تاريخًا صحيحًا")
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, "أدخل تاريخًا صحيحًا"),
    status: z.enum(["registered", "in_progress", "completed", "cancelled"]),
    group_name: optionalText(200),
    sponsor_name: optionalText(200),
    amount: z
      .number()
      .finite()
      .positive()
      .max(999999999999.99)
      .multipleOf(0.01, "أدخل المبلغ حتى منزلتين عشريتين")
      .nullable(),
    currency: z.enum(["YER", "SAR", "USD"]).nullable(),
    quantity: z.number().int().positive().max(100000).nullable(),
    notes: optionalText(3000),
  })
  .superRefine((record, ctx) => {
    const invalid = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (
      !getDepartmentPrograms(record.department).some((program) => program.id === record.program_id)
    )
      invalid("program_id", "اختر برنامجًا تابعًا للقسم");
    if (isMoneyProgram(record.program_id)) {
      if (record.amount === null || record.currency === null)
        invalid("amount", "أدخل المبلغ والعملة");
    } else if (record.amount !== null || record.currency !== null)
      invalid("amount", "المبلغ والعملة مخصصان للبرامج النقدية");
    if (record.program_id === "food-baskets") {
      if (record.quantity === null) invalid("quantity", "أدخل عدد السلال");
    } else if (record.quantity !== null) invalid("quantity", "عدد السلال مخصص للمساعدات الغذائية");
    if (isOrphanProgram(record.program_id) && record.beneficiary_type !== "orphan")
      invalid("beneficiary_type", "اختر نوع المستفيد: يتيم");
    if (isChildProgram(record.program_id) && record.beneficiary_type !== "child")
      invalid("beneficiary_type", "اختر نوع المستفيد: طفل");
    if (["child", "orphan"].includes(record.beneficiary_type) && !record.guardian_name)
      invalid("guardian_name", "أدخل اسم ولي الأمر أو الوصي");
  });
export type CommunityRecordInput = z.infer<typeof communityRecordSchema>;
export type CommunityRecord = CommunityRecordInput & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/** صف SQLite: يحمل عمود التدقيق المحلي فوق أعمدة السحابة. */
export type CommunityRecordRow = CommunityRecord & {
  /** طابع آخر تعديل **على هذا الجهاز** — لا يُرفع إلى السحابة. */
  local_updated_at?: string | null;
};

// ============================================================
// المرحلة 5: توطين سجل المجتمع (محلي أولاً + رفع محصور)
// ============================================================

export const COMMUNITY_RECORD_TABLE = "community_records" as const;

/** أعمدة الجدول في السحابة (لا يُرفع غيرها). */
export const COMMUNITY_RECORD_COLUMNS = [
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
] as const;

/** أعمدة الجدول محلياً (السحابية + عمود التدقيق المحلي). */
export const LOCAL_COMMUNITY_RECORD_COLUMNS = [
  ...COMMUNITY_RECORD_COLUMNS,
  "local_updated_at",
] as const;

/**
 * تطبيع صف قادم من SQLite أو من السحابة: النصوص الفارغة `null`، والحقول
 * النقدية/العددية تُصفَّر في البرامج غير المعنية (حماية من صفوف قديمة قبل
 * تفعيل القيود)، والتواريخ الناقصة تُستبدل بتاريخ اليوم.
 */
export const normalizeCommunityRecord = (
  row: Partial<CommunityRecord> & { id: string; user_id: string },
): CommunityRecordRow => {
  const text = (value: unknown, max: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  };
  const amount = isMoneyProgram(row.program_id ?? "")
    ? Number.isFinite(Number(row.amount))
      ? Number(row.amount)
      : null
    : null;
  const currency = isMoneyProgram(row.program_id ?? "") ? (row.currency ?? null) : null;
  const quantity =
    row.program_id === "food-baskets" && Number.isFinite(Number(row.quantity))
      ? Number(row.quantity)
      : null;
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: row.id,
    user_id: row.user_id,
    department: row.department === "care" ? "care" : "training",
    program_id: text(row.program_id, 120) ?? "",
    beneficiary_name: text(row.beneficiary_name, 200) ?? "",
    beneficiary_type: row.beneficiary_type ?? "individual",
    phone: text(row.phone, 40),
    guardian_name: text(row.guardian_name, 200),
    address: text(row.address, 300),
    service_date: /^\d{4}-\d{2}-\d{2}$/.test(row.service_date ?? "")
      ? (row.service_date as string)
      : today,
    status: row.status ?? "registered",
    group_name: text(row.group_name, 200),
    sponsor_name: text(row.sponsor_name, 200),
    amount,
    currency: currency as CommunityRecord["currency"],
    quantity,
    notes: text(row.notes, 3000),
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    local_updated_at: (row as CommunityRecordRow).local_updated_at ?? null,
  };
};

/** حمولة الرفع إلى السحابة: الأعمدة السحابية فقط والمالك صريح. */
export const toCommunityCloudPayload = (
  row: CommunityRecordRow | CommunityRecord,
  ownerId: string,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...row, user_id: ownerId };
  delete payload.local_updated_at;
  for (const key of Object.keys(payload)) {
    if (!(COMMUNITY_RECORD_COLUMNS as readonly string[]).includes(key)) delete payload[key];
  }
  return payload;
};

/** معرّف جديد للسجل (UUID يُولَّد على الجهاز ويبقى نفسه في السحابة). */
export const newCommunityRecordId = (): string => newLocalId();

/** ينشئ سجلاً كاملاً من مدخلات الواجهة (تحقق + معرّف + مالك + تواريخ). */
export const createCommunityRecord = (
  input: CommunityRecordInput,
  ownerId: string,
  id: string = newCommunityRecordId(),
): CommunityRecord => {
  const values = communityRecordSchema.parse(input);
  const stamp = new Date().toISOString();
  return { ...values, id, user_id: ownerId, created_at: stamp, updated_at: stamp };
};

/** نفس ترتيب السحابة: الأحدث تاريخ خدمة أولاً، ثم المعرّف فاصلاً ثابتاً. */
export const sortCommunityRecords = <T extends { service_date: string; id: string }>(
  rows: T[],
): T[] => sortRows(rows, [{ key: "service_date", dir: "desc" }, { key: "id" }]);

/** يحوّل خطأ Supabase/التحقق إلى رسالة عربية مفهومة للمستخدم. */
export const communityErrorMessage = (error: unknown): string => {
  const err = error as { code?: string; message?: string } | null;
  const code = err?.code ?? "";
  if (["42P01", "PGRST205", "42703", "PGRST204"].includes(code))
    return "قاعدة البيانات تحتاج تحديثًا: طبّق ملف 20261015100000_community_records.sql ثم أعد المحاولة.";
  if (code === "42501") return "ليست لديك صلاحية لهذه العملية. تحقق من الحساب وإذن الاطلاع.";
  if (code === "23505") return "يوجد سجل بنفس البيانات — تحقق من التكرار.";
  return (
    err?.message || "تعذّرت العملية على سجل المجتمع. تحقق من الاتصال والصلاحيات ثم أعد المحاولة."
  );
};

export function summarizeCompletedServices(records: CommunityRecord[]) {
  const amounts = { YER: 0, SAR: 0, USD: 0 };
  let baskets = 0;
  for (const record of records) {
    if (record.status !== "completed") continue;
    if (record.currency && record.amount !== null) {
      // Sum minor units to avoid floating-point artifacts in financial totals.
      amounts[record.currency] += Math.round(record.amount * 100);
    }
    if (record.program_id === "food-baskets") baskets += record.quantity ?? 0;
  }
  return {
    baskets,
    amounts: { YER: amounts.YER / 100, SAR: amounts.SAR / 100, USD: amounts.USD / 100 },
  };
}

export function filterCommunityRecords(
  records: CommunityRecord[],
  search: string,
  program: string,
  status: string,
) {
  const term = search.trim().toLocaleLowerCase("ar");
  return records.filter(
    (record) =>
      (program === "all" || record.program_id === program) &&
      (status === "all" || record.status === status) &&
      (!term ||
        [
          record.beneficiary_name,
          record.phone,
          record.guardian_name,
          record.group_name,
          record.sponsor_name,
        ].some((value) => value?.toLocaleLowerCase("ar").includes(term))),
  );
}
