import {
  buildSupplementPool,
  pickSupplements,
  type SupplementQuestion,
} from "@/utils/examSupplementQuestions";
import {
  CHARS_PER_LINE,
  JUZ_COUNT,
  type QuranData,
  estimateLines,
  extractFirstWords,
  fromGlobalId,
  juzFirstId,
  juzLastId,
  juzOf,
  lastWords,
  pageOf,
  surahLastId,
  surahName,
  ayahText,
} from "@/utils/quranText";

/**
 * مولّد أسئلة الاختبارات من المصحف حسب فئة الحفظ.
 * ------------------------------------------------------------------
 * صيغة السؤال: «اقرأ من قوله تعالى ﴿أول الكلمات﴾ إلى قوله تعالى ﴿آخر الكلمات﴾»
 * بطول نحو 10 آيات أو ما يقارب 5 أسطر من مصحف المدينة (أقصرُهما)، ولا يقل عن
 * آيتين ولا يتجاوز حدّ السورة.
 */

/** عدد كلمات الاقتباس من أول المقطع وآخره */
export const QUOTE_WORDS = 4;
/** الحد الأقصى لعدد الآيات في السؤال */
export const MAX_AYAHS = 10;
/** الحد الأدنى لعدد الآيات في السؤال */
export const MIN_AYAHS = 2;
/** الطول المستهدف للسؤال بالأسطر (مصحف المدينة) */
export const TARGET_LINES = 5;

export type RangeDirection = "end" | "start";

export interface HifzCategory {
  id: string;
  /** الاسم كما يظهر للمعلم/المعلمة */
  label: string;
  /** عدد الأجزاء التي تشملها الفئة */
  juzCount: number;
  /** عدد أسئلة النموذج الواحد */
  questions: number;
  /** فئة جزء واحد محدَّد (جزء عمّ = 30، جزء تبارك = 29) */
  singleJuz?: number;
  /** تقسيم الأجزاء إلى مجموعات ثابتة (المصحف كامل: سؤال من كل 5 أجزاء) */
  blocksOfJuz?: number;
}

export const HIFZ_CATEGORIES: HifzCategory[] = [
  { id: "juz30", label: "جزء عمّ", juzCount: 1, questions: 3, singleJuz: 30 },
  { id: "juz29", label: "جزء تبارك", juzCount: 1, questions: 3, singleJuz: 29 },
  { id: "juz3", label: "3 أجزاء", juzCount: 3, questions: 3 },
  { id: "juz5", label: "5 أجزاء", juzCount: 5, questions: 3 },
  { id: "juz10", label: "10 أجزاء", juzCount: 10, questions: 4 },
  { id: "juz15", label: "15 جزءًا", juzCount: 15, questions: 5 },
  { id: "juz20", label: "20 جزءًا", juzCount: 20, questions: 6 },
  { id: "full", label: "المصحف كامل", juzCount: 30, questions: 6, blocksOfJuz: 5 },
];

export const getCategory = (id: string): HifzCategory =>
  HIFZ_CATEGORIES.find((c) => c.id === id) ?? HIFZ_CATEGORIES[0];

export const MIN_MODELS = 2;
/** طول قائمة الاختيار اليدوي في واجهات النماذج — وسقف التوليد الافتراضي */
export const MAX_MODELS = 30;
/**
 * الحد الأقصى العملي عند رفع السقف (توليد أوراق الطلاب): حدٌّ لحجم مستند
 * الطباعة وزمن تجهيز PDF، لا حدٌّ رياضي — سقف كل فئة يحدّده `maxFeasibleModels`.
 */
export const HARD_MODEL_CEILING = 200;
export const MODEL_LABELS = Array.from({ length: MAX_MODELS }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);

/** تسمية النموذج حسب ترتيبه: 01…30 من القائمة المعتمدة، ثم 031…200 بثلاث خانات */
export const modelLabel = (index: number): string =>
  index < MODEL_LABELS.length ? MODEL_LABELS[index] : String(index + 1).padStart(3, "0");

export interface JuzRange {
  fromJuz: number;
  toJuz: number;
}

/** نطاق الأجزاء لفئة الحفظ حسب اتجاه النطاق (من آخر المصحف أو من أوله) */
export const resolveJuzRange = (category: HifzCategory, direction: RangeDirection): JuzRange => {
  if (category.singleJuz) {
    return { fromJuz: category.singleJuz, toJuz: category.singleJuz };
  }
  if (category.juzCount >= JUZ_COUNT) return { fromJuz: 1, toJuz: JUZ_COUNT };
  return direction === "start"
    ? { fromJuz: 1, toJuz: category.juzCount }
    : { fromJuz: JUZ_COUNT - category.juzCount + 1, toJuz: JUZ_COUNT };
};

/** وصف مختصر لنطاق الفئة، مثال: «الجزء 30» أو «الأجزاء 28–30» */
export const describeJuzRange = (range: JuzRange): string =>
  range.fromJuz === range.toJuz
    ? `الجزء ${range.fromJuz}`
    : `الأجزاء ${range.fromJuz}–${range.toJuz}`;

/** توزيع عدد صحيح على أجزاء متساوية قدر الإمكان */
const splitEvenly = (total: number, parts: number): number[] => {
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
};

export interface AyahBlock {
  fromId: number;
  toId: number;
  juzFrom: number;
  juzTo: number;
}

/** تقسيم نطاق الفئة إلى مقاطع آيات، لكل مقطع سؤال واحد */
export const buildAyahBlocks = (
  data: QuranData,
  category: HifzCategory,
  range: JuzRange,
): AyahBlock[] => {
  const rangeFirst = juzFirstId(data, range.fromJuz);
  const rangeLast = juzLastId(data, range.toJuz);
  const questions = Math.max(1, category.questions);

  // المصحف كامل: سؤال من كل 5 أجزاء (1–5، 6–10، ... 26–30)
  if (category.blocksOfJuz) {
    const size = category.blocksOfJuz;
    const blocks: AyahBlock[] = [];
    for (let juz = range.fromJuz; juz <= range.toJuz; juz += size) {
      const lastJuz = Math.min(juz + size - 1, range.toJuz);
      blocks.push({
        fromId: juzFirstId(data, juz),
        toId: juzLastId(data, lastJuz),
        juzFrom: juz,
        juzTo: lastJuz,
      });
    }
    return blocks;
  }

  // فئة تشمل عددًا من الأجزاء يقبل القسمة على عدد الأسئلة → سؤال لكل مجموعة أجزاء
  if (category.juzCount >= questions && category.juzCount % questions === 0) {
    const perBlock = category.juzCount / questions;
    const blocks: AyahBlock[] = [];
    for (let i = 0; i < questions; i++) {
      const fromJuz = range.fromJuz + i * perBlock;
      const toJuz = fromJuz + perBlock - 1;
      blocks.push({
        fromId: juzFirstId(data, fromJuz),
        toId: juzLastId(data, toJuz),
        juzFrom: fromJuz,
        juzTo: toJuz,
      });
    }
    return blocks;
  }

  // غير ذلك: توزيع متساوٍ على عدد الآيات في نطاق الفئة
  const totalAyahs = rangeLast - rangeFirst + 1;
  const sizes = splitEvenly(totalAyahs, questions);
  const blocks: AyahBlock[] = [];
  let cursor = rangeFirst;
  for (const size of sizes) {
    const fromId = cursor;
    const toId = Math.min(cursor + size - 1, rangeLast);
    blocks.push({ fromId, toId, juzFrom: juzOf(data, fromId), juzTo: juzOf(data, toId) });
    cursor = toId + 1;
  }
  return blocks;
};

export interface PaperQuestion {
  number: number;
  /** رقم الآية العام لبداية المقطع ونهايته */
  fromId: number;
  toId: number;
  surah: number;
  surahName: string;
  fromAyah: number;
  toAyah: number;
  /** كلمات الاقتباس من أول المقطع وآخره */
  firstQuote: string;
  lastQuote: string;
  ayahCount: number;
  lines: number;
  juzFrom: number;
  juzTo: number;
  pageFrom: number;
  pageTo: number;
}

export interface ExamPaper {
  index: number;
  label: string;
  /** مثال: «النموذج (أ)» */
  title: string;
  categoryLabel: string;
  rangeLabel: string;
  questions: PaperQuestion[];
  supplements: SupplementQuestion[];
}

/** صيغة السؤال كما تُطبع في ورقة الاختبار */
export const formatQuestionText = (q: PaperQuestion): string =>
  `اقرأ من قوله تعالى ﴿${q.firstQuote}﴾ إلى قوله تعالى ﴿${q.lastQuote}﴾`;

/** مرجع السؤال للمصحّح: السورة والآيات والصفحة */
export const formatQuestionRef = (q: PaperQuestion): string =>
  `سورة ${q.surahName}: من الآية ${q.fromAyah} إلى الآية ${q.toAyah}` +
  (q.pageFrom === q.pageTo ? ` — صفحة ${q.pageFrom}` : ` — صفحات ${q.pageFrom}–${q.pageTo}`);

interface Passage {
  fromId: number;
  toId: number;
  chars: number;
}

/**
 * يبني مقطعًا يبدأ من آية محدَّدة ولا يتجاوز (عدد الآيات المستهدف أو الطول
 * المستهدف بالأسطر) ولا يخرج عن نهاية السورة ولا عن حدّ المقطع المسموح.
 */
const buildPassage = (data: QuranData, startId: number, hardEndId: number): Passage => {
  const { surah } = fromGlobalId(startId);
  // لا يخرج المقطع عن نهاية السورة ولا عن حدّ المقطع (خانة النموذج) المسموح
  const limit = Math.min(hardEndId, surahLastId(surah));
  const targetChars = TARGET_LINES * CHARS_PER_LINE;
  let toId = startId;
  let count = 0;
  let chars = 0;
  for (let id = startId; id <= limit; id++) {
    // نتوقف عند بلوغ 10 آيات، أو عند بلوغ الطول المستهدف بعد آيتين على الأقل
    if (count >= MAX_AYAHS) break;
    if (count >= MIN_AYAHS && chars >= targetChars) break;
    chars += ayahText(data, id).length;
    count++;
    toId = id;
  }
  return { fromId: startId, toId, chars };
};

/** اختيار موضع عشوائي داخل مدى معيّن */
const randomInt = (rng: () => number, min: number, max: number): number => {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
};

export interface GenerateOptions {
  category: HifzCategory;
  /** عدد النماذج 2..30 (وما يصل إلى HARD_MODEL_CEILING مع allowBeyondMax) */
  models: number;
  direction?: RangeDirection;
  rng?: () => number;
  includeSupplements?: boolean;
  /** رفع سقف التوليد من MAX_MODELS إلى HARD_MODEL_CEILING — لتوليد أوراق الطلاب */
  allowBeyondMax?: boolean;
}

/**
 * توليد النماذج: كل نموذج يحصل على مواضع مختلفة داخل نفس المقاطع، مع توزيع
 * المواضع على خانات متساوية لمنع التكرار والتراكب بين النماذج.
 */
export const generatePapers = (data: QuranData, opts: GenerateOptions): ExamPaper[] => {
  const rng = opts.rng ?? Math.random;
  const direction: RangeDirection = opts.direction ?? "end";
  const ceiling = opts.allowBeyondMax ? HARD_MODEL_CEILING : MAX_MODELS;
  const models = Math.min(
    ceiling,
    Math.max(MIN_MODELS, Math.round(Number.isFinite(opts.models) ? opts.models : MIN_MODELS)),
  );
  const category = opts.category;
  const range = resolveJuzRange(category, direction);
  const blocks = buildAyahBlocks(data, category, range);
  const rangeLabel = describeJuzRange(range);

  const supplementPool = opts.includeSupplements === false ? [] : buildSupplementPool(data, range);
  // خلط البنك مرة واحدة ينوّع مواضع التجويد والمعاني في كل توليد.
  for (let i = supplementPool.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [supplementPool[i], supplementPool[j]] = [supplementPool[j], supplementPool[i]];
  }
  const papers: ExamPaper[] = [];
  for (let m = 0; m < models; m++) {
    papers.push({
      index: m,
      label: modelLabel(m),
      title: `النموذج (${modelLabel(m)})`,
      categoryLabel: category.label,
      rangeLabel,
      supplements: pickSupplements(supplementPool, m),
      questions: blocks.map((block, b) => {
        const blockLength = block.toId - block.fromId + 1;
        // خانة كل نموذج داخل المقطع — تضمن مواضع مختلفة ومنفصلة
        const slotSize = Math.max(1, Math.floor(blockLength / models));
        const slotFrom = block.fromId + m * slotSize;
        const slotTo =
          m === models - 1
            ? block.toId
            : Math.min(block.fromId + (m + 1) * slotSize - 1, block.toId);
        // لا نختار آخر آية من الخانة أو السورة: ضمان آيتين على الأقل
        // مهم عند توليد ٣٠ نموذجًا، حيث تصبح الخانات أصغر.
        const candidates: number[] = [];
        for (let id = slotFrom; id < slotTo; id++) {
          if (id < surahLastId(fromGlobalId(id).surah)) candidates.push(id);
        }
        if (!candidates.length) throw new Error("نطاق الحفظ لا يكفي لعدد النماذج المطلوب");
        const startId = candidates[randomInt(rng, 0, candidates.length - 1)];
        const passage = buildPassage(data, startId, slotTo);
        const from = fromGlobalId(passage.fromId);
        const to = fromGlobalId(passage.toId);
        return {
          number: b + 1,
          fromId: passage.fromId,
          toId: passage.toId,
          surah: from.surah,
          surahName: surahName(from.surah),
          fromAyah: from.ayah,
          toAyah: to.ayah,
          firstQuote: extractFirstWords(data, passage.fromId, QUOTE_WORDS),
          lastQuote: lastWords(ayahText(data, passage.toId), QUOTE_WORDS),
          ayahCount: passage.toId - passage.fromId + 1,
          lines: estimateLines(passage.chars),
          juzFrom: juzOf(data, passage.fromId),
          juzTo: juzOf(data, passage.toId),
          pageFrom: pageOf(data, passage.fromId),
          pageTo: pageOf(data, passage.toId),
        };
      }),
    });
  }
  return papers;
};

/** اللقب المناسب لورقة الاختبار حسب الجنس المسجّل (ذكر/أنثى/بدون) */
export const studentTitle = (gender?: string): string => {
  const value = (gender || "").trim().toLowerCase();
  if (value === "أنثى" || value === "انثى" || value === "female") return "الطالبة";
  if (value === "ذكر" || value === "male") return "الطالب";
  return "الطالب/ة";
};

/** أكبر عدد أسئلة ممكن في نموذج لفئة معيّنة (يُستخدم في التحقق قبل التوليد) */
export const categoryQuestionCount = (category: HifzCategory, data?: QuranData): number => {
  if (!data) return category.questions;
  const range = resolveJuzRange(category, "end");
  return buildAyahBlocks(data, category, range).length;
};

/**
 * السقف الحقيقي لعدد النماذج في فئة: أكبر عدد يبقى لكل نموذجٍ فيه موضع مستقل.
 * ------------------------------------------------------------------
 * القاعدة هنا مطابقة حرفيًا لمرشّحات بدايات المقاطع في `generatePapers`:
 * خانة كل نموذج داخل المقطع هي `slotFrom…slotTo`، والبدايات المقبولة منها
 * هي حتى `slotTo - 1` — لأن `buildPassage` يحدّ المقطع بآية الخانة الأخيرة
 * (فلا يعبر إلى خانة النموذج التالي) وبنهاية السورة — ولا تُقبل بداية عند
 * آخر آية في السورة (ضمان آيتين على الأقل). تُفشل الدفعة بمجرد خلوّ خانة
 * واحدة من بداية صالحة، وهذا هو السقف.
 */
export const maxFeasibleModels = (
  data: QuranData,
  category: HifzCategory,
  direction: RangeDirection = "end",
): number => {
  const range = resolveJuzRange(category, direction);
  const blocks = buildAyahBlocks(data, category, range);
  /** هل لخانة نموذجٍ معيّن بداية صالحة واحدة على الأقل؟ (نفس حلقة المولّد) */
  const hasCandidate = (block: AyahBlock, models: number, m: number): boolean => {
    const blockLength = block.toId - block.fromId + 1;
    const slotSize = Math.max(1, Math.floor(blockLength / models));
    const slotFrom = block.fromId + m * slotSize;
    const slotTo =
      m === models - 1 ? block.toId : Math.min(block.fromId + (m + 1) * slotSize - 1, block.toId);
    for (let id = slotFrom; id < slotTo; id++) {
      if (id < surahLastId(fromGlobalId(id).surah)) return true;
    }
    return false;
  };
  for (let models = HARD_MODEL_CEILING; models > MIN_MODELS; models--) {
    if (
      blocks.every((block) => {
        for (let m = 0; m < models; m++) {
          if (!hasCandidate(block, models, m)) return false;
        }
        return true;
      })
    ) {
      return models;
    }
  }
  return MIN_MODELS;
};
