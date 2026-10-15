import type { Student } from "@/types/student";

/**
 * منطق سجل المعلمين والمعلمات العام (مستقل عن الأعوام) في وحدة نقية بلا أي
 * اعتماد على قاعدة البيانات، حتى تُختبَر مباشرة ويُعاد استعمالها في الواجهة
 * وفي طبقة التخزين معاً.
 */

/**
 * قيمة عمود العام لصفوف السجل العام. المعلمون والمعلمات لم يعودوا مرتبطين
 * بعام، ويُحفظ الاسم مرة واحدة بهذه القيمة حتى يظهر في كل الأعوام.
 */
export const GLOBAL_TEACHER_YEAR = "all";

export type TeacherLike = {
  id: string;
  user_id?: string;
  year: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

/**
 * يوحّد صفوف المعلمين/المعلمات: اسم واحد لكل معلم/ة مهما تكرّرت صفوفه
 * (بيانات قديمة كانت لكل عام صف)، مع الاحتفاظ بأحدث صف حسب updated_at،
 * والترتيب أبجدي عربي. لا يُعدّل الصفوف الأصلية.
 */
export function dedupeTeachersByName<T extends TeacherLike>(rows: T[]): T[] {
  const byName = new Map<string, T>();
  for (const row of rows) {
    const name = (row.name || "").trim();
    if (!name) continue;
    const current = byName.get(name);
    if (!current || (row.updated_at || "") >= (current.updated_at || "")) {
      byName.set(name, { ...row, name });
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

/**
 * أسماء المعلمين والمعلمات من السجل العام + أي اسم ظهر في سجلات أخرى
 * (إكراميات، جوائز، شهادات) حتى لا يختفي اسم من القوائم.
 */
export const mergeTeacherNames = (
  registryNames: string[],
  ...extraSources: Array<Array<string | null | undefined>>
) => {
  const set = new Set(registryNames.map((name) => (name || "").trim()).filter(Boolean));
  extraSources.forEach((source) =>
    source.forEach((name) => {
      const value = (name || "").trim();
      if (value) set.add(value);
    }),
  );
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
};

/** يجمع طلاب السجل الشامل حسب معلم/ة (الاسم الفارغ لا يُحسب). */
export const groupStudentsByTeacher = (students: Student[]) => {
  const map = new Map<string, Student[]>();
  students.forEach((student) => {
    const name = (student.teacher || "").trim();
    if (!name) return;
    const list = map.get(name) || [];
    list.push(student);
    map.set(name, list);
  });
  return map;
};

/** الأعوام التي ظهر فيها طلاب معلم/ة في حلقاتهم. */
export const teacherYears = (students: Student[], teacherName: string) => {
  const years = new Set<string>();
  (groupStudentsByTeacher(students).get(teacherName.trim()) || []).forEach((student) =>
    (student.registered_years || []).forEach((year) => years.add(year.replace(/D$/, ""))),
  );
  return Array.from(years).sort();
};
