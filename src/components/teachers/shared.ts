import { END_YEAR, START_YEAR, type Student } from "@/types/student";
import { groupStudentsByTeacher, mergeTeacherNames, teacherYears } from "@/lib/teacher-registry";
import type { AwardRow, CertificateRow, TeacherBonusRow, TeacherRow } from "@/utils/storage";

/** أعوام النظام الهجرية (نفس قائمة بقية الصفحات). */
export const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, index) =>
  String(START_YEAR + index),
);

/** أشهر الإكراميات الشهرية (من محرم إلى ذو الحجة). */
export const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

/** فئات المستفيد التي تُعدّ معلم/ة في جداول الجوائز والشهادات. */
export const TEACHER_RECIPIENT_TYPES = ["teacher", "male_teacher"];

export const isTeacherRecipient = (recipientType: string | null | undefined) =>
  TEACHER_RECIPIENT_TYPES.includes((recipientType || "").trim());

export const TEACHER_RECIPIENT_LABEL: Record<string, string> = {
  teacher: "معلم/ة",
  male_teacher: "معلم",
};

/** القيم المشتركة التي تُمرَّر من صفحة المعلمين إلى كل تبويب. */
export interface TeacherTabProps {
  /** السجل العام للمعلمين والمعلمات (مستقل عن الأعوام). */
  teachers: TeacherRow[];
  /** طلاب السجل الشامل لكل الأعوام (كل طالب بعام/أعوام تسجيله). */
  students: Student[];
  /** كل الإكراميات الشهرية المحفوظة. */
  bonuses: TeacherBonusRow[];
  /** كل سجلات الجوائز (تُستعمل للسنوية والمساعدات العينية). */
  awards: AwardRow[];
  /** كل الشهادات. */
  certificates: CertificateRow[];
  /** العام النشط افتراضياً لتبويبات الأعوام. */
  defaultYear: string;
  /** وضع الاطلاع: قراءة فقط. */
  readOnly: boolean;
  /** يُستدعى بعد أي تعديل لإعادة تحميل البيانات. */
  onChanged: () => Promise<void> | void;
}

export const amount = (value: number | string | null | undefined) => Number(value || 0) || 0;

export const formatAmount = (value: number | string | null | undefined) =>
  amount(value).toLocaleString("ar-EG", { maximumFractionDigits: 2 });

export const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : "—");

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** أسماء كل من في السجل + أي اسم ظهر في سجلات الإكراميات/الجوائز. */
export { mergeTeacherNames, teacherYears };

/** طلاب كل معلم/ة في السجل الشامل (بغض النظر عن العام). */
export const studentsByTeacher = groupStudentsByTeacher;

/** إجمالي الإكراميات الشهرية لمعلم/ة (وكل الأعوام إن لم يُحدَّد عام). */
export const monthlyTotalFor = (bonuses: TeacherBonusRow[], teacherName: string, year?: string) =>
  bonuses
    .filter((bonus) => bonus.teacher_name === teacherName && (!year || bonus.year === year))
    .reduce((sum, bonus) => sum + amount(bonus.amount), 0);

/** إجمالي الإكراميات السنوية لمعلم/ة (وكل الأعوام إن لم يُحدَّد عام). */
export const annualTotalFor = (awards: AwardRow[], teacherName: string, year?: string) =>
  awards
    .filter(
      (award) =>
        award.award_type === "annual" &&
        award.recipient_name === teacherName &&
        isTeacherRecipient(award.recipient_type) &&
        (!year || award.year === year),
    )
    .reduce((sum, award) => sum + amount(award.amount), 0);
