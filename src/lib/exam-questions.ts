import { z } from "zod";
import { newLocalId, parseJsonColumn, sortRows, stringifyJsonColumn } from "./local-ids";

/**
 * بنك الأسئلة (`exam_questions`) — منطق نقي مشترك بين الطبقة المحلية
 * (`src/utils/examStorage.ts`) والسحابة والترحيل الشامل.
 *
 * مفتاح الجدول UUID: المعرّف يُولَّد على الجهاز (`newLocalId`) ويبقى نفسه عند
 * الرفع، فلا مطابقة ولا إعادة ترقيم. عمود `choices` من نوع `jsonb` في السحابة
 * ونصّ JSON في SQLite — التحويل في الاتجاهين هنا، في مكان واحد.
 */

export const examQuestionTypes = {
  mcq: "اختيار من متعدد",
  true_false: "صح / خطأ",
  written: "سؤال مقالي",
} as const;

export const examDifficulties = ["سهل", "متوسط", "صعب"] as const;

const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const examQuestionSchema = z
  .object({
    year: z.string().trim().max(20),
    category: z.string().trim().max(200),
    subject: z.string().trim().max(200),
    question_type: z.enum(["mcq", "true_false", "written"]),
    question: z.string().trim().min(3, "نص السؤال قصير جدًا").max(4000, "نص السؤال طويل جدًا"),
    choices: z.array(z.string().trim().min(1)).max(20, "عدد الخيارات كبير جدًا"),
    correct_answer: optionalText(2000),
    difficulty: z.enum(["سهل", "متوسط", "صعب"]),
    notes: optionalText(2000),
  })
  .superRefine((question, ctx) => {
    const invalid = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (question.question_type === "mcq") {
      if (question.choices.length < 2) invalid("choices", "أدخل خيارين على الأقل");
      const answer = (question.correct_answer ?? "").trim();
      if (!answer || !question.choices.includes(answer))
        invalid("correct_answer", "الإجابة الصحيحة يجب أن تطابق أحد الخيارات");
    }
  });

export type ExamQuestionInput = z.infer<typeof examQuestionSchema>;

export type ExamQuestion = ExamQuestionInput & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  /** طابع آخر تعديل **على هذا الجهاز** — لا يُرفع إلى السحابة. */
  local_updated_at?: string | null;
};

/** صف SQLite: عمود `choices` نصّ JSON (وليس مصفوفة). */
export type ExamQuestionRow = Omit<ExamQuestion, "choices"> & {
  choices: string | null;
};

/** أعمدة الجدول في السحابة (لا يُرفع غيرها). */
export const EXAM_QUESTION_COLUMNS = [
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
] as const;

/** أعمدة الجدول محلياً (السحابية + عمود التدقيق المحلي). */
export const LOCAL_EXAM_QUESTION_COLUMNS = [...EXAM_QUESTION_COLUMNS, "local_updated_at"] as const;

export const EXAM_QUESTION_TABLE = "exam_questions" as const;

// ============================================================
// التحويل بين الصف المحلي والكائن والسحابة
// ============================================================

const nowIso = () => new Date().toISOString();

/** كائن ← صف SQLite (`choices` تصبح نصّ JSON). */
export const toExamQuestionRow = (question: ExamQuestion): ExamQuestionRow => ({
  ...question,
  choices: stringifyJsonColumn(question.choices ?? []),
});

/** صف SQLite ← كائن (`choices` تصبح مصفوفة). */
export const fromExamQuestionRow = (row: ExamQuestionRow): ExamQuestion => ({
  ...row,
  choices: parseJsonColumn<string[]>(row.choices, []).filter(
    (choice): choice is string => typeof choice === "string",
  ),
});

/** حمولة الرفع إلى السحابة: `choices` مصفوفة (jsonb) والمالك صريح. */
export const toExamCloudPayload = (
  question: ExamQuestion | ExamQuestionRow,
  ownerId: string,
): Record<string, unknown> => {
  const choices = Array.isArray(question.choices)
    ? question.choices
    : parseJsonColumn<string[]>(question.choices, []);
  const payload: Record<string, unknown> = { ...question, user_id: ownerId };
  payload.choices = choices;
  delete payload.local_updated_at;
  for (const key of Object.keys(payload)) {
    if (!(EXAM_QUESTION_COLUMNS as readonly string[]).includes(key)) delete payload[key];
  }
  return payload;
};

/** معرّف جديد للسؤال (UUID يُولَّد على الجهاز ويبقى نفسه في السحابة). */
export const newExamQuestionId = (): string => newLocalId();

/**
 * يُنشئ سؤالاً كاملاً من مدخلات الواجهة: يتحقق من السكيمة ويضيف المعرّف
 * والمالك والتواريخ.
 */
export const createExamQuestion = (
  input: ExamQuestionInput,
  ownerId: string,
  id: string = newExamQuestionId(),
): ExamQuestion => {
  const values = examQuestionSchema.parse(input);
  const stamp = nowIso();
  return {
    ...values,
    id,
    user_id: ownerId,
    created_at: stamp,
    updated_at: stamp,
    local_updated_at: stamp,
  };
};

// ============================================================
// الترتيب والبحث وتكرار الأسئلة
// ============================================================

/** نفس ترتيب السحابة: الأحدث إنشاءً أولاً، ثم المعرّف فاصلاً ثابتاً. */
export const sortExamQuestions = <T extends { created_at?: string | null; id: string }>(
  rows: T[],
): T[] => sortRows(rows, [{ key: "created_at", dir: "desc" }, { key: "id" }]);

/**
 * تطبيع نصّ السؤال للمقارنة: توحيد الألفات والياء والتاء المربوطة، وإزالة
 * التشكيل والتطويل والمسافات الزائدة — حتى يُكتشف المكرّر ولو اختلف رسمه.
 */
export const normalizeQuestionText = (text: string): string =>
  text
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");

export type ExamQuestionFilters = {
  search?: string;
  subject?: string;
  category?: string;
};

/** ترشيح بنك الأسئلة (مادة + فئة حفظ + بحث نصّي). */
export const filterExamQuestions = (
  rows: ExamQuestion[],
  filters: ExamQuestionFilters = {},
): ExamQuestion[] => {
  const term = normalizeQuestionText(filters.search ?? "");
  const subject = filters.subject && filters.subject !== "all" ? filters.subject : null;
  const category = filters.category && filters.category !== "all" ? filters.category : null;
  return rows.filter((row) => {
    if (subject && row.subject !== subject) return false;
    if (category && (row.category || "").trim() !== category.trim()) return false;
    if (!term) return true;
    return (
      normalizeQuestionText(row.question).includes(term) ||
      normalizeQuestionText(row.subject).includes(term) ||
      normalizeQuestionText(row.correct_answer ?? "").includes(term)
    );
  });
};

/** هل يوجد سؤال بنفس النصّ (بعد التطبيع) في القائمة؟ */
export const findDuplicateExamQuestion = (
  rows: Pick<ExamQuestion, "question">[],
  question: string,
): ExamQuestion | null => {
  const target = normalizeQuestionText(question);
  if (!target) return null;
  const found = rows.find((row) => normalizeQuestionText(row.question) === target);
  return (found as ExamQuestion | undefined) ?? null;
};

/** يقرأ الخيارات من نصّ الواجهة (مفصولة بفاصلة عربية أو لاتينية). */
export const parseChoicesText = (text: string): string[] =>
  text
    .split(/[،,]/)
    .map((choice) => choice.trim())
    .filter(Boolean);

// ============================================================
// رسائل الأخطاء
// ============================================================

/** يحوّل خطأ Supabase/التحقق إلى رسالة عربية مفهومة للمستخدم. */
export const examQuestionErrorMessage = (error: unknown): string => {
  const err = error as {
    code?: string;
    message?: string;
    issues?: { message?: string }[];
  } | null;
  const issues = err?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    return issues.map((issue) => issue.message ?? "قيمة غير صالحة").join(" — ");
  }
  const code = err?.code ?? "";
  if (["42P01", "PGRST205", "42703", "PGRST204"].includes(code))
    return "قاعدة البيانات تحتاج تحديثًا: طبّق ملف ترحيل exam_questions ثم أعد المحاولة.";
  if (code === "42501") return "ليست لديك صلاحية لهذه العملية. تحقق من الحساب وإذن الاطلاع.";
  if (code === "23505") return "يوجد سؤال بنفس النصّ في البنك.";
  return err?.message || "تعذّرت العملية على بنك الأسئلة. أعد المحاولة.";
};
