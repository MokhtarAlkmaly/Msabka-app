/**
 * بديل `src/utils/storage.ts` لاختبار أدوات المسابقة في الإعدادات.
 *
 * اللوحة تحت الاختبار (`CompetitionToolsPanel`) وأدوات الاستيراد/التصدير التي
 * تحتويها تستورد دوال التخزين الحقيقية التي تجرّ SQLite وSupabase والمتصفح.
 * هذا البديل يغطي حدودها فقط: قائمة طلاب في الذاكرة + تسجيل استدعاءات الحذف،
 * فيتحقق الاختبار أن اللوحة تمرّر مفتاح العام الصحيح (1447 أو 1447D).
 */

const state = {
  activeYear: "1447",
  students: [],
  yearDeletes: [],
  studentDeletes: [],
};

export const __competitionStore = state;

export const __resetCompetitionStore = (students = []) => {
  state.activeYear = "1447";
  state.students = students.map((student) => ({ ...student }));
  state.yearDeletes.length = 0;
  state.studentDeletes.length = 0;
};

export const getActiveYear = async () => state.activeYear;

export const loadAllStudentsWithData = async (year) =>
  state.students.filter((student) => !student.year || student.year === year);

export const loadStudentsForYear = loadAllStudentsWithData;

export const loadGlobalStudents = async () => state.students.map((student) => ({ ...student }));

export const saveStudent = async (student) => {
  const nextId = state.students.reduce((max, row) => Math.max(max, row.id ?? 0), 0) + 1;
  const id = student?.id ?? nextId;
  state.students.push({ id, name: student?.name ?? "", teacher: student?.teacher ?? "" });
  return id;
};

export const loadYearData = async () => ({
  parts: "",
  annual: "",
  recitation: "",
  memorization: "",
  total: "0",
  grade: "",
  prize: "0",
  teacher: "",
});

export const saveYearData = async () => undefined;

export const registerStudentInYear = async () => undefined;

export const mergeDuplicateStudents = async () => 0;

export const syncToCloud = async () => true;

export const deleteYearData = async (year) => {
  state.yearDeletes.push(year);
};

export const deleteStudentsFromYear = async (year, ids) => {
  state.studentDeletes.push({ year, ids: [...ids] });
};
