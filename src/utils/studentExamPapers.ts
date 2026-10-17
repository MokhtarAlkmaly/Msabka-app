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
 * التنفيذ: نجمع الطلاب حسب فئة الحفظ، ثم نولّد للفئة دفعة واحدة بعدد نماذج
 * يساوي عدد طلابها (بحدٍّ أقصى سقف الفئة من `maxFeasibleModels`)، ونوزّع
 * النماذج على الطلاب بالترتيب. عند تجاوز السقف نعيد الاستخدام من البداية.
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

/**
 * عتبات ربط إجمالي الحفظ بفئة من فئات الحفظ المعتمدة.
 * تُقرأ من الأعلى إلى الأسفل: أول حدّ يستوفي إجمالي الحفظ هو الفئة المختارة.
 * مثال: من حفظ 12 جزءًا يُختبر في فئة «10 أجزاء» (الأجزاء 21–30).
 */
const AUTO_CATEGORY_THRESHOLDS: { minHifz: number; categoryId: string }[] = [
  { minHifz: 30, categoryId: "full" },
  { minHifz: 20, categoryId: "juz20" },
  { minHifz: 15, categoryId: "juz15" },
  { minHifz: 10, categoryId: "juz10" },
  { minHifz: 5, categoryId: "juz5" },
  { minHifz: 3, categoryId: "juz3" },
  { minHifz: 1, categoryId: "juz29" },
];

/** فئة الحفظ المناسبة لإجمالي حفظ معيّن */
export const categoryForHifz = (totalHifz: number): HifzCategory | null => {
  const hifz = Math.min(30, Math.max(0, Math.round(Number(totalHifz) || 0)));
  const match = AUTO_CATEGORY_THRESHOLDS.find((t) => hifz >= t.minHifz);
  return match ? getCategory(match.categoryId) : null;
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

  // تجميع الطلاب حسب الفئة مع الحفاظ على ترتيبهم الأصلي داخل كل فئة
  const groups = new Map<string, StudentPaperInput[]>();
  const skipped: StudentPapersResult["skipped"] = [];

  for (const student of students) {
    const category = resolveStudentCategory(student.totalHifz, opts.categoryId);
    if (!category) {
      skipped.push({ student, reason: "لا يوجد حفظ مسجّل يغطي فئة اختبار" });
      continue;
    }
    const list = groups.get(category.id);
    if (list) list.push(student);
    else groups.set(category.id, [student]);
  }

  const papers: StudentPaper[] = [];
  for (const [categoryId, group] of groups) {
    const category = getCategory(categoryId);
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

/** ملخص التوزيع حسب الفئة — يُعرض للمعلم قبل الطباعة */
export const summarizeByCategory = (
  papers: StudentPaper[],
): { category: HifzCategory; count: number }[] => {
  const map = new Map<string, { category: HifzCategory; count: number }>();
  for (const p of papers) {
    const entry = map.get(p.category.id);
    if (entry) entry.count += 1;
    else map.set(p.category.id, { category: p.category, count: 1 });
  }
  // نفس ترتيب الفئات المعتمد في القائمة المنسدلة
  return HIFZ_CATEGORIES.filter((c) => map.has(c.id)).map((c) => map.get(c.id)!);
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
