/**
 * تنزيل صفحات السحابة بالكامل — وحدة نقية (بلا استيراد لـ Supabase).
 *
 * لماذا؟
 *  - Supabase يقطع أي استعلام عند **1000 صف** بصمت: من لديه 1200 سجل مستفيد
 *    كان سيرى 1000 فقط دون أي تنبيه.
 *  - منطق «التنزيل المحصور بقسم/عام واحد» في المرحلة 5 يحتاج نفس الحلقة في
 *    ثلاثة مواضع، فصار هنا مرة واحدة قابلة للاختبار.
 *
 * الاستخدام: تُمرَّر دالة جلب واحدة `(from, to) => rows`، فتبقى الوحدة نقية
 * ويبقى اختبارها ممكناً بلا شبكة ولا عميل Supabase.
 */

/** حجم الصفحة الافتراضي (نصف سقف Supabase — 1000). */
export const CLOUD_PAGE_SIZE = 500;

/** حدّ أمان: أكثر من هذا العدد يعني خطأً في الاستعلام لا بيانات حقيقية. */
export const CLOUD_MAX_ROWS = 100_000;

export type PageFetcher<T> = (from: number, to: number) => Promise<T[]>;

export type FetchAllPagesOptions = {
  pageSize?: number;
  maxRows?: number;
};

/**
 * يجلب كل الصفوف صفحةً صفحةً حتى تعود صفحة ناقصة (علامة النهاية).
 *
 * @throws خطأ عربي عند تجاوز `maxRows` — صمت الاستعلام أسوأ من فشله.
 */
export const fetchAllPages = async <T>(
  fetchPage: PageFetcher<T>,
  options: FetchAllPagesOptions = {},
): Promise<T[]> => {
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? CLOUD_PAGE_SIZE));
  const maxRows = Math.max(pageSize, Math.floor(options.maxRows ?? CLOUD_MAX_ROWS));

  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = (await fetchPage(offset, offset + pageSize - 1)) ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
    if (rows.length >= maxRows) {
      throw new Error(
        `تجاوز التنزيل حدّ الأمان (${maxRows} صفًا) — توقّف التنزيل لتفادي استهلاك الذاكرة.`,
      );
    }
  }
};
