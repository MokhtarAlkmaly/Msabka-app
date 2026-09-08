export interface SurahOption {
  number: number;
  name: string;
  ayahCount: number;
}

// قائمة السور الـ ١١٤ كاملة (رقم، اسم، عدد الآيات) — بيانات ثابتة موثوقة
// مضمَّنة مباشرة بالكود (مجموع الآيات = 6236، مطابق للمصحف الشريف)،
// بدون أي اعتماد على مكتبات خارجية، حتى تعمل القوائم المنسدلة دائماً
// بشكل مضمون 100% بغض النظر عن أي مشكلة بمكتبات إضافية.
export const SURAH_LIST: SurahOption[] = [
  { number: 1, name: "الفاتحة", ayahCount: 7 },
  { number: 2, name: "البقرة", ayahCount: 286 },
  { number: 3, name: "آل عمران", ayahCount: 200 },
  { number: 4, name: "النساء", ayahCount: 176 },
  { number: 5, name: "المائدة", ayahCount: 120 },
  { number: 6, name: "الأنعام", ayahCount: 165 },
  { number: 7, name: "الأعراف", ayahCount: 206 },
  { number: 8, name: "الأنفال", ayahCount: 75 },
  { number: 9, name: "التوبة", ayahCount: 129 },
  { number: 10, name: "يونس", ayahCount: 109 },
  { number: 11, name: "هود", ayahCount: 123 },
  { number: 12, name: "يوسف", ayahCount: 111 },
  { number: 13, name: "الرعد", ayahCount: 43 },
  { number: 14, name: "إبراهيم", ayahCount: 52 },
  { number: 15, name: "الحجر", ayahCount: 99 },
  { number: 16, name: "النحل", ayahCount: 128 },
  { number: 17, name: "الإسراء", ayahCount: 111 },
  { number: 18, name: "الكهف", ayahCount: 110 },
  { number: 19, name: "مريم", ayahCount: 98 },
  { number: 20, name: "طه", ayahCount: 135 },
  { number: 21, name: "الأنبياء", ayahCount: 112 },
  { number: 22, name: "الحج", ayahCount: 78 },
  { number: 23, name: "المؤمنون", ayahCount: 118 },
  { number: 24, name: "النور", ayahCount: 64 },
  { number: 25, name: "الفرقان", ayahCount: 77 },
  { number: 26, name: "الشعراء", ayahCount: 227 },
  { number: 27, name: "النمل", ayahCount: 93 },
  { number: 28, name: "القصص", ayahCount: 88 },
  { number: 29, name: "العنكبوت", ayahCount: 69 },
  { number: 30, name: "الروم", ayahCount: 60 },
  { number: 31, name: "لقمان", ayahCount: 34 },
  { number: 32, name: "السجدة", ayahCount: 30 },
  { number: 33, name: "الأحزاب", ayahCount: 73 },
  { number: 34, name: "سبإ", ayahCount: 54 },
  { number: 35, name: "فاطر", ayahCount: 45 },
  { number: 36, name: "يس", ayahCount: 83 },
  { number: 37, name: "الصافات", ayahCount: 182 },
  { number: 38, name: "ص", ayahCount: 88 },
  { number: 39, name: "الزمر", ayahCount: 75 },
  { number: 40, name: "غافر", ayahCount: 85 },
  { number: 41, name: "فصلت", ayahCount: 54 },
  { number: 42, name: "الشورى", ayahCount: 53 },
  { number: 43, name: "الزخرف", ayahCount: 89 },
  { number: 44, name: "الدخان", ayahCount: 59 },
  { number: 45, name: "الجاثية", ayahCount: 37 },
  { number: 46, name: "الأحقاف", ayahCount: 35 },
  { number: 47, name: "محمد", ayahCount: 38 },
  { number: 48, name: "الفتح", ayahCount: 29 },
  { number: 49, name: "الحجرات", ayahCount: 18 },
  { number: 50, name: "ق", ayahCount: 45 },
  { number: 51, name: "الذاريات", ayahCount: 60 },
  { number: 52, name: "الطور", ayahCount: 49 },
  { number: 53, name: "النجم", ayahCount: 62 },
  { number: 54, name: "القمر", ayahCount: 55 },
  { number: 55, name: "الرحمن", ayahCount: 78 },
  { number: 56, name: "الواقعة", ayahCount: 96 },
  { number: 57, name: "الحديد", ayahCount: 29 },
  { number: 58, name: "المجادلة", ayahCount: 22 },
  { number: 59, name: "الحشر", ayahCount: 24 },
  { number: 60, name: "الممتحنة", ayahCount: 13 },
  { number: 61, name: "الصف", ayahCount: 14 },
  { number: 62, name: "الجمعة", ayahCount: 11 },
  { number: 63, name: "المنافقون", ayahCount: 11 },
  { number: 64, name: "التغابن", ayahCount: 18 },
  { number: 65, name: "الطلاق", ayahCount: 12 },
  { number: 66, name: "التحريم", ayahCount: 12 },
  { number: 67, name: "الملك", ayahCount: 30 },
  { number: 68, name: "القلم", ayahCount: 52 },
  { number: 69, name: "الحاقة", ayahCount: 52 },
  { number: 70, name: "المعارج", ayahCount: 44 },
  { number: 71, name: "نوح", ayahCount: 28 },
  { number: 72, name: "الجن", ayahCount: 28 },
  { number: 73, name: "المزمل", ayahCount: 20 },
  { number: 74, name: "المدثر", ayahCount: 56 },
  { number: 75, name: "القيامة", ayahCount: 40 },
  { number: 76, name: "الإنسان", ayahCount: 31 },
  { number: 77, name: "المرسلات", ayahCount: 50 },
  { number: 78, name: "النبإ", ayahCount: 40 },
  { number: 79, name: "النازعات", ayahCount: 46 },
  { number: 80, name: "عبس", ayahCount: 42 },
  { number: 81, name: "التكوير", ayahCount: 29 },
  { number: 82, name: "الانفطار", ayahCount: 19 },
  { number: 83, name: "المطففين", ayahCount: 36 },
  { number: 84, name: "الانشقاق", ayahCount: 25 },
  { number: 85, name: "البروج", ayahCount: 22 },
  { number: 86, name: "الطارق", ayahCount: 17 },
  { number: 87, name: "الأعلى", ayahCount: 19 },
  { number: 88, name: "الغاشية", ayahCount: 26 },
  { number: 89, name: "الفجر", ayahCount: 30 },
  { number: 90, name: "البلد", ayahCount: 20 },
  { number: 91, name: "الشمس", ayahCount: 15 },
  { number: 92, name: "الليل", ayahCount: 21 },
  { number: 93, name: "الضحى", ayahCount: 11 },
  { number: 94, name: "الشرح", ayahCount: 8 },
  { number: 95, name: "التين", ayahCount: 8 },
  { number: 96, name: "العلق", ayahCount: 19 },
  { number: 97, name: "القدر", ayahCount: 5 },
  { number: 98, name: "البينة", ayahCount: 8 },
  { number: 99, name: "الزلزلة", ayahCount: 8 },
  { number: 100, name: "العاديات", ayahCount: 11 },
  { number: 101, name: "القارعة", ayahCount: 11 },
  { number: 102, name: "التكاثر", ayahCount: 8 },
  { number: 103, name: "العصر", ayahCount: 3 },
  { number: 104, name: "الهمزة", ayahCount: 9 },
  { number: 105, name: "الفيل", ayahCount: 5 },
  { number: 106, name: "قريش", ayahCount: 4 },
  { number: 107, name: "الماعون", ayahCount: 7 },
  { number: 108, name: "الكوثر", ayahCount: 3 },
  { number: 109, name: "الكافرون", ayahCount: 6 },
  { number: 110, name: "النصر", ayahCount: 3 },
  { number: 111, name: "المسد", ayahCount: 5 },
  { number: 112, name: "الإخلاص", ayahCount: 4 },
  { number: 113, name: "الفلق", ayahCount: 5 },
  { number: 114, name: "الناس", ayahCount: 6 },];

export const getSurahList = (): SurahOption[] => SURAH_LIST;

export const getAyahCount = (surah: number): number => {
  const found = SURAH_LIST.find((s) => s.number === surah);
  return found ? found.ayahCount : 0;
};

// ===== حساب رقم الصفحة (مصحف المدينة) — ميزة إضافية اختيارية =====
// تعتمد على مكتبة quran-meta لحساب عدد الأوجه تلقائياً. محمّلة بشكل
// كسول (lazy) ومحمية بالكامل: أي فشل بها لا يؤثر على القوائم المنسدلة
// أعلاه (اللي تعمل دائماً من البيانات الثابتة المضمَّنة)، وبس ميزة
// "حساب الأوجه التلقائي" تتعطل بهدوء وتحتاج إدخال يدوي عندها.
let hafsInstance: any = null;

const getHafs = async () => {
  if (!hafsInstance) {
    const { QuranRiwaya } = await import("quran-meta");
    hafsInstance = QuranRiwaya.hafs();
  }
  return hafsInstance;
};

export const getPageForAyahAsync = async (surah: number, ayah: number): Promise<number | null> => {
  if (!surah || !ayah) return null;
  try {
    const hafs = await getHafs();
    const ayahId = hafs.findAyahIdBySurah(surah, ayah);
    const meta = hafs.getAyahMeta(ayahId);
    return meta.page ?? null;
  } catch (e) {
    console.error("تعذر حساب رقم الصفحة (ميزة اختيارية):", e);
    return null;
  }
};

// نسخة متزامنة (تُرجع فوراً) تُستخدم بالحسابات الفورية بالواجهة —
// تعتمد على تخزين مؤقت يُملأ بالخلفية عبر warmupPageCache
const pageCache = new Map<string, number | null>();

export const warmupPageCache = async (points: { surah: number; ayah: number }[]) => {
  await Promise.all(points.map(async ({ surah, ayah }) => {
    if (!surah || !ayah) return;
    const key = `${surah}:${ayah}`;
    if (pageCache.has(key)) return;
    const page = await getPageForAyahAsync(surah, ayah);
    pageCache.set(key, page);
  }));
};

export const getPageForAyah = (surah: number, ayah: number): number | null => {
  if (!surah || !ayah) return null;
  const key = `${surah}:${ayah}`;
  return pageCache.has(key) ? pageCache.get(key)! : null;
};

// يحسب عدد الأوجه (صفحات مصحف المدينة) المقطوعة بين نقطتين (من - إلى)
// شامل الصفحتين، بحد أدنى وجه واحد. يرجع 0 إذا لم تُحسب الصفحات بعد
// (استخدم warmupPageCache أولاً أو getPagesBetweenAsync للنتيجة الفورية)
export const calcPagesBetween = (
  fromSurah: number,
  fromAyah: number,
  toSurah: number,
  toAyah: number
): number => {
  const fromPage = getPageForAyah(fromSurah, fromAyah);
  const toPage = getPageForAyah(toSurah, toAyah);
  if (fromPage === null || toPage === null) return 0;
  return Math.max(1, toPage - fromPage + 1);
};

export const calcPagesBetweenAsync = async (
  fromSurah: number,
  fromAyah: number,
  toSurah: number,
  toAyah: number
): Promise<number> => {
  const [fromPage, toPage] = await Promise.all([
    getPageForAyahAsync(fromSurah, fromAyah),
    getPageForAyahAsync(toSurah, toAyah),
  ]);
  if (fromPage === null || toPage === null) return 0;
  return Math.max(1, toPage - fromPage + 1);
};
