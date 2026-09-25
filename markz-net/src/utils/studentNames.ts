/**
 * أدوات التعامل مع أسماء الطلاب — وعلى وجه الخصوص كشف الأسماء المكررة.
 *
 * التطبيع مُصمم خصيصًا للبيانات العربية المدخلة يدويًا، بحيث تُطابَق
 * الاختلافات الشائعة في الإدخال (مسافات زائدة، تشكيل، تطويل، أشكال الألف
 * والياء والتاء المربوطة) دون تغيير الاسم المعروض للمستخدم.
 */

/** التشكيل والعلامات القرآنية (تنوين/مد/سكون/مد/كان..) */
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
/** التطويل (كشيدة) */
const TATWEEL = /ـ/g;
/** أي تسلسل من المسافات بما فيها المسافة غير المنقسمة */
const WHITESPACE_RUN = /\s+/g;

/**
 * يُعيد الصيغة الموحّدة للاسم لاستخدامها في المقارنة فقط.
 * مثال: "  أحمد  محمَّد "  →  "احمد محمد"
 */
export function normalizeStudentName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱﺎ]/g, "ا") // توحيد صور الألف
    .replace(/ى/g, "ي") // توحيد الألف المقصورة
    .replace(/ة/g, "ه") // توحيد التاء المربوطة (شائع في الإدخال اليدوي)
    .replace(WHITESPACE_RUN, " ")
    .trim();
}

/**
 * يحسب عدد مرات تكرار كل اسم (بعد التطبيع) في قائمة الطلاب.
 * يُرجع Map لا يتضمن إلا الأسماء المكررة (التي ظهرت أكثر من مرة)،
 * ويتجاهل الأسماء الفارغة.
 */
export function getDuplicateNameCounts(
  students: Array<{ name?: string | null }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of students) {
    const normalized = normalizeStudentName(s.name);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  for (const [key, count] of counts) {
    if (count < 2) counts.delete(key);
  }
  return counts;
}

/**
 * يُرجع عدد مرات تكرار اسم الطالب المعطى (0 أو 1 يعني غير مكرر).
 */
export function getDuplicateCountFor(
  name: string | null | undefined,
  duplicateCounts: Map<string, number>,
): number {
  const normalized = normalizeStudentName(name);
  if (!normalized) return 0;
  return duplicateCounts.get(normalized) || 0;
}
