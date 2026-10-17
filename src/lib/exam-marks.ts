/**
 * توزيع درجات نموذج الاختبار المطبوع — مصدر واحد للحقيقة.
 *
 * مجموع درجات أسئلة النموذج 80 درجة:
 *  - 60 درجة لأسئلة الحفظ وكل ما يتعلق بها.
 *  - 20 درجة لأسئلة التلاوة والتجويد والمعاني وكل ما يتعلق بها.
 *
 * ويضيف المعلم/ة تقييم المواظبة (10) والسلوك (10) — وهما من اختصاصه — فيصبح
 * المجموع النهائي 100 درجة.
 *
 * توزيع درجات القسم على أسئلته يتم بالتساوي قدر الإمكان، وما يتبقى من كسور
 * يُضاف إلى أوائل الأسئلة، فلا تضيع درجة ولا يحتاج المعلم/ة إلى حساب يدوي.
 */

export const HIFZ_TOTAL_MARKS = 60;
export const RECITATION_TOTAL_MARKS = 20;
export const ATTENDANCE_MARKS = 10;
export const BEHAVIOR_MARKS = 10;

/** مجموع درجات أسئلة النموذج (حفظ + تلاوة). */
export const QUESTIONS_TOTAL_MARKS = HIFZ_TOTAL_MARKS + RECITATION_TOTAL_MARKS;

/** مجموع تقييم المعلم/ة (مواظبة + سلوك). */
export const TEACHER_TOTAL_MARKS = ATTENDANCE_MARKS + BEHAVIOR_MARKS;

/** الدرجة النهائية للنموذج. */
export const PAPER_TOTAL_MARKS = QUESTIONS_TOTAL_MARKS + TEACHER_TOTAL_MARKS;

/**
 * توزيع عدد صحيح من الدرجات على عدد من الأسئلة بأعداد صحيحة مجموعها `total`
 * بالضبط. مثال: 60 على 3 أسئلة = [20, 20, 20]، و20 على 4 أسئلة = [5, 5, 5, 5].
 */
export const splitMarks = (total: number, count: number): number[] => {
  if (!Number.isFinite(total) || !Number.isFinite(count) || count <= 0) return [];
  const safeTotal = Math.max(0, Math.round(total));
  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
};

/** درجات أسئلة الحفظ، موزعة على عددها. */
export const hifzQuestionMarks = (count: number): number[] => splitMarks(HIFZ_TOTAL_MARKS, count);

/** درجات أسئلة التلاوة والتجويد والمعاني، موزعة على عددها. */
export const recitationQuestionMarks = (count: number): number[] =>
  splitMarks(RECITATION_TOTAL_MARKS, count);

/** مجموع مصفوفة درجات (للاختبارات والتحقق). */
export const sumMarks = (marks: number[]): number => marks.reduce((total, mark) => total + mark, 0);
