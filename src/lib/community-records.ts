import { z } from "zod";
import { departmentDetails, type CommunityDepartment } from "./center-programs";

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
