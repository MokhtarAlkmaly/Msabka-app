/**
 * منطق استيراد سجل الطلاب من Excel — وحدة نقية بلا React أو قاعدة بيانات:
 *  - أعمدة القالب وتعليماته.
 *  - مطابقة أسماء الأعمدة مع مرادفاتها بعد التطبيع العربي.
 *  - تطبيع الجنس والهواتف والأرقام والتواريخ المدخلة يدوياً.
 *
 * تعتمد عليها شاشة الاستيراد في صفحة المسابقة، وتغطيها
 * `scripts/test-student-import.mjs` حتى يبقى قبول الملفات متسامحاً مع
 * اختلاف صياغات الأعمدة والأرقام العربية.
 */

import { normalizeArabic } from "@/utils/arabicSearch";

export type StudentImportField =
  | "name"
  | "gender"
  | "teacher"
  | "school_grade"
  | "status"
  | "hijri_join_date"
  | "initial_hifz"
  | "first_competition_year"
  | "guardian_phone"
  | "student_phone"
  | "notes";

/** الأعمدة التي يُنشأ بها قالب الاستيراد (بالترتيب). */
export const STUDENT_IMPORT_HEADERS = [
  "الاسم",
  "الجنس",
  "المعلم/ة",
  "السنة الدراسية",
  "الحالة",
  "تاريخ هجري الالتحاق",
  "الحفظ قبل الالتحاق",
  "عام أول مسابقة",
  "رقم ولي الأمر",
  "رقم الطالب",
  "ملاحظات",
];

/** ورقة «تعليمات» داخل القالب. */
export const STUDENT_IMPORT_INSTRUCTIONS: string[][] = [
  ["قالب استيراد سجل الطلاب — مركز إنماء الأهلي الخيري"],
  [""],
  ["العمود", "إلزامي", "الوصف والمثال"],
  ["الاسم", "نعم", "الاسم الكامل للطالب/الطالبة — مثال: فاطمة أحمد. الصفوف بلا اسم تُتجاهل."],
  ["الجنس", "لا", "ذكر أو أنثى."],
  ["المعلم/ة", "لا", "اسم المعلم/المعلمة المسؤول عن متابعة الطالب/الطالبة."],
  ["السنة الدراسية", "لا", "مثال: الرابع الابتدائي، أو الأول الثانوي."],
  ["الحالة", "لا", "طبيعي / يتيم / مسكين / ذوي احتياجات خاصة ..."],
  ["تاريخ هجري الالتحاق", "لا", "مثال: 1447-03-15."],
  ["الحفظ قبل الالتحاق", "لا", "عدد الأجزاء المحفوظة قبل الالتحاق — مثال: 5."],
  ["عام أول مسابقة", "لا", "مثال: 1447."],
  ["رقم ولي الأمر", "لا", "مثال: 0777123456. يُفضّل كتابته كنص للحفاظ على الصفر البادئ."],
  ["رقم الطالب", "لا", "مثال: 0733123456."],
  ["ملاحظات", "لا", "أي ملاحظات إضافية عن الطالب/الطالبة."],
  [""],
  ["ملاحظات هامة"],
  [
    "• لا تغيّر أسماء الأعمدة في ورقة «سجل الطلاب»، ويمكنك حذف الأعمدة غير المستخدمة مع إبقاء عمود «الاسم».",
  ],
  [
    "• الطلاب الموجودون مسبقاً بنفس الاسم (بعد تجاهل فروق الهمزات والتاء المربوطة والمسافات) تُحدَّث بياناتهم بالحقول المعبّأة فقط، ولا تتكرر سجلاتهم.",
  ],
  ["• الأسماء المكررة داخل الملف نفسه تُستورد مرة واحدة، والصفوف التي لا تحتوي على اسم تُتجاهل."],
  ["• في صفحة المسابقة يمكنك اختيار تسجيل الطلاب المستوردين تلقائياً في كشف المسابقة المفتوحة."],
  ["• تتم المزامنة مع السحابة تلقائياً بعد الاستيراد عند توفر الاتصال بالإنترنت."],
];

/** أسماء الأعمدة المقبولة في الملف — المقارنة تتم بعد تطبيع النص العربي. */
const HEADER_ALIASES: Record<StudentImportField, string[]> = {
  name: ["الاسم", "اسم الطالب", "اسم الطالبة", "اسم"],
  gender: ["الجنس"],
  teacher: ["المعلم/ة", "المعلم", "المعلمة", "الأستاذ/ة", "الأستاذ", "الأستاذة"],
  school_grade: [
    "السنة الدراسية",
    "الصف",
    "الصف الدراسي",
    "المستوى الدراسي",
    "السنة الدراسية وقت الالتحاق",
  ],
  status: ["الحالة"],
  hijri_join_date: ["تاريخ هجري الالتحاق", "تاريخ الالتحاق", "تاريخ الالتحاق الهجري"],
  initial_hifz: [
    "الحفظ قبل الالتحاق",
    "الحفظ السابق",
    "مقدار الحفظ قبل الالتحاق",
    "الحفظ الابتدائي",
  ],
  first_competition_year: [
    "عام أول مسابقة",
    "أول عام مسابقة",
    "عام المسابقة الأولى",
    "عام اول مسابقه",
  ],
  guardian_phone: ["رقم ولي الأمر", "جوال ولي الأمر", "هاتف ولي الأمر"],
  student_phone: ["رقم الطالب", "جوال الطالب", "هاتف الطالب", "رقم الطالبة", "جوال الطالبة"],
  notes: ["ملاحظات", "الملاحظات"],
};

/** يحوّل الأرقام العربية/الفارسية إلى أرقام إنجليزية لقراءتها من Excel. */
export const toAsciiDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

/** يقبل ذكر/أنثى وصيغها الشائعة (بنت/ولد/ذكر/أنثى/انثي...). */
export const normalizeGenderInput = (value: string): string | undefined => {
  const normalized = normalizeArabic(value);
  if (!normalized) return undefined;
  if (
    normalized.startsWith("انث") ||
    normalized.startsWith("اناث") ||
    normalized.startsWith("بنت") ||
    normalized === "female" ||
    normalized === "f"
  ) {
    return "أنثى";
  }
  if (
    normalized.startsWith("ذكر") ||
    normalized.startsWith("ذكو") ||
    normalized.startsWith("ولد") ||
    normalized === "male" ||
    normalized === "m"
  ) {
    return "ذكر";
  }
  return undefined;
};

/** أرقام الجوال اليمنية قد تُقرأ من Excel بلا الصفر البادئ (7XXXXXXXX). */
export const normalizePhoneInput = (value: string): string => {
  const digits = toAsciiDigits(value).replace(/[^\d+]/g, "");
  return /^7\d{8}$/.test(digits) ? `0${digits}` : digits;
};

/** أرقام الأجزاء: يقبل «٥٫٥» و«5,5» و«5 أجزاء». */
export const normalizeDecimalInput = (value: string): string =>
  toAsciiDigits(value)
    .replace(/[,٫]/g, ".")
    .replace(/[^\d.]/g, "");

/** عام هجري مكتوب مثل «١٤٤٧هـ» ← «1447». */
export const normalizeYearInput = (value: string): string =>
  toAsciiDigits(value).replace(/[^\d]/g, "");

export interface StudentRowReader {
  hasNameColumn: boolean;
  read(row: Record<string, unknown>, field: StudentImportField): string;
}

/**
 * يبني قارئاً لصفوف الملف: يربط أسماء الأعمدة المقبولة (أو مرادفاتها)
 * بأسماء الحقول، ويقرأ القيم كنصوص مع توحيد المسافات.
 */
export const buildStudentRowReader = (headers: string[]): StudentRowReader => {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeArabic(header), header]));

  const columnFor = (field: StudentImportField): string | undefined => {
    for (const alias of HEADER_ALIASES[field]) {
      const column = normalizedHeaders.get(normalizeArabic(alias));
      if (column) return column;
    }
    return undefined;
  };

  const columns = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as StudentImportField[]).map((field) => [field, columnFor(field)]),
  ) as Record<StudentImportField, string | undefined>;

  return {
    hasNameColumn: Boolean(columns.name),
    read(row: Record<string, unknown>, field: StudentImportField): string {
      const column = columns[field];
      if (!column) return "";
      const value = row[column];
      if (value === null || value === undefined) return "";
      return String(value).replace(/\s+/g, " ").trim();
    },
  };
};

export interface StudentImportValues {
  name: string;
  teacher: string;
  gender?: string;
  schoolGrade: string;
  status: string;
  hijriJoinDate: string;
  initialHifz: string;
  firstCompetitionYear: string;
  guardianPhone: string;
  studentPhone: string;
  notes: string;
}

/** يقرأ صفاً كاملاً ويطبّع قيمه حسب نوع كل حقل. */
export const readStudentImportRow = (
  reader: StudentRowReader,
  row: Record<string, unknown>,
): StudentImportValues => ({
  name: reader.read(row, "name"),
  teacher: reader.read(row, "teacher"),
  gender: normalizeGenderInput(reader.read(row, "gender")),
  schoolGrade: reader.read(row, "school_grade"),
  status: reader.read(row, "status"),
  hijriJoinDate: toAsciiDigits(reader.read(row, "hijri_join_date")),
  initialHifz: normalizeDecimalInput(reader.read(row, "initial_hifz")),
  firstCompetitionYear: normalizeYearInput(reader.read(row, "first_competition_year")),
  guardianPhone: normalizePhoneInput(reader.read(row, "guardian_phone")),
  studentPhone: normalizePhoneInput(reader.read(row, "student_phone")),
  notes: reader.read(row, "notes"),
});
