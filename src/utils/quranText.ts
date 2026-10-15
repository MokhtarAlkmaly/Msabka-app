import { SURAH_LIST } from "@/utils/quranData";

/**
 * نص المصحف الشريف (الرواية العثمانية) — يُحمَّل مرة واحدة من ملف ثابت
 * (`public/quran/uthmani.json`) مولَّد عبر `npm run quran:extract`.
 *
 * الملف يعمل دون إنترنت (أصل ثابت داخل التطبيق/الموقع)، ويحتوي:
 *   - نصوص الآيات الـ٦٢٣٦ كاملة.
 *   - بداية كل جزء من الأجزاء الثلاثين (برقم الآية العام 1..6236).
 *   - رقم صفحة مصحف المدينة لكل آية.
 */
export interface QuranData {
  format?: string;
  source?: string;
  totalAyahs: number;
  /** رقم الآية العام (1..6236) لبداية كل جزء — 30 عنصرًا */
  juzStarts: number[];
  /** رقم صفحة مصحف المدينة لكل آية (الفهرس = رقم الآية العام - 1) */
  pages: number[];
  /** 114 مصفوفة، كل واحدة تحتوي نصوص آيات السورة */
  surahs: string[][];
}

export const TOTAL_AYAHS = 6236;
export const JUZ_COUNT = 30;

/** متوسط أحرف السطر في مصحف المدينة (15 سطرًا × 604 صفحات = 9060 سطرًا)
 *  محسوب من النص نفسه: 700,236 حرفًا ÷ 9,060 سطرًا ≈ 77 حرفًا. */
export const CHARS_PER_LINE = 77;

/** أرقام الآيات العامة لبداية كل سورة ونهايتها (1-based) */
const SURAH_FIRST_ID: number[] = (() => {
  const out: number[] = [];
  let id = 1;
  for (const s of SURAH_LIST) {
    out.push(id);
    id += s.ayahCount;
  }
  return out;
})();

const SURAH_LAST_ID: number[] = SURAH_LIST.map((s, i) => SURAH_FIRST_ID[i] + s.ayahCount - 1);

/** مسار ملف نص المصحف داخل أصول الموقع/التطبيق */
const dataUrl = () => `${import.meta.env?.BASE_URL ?? "/"}quran/uthmani.json`;

let dataPromise: Promise<QuranData> | null = null;

/** يحمّل نص المصحف (مرة واحدة، ثم يُخزَّن في الذاكرة) */
export const loadQuranData = (): Promise<QuranData> => {
  if (!dataPromise) {
    dataPromise = fetch(dataUrl())
      .then((res) => {
        if (!res.ok) throw new Error(`تعذّر تحميل نص المصحف (${res.status})`);
        return res.json() as Promise<QuranData>;
      })
      .then((data) => {
        if (!Array.isArray(data?.surahs) || data.surahs.length !== 114) {
          throw new Error("ملف نص المصحف غير صالح");
        }
        return data;
      })
      .catch((err) => {
        dataPromise = null; // إعادة المحاولة مسموحة في الطلب التالي
        throw err;
      });
  }
  return dataPromise;
};

export const isQuranDataLoaded = () => dataPromise !== null;

// ===== حسابات المواضع =====

/** رقم الآية العام (1..6236) من رقم السورة ورقم الآية داخلها */
export const toGlobalId = (surah: number, ayah: number): number => {
  const first = SURAH_FIRST_ID[surah - 1];
  if (!first || ayah < 1) return 0;
  return first + ayah - 1;
};

/** رقم السورة ورقم الآية من رقم الآية العام */
export const fromGlobalId = (id: number): { surah: number; ayah: number } => {
  const clamped = Math.min(Math.max(1, Math.floor(id)), TOTAL_AYAHS);
  let surah = 114;
  for (let i = 0; i < SURAH_FIRST_ID.length; i++) {
    if (clamped < SURAH_FIRST_ID[i]) {
      surah = i; // السورة السابقة
      break;
    }
  }
  return { surah, ayah: clamped - SURAH_FIRST_ID[surah - 1] + 1 };
};

export const surahFirstId = (surah: number): number => SURAH_FIRST_ID[surah - 1] ?? 1;
export const surahLastId = (surah: number): number => SURAH_LAST_ID[surah - 1] ?? TOTAL_AYAHS;
export const surahName = (surah: number): string => SURAH_LIST[surah - 1]?.name ?? "";
export const surahAyahCount = (surah: number): number => SURAH_LIST[surah - 1]?.ayahCount ?? 0;

/** الآية الأخيرة في الجزء (رقم عام) */
export const juzFirstId = (data: QuranData, juz: number): number =>
  data.juzStarts[Math.min(Math.max(1, juz), JUZ_COUNT) - 1] ?? 1;

export const juzLastId = (data: QuranData, juz: number): number =>
  juz >= JUZ_COUNT ? TOTAL_AYAHS : juzFirstId(data, juz + 1) - 1;

/** الجزء الذي تنتمي إليه آية برقمها العام */
export const juzOf = (data: QuranData, id: number): number => {
  let juz = 1;
  for (let i = 0; i < data.juzStarts.length; i++) {
    if (id >= data.juzStarts[i]) juz = i + 1;
    else break;
  }
  return juz;
};

/** رقم صفحة مصحف المدينة للآية */
export const pageOf = (data: QuranData, id: number): number => data.pages?.[id - 1] ?? 0;

/** نص آية من الأرقام العامة */
export const ayahText = (data: QuranData, id: number): string => {
  const { surah, ayah } = fromGlobalId(id);
  return data.surahs[surah - 1]?.[ayah - 1] ?? "";
};

/** نص آية من السورة ورقم الآية داخلها */
export const ayahTextAt = (data: QuranData, surah: number, ayah: number): string =>
  data.surahs[surah - 1]?.[ayah - 1] ?? "";

// ===== اقتباس أوائل الكلمات وأواخرها =====

export const wordsOf = (text: string): string[] => (text || "").split(/\s+/).filter(Boolean);

/** أول كلمات الآية (بعددها، أو الآية كاملة إن كانت أقصر) */
export const firstWords = (text: string, count = 4): string => {
  const words = wordsOf(text);
  return words.slice(0, Math.max(1, count)).join(" ");
};

/** آخر كلمات الآية (بعددها، أو الآية كاملة إن كانت أقصر) */
export const lastWords = (text: string, count = 4): string => {
  const words = wordsOf(text);
  return words.slice(Math.max(0, words.length - Math.max(1, count))).join(" ");
};

export const extractFirstWords = (data: QuranData, id: number, count = 4): string => {
  const { surah, ayah } = fromGlobalId(id);
  let text = ayahText(data, id);
  // احتياط: بعض المصادر تُضمِّن البسملة في أول آية من كل سورة (ما عدا الفاتحة وبراءة)
  if (surah !== 1 && ayah === 1) {
    const basmala = wordsOf(ayahTextAt(data, 1, 1)).join(" ");
    const words = wordsOf(text);
    if (basmala && words.slice(0, 4).join(" ") === basmala) {
      text = words.slice(4).join(" ");
    }
  }
  return firstWords(text, count);
};

/** تقدير عدد أسطر المقطع في مصحف المدينة من عدد أحرفه */
export const estimateLines = (chars: number, charsPerLine = CHARS_PER_LINE): number =>
  Math.max(1, Math.round((chars / charsPerLine) * 10) / 10);
