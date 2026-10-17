import {
  HIFZ_CATEGORIES,
  HARD_MODEL_CEILING,
  MIN_MODELS,
  generatePapers,
  getCategory,
  maxFeasibleModels,
  type ExamPaper,
  type HifzCategory,
  type RangeDirection,
} from "@/utils/examPaperGenerator";

/** يُعاد تصديره لأن أوراق الطباعة والواجهة تستخدمه مع بيانات الطالب */
export { studentTitle } from "@/utils/examPaperGenerator";
import type { QuranData } from "@/utils/quranText";

/**
 * توليد نماذج اختبار مخصصة لطلاب المسابقة.
 * ------------------------------------------------------------------
 * الفكرة: كل طالب/ة يحصل على نموذج مطبوع باسمه، وأسئلته مأخوذة من نطاق
 * حفظه هو (فئة الحفظ)، وموضعه داخل النطاق يختلف عن موضع زملائه في نفس
 * الفئة حتى لا تتطابق النماذج داخل الحلقة الواحدة.
 *
 * التنفيذ: في الوضع التلقائي نجمع الطلاب ذوي الإجمالي التراكمي نفسه، ونحدد
 * النطاق الموافق لعدد الأجزاء (آخر N أجزاء افتراضيًا)، ثم نولّد نماذج بعدد طلاب المجموعة (بحدٍّ
 * أقصى سقف المواضع من `maxFeasibleModels`) ونوزّعها عليهم. عند تجاوز السقف
 * نعيد الاستخدام من البداية.
 */

/** بيانات الطالب اللازمة لبناء النموذج المخصص */
export interface StudentPaperInput {
  id: number;
  name: string;
  /** اسم المعلم/ة كما هو مسجل في الجدول */
  teacher?: string;
  /** الجنس لتفصيل اللقب في ورقة الاختبار (ذكر/أنثى) */
  gender?: string;
  /** إجمالي الحفظ التراكمي (0..30) — يُشتق منه فئة الحفظ */
  totalHifz: number;
}

export interface StudentPaper {
  student: StudentPaperInput;
  category: HifzCategory;
  paper: ExamPaper;
  /** ترتيب الطالب داخل فئته (يبدأ من 1) */
  orderInCategory: number;
  /** عدد طلاب نفس الفئة في هذه الدفعة */
  categoryTotal: number;
}

export interface StudentPapersResult {
  papers: StudentPaper[];
  /** طلاب تعذّر توليد نموذج لهم (لا يوجد حفظ، أو نطاق لا يكفي) مع السبب */
  skipped: { student: StudentPaperInput; reason: string }[];
}

/** الفئات الثابتة الموافقة تمامًا لبعض أعداد الأجزاء التراكمية. */
const CANONICAL_CATEGORIES_BY_JUZ_COUNT: Record<number, string> = {
  1: "juz30", // جزء عمّ هو آخر جزء في المصحف
  3: "juz3",
  5: "juz5",
  10: "juz10",
  15: "juz15",
  20: "juz20",
  30: "full",
};

/** عدد أسئلة الحفظ للفئات التلقائية غير الثابتة، بما ينسجم مع الفئات المعتمدة. */
const questionsForJuzCount = (juzCount: number): number =>
  Math.min(6, Math.max(3, Math.ceil(juzCount / 5) + 2));

/** اسم مناسب لعدد الأجزاء التراكمي المعروض في ملخص التوزيع. */
const labelForJuzCount = (juzCount: number): string => {
  if (juzCount === 1) return "جزء عمّ";
  if (juzCount === 2) return "جزآن";
  if (juzCount === 30) return "المصحف كامل";
  return juzCount <= 10 ? `${juzCount} أجزاء` : `${juzCount} جزءًا`;
};

/**
 * فئة الحفظ المناسبة لإجمالي تراكمي معيّن.
 * كل عدد صحيح يُعامل كفئة مستقلة، ونطاقه الافتراضي آخر N أجزاء من المصحف؛
 * فمثلًا 1 = جزء عمّ، و2 = الجزآن 29–30، و4 = الأجزاء 27–30.
 */
export const categoryForHifz = (totalHifz: number): HifzCategory | null => {
  const juzCount = Math.min(30, Math.max(0, Math.round(Number(totalHifz) || 0)));
  if (juzCount === 0) return null;

  const canonicalId = CANONICAL_CATEGORIES_BY_JUZ_COUNT[juzCount];
  if (canonicalId) return getCategory(canonicalId);

  return {
    id: `cumulative-${juzCount}`,
    label: labelForJuzCount(juzCount),
    juzCount,
    questions: questionsForJuzCount(juzCount),
  };
};

/**
 * تحديد فئة الطالب: قيمة صريحة من المعلم، أو تلقائيًا من إجمالي حفظه.
 * تُعيد `null` حين لا يوجد حفظ كافٍ لأي فئة.
 */
export const resolveStudentCategory = (
  totalHifz: number,
  categoryId?: string | null,
): HifzCategory | null => {
  if (categoryId && categoryId !== "auto") return getCategory(categoryId);
  return categoryForHifz(totalHifz);
};

export interface GenerateStudentPapersOptions {
  /** "auto" = فئة كل طالب من إجمالي حفظه، أو معرّف فئة موحّد للجميع */
  categoryId?: string | null;
  direction?: RangeDirection;
  /**
   * عدد النماذج المطلوب داخل الفئة الواحدة — اختيار المعلم الصريح.
   * بلا قيمة = تلقائي: موضع مستقل لكل طالب/ة حتى سقف فئته.
   */
  models?: number | null;
  /** دالة توليد عشوائي — تُمرَّر في الاختبارات لتثبيت النتائج */
  rng?: () => number;
  includeSupplements?: boolean;
}

/**
 * توليد نموذج لكل طالب في القائمة.
 * الطلاب ذوو الحفظ الأقل من جزء واحد يُتخطَّون مع سبب واضح.
 */
export const generateStudentPapers = (
  data: QuranData,
  students: StudentPaperInput[],
  opts: GenerateStudentPapersOptions = {},
): StudentPapersResult => {
  const direction: RangeDirection = opts.direction ?? "end";
  const explicitModels = Number.isFinite(opts.models ?? NaN)
    ? Math.min(HARD_MODEL_CEILING, Math.max(MIN_MODELS, Math.round(Number(opts.models))))
    : null; // تلقائي: موضع مستقل لكل طالب/ة حتى سقف الفئة

  // التجميع حسب العدد التراكمي الدقيق (في التلقائي)، أو حسب الفئة المختارة.
  // حفظ كائن الفئة نفسه مهم للفئات التلقائية ذات الأعداد غير الثابتة.
  const groups = new Map<string, { category: HifzCategory; students: StudentPaperInput[] }>();
  const skipped: StudentPapersResult["skipped"] = [];

  for (const student of students) {
    const category = resolveStudentCategory(student.totalHifz, opts.categoryId);
    if (!category) {
      skipped.push({ student, reason: "لا يوجد حفظ مسجّل يغطي فئة اختبار" });
      continue;
    }
    const group = groups.get(category.id);
    if (group) group.students.push(student);
    else groups.set(category.id, { category, students: [student] });
  }

  const papers: StudentPaper[] = [];
  const orderedGroups = [...groups.values()].sort(
    (a, b) =>
      a.category.juzCount - b.category.juzCount || a.category.id.localeCompare(b.category.id),
  );
  for (const { category, students: group } of orderedGroups) {
    // السقف الحقيقي للفئة: أكبر عدد نماذج يبقى لكلٍّ منها موضع مستقل
    const cap = maxFeasibleModels(data, category, direction);
    // الطلب = min(اختيار المعلم إن وُجد، عدد طلاب الفئة، سقف الفئة)،
    // وبلا أقل من الحد الأدنى. اختيار المعلم لعدد صغير مقصود (نماذج أقل
    // تميّزًا) لا يُرفع قسرًا؛ والزائدون عن العدد يعيدون استخدام المواضع.
    const wanted = Math.max(
      MIN_MODELS,
      Math.min(explicitModels ?? group.length, group.length, cap),
    );
    const attempts = [wanted, MIN_MODELS];
    let batch: ExamPaper[] | null = null;
    let lastError: Error | null = null;
    for (const count of attempts) {
      if (batch && count >= batch.length) continue;
      try {
        batch = generatePapers(data, {
          category,
          direction,
          models: count,
          rng: opts.rng,
          includeSupplements: opts.includeSupplements,
          allowBeyondMax: true,
        });
        break;
      } catch (err) {
        lastError = err as Error;
      }
    }
    if (!batch) {
      const reason = lastError?.message || "نطاق الحفظ لا يكفي لتوليد نماذج الفئة";
      for (const student of group) skipped.push({ student, reason });
      continue;
    }
    group.forEach((student, i) => {
      papers.push({
        student,
        category,
        paper: batch![i % batch!.length],
        orderInCategory: i + 1,
        categoryTotal: group.length,
      });
    });
  }

  return { papers, skipped };
};

/** عدد النماذج الفعلية المختلفة المستخدمة في النتيجة (للعرض في الواجهة) */
export const distinctPaperCount = (papers: StudentPaper[]): number =>
  new Set(papers.map((p) => `${p.category.id}:${p.paper.label}`)).size;

/** ملخص التوزيع حسب الإجمالي التراكمي — يُعرض للمعلم قبل الطباعة */
export const summarizeByCategory = (
  papers: StudentPaper[],
): { category: HifzCategory; count: number }[] => {
  const map = new Map<string, { category: HifzCategory; count: number }>();
  for (const p of papers) {
    const entry = map.get(p.category.id);
    if (entry) entry.count += 1;
    else map.set(p.category.id, { category: p.category, count: 1 });
  }
  const predefinedOrder = new Map(HIFZ_CATEGORIES.map((category, index) => [category.id, index]));
  return [...map.values()].sort((a, b) => {
    const juzDifference = a.category.juzCount - b.category.juzCount;
    if (juzDifference !== 0) return juzDifference;
    return (
      (predefinedOrder.get(a.category.id) ?? Number.MAX_SAFE_INTEGER) -
      (predefinedOrder.get(b.category.id) ?? Number.MAX_SAFE_INTEGER)
    );
  });
};

/**
 * تحويل طلاب الجدول إلى مدخلات التوليد: نحسب إجمالي الحفظ التراكمي
 * (الحفظ السابق + الحفظ الجديد، بحد أقصى 30 جزءًا).
 */
export const toStudentPaperInput = (student: {
  id: number;
  name: string;
  teacher?: string;
  gender?: string;
  yearData?: {
    baseHifz?: string;
    totalHifz?: string;
    parts?: string;
    teacher?: string;
  } | null;
}): StudentPaperInput => {
  const base = parseFloat(student.yearData?.baseHifz || "0") || 0;
  const parts = parseFloat(student.yearData?.parts || "0") || 0;
  const stored = parseFloat(student.yearData?.totalHifz || "0") || 0;
  return {
    id: student.id,
    name: student.name || "",
    teacher: student.teacher || student.yearData?.teacher || "",
    gender: student.gender,
    totalHifz: Math.min(30, Math.max(base + parts, stored)),
  };
};
