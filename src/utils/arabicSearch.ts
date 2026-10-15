/**
 * أدوات البحث العربي الموحّدة للاستخدام في كل صفحات التطبيق.
 *
 * البيانات العربية تُدخَل يدويًا، فتختلف صور الألف والياء والتاء المربوطة
 * وتظهر التشكيلات والمسافات الزائدة. البحث الحرفي (`String.includes`) يجعل
 * «احمد» لا يجد «أحمد»، والحل هنا تطبيع النصَّين (المحرَّك والمفتاح) قبل
 * المقارنة دون تغيير النص المعروض للمستخدم.
 */

/** التشكيل والعلامات القرآنية (تنوين/مد/سكون/علامات وقف..) */
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g;
/** التطويل (كشيدة) */
const TATWEEL = /ـ/g;
/** أي تسلسل من المسافات بما فيها المسافة غير المنقسمة */
const WHITESPACE_RUN = /\s+/g;

/**
 * يُعيد الصيغة الموحّدة للنص للاستخدام في المقارنة فقط.
 * مثال: "  أحمد  محمَّد " → "احمد محمد"
 *
 * يوحّد: التشكيل، التطويل، صور الألف (أإآٱ)، الألف المقصورة (ى)،
 * التاء المربوطة (ة→ه)، المسافات الزائدة، وحروف اللاتينية الكبيرة.
 */
export function normalizeArabic(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱﺎ]/g, "ا") // توحيد صور الألف
    .replace(/ى/g, "ي") // توحيد الألف المقصورة
    .replace(/ة/g, "ه") // توحيد التاء المربوطة (شائع في الإدخال اليدوي)
    .replace(WHITESPACE_RUN, " ")
    .trim()
    .toLowerCase();
}

/**
 * هل يحتوي `haystack` على `needle` بعد التطبيع العربي؟
 *
 * - المفتاح الفارغ يطابق كل شيء (كـ `String.includes`).
 * - المفتاح المتعدد كلمات يطابق إذا وُجدت كل كلمة في أي ترتيب:
 *   «محمد احمد» يجد «أحمد بن محمد».
 * - المسافات لا تؤثر: «عبد الله» يجد «عبدالله» والعكس.
 */
export function arabicIncludes(
  haystack: string | null | undefined,
  needle: string | null | undefined,
): boolean {
  const normalizedHaystack = normalizeArabic(haystack);
  const normalizedNeedle = normalizeArabic(needle);
  if (!normalizedNeedle) return true;
  // نسخة بلا مسافات تُغلق فجوة الأسماء المركبة (عبد الله / عبدالله)
  const compactHaystack = normalizedHaystack.replace(/ /g, "");
  return normalizedNeedle.split(" ").every((token) => {
    if (token === "") return true;
    return normalizedHaystack.includes(token) || compactHaystack.includes(token.replace(/ /g, ""));
  });
}

/**
 * هل يطابق المفتاح أيَّ من الحقول المفردة؟ (للبحث في صف كامل)
 * مثال: `arabicIncludesAny(q, [row.student_name, row.competition_name])`
 */
export function arabicIncludesAny(
  needle: string | null | undefined,
  haystacks: Array<string | null | undefined>,
): boolean {
  return haystacks.some((haystack) => arabicIncludes(haystack, needle));
}
