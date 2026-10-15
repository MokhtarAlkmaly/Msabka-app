/**
 * معرّفات محلية وتحويلات أعمدة مشتركة — وحدة نقية (بلا SQLite ولا Supabase).
 *
 * لماذا هذا الملف منفصل؟
 *  - جداول السحابة التي نُوطّنها في المرحلة 5 (`community_records` و
 *    `exam_questions`) مفاتيحها **UUID** وليست أرقاماً تسلسلية. المعرّف
 *    يُولَّد على الجهاز ويبقى نفسه عند الرفع — بلا مطابقة ولا إعادة ترقيم
 *    (على عكس الطلاب ذوي المعرّفات المؤقتة).
 *  - عمود `choices` في `exam_questions` من نوع `jsonb` في السحابة ونصّ في
 *    SQLite، فيلزم تحويل في الاتجاهين عند كل قراءة/كتابة.
 *  - ترتيب الصفوف يجب أن يكون متطابقاً بين القراءة المحلية والسحابية حتى لا
 *    «تقفز» الواجهة عند كل مزامنة.
 */

/** نمط UUID الإصدار الرابع (كما يُولّده `crypto.randomUUID`). */
export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HEX = "0123456789abcdef";

const randomBytes = (count: number): Uint8Array => {
  const cryptoObj =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(count);
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  const bytes = new Uint8Array(count);
  for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
};

/**
 * معرّف UUID جديد يُولَّد على الجهاز.
 *
 * ثلاث درجات: `crypto.randomUUID` (المتصفحات الحديثة و Node 19+)، ثم
 * `crypto.getRandomValues` (متصفحات أقدم أو سياق غير آمن)، ثم `Math.random`
 * كبديل أخير. الناتج صالح كمفتاح أساسي في Supabase في كل الحالات، وهذا ما
 * يجعل الترحيل ممكناً بلا أي مطابقة معرّفات.
 */
export const newLocalId = (): string => {
  const cryptoObj =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    try {
      return cryptoObj.randomUUID();
    } catch {
      /* سياق غير آمن (http) قد يرفض — نتابع إلى البديل */
    }
  }

  const bytes = randomBytes(16);
  // الإصدار 4 (الموضع 6) والمتغيّر RFC 4122 (الموضع 8)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  let id = "";
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) id += "-";
    id += HEX[bytes[i] >> 4];
    id += HEX[bytes[i] & 0x0f];
  }
  return id;
};

/** هل القيمة UUID صالح؟ (يُستعمل للتفريق بين صفوف السحابة والصفوف المحضة). */
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_V4_PATTERN.test(value);

/**
 * قراءة عمود مخزَّن كنصّ (في SQLite) أو كائن (في السحابة).
 * النصوص الفاسدة تُرجع البديل بدلاً من إسقاط الصف كاملاً.
 */
export const parseJsonColumn = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
};

/** تحويل قيمة إلى نصّ JSON للتخزين المحلي (أعمدة jsonb في السحابة). */
export const stringifyJsonColumn = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

/** اتجاه الترتيب. */
export type SortDirection = "asc" | "desc";

export type SortKey<T> = {
  /** اسم العمود أو دالة استخراجه. */
  key: keyof T & string;
  dir?: SortDirection;
};

const compareValues = (a: unknown, b: unknown): number => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "ar");
};

/**
 * ترتيب ثابت متعدد المفاتيح — نفس الترتيب الذي يعيده السحاب، حتى لا تتغيّر
 * مواضع الصفوف في الواجهة عند بدّل مصدر القراءة.
 */
export const sortRows = <T>(rows: T[], keys: SortKey<T>[]): T[] =>
  [...rows].sort((left, right) => {
    for (const { key, dir = "asc" } of keys) {
      const result = compareValues(left?.[key], right?.[key]);
      if (result !== 0) return dir === "desc" ? -result : result;
    }
    return 0;
  });

/** هل القيمة طابعاً زمنياً نصياً صالحاً؟ */
export const isTimestamp = (value: unknown): boolean => {
  if (typeof value !== "string" || !value) return false;
  return !Number.isNaN(Date.parse(value));
};
