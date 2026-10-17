import { END_YEAR, START_YEAR, formatYearKey } from "@/types/student";

/**
 * منطق مشترك لبيانات المسابقات: نوع المسابقة، مفتاح العام في قاعدة البيانات،
 * وتسميات الحذف. كانت هذه التفاصيل مكرّرة داخل صفحة المسابقة، وأصبحت هنا
 * لأن أدوات الاستيراد/التصدير/الحذف انتقلت إلى صفحة الإعدادات بينما بقيت
 * صفحة المسابقة تقرأ نفس المفتاح.
 */

export type CompetitionType = "ramadan" | "dhul_hijjah";

/** نفس المفتاح الذي تكتبه وتقرأه صفحة المسابقة في localStorage. */
export const COMPETITION_TYPE_STORAGE_KEY = "competitionType";

export const COMPETITION_LABELS: Record<CompetitionType, string> = {
  ramadan: "المسابقة الرمضانية",
  dhul_hijjah: "مسابقة عشر ذي الحجة",
};

/** كل قيمة غير معروفة تسقط إلى النوع الافتراضي بدل كسر الصفحة. */
export const normalizeCompetitionType = (
  value: unknown,
  fallback: CompetitionType = "ramadan",
): CompetitionType => (value === "ramadan" || value === "dhul_hijjah" ? value : fallback);

/** "1447D" ← "1447"، و"1447" تبقى كما هي. */
export const competitionBaseYear = (key: string): string =>
  key.endsWith("D") ? key.slice(0, -1) : key;

/** مفتاح بيانات العام في القاعدة: 1447 لرمضان و1447D لعشر ذي الحجة. */
export const competitionYearKey = (year: string, type: CompetitionType): string => {
  const base = competitionBaseYear(year);
  return type === "dhul_hijjah" ? `${base}D` : base;
};

export const competitionLabelFor = (type: CompetitionType): string =>
  COMPETITION_LABELS[normalizeCompetitionType(type)];

/** نص العام للعرض داخل أدوات الإعدادات، مثال: «1447هـ · عشر ذي الحجة». */
export const competitionYearLabel = (year: string, type: CompetitionType): string =>
  formatYearKey(competitionYearKey(year, type));

/** الأعوام المتاحة في القائمة المنسدلة (نصوص لتوافق مكوّن Select). */
export const competitionYears = (): string[] =>
  Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => String(START_YEAR + i));

/** قراءة نوع المسابقة المحفوظ، بأمان خارج المتصفح وعند تلف القيمة. */
export const readStoredCompetitionType = (
  fallback: CompetitionType = "ramadan",
): CompetitionType => {
  if (typeof localStorage === "undefined") return fallback;
  try {
    return normalizeCompetitionType(localStorage.getItem(COMPETITION_TYPE_STORAGE_KEY), fallback);
  } catch {
    return fallback;
  }
};

/** حفظ نوع المسابقة ليُفتح عليه في صفحة المسابقة أيضاً. */
export const storeCompetitionType = (type: CompetitionType): void => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(COMPETITION_TYPE_STORAGE_KEY, normalizeCompetitionType(type));
  } catch {
    // تجاهل فشل التخزين (وضع خاص/تخزين ممتلئ) — الاختيار يبقى سارياً في الجلسة.
  }
};

/** أنماط حذف بيانات المسابقة بعد نقلها من صفحة المسابقة إلى الإعدادات. */
export type CompetitionDeleteMode = "year" | "selected";

export const COMPETITION_DELETE_MODES: Record<
  CompetitionDeleteMode,
  { title: string; description: string; phrase: string }
> = {
  year: {
    title: "حذف بيانات المسابقة لعام كامل",
    description: "يحذف درجات وحفظ هذا العام/المسابقة فقط، ويبقى الطلاب وسجلاتهم العامة كما هي.",
    phrase: "حذف بيانات المسابقة",
  },
  selected: {
    title: "حذف طلاب محددين من المسابقة",
    description: "يفصل الطلاب المحددين عن هذه المسابقة فقط دون حذف سجلاتهم العامة.",
    phrase: "حذف الطلاب",
  },
};

export const competitionDeletePhrase = (mode: CompetitionDeleteMode): string =>
  COMPETITION_DELETE_MODES[mode]?.phrase ?? COMPETITION_DELETE_MODES.year.phrase;
