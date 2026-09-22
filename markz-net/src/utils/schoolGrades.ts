/**
 * السنوات الدراسية (المستويات الدراسية) المعتمدة في المركز.
 *
 * تُستخدم هذه القائمة في مكانين حتى تبقى البيانات المتقنة والتصفية متطابقتين:
 *  1) القائمة المنسدلة "كل السنوات الدراسية" في شريط تصفية سجل الطلاب.
 *  2) خلية "السنة الدراسية وقت الالتحاق" داخل جدول الطلاب وملف الطالب.
 *
 * الترتيب تربوي (من الأصغر إلى الأكبر) وليس أبجديًا، حتى تظهر القائمة
 * المنسدلة بترتيب منطقي مفهوم للمستخدم.
 */
export const DEFAULT_SCHOOL_GRADES: string[] = [
  "رياض الأطفال / تمهيدي",
  "الأول الابتدائي",
  "الثاني الابتدائي",
  "الثالث الابتدائي",
  "الرابع الابتدائي",
  "الخامس الابتدائي",
  "السادس الابتدائي",
  "الأول الإعدادي",
  "الثاني الإعدادي",
  "الثالث الإعدادي",
  "الأول الثانوي",
  "الثاني الثانوي",
  "الثالث الثانوي",
  "جامعي",
  "متوقف عن الدراسة",
];

/** القيمة المستخدمة لخيار "كل السنوات الدراسية" (بدون تصفية). */
export const ALL_GRADES_VALUE = "all";

/**
 * تطبيع نص السنة الدراسية لأغراض المقارنة والتصفية فقط (لا يُخزَّن):
 * - إزالة التشكيل والتطويل
 * - توحيد الهمزات (أ إ آ ← ا) والياء (ى ← ي) والتاء المربوطة (ة ← ه)
 * - إزالة كلمة "الصف/صف" في البداية حتى يتطابق "الصف الرابع" مع "الرابع الابتدائي"
 * - طيّ المسافات الزائدة
 */
export const normalizeSchoolGrade = (value?: string | null): string =>
  (value || "")
    .replace(/[\u0610-\u061A\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:ال)?صف\s+/, "")
    // حذف أداة التعريف من بداية كل كلمة حتى يتطابق "السادس" مع "سادس"
    .replace(/(^|\s)ال(?=\S)/g, "$1")
    .trim();

/** مفتاح موحّد يُقارَن به */
const gradeKey = (value?: string | null): string =>
  normalizeSchoolGrade(value).replace(/\s+/g, " ");

/**
 * المفتاح المعتمد للدمج: يجمع كل صياغات السنة نفسها في خيار واحد،
 * مثل "الصف الرابع" و"الرابع" و"الرابع الابتدائي" ← "الرابع الابتدائي".
 */
const canonicalGradeKey = (value?: string | null): string => {
  const key = gradeKey(value);
  if (!key) return "";
  const exact = DEFAULT_SCHOOL_GRADES.find((grade) => gradeKey(grade) === key);
  if (exact) return gradeKey(exact);
  // صياغة مختصرة: "الرابع" ← "الرابع الابتدائي"
  const shortForm = DEFAULT_SCHOOL_GRADES.find((grade) => gradeKey(grade).startsWith(key));
  if (shortForm) return gradeKey(shortForm);
  // صياغة ممتدة: "الرابع الابتدائي أ" ← "الرابع الابتدائي"
  const longForm = DEFAULT_SCHOOL_GRADES.find((grade) => key.startsWith(gradeKey(grade)));
  if (longForm) return gradeKey(longForm);
  return key;
};

/** رتبة العرض: قائمة المركز أولًا بترتيبها، ثم القيم غير المعروفة أبجديًا في النهاية. */
export const schoolGradeRank = (value?: string | null): number => {
  const key = gradeKey(value);
  if (!key) return Number.MAX_SAFE_INTEGER;
  const exact = DEFAULT_SCHOOL_GRADES.findIndex((grade) => gradeKey(grade) === key);
  if (exact >= 0) return exact;
  // مطابقة جزئية: "الرابع" تُرتَّب مكان "الرابع الابتدائي"
  const firstWord = key.split(" ")[0];
  const partial = DEFAULT_SCHOOL_GRADES.findIndex((grade) => gradeKey(grade).startsWith(firstWord));
  return partial >= 0 ? partial + 0.5 : DEFAULT_SCHOOL_GRADES.length + 1;
};

export interface SchoolGradeOption {
  /** القيمة المخزَّنة/المختارة (أول صياغة معتمدة نراها) */
  value: string;
  /** نص العرض */
  label: string;
  /** عدد الطلاب في هذه السنة الدراسية */
  count: number;
  /** هل هي سنة دراسية مخصّصة (غير موجودة في قائمة المركز الافتراضية)؟ */
  isCustom: boolean;
}

/**
 * بناء قائمة السنوات الدراسية المنسدلة:
 * قائمة المركز الافتراضية (بترتيبها) + أي قيم مخصّصة مكتوبة داخل بيانات الطلاب،
 * مع عدد الطلاب في كل سنة. لا تتكرر القيمة أبدًا مهما اختلفت كتابتها
 * (مثل "الصف الرابع" و"الرابع").
 */
export const buildSchoolGradeOptions = (
  students: { school_grade?: string | null }[],
  extraValues: (string | null | undefined)[] = [],
): SchoolGradeOption[] => {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();

  const register = (raw?: string | null, count = 1) => {
    const key = canonicalGradeKey(raw);
    if (!key) return;
    if (!labels.has(key)) {
      labels.set(key, (raw || "").trim().replace(/\s+/g, " "));
    }
    counts.set(key, (counts.get(key) || 0) + count);
  };

  // 1) قيم قائمة المركز الافتراضية (نصوصها الرسمية أولًا)
  DEFAULT_SCHOOL_GRADES.forEach((grade) => register(grade, 0));
  // 2) قيم إضافية مطلوبة (مثل القيمة المختارة حاليًا في التصفية)
  extraValues.forEach((value) => register(value, 0));
  // 3) ما هو مكتوب فعليًا في بيانات الطلاب
  students.forEach((student) => register(student.school_grade));

  return Array.from(labels.keys())
    .map<SchoolGradeOption>((key) => {
      const label = labels.get(key) || "";
      const isCustom = !DEFAULT_SCHOOL_GRADES.some((grade) => gradeKey(grade) === key);
      return { value: label, label, count: counts.get(key) || 0, isCustom };
    })
    .sort((a, b) => {
      const diff = schoolGradeRank(a.value) - schoolGradeRank(b.value);
      return diff !== 0 ? diff : a.label.localeCompare(b.label, "ar");
    });
};

/**
 * هل يطابق نص سنة الطالب القيمة المختارة من القائمة المنسدلة؟
 * المقارنة تتم بعد التطبيع، لذلك لا يتأثر التصفية باختلاف الهمزات أو المسافات
 * أو كتابة "الصف" في البداية.
 */
export const matchesSchoolGrade = (
  studentGrade: string | null | undefined,
  selectedGrade: string,
): boolean => {
  if (!selectedGrade || selectedGrade === ALL_GRADES_VALUE) return true;
  const studentKey = canonicalGradeKey(studentGrade);
  if (!studentKey) return false;
  const selectedKey = canonicalGradeKey(selectedGrade);
  if (studentKey === selectedKey) return true;
  // مطابقة جزئية آمنة: "الرابع" تطابق "الرابع الابتدائي" والعكس
  return studentKey.startsWith(selectedKey) || selectedKey.startsWith(studentKey);
};
