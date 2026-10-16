/**
 * هوية النظام — مرجع واحد لاسم النسخة المستقلة وعلاماتها المميزة.
 *
 * تمييزاً عن التطبيق السابق «مركز إنماء الأهلي الخيري» (النسخة المتصلة بالسحابة):
 *   • الاسم الظاهر:  Markz Net
 *   • الوسم:         «نسخة بلا إنترنت» — تعمل محلياً بلا أي خادم أو اتصال
 *   • الشعار:        مصحف مفتوح + سهم عنبري + شارة «بلا إنترنت»
 *                    (يُولَّد بـ scripts/generate-brand-assets.mjs)
 *
 * لا تكتب اسم النظام نصّاً في الصفحات — استورد الثوابت من هنا حتى تبقى الهوية
 * موحّدة في الواجهة والطباعة والبيانات الوصفية.
 */

/** الاسم الأساسي للنظام. */
export const BRAND_NAME = "Markz Net";

/** الوسم المميّز للنسخة المحلية. */
export const BRAND_OFFLINE_TAG = "نسخة بلا إنترنت";

/** القسم الذي يخدمه النظام (يُذكر في الترويسات والتقارير). */
export const BRAND_SECTION = "قسم القرآن الكريم";

/** سطر الإشراف كما في الترويسات الرسمية. */
export const BRAND_SUPERVISOR = "الإشراف - شرعب الرونة";

/** العبارة القصيرة الموحّدة للشارات داخل الواجهة. */
export const BRAND_LOCAL_NOTE = `${BRAND_OFFLINE_TAG} · البيانات على هذا الجهاز`;

/** اسم النظام كاملاً بوسمه: «Markz Net — نسخة بلا إنترنت». */
export const BRAND_NAME_TAGGED = `${BRAND_NAME} — ${BRAND_OFFLINE_TAG}`;

/** ترويسة الصفحات: «Markz Net — نسخة بلا إنترنت · قسم القرآن الكريم». */
export const BRAND_HEADER = `${BRAND_NAME_TAGGED} · ${BRAND_SECTION}`;

/** ترويسة التقارير والطباعة (بدون شرطة مفردة لتفادي مشاكل الاتجاه). */
export const BRAND_PRINT_TITLE = `${BRAND_NAME} ${BRAND_OFFLINE_TAG} · ${BRAND_SECTION}`;

/** عنوان الصفحة (title) الموحّد. */
export const BRAND_META_TITLE = `${BRAND_NAME_TAGGED} — نظام إدارة حلقات ومسابقات القرآن الكريم`;

/** سطر التوقيع في التذييلات. */
export const BRAND_SIGNATURE = `${BRAND_NAME} ${BRAND_OFFLINE_TAG} · تصميم أ/ مختار الكمالي`;
