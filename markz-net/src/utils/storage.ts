import {
  Student,
  HifzHistory,
  YearData,
  START_YEAR,
  CustomColumnDef,
  DEFAULT_STATUSES,
} from "@/types/student";
import { resolveBaseHifz } from "./calculations";
import { getSessionUserId, subscribeAuth } from "./localAuth";

/**
 * النسخة المستقلة (markz-net): طبقة التخزين محلية بالكامل — قاعدة SQLite
 * واحدة على الجهاز تخدم كل الحسابات مع عزل بيانات كل حساب عبر user_id.
 * لا يوجد أي اتصال شبكي أو مزامنة سحابية في هذا الملف.
 */

/** بديل محلي لنوع Json الذي كان يُستورد من أنواع Supabase. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** صف المتابعة الشهرية كما يُخزَّن محليًا. */
type MonthlyRow = {
  user_id: string;
  student_id: number;
  year: string;
  month: number;
  memorization_from_surah: number | null;
  memorization_from_ayah: number | null;
  memorization_to_surah: number | null;
  memorization_to_ayah: number | null;
  memorization_hifz_score: number | null;
  memorization_recitation_score: number | null;
  review_from_surah: number | null;
  review_from_ayah: number | null;
  review_to_surah: number | null;
  review_to_ayah: number | null;
  review_hifz_score: number | null;
  review_recitation_score: number | null;
  attendance_score: number | null;
  behavior_score: number | null;
};

import {
  getCachedStudents,
  putCachedStudent,
  deleteCachedStudent,
  getCachedHifzHistory,
  putCachedHifzRow,
  getCachedYearData,
  putCachedYearData,
  setCachedSetting,
  getCachedSetting,
  CachedStudent,
  CachedHifzRow,
  CachedYearData,
  getCachedTeachers,
  putCachedTeacher,
  deleteCachedTeacher,
  getCachedTeacherBonuses,
  putCachedTeacherBonus,
  deleteCachedTeacherBonus,
  getCachedDonors,
  putCachedDonor,
  deleteCachedDonor,
  getCachedAwards,
  putCachedAward,
  deleteCachedAward,
  getCachedCeremonyExpenses,
  putCachedCeremonyExpense,
  deleteCachedCeremonyExpense,
  getCachedCertificates,
  putCachedCertificate,
  deleteCachedCertificate,
  getCachedInternalCompetitions,
  putCachedInternalCompetition,
  deleteCachedInternalCompetition,
  getCachedExternalCompetitions,
  putCachedExternalCompetition,
  deleteCachedExternalCompetition,
  getCachedMedia,
  putCachedMedia,
  deleteCachedMedia,
  getCachedYearDataForStudent,
  getCachedYearDataForStudents,
  getCachedYearDataForYear,
  getCachedStudentsForYear,
  searchCachedStudentsByName,
  getCachedHifzHistoryForStudents,
  CachedTeacher,
  CachedTeacherBonus,
  CachedDonor,
  CachedAward,
  CachedCeremonyExpense,
  CachedCertificate,
  CachedMedia,
  CachedInternalCompetition,
  CachedExternalCompetition,
  putMonthlyTracking,
  getMonthlyTrackingForMonth,
  getMonthlyTrackingForStudent,
  getLatestMonthlyTrackingPeriod,
  deleteMonthlyTrackingForYear,
  deleteAllRowsForUser,
} from "./localDB";
import { markDirty } from "./localDB";
import { getViewAsId, isViewingOtherUser } from "./viewAs";

// ===== Helper: get cached user =====

let cachedAuthUserId: string | null = null;

/**
 * معرّف الحساب المسجَّل دخوله فعلياً (وليس الحساب المعروض).
 * الجلسة محلية بالكامل: تُقرأ من التخزين المحلي وتتحقق من قاعدة البيانات.
 */
const getAuthUserId = async (): Promise<string | null> => {
  if (cachedAuthUserId) return cachedAuthUserId;
  cachedAuthUserId = await getSessionUserId();
  return cachedAuthUserId;
};

/**
 * صاحب البيانات التي تُقرأ/تُكتب حالياً.
 * في الوضع الطبيعي هو الحساب نفسه، وفي وضع الاطلاع هو المستخدم المعروض
 * (قراءة فقط — كل دوال الكتابة محمية بـ guardWrite).
 */
const getUserId = async (): Promise<string | null> => {
  const viewing = getViewAsId();
  if (viewing) return viewing;
  return getAuthUserId();
};

/** خطأ يُرمى عند محاولة التعديل أثناء الاطلاع على بيانات مستخدم آخر. */
export class ReadOnlyViewError extends Error {
  constructor() {
    super("أنت في وضع الاطلاع على بيانات مستخدم آخر — التعديل غير مسموح");
    this.name = "ReadOnlyViewError";
  }
}

/** يمنع أي كتابة أثناء وضع الاطلاع. */
const guardWrite = () => {
  if (isViewingOtherUser()) throw new ReadOnlyViewError();
};

// تبديل الدخول/الخروج يُبطل هوية المستخدم المخبأة محليًا. قاعدة البيانات
// نفسها دائمة ومشتركة بين الحسابات (مع عزل user_id) — لا يُمسح أي شيء.
subscribeAuth(() => {
  cachedAuthUserId = null;
});

/** بادئة مفتاح إعداد ليصبح خاصًا بمستخدم واحد (تعادل user_settings السحابية). */
const scopedSettingKey = (userId: string, key: string) => `${userId}:${key}`;

const newLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * في النسخة المستقلة لم يعد هناك "كاش" يُدار لكل جلسة — قاعدة SQLite
 * نفسها هي المخزن الدائم لكل الحسابات، وكل استعلام يفلتر بـ user_id.
 * نبقي ensureCache كدالة فارغة لأنها تُستدعى في مقدمة كل دالة قراءة.
 */
const ensureCache = async () => {};

const belongsToUser = <T extends { user_id: string }>(row: T, userId: string) =>
  row.user_id === userId;

const byYear = <T extends { year: string }>(rows: T[], year?: string) =>
  year ? rows.filter((row) => row.year === year) : rows;

// ===== المتابعة الشهرية والشريط العام (كانا سحابيين — صارا محليين) =====
export type ProgressCb = (current: number, total: number, label?: string) => void;

// ===== Custom Columns Settings =====
export const loadCustomColumns = async (): Promise<CustomColumnDef[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const cached = await getCachedSetting<CustomColumnDef[]>(
    scopedSettingKey(userId, "student_custom_columns"),
  );
  return Array.isArray(cached) ? cached : [];
};

export const saveCustomColumns = async (cols: CustomColumnDef[]) => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return;
  await setCachedSetting(scopedSettingKey(userId, "student_custom_columns"), cols);
};

// ===== Student Statuses Settings =====
export const loadStudentStatuses = async (): Promise<string[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return DEFAULT_STATUSES;
  const cached = await getCachedSetting<string[]>(scopedSettingKey(userId, "student_statuses"));
  if (Array.isArray(cached) && cached.length > 0) return cached;

  return DEFAULT_STATUSES;
};

export const saveStudentStatuses = async (statuses: string[]) => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return;
  const normalized = statuses.map((status) => status.trim()).filter(Boolean);
  await setCachedSetting(scopedSettingKey(userId, "student_statuses"), normalized);
};

// ===== Load students with data from LOCAL cache =====
/**
 * تحميل طلاب عام محدد فقط. الاستعلامات المحلية لا تقرأ year_data أو سجل الحفظ
 * لكل الأعوام، وهو ما يجعل فتح الصفحة الرئيسية والحلقات أسرع مع كبر السجل.
 */
export const loadStudentsForYear = async (currentYear: string): Promise<Student[]> => {
  if (!currentYear) return [];
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];

  const [studentsForYear, yearRows] = await Promise.all([
    getCachedStudentsForYear(currentYear, userId),
    getCachedYearDataForYear(currentYear),
  ]);
  const students = studentsForYear.filter((student) => student.user_id === userId);
  const studentIds = students.map((student) => student.id);
  const allHistory = await getCachedHifzHistoryForStudents(studentIds);

  const historyMap: Record<number, HifzHistory> = {};
  allHistory.forEach((row) => {
    if (!historyMap[row.student_id]) historyMap[row.student_id] = {};
    historyMap[row.student_id][row.year_key] = row.value;
  });

  // يظل مقدار الحفظ الجديد في أي صف سابق مرجعاً صالحاً للحفظ التراكمي.
  // نقرأ صفوف الأعوام للطلاب الظاهرين فقط، لا كامل قاعدة البيانات.
  const studentYearRows = await getCachedYearDataForStudents(studentIds);
  studentYearRows.forEach((row) => {
    const parts = parseFloat(row.parts) || 0;
    if (parts <= 0) return;
    if (!historyMap[row.student_id]) historyMap[row.student_id] = {};
    const key = `h${row.year}`;
    const existing = parseFloat(historyMap[row.student_id][key]) || 0;
    if (parts > existing) historyMap[row.student_id][key] = parts.toString();
  });

  const yearDataMap: Record<number, YearData> = {};
  yearRows.forEach((row) => {
    if (!students.some((student) => student.id === row.student_id)) return;
    yearDataMap[row.student_id] = {
      baseHifz: row.base_hifz,
      totalHifz: row.total_hifz,
      parts: row.parts,
      annual: row.annual,
      recitation: row.recitation,
      memorization: row.memorization,
      total: row.total,
      grade: row.grade,
      prize: row.prize,
      statusPrize: row.status_prize,
      rank: row.rank,
      teacher: row.teacher || "",
    };
  });

  return students
    .filter((student) => yearDataMap[student.id])
    .map((student) => ({
      id: student.id,
      name: student.name,
      teacher: yearDataMap[student.id]?.teacher || student.teacher || "",
      gender: student.gender || undefined,
      hijri_join_date: student.hijri_join_date || undefined,
      initial_hifz: student.initial_hifz || undefined,
      first_competition_year: student.first_competition_year || undefined,
      status: student.status || "طبيعي",
      school_grade: student.school_grade || undefined,
      guardian_phone: student.guardian_phone || undefined,
      student_phone: student.student_phone || undefined,
      custom_fields: student.custom_fields || {},
      notes: student.notes || undefined,
      hifzHistory: historyMap[student.id] || {},
      yearData: yearDataMap[student.id],
    }));
};

// الاسم القديم يبقى متاحاً لكل الصفحات الحالية.
export const loadAllStudentsWithData = loadStudentsForYear;

export const emptyYearData = (): YearData => ({
  baseHifz: "0",
  totalHifz: "0",
  parts: "",
  annual: "",
  recitation: "",
  memorization: "",
  total: "0",
  grade: "",
  prize: "0",
  statusPrize: "",
  rank: "-",
  teacher: "",
});

export interface RecallCandidate {
  id: number;
  name: string;
  teacher: string;
  lastYear: string;
  baseHifz: number;
  years: string[];
}

/**
 * ترتيب زمني لمفاتيح الأعوام: مسابقة رمضان في عام ما تسبق مسابقة ذي الحجة
 * من العام نفسه، وتليها رمضان العام التالي. "1447" < "1447D" < "1448".
 */
const yearRank = (key: string) => parseInt(key) * 10 + (key.endsWith("D") ? 5 : 0);

/**
 * الحفظ السابق المرحَّل لطالب عند استدعائه إلى عام: مجموع أجزاء الأعوام
 * السابقة (أو آخر إجمالي تراكمي إن كان أكبر)، وآخر معلم/ة له.
 */
const computeCarryOver = async (
  year: string,
  studentId: number,
): Promise<{ baseHifz: number; teacher: string }> => {
  const student = (await getCachedStudents()).find((s) => s.id === studentId);
  if (!student) return { baseHifz: 0, teacher: "" };

  const targetRank = yearRank(year);
  const previous = (await getCachedYearData())
    .filter((row) => row.student_id === studentId)
    .sort((a, b) => yearRank(a.year) - yearRank(b.year))
    .filter((row) => yearRank(row.year) < targetRank);

  const history: HifzHistory = {};
  (await getCachedHifzHistory())
    .filter((row) => row.student_id === studentId)
    .forEach((row) => {
      history[row.year_key] = row.value;
    });
  previous.forEach((row) => {
    const parts = parseFloat(row.parts) || 0;
    if (parts > 0) {
      const key = `h${row.year}`;
      if ((parseFloat(history[key]) || 0) < parts) history[key] = parts.toString();
    }
  });

  const last = previous.length > 0 ? previous[previous.length - 1] : null;
  const lastTotalHifz = last
    ? parseFloat(last.total_hifz) || 0
    : parseFloat(student.initial_hifz || "0") || 0;
  const baseHifz = resolveBaseHifz(history, parseInt(year), lastTotalHifz);
  return { baseHifz, teacher: last?.teacher || student.teacher || "" };
};

// الطلاب الموجودون في السجل العام وغير المسجّلين في العام المختار
export const listRecallCandidates = async (year: string): Promise<RecallCandidate[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const students = (await getCachedStudents()).filter((s) => s.user_id === userId);
  const allYearData = await getCachedYearData();
  const allHistory = await getCachedHifzHistory();
  const yearNum = parseInt(year);
  const targetRank = yearRank(year);

  const byStudent = new Map<number, typeof allYearData>();
  allYearData.forEach((row) => {
    const list = byStudent.get(row.student_id) || [];
    list.push(row);
    byStudent.set(row.student_id, list);
  });

  const historyMap: Record<number, HifzHistory> = {};
  allHistory.forEach((row) => {
    if (!historyMap[row.student_id]) historyMap[row.student_id] = {};
    historyMap[row.student_id][row.year_key] = row.value;
  });

  const candidates: RecallCandidate[] = [];
  for (const s of students) {
    const rows = byStudent.get(s.id) || [];
    if (rows.some((r) => r.year === year)) continue;
    const previous = rows
      .filter((r) => yearRank(r.year) < targetRank)
      .sort((a, b) => yearRank(a.year) - yearRank(b.year));

    const history = { ...(historyMap[s.id] || {}) };
    previous.forEach((r) => {
      const parts = parseFloat(r.parts) || 0;
      if (parts > 0) {
        const key = `h${r.year}`;
        if ((parseFloat(history[key]) || 0) < parts) history[key] = parts.toString();
      }
    });

    const last = previous.length > 0 ? previous[previous.length - 1] : null;
    const lastTotalHifz = last
      ? parseFloat(last.total_hifz) || 0
      : parseFloat(s.initial_hifz || "0") || 0;
    const baseHifz = resolveBaseHifz(history, yearNum, lastTotalHifz);

    candidates.push({
      id: s.id,
      name: s.name,
      teacher: last?.teacher || s.teacher || "",
      lastYear: last?.year || s.first_competition_year || "سجل عام",
      baseHifz,
      years: rows.map((r) => r.year).sort((a, b) => yearRank(a) - yearRank(b)),
    });
  }

  return candidates.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
};

// استدعاء طلاب من السجل العام إلى العام المختار مع ترحيل الحفظ التراكمي
export const recallStudentsToYear = async (year: string, ids: number[]): Promise<number> => {
  guardWrite();
  const candidates = await listRecallCandidates(year);
  const map = new Map(candidates.map((c) => [c.id, c]));
  let added = 0;

  for (const id of ids) {
    const c = map.get(id);
    if (!c) continue;
    await saveYearData(year, id, {
      ...emptyYearData(),
      teacher: c.teacher,
      baseHifz: c.baseHifz.toString(),
      totalHifz: c.baseHifz.toString(),
    });
    added++;
  }

  return added;
};

// تسجيل طالب/ة في العام المختار مع ترحيل الحفظ التراكمي من الأعوام السابقة
export const registerStudentInYear = async (year: string, studentId: number, teacher = "") => {
  guardWrite();
  const carry = await computeCarryOver(year, studentId);
  await saveYearData(year, studentId, {
    ...emptyYearData(),
    teacher: teacher || carry.teacher,
    baseHifz: carry.baseHifz.toString(),
    totalHifz: carry.baseHifz.toString(),
  });
};

// تحميل كل الطلاب المسجلين في كل الأعوام من السجل الرسمي الشامل
export const loadGlobalStudents = async (): Promise<Student[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];

  const students = (await getCachedStudents()).filter((student) => student.user_id === userId);
  return students
    .map((s) => ({
      id: s.id,
      name: s.name,
      teacher: s.teacher || "",
      gender: s.gender || undefined,
      hijri_join_date: s.hijri_join_date || undefined,
      initial_hifz: s.initial_hifz || undefined,
      first_competition_year: s.first_competition_year || undefined,
      status: s.status || "طبيعي",
      school_grade: s.school_grade || undefined,
      guardian_phone: s.guardian_phone || undefined,
      student_phone: s.student_phone || undefined,
      custom_fields: (s.custom_fields as Record<string, string> | null) ?? {},
      notes: s.notes || undefined,
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
};

/**
 * السجل الشامل لكل الأعوام: كل طلاب السجل الرسمي (بدون ربط بعام محدد)
 * مع الأعوام المسجل بها كل طالب وآخر حفظ تراكمي حققه، لعرضه في صفحة
 * إدارة الطلاب واستدعاء الطلاب منها إلى أي عام/مسابقة.
 */
export const loadGlobalStudentsWithYears = async (): Promise<Student[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];

  const [students, allYearData] = await Promise.all([getCachedStudents(), getCachedYearData()]);

  const rowsByStudent = new Map<number, CachedYearData[]>();
  allYearData.forEach((row) => {
    const list = rowsByStudent.get(row.student_id) || [];
    list.push(row);
    rowsByStudent.set(row.student_id, list);
  });

  return students
    .filter((student) => student.user_id === userId)
    .map((s) => {
      const rows = (rowsByStudent.get(s.id) || []).sort(
        (a, b) => yearRank(a.year) - yearRank(b.year),
      );
      const last = rows.length > 0 ? rows[rows.length - 1] : null;
      return {
        id: s.id,
        name: s.name,
        // معلم/ة السجل هي المرجع؛ وعند فراغها نستأنف بآخر معلم/ة في الأعوام
        teacher: s.teacher || last?.teacher || "",
        gender: s.gender || undefined,
        hijri_join_date: s.hijri_join_date || undefined,
        initial_hifz: s.initial_hifz || undefined,
        first_competition_year: s.first_competition_year || undefined,
        status: s.status || "طبيعي",
        school_grade: s.school_grade || undefined,
        guardian_phone: s.guardian_phone || undefined,
        student_phone: s.student_phone || undefined,
        custom_fields: (s.custom_fields as Record<string, string> | null) ?? {},
        notes: s.notes || undefined,
        registered_years: rows.map((row) => row.year),
        latest_total_hifz: last ? last.total_hifz : s.initial_hifz || "0",
      };
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
};

// ===== Save to LOCAL cache =====
export const saveStudent = async (
  student: Partial<Student> & { id?: number; name: string },
): Promise<number | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;

  const payload: CachedStudent = {
    id: student.id || 0,
    name: (student.name || "").trim(),
    teacher: (student.teacher || "").trim(),
    user_id: userId,
    gender: student.gender || null,
    hijri_join_date: student.hijri_join_date || null,
    initial_hifz: student.initial_hifz || null,
    first_competition_year: student.first_competition_year || null,
    status: student.status || "طبيعي",
    school_grade: student.school_grade || null,
    guardian_phone: student.guardian_phone || null,
    student_phone: student.student_phone || null,
    custom_fields: student.custom_fields || {},
    notes: student.notes || null,
  };

  let targetId = student.id;
  if (targetId) {
    payload.id = targetId;
    await putCachedStudent(payload);
    await markDirty("student", "upsert", { id: targetId });
  } else {
    // النسخة المستقلة: المعرفات محلية فقط — تسلسل طبيعي يبدأ من 1.
    const existing = await getCachedStudents();
    const maxId = existing.reduce((max, s) => Math.max(max, s.id), 0);
    targetId = maxId + 1;
    payload.id = targetId;
    await putCachedStudent(payload);
    await markDirty("student", "upsert", { id: targetId });
  }

  // إذا تم تحديد مقدار الحفظ قبل الالتحاق وعام المسابقة الأولى:
  // يُسجّل تلقائياً في عام المسابقة الأولى كحفظ مسبق (hifz_history و base_hifz)
  if (targetId && student.initial_hifz && parseFloat(student.initial_hifz) > 0) {
    const compYear = student.first_competition_year || "1441";
    const historyKey = `h${compYear}`;
    const currentHistory = await loadHifzHistory(targetId);
    if (!currentHistory[historyKey] || currentHistory[historyKey] === "0") {
      currentHistory[historyKey] = student.initial_hifz;
      await saveHifzHistory(targetId, currentHistory);
    }
  }

  queueCloudSync();
  return targetId;
};

export const deleteStudent = async (id: number) => {
  guardWrite();
  await deleteCachedStudent(id);
  await markDirty("student", "delete", { id });
  const allHistory = await getCachedHifzHistory();
  const allYearData = await getCachedYearData();
  const { deleteItem } = await import("./localDB");
  for (const row of allHistory.filter((r) => r.student_id === id)) {
    await deleteItem("hifz_history", [row.student_id, row.year_key]);
  }
  for (const row of allYearData.filter((r) => r.student_id === id)) {
    await deleteItem("year_data", [row.student_id, row.year]);
  }
  const allInternal = await getCachedInternalCompetitions();
  for (const row of allInternal.filter((r) => r.student_id === id)) {
    await deleteItem("internal_competitions", row.id);
  }
  const allExternal = await getCachedExternalCompetitions();
  for (const row of allExternal.filter((r) => r.student_id === id)) {
    await deleteItem("external_competitions", row.id);
  }
  queueCloudSync();
};

/**
 * يفصل الطالب/ة عن عام واحد فقط مع إبقاء سجلها العام وبقية الأعوام كما هي.
 * يُستخدم من صفحات المسابقات ومن شاشة الحذف المتقدم في الإعدادات.
 */
export const deleteStudentFromYear = async (year: string, studentId: number) => {
  guardWrite();
  const { deleteItem, deleteMonthlyTrackingForStudentYear } = await import("./localDB");
  const userId = await getUserId();
  const historyKey = `h${year}`;

  const yearRow = await getCachedYearDataForStudent(studentId);
  const localYearRow = yearRow.find((row) => row.year === year);
  if (localYearRow) {
    await deleteItem("year_data", [studentId, year]);
  }
  await markDirty("year", "delete", { student_id: studentId, year });

  // المتابعة الشهرية لهذا الطالب/ة في هذا العام تُحذف محليًا.
  if (userId) await deleteMonthlyTrackingForStudentYear(userId, year, studentId);

  const history = (await getCachedHifzHistory()).filter(
    (row) => row.student_id === studentId && row.year_key === historyKey,
  );
  for (const row of history) {
    await deleteItem("hifz_history", [row.student_id, row.year_key]);
  }
  await markDirty("hifz", "delete", { student_id: studentId, year_key: historyKey });

  const internal = (await getCachedInternalCompetitions()).filter(
    (row) => row.student_id === studentId && row.year === year,
  );
  for (const row of internal) {
    await deleteItem("internal_competitions", row.id);
    await markDirty("internal_competition", "delete", { id: row.id });
  }
  const external = (await getCachedExternalCompetitions()).filter(
    (row) => row.student_id === studentId && row.year === year,
  );
  for (const row of external) {
    await deleteItem("external_competitions", row.id);
    await markDirty("external_competition", "delete", { id: row.id });
  }

  queueCloudSync();
};

/** حذف عدة طلاب من عام واحد دون المساس بالسجل العام. */
export const deleteStudentsFromYear = async (year: string, ids: number[]) => {
  guardWrite();
  for (const id of Array.from(new Set(ids))) {
    await deleteStudentFromYear(year, id);
  }
};

/** حذف بيانات العام الدراسي من السجل الأكاديمي فقط (لا يحذف الطالب العام). */
export const deleteYearData = async (year: string) => {
  guardWrite();
  const { deleteItem } = await import("./localDB");
  const userId = await getUserId();

  const allYearData = await getCachedYearData();
  for (const row of allYearData.filter((r) => r.year === year)) {
    await deleteItem("year_data", [row.student_id, row.year]);
    await markDirty("year", "delete", { student_id: row.student_id, year: row.year });
  }
  const allHistory = await getCachedHifzHistory();
  for (const row of allHistory.filter((r) => r.year_key === `h${year}`)) {
    await deleteItem("hifz_history", [row.student_id, row.year_key]);
    await markDirty("hifz", "delete", { student_id: row.student_id, year_key: row.year_key });
  }
  if (userId) await deleteMonthlyTrackingForYear(userId, year);
  queueCloudSync();
};

/**
 * حذف عام كامل: يحذف كل البيانات المرتبطة بالعام من الجداول السنوية، مع
 * الإبقاء على الطلاب في السجل العام ليستطيع المستخدم تسجيلهم في عام آخر.
 */
export const deleteFullYearData = async (year: string) => {
  guardWrite();
  await deleteYearData(year);
  const userId = await getUserId();

  // ملفات وسائط هذا العام تُحذف من المخزن المحلي قبل حذف سجلاتها.
  const yearMedia = (await getCachedMedia()).filter(
    (row) => row.user_id === userId && row.year === year,
  );
  if (yearMedia.length > 0) {
    const { deleteMediaFiles } = await import("./mediaStore");
    await deleteMediaFiles(yearMedia.map((row) => row.file_path).filter(Boolean));
  }

  const { deleteItem } = await import("./localDB");
  const yearStores: Array<{
    store: string;
    entity:
      | "teacher"
      | "teacher_bonus"
      | "donor"
      | "award"
      | "expense"
      | "certificate"
      | "internal_competition"
      | "external_competition"
      | "media";
    rows: Array<{ id: string; year: string; user_id?: string }>;
  }> = [
    { store: "teachers", entity: "teacher", rows: await getCachedTeachers() },
    { store: "teacher_bonuses", entity: "teacher_bonus", rows: await getCachedTeacherBonuses() },
    { store: "donors", entity: "donor", rows: await getCachedDonors() },
    { store: "awards", entity: "award", rows: await getCachedAwards() },
    { store: "ceremony_expenses", entity: "expense", rows: await getCachedCeremonyExpenses() },
    { store: "certificates", entity: "certificate", rows: await getCachedCertificates() },
    {
      store: "internal_competitions",
      entity: "internal_competition",
      rows: await getCachedInternalCompetitions(),
    },
    {
      store: "external_competitions",
      entity: "external_competition",
      rows: await getCachedExternalCompetitions(),
    },
    { store: "media", entity: "media", rows: await getCachedMedia() },
  ];

  for (const group of yearStores) {
    for (const row of group.rows.filter((item) => item.year === year && item.user_id === userId)) {
      await deleteItem(group.store, row.id);
      await markDirty(group.entity, "delete", { id: row.id });
    }
  }
  queueCloudSync();
};

/**
 * حذف قاعدة بيانات المستخدم الحالي كاملة (كل جداول بياناته + ملفات
 * وسائطه + إعداداته) مع إبقاء حسابات المستخدمين الآخرين على الجهاز.
 */
export const deleteEntireDatabase = async () => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return;

  // ملفات الوسائط تُحذف من المخزن المحلي أولاً.
  const mediaRows = (await getCachedMedia()).filter((row) => row.user_id === userId);
  if (mediaRows.length > 0) {
    const { deleteMediaFiles } = await import("./mediaStore");
    await deleteMediaFiles(mediaRows.map((row) => row.file_path).filter(Boolean));
  }

  await deleteAllRowsForUser(userId);
};

// التوافق مع الاسم القديم المستخدم في بعض الشاشات.
export const deleteAllStudents = deleteEntireDatabase;

// حذف الطلاب عالمياً — يُترك للاستخدام الداخلي الصريح فقط.
export const deleteStudents = async (ids: number[]) => {
  guardWrite();
  for (const id of ids) {
    await deleteStudent(id);
  }
};

export const saveHifzHistory = async (studentId: number, history: HifzHistory) => {
  guardWrite();
  for (const [yearKey, value] of Object.entries(history)) {
    await putCachedHifzRow({ student_id: studentId, year_key: yearKey, value: value || "0" });
    await markDirty("hifz", "upsert", { student_id: studentId, year_key: yearKey });
  }
};

export const loadHifzHistory = async (studentId: number): Promise<HifzHistory> => {
  const allHistory = await getCachedHifzHistory();
  const history: HifzHistory = {};
  allHistory
    .filter((r) => r.student_id === studentId)
    .forEach((r) => {
      history[r.year_key] = r.value;
    });
  return history;
};

export const saveYearData = async (year: string, studentId: number, data: YearData) => {
  guardWrite();
  await putCachedYearData({
    student_id: studentId,
    year,
    base_hifz: data.baseHifz,
    total_hifz: data.totalHifz,
    parts: data.parts,
    annual: data.annual,
    recitation: data.recitation,
    memorization: data.memorization,
    total: data.total,
    grade: data.grade,
    prize: data.prize,
    status_prize: data.statusPrize,
    rank: data.rank,
    teacher: data.teacher || "",
  });
  await markDirty("year", "upsert", { student_id: studentId, year });
};

const defaultYearData = (): YearData => ({
  baseHifz: "0",
  totalHifz: "0",
  parts: "",
  annual: "",
  recitation: "",
  memorization: "",
  total: "0",
  grade: "",
  prize: "0",
  statusPrize: "",
  rank: "-",
  teacher: "",
});

const yearRowToData = (row: {
  base_hifz: string;
  total_hifz: string;
  parts: string;
  annual: string;
  recitation: string;
  memorization: string;
  total: string;
  grade: string;
  prize: string;
  status_prize: string;
  rank: string;
  teacher: string;
}): YearData => ({
  baseHifz: row.base_hifz,
  totalHifz: row.total_hifz,
  parts: row.parts,
  annual: row.annual,
  recitation: row.recitation,
  memorization: row.memorization,
  total: row.total,
  grade: row.grade,
  prize: row.prize,
  statusPrize: row.status_prize,
  rank: row.rank,
  teacher: row.teacher || "",
});

export const loadYearData = async (year: string, studentId: number): Promise<YearData> => {
  const rows = await getCachedYearDataForStudent(studentId);
  const row = rows.find((item) => item.year === year);
  return row ? yearRowToData(row) : defaultYearData();
};

/** يقرأ جميع أعوام الطالب باستعلام محلي واحد لملف الطالب الشامل. */
export const loadYearDataForStudent = async (
  studentId: number,
): Promise<Record<string, YearData>> => {
  const rows = await getCachedYearDataForStudent(studentId);
  return rows.reduce<Record<string, YearData>>((result, row) => {
    result[row.year] = yearRowToData(row);
    return result;
  }, {});
};

// Latest Hijri year that actually has data
const getLatestDataYear = async (): Promise<string> => {
  const userId = await getUserId();
  if (!userId) return String(START_YEAR);

  try {
    const studentIds = new Set(
      (await getCachedStudents())
        .filter((student) => student.user_id === userId)
        .map((student) => student.id),
    );
    const cached = await getCachedYearData();
    const cachedYears = cached
      .filter((row) => studentIds.has(row.student_id))
      .map((row) => row.year)
      .filter(Boolean);
    if (cachedYears.length) return cachedYears.sort().slice(-1)[0];
  } catch {
    /* ignore */
  }

  return String(START_YEAR);
};

/**
 * العام النشط ومرشّحات الجدول تفضيلات عرض تخص الحساب الذي يسجّل الدخول
 * (وليس صاحب البيانات أثناء وضع الاطلاع)، لذلك تُقيَّد بمفتاح خاص به.
 */
const getViewPrefUserId = async (): Promise<string> => (await getAuthUserId()) ?? "";

export const getActiveYear = async (): Promise<string> => {
  const prefUserId = await getViewPrefUserId();
  if (prefUserId) {
    const year = await getCachedSetting<string>(scopedSettingKey(prefUserId, "active_year"));
    if (year) return year;
  }
  return getLatestDataYear();
};

export const setActiveYear = async (year: string) => {
  // تبديل العام مجرد تنقل في العرض، لذا يبقى مسموحاً أثناء الاطلاع، ويُحفظ
  // ضمن تفضيلات الحساب المتصفح نفسه دون أن يمسّ بيانات صاحبها.
  const prefUserId = await getViewPrefUserId();
  if (prefUserId) {
    await setCachedSetting(scopedSettingKey(prefUserId, "active_year"), year);
  }
};

export const getTableFilters = async <T>(): Promise<T | undefined> => {
  const prefUserId = await getViewPrefUserId();
  if (!prefUserId) return undefined;
  return getCachedSetting<T>(scopedSettingKey(prefUserId, "table_filters"));
};

export const setTableFilters = async (filters: Json) => {
  // مرشّحات الجدول تفضيل عرض؛ تُحفظ ضمن تفضيلات الحساب المتصفح فقط.
  const prefUserId = await getViewPrefUserId();
  if (!prefUserId) return;
  await setCachedSetting(scopedSettingKey(prefUserId, "table_filters"), filters);
};

export const migrateYearData = async (newYear: string, students: { id: number }[]) => {
  guardWrite();
  const newYearNum = parseInt(newYear);
  const previousYear = newYearNum - 1;

  for (const student of students) {
    const history = await loadHifzHistory(student.id);
    const previousYearData = await loadYearData(previousYear.toString(), student.id);

    const previousParts = parseFloat(previousYearData.parts) || 0;
    if (previousParts > 0) {
      const historyKey = `h${previousYear}`;
      history[historyKey] = previousParts.toString();
      await saveHifzHistory(student.id, history);
    }
  }
};

// لا مزامنة سحابية في النسخة المستقلة: كل كتابة تتم مباشرة في القاعدة
// المحلية داخل دوال put*/delete*. الدالة تبقى no-op لاستدعاءاتها المنتشرة.
const queueCloudSync = () => {};

// ===== Local-first CRUD for modules =====

export type TeacherRow = CachedTeacher;
export type TeacherBonusRow = CachedTeacherBonus;
export type DonorRow = CachedDonor;
export type AwardRow = CachedAward;
export type CeremonyExpenseRow = CachedCeremonyExpense;
export type CertificateRow = CachedCertificate;
export type InternalCompetitionRow = CachedInternalCompetition;
export type ExternalCompetitionRow = CachedExternalCompetition;
export type MediaMetadataRow = CachedMedia;

export const loadTeachers = async (year?: string): Promise<TeacherRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedTeachers();
  return byYear(
    rows.filter((r) => belongsToUser(r, userId)),
    year,
  ).sort((a, b) => a.name.localeCompare(b.name, "ar"));
};

export const saveTeacher = async (
  teacher: Partial<TeacherRow> & { name: string; year: string },
): Promise<TeacherRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const existing = teacher.id
    ? undefined
    : (await getCachedTeachers()).find(
        (t) => t.user_id === userId && t.year === teacher.year && t.name === teacher.name,
      );
  const row: TeacherRow = {
    id: teacher.id || existing?.id || newLocalId(),
    user_id: userId,
    year: teacher.year,
    name: teacher.name,
    created_at: teacher.created_at || existing?.created_at,
    updated_at: new Date().toISOString(),
  };
  await putCachedTeacher(row);
  await markDirty("teacher", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteTeacherLocal = async (id: string) => {
  guardWrite();
  await deleteCachedTeacher(id);
  await markDirty("teacher", "delete", { id });
  queueCloudSync();
};

export const loadTeacherBonuses = async (year?: string): Promise<TeacherBonusRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedTeacherBonuses();
  return byYear(
    rows.filter((r) => belongsToUser(r, userId)),
    year,
  );
};

export const saveTeacherBonus = async (
  bonus: Partial<TeacherBonusRow> & {
    teacher_name: string;
    year: string;
    month: number;
    amount: number;
  },
): Promise<TeacherBonusRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const existing = bonus.id
    ? undefined
    : (await getCachedTeacherBonuses()).find(
        (b) =>
          b.user_id === userId &&
          b.teacher_name === bonus.teacher_name &&
          b.year === bonus.year &&
          b.month === bonus.month,
      );
  const row: TeacherBonusRow = {
    id: bonus.id || existing?.id || newLocalId(),
    user_id: userId,
    teacher_name: bonus.teacher_name,
    year: bonus.year,
    month: bonus.month,
    amount: Number(bonus.amount || 0),
    created_at: bonus.created_at || existing?.created_at,
    updated_at: new Date().toISOString(),
  };
  await putCachedTeacherBonus(row);
  await markDirty("teacher_bonus", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteTeacherBonusLocal = async (id: string) => {
  guardWrite();
  await deleteCachedTeacherBonus(id);
  await markDirty("teacher_bonus", "delete", { id });
  queueCloudSync();
};

export const loadDonors = async (year?: string): Promise<DonorRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedDonors();
  return byYear(
    rows.filter((r) => belongsToUser(r, userId)),
    year,
  ).sort((a, b) => a.name.localeCompare(b.name, "ar"));
};

export const saveDonor = async (
  donor: Partial<DonorRow> & {
    year: string;
    name: string;
    donor_type: string;
    pledged_amount: number;
    paid_amount: number;
    phone?: string | null;
    in_kind?: string | null;
    notes?: string | null;
  },
): Promise<DonorRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const row: DonorRow = {
    ...donor,
    id: donor.id || newLocalId(),
    user_id: userId,
    phone: donor.phone ?? null,
    in_kind: donor.in_kind ?? null,
    notes: donor.notes ?? null,
    pledged_amount: Number(donor.pledged_amount || 0),
    paid_amount: Number(donor.paid_amount || 0),
    updated_at: new Date().toISOString(),
  };
  await putCachedDonor(row);
  await markDirty("donor", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteDonorLocal = async (id: string) => {
  guardWrite();
  await deleteCachedDonor(id);
  await markDirty("donor", "delete", { id });
  queueCloudSync();
};

export const loadAwards = async (year?: string): Promise<AwardRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedAwards();
  return byYear(
    rows.filter((r) => belongsToUser(r, userId)),
    year,
  ).sort((a, b) => (b.awarded_at || "").localeCompare(a.awarded_at || ""));
};

export const saveAward = async (
  award: Partial<AwardRow> & {
    year: string;
    recipient_type: string;
    recipient_name: string;
    award_type: string;
    award_kind: string;
    amount: number;
    item?: string | null;
    student_name?: string | null;
    notes?: string | null;
    awarded_at: string;
    funded_by?: string | null;
  },
): Promise<AwardRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const row: AwardRow = {
    ...award,
    id: award.id || newLocalId(),
    user_id: userId,
    amount: Number(award.amount || 0),
    item: award.item ?? null,
    student_name: award.student_name ?? null,
    notes: award.notes ?? null,
    funded_by: award.funded_by ?? null,
    updated_at: new Date().toISOString(),
  };
  await putCachedAward(row);
  await markDirty("award", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteAwardLocal = async (id: string) => {
  guardWrite();
  await deleteCachedAward(id);
  await markDirty("award", "delete", { id });
  queueCloudSync();
};

export const loadCeremonyExpenses = async (year?: string): Promise<CeremonyExpenseRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedCeremonyExpenses();
  return byYear(
    rows.filter((r) => belongsToUser(r, userId)),
    year,
  ).sort((a, b) => (b.spent_at || "").localeCompare(a.spent_at || ""));
};

export const saveCeremonyExpense = async (
  expense: Partial<CeremonyExpenseRow> & {
    year: string;
    category: string;
    description: string;
    amount: number;
    spent_at: string;
    funded_by?: string | null;
    notes?: string | null;
  },
): Promise<CeremonyExpenseRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const row: CeremonyExpenseRow = {
    ...expense,
    id: expense.id || newLocalId(),
    user_id: userId,
    amount: Number(expense.amount || 0),
    funded_by: expense.funded_by ?? null,
    notes: expense.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  await putCachedCeremonyExpense(row);
  await markDirty("expense", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteCeremonyExpenseLocal = async (id: string) => {
  guardWrite();
  await deleteCachedCeremonyExpense(id);
  await markDirty("expense", "delete", { id });
  queueCloudSync();
};

export const loadCertificates = async (year?: string): Promise<CertificateRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedCertificates();
  return byYear(
    rows.filter((r) => belongsToUser(r, userId)),
    year,
  ).sort((a, b) => a.recipient_name.localeCompare(b.recipient_name, "ar"));
};

export const saveCertificate = async (
  certificate: Partial<CertificateRow> & {
    year: string;
    recipient_type: string;
    recipient_name: string;
    cert_type: string;
    title?: string;
    notes?: string | null;
    issued_at: string;
  },
): Promise<CertificateRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const row: CertificateRow = {
    ...certificate,
    id: certificate.id || newLocalId(),
    user_id: userId,
    title: certificate.title || "",
    notes: certificate.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  await putCachedCertificate(row);
  await markDirty("certificate", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const saveCertificates = async (
  certificates: Array<Parameters<typeof saveCertificate>[0]>,
) => {
  guardWrite();
  const saved: CertificateRow[] = [];
  for (const certificate of certificates) {
    const row = await saveCertificate(certificate);
    if (row) saved.push(row);
  }
  return saved;
};

export const deleteCertificateLocal = async (id: string) => {
  guardWrite();
  await deleteCachedCertificate(id);
  await markDirty("certificate", "delete", { id });
  queueCloudSync();
};

// ===== Internal Competitions =====
export const loadInternalCompetitions = async (
  year?: string,
  studentId?: number,
): Promise<InternalCompetitionRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  let rows = await getCachedInternalCompetitions();
  rows = rows.filter((r) => belongsToUser(r, userId));
  if (year) rows = rows.filter((r) => r.year === year);
  if (studentId) rows = rows.filter((r) => r.student_id === studentId);
  return rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
};

export const saveInternalCompetition = async (
  comp: Partial<InternalCompetitionRow> & {
    student_id: number;
    student_name: string;
    year: string;
    competition_name: string;
    category: string;
    score: number | string;
    rank: string;
    prize: string;
    notes?: string | null;
    date?: string | null;
  },
): Promise<InternalCompetitionRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const row: InternalCompetitionRow = {
    ...comp,
    id: comp.id || newLocalId(),
    user_id: userId,
    score: comp.score ?? 0,
    notes: comp.notes ?? null,
    date: comp.date ?? new Date().toISOString().slice(0, 10),
    created_at: comp.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await putCachedInternalCompetition(row);
  await markDirty("internal_competition", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteInternalCompetitionLocal = async (id: string) => {
  guardWrite();
  await deleteCachedInternalCompetition(id);
  await markDirty("internal_competition", "delete", { id });
  queueCloudSync();
};

// ===== External Competitions =====
export const loadExternalCompetitions = async (
  year?: string,
  studentId?: number,
): Promise<ExternalCompetitionRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  let rows = await getCachedExternalCompetitions();
  rows = rows.filter((r) => belongsToUser(r, userId));
  if (year) rows = rows.filter((r) => r.year === year);
  if (studentId) rows = rows.filter((r) => r.student_id === studentId);
  return rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
};

export const saveExternalCompetition = async (
  comp: Partial<ExternalCompetitionRow> & {
    student_id: number;
    student_name: string;
    year: string;
    competition_name: string;
    organizer: string;
    category: string;
    score: number | string;
    rank: string;
    prize: string;
    notes?: string | null;
    date?: string | null;
  },
): Promise<ExternalCompetitionRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const row: ExternalCompetitionRow = {
    ...comp,
    id: comp.id || newLocalId(),
    user_id: userId,
    score: comp.score ?? 0,
    notes: comp.notes ?? null,
    date: comp.date ?? new Date().toISOString().slice(0, 10),
    created_at: comp.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await putCachedExternalCompetition(row);
  await markDirty("external_competition", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteExternalCompetitionLocal = async (id: string) => {
  guardWrite();
  await deleteCachedExternalCompetition(id);
  await markDirty("external_competition", "delete", { id });
  queueCloudSync();
};

// ===== Media Metadata =====
export const loadMediaMetadata = async (year?: string): Promise<MediaMetadataRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedMedia();
  return byYear(
    rows.filter((r) => belongsToUser(r, userId)),
    year,
  ).sort((a, b) => a.month - b.month || (b.created_at || "").localeCompare(a.created_at || ""));
};

export const saveMediaMetadata = async (
  media: Partial<MediaMetadataRow> & {
    year: string;
    month: number;
    title: string;
    file_path: string;
    file_type: "image" | "video";
    file_size: number;
  },
): Promise<MediaMetadataRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const row: MediaMetadataRow = {
    ...media,
    id: media.id || newLocalId(),
    user_id: userId,
    created_at: media.created_at || new Date().toISOString(),
  };
  await putCachedMedia(row);
  await markDirty("media", "upsert", { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteMediaMetadataLocal = async (id: string) => {
  guardWrite();
  const existing = (await getCachedMedia()).find((item) => item.id === id);
  await deleteCachedMedia(id);
  await markDirty("media", "delete", { id, file_path: existing?.file_path });
  queueCloudSync();
};

// ===== SYNC TO CLOUD: called when user clicks "Save" =====
/**
 * لا توجد مزامنة سحابية في النسخة المستقلة — كل الكتابات تتم مباشرة في
 * قاعدة SQLite المحلية. تُبقى الدالة (وتكتمل فوراً) للتوافق مع الشاشات
 * التي تستدعيها بعد عمليات الحفظ.
 */
export const syncToCloud = async (_onProgress?: ProgressCb): Promise<boolean> => true;

export const saveGlobalStudents = async (students: Student[]) => {
  guardWrite();
  // Handled per student via saveStudent
};

// ===== Merge duplicate students by name =====
export const mergeDuplicateStudents = async (): Promise<number> => {
  guardWrite();
  const students = await getCachedStudents();
  const allHistory = await getCachedHifzHistory();
  const allYearData = await getCachedYearData();

  const norm = (s: string) => (s || "").trim().replace(/\s+/g, " ");
  const groups: Record<string, typeof students> = {};
  for (const s of students) {
    const key = norm(s.name);
    if (!key) continue;
    (groups[key] = groups[key] || []).push(s);
  }

  const { putCachedHifzRow, putCachedYearData, deleteItem } = await import("./localDB");
  let mergedCount = 0;

  for (const key in groups) {
    const group = groups[key];
    if (group.length < 2) continue;
    group.sort((a, b) => a.id - b.id);
    const primary = group[0];
    const dupes = group.slice(1);

    for (const dup of dupes) {
      const dupHistory = allHistory.filter((h) => h.student_id === dup.id);
      for (const h of dupHistory) {
        const existing = allHistory.find(
          (r) => r.student_id === primary.id && r.year_key === h.year_key,
        );
        if (!existing || !existing.value || existing.value === "0") {
          await putCachedHifzRow({ student_id: primary.id, year_key: h.year_key, value: h.value });
          await markDirty("hifz", "upsert", { student_id: primary.id, year_key: h.year_key });
        }
        await deleteItem("hifz_history", [h.student_id, h.year_key]);
      }
      const dupYears = allYearData.filter((y) => y.student_id === dup.id);
      for (const y of dupYears) {
        const existing = allYearData.find((r) => r.student_id === primary.id && r.year === y.year);
        if (!existing || (!existing.parts && existing.total === "0")) {
          await putCachedYearData({ ...y, student_id: primary.id });
          await markDirty("year", "upsert", { student_id: primary.id, year: y.year });
        }
        await deleteItem("year_data", [y.student_id, y.year]);
      }
      const { deleteCachedStudent } = await import("./localDB");
      await deleteCachedStudent(dup.id);
      await markDirty("student", "delete", { id: dup.id });
      mergedCount++;
    }
  }

  return mergedCount;
};

// ================= المتابعة الشهرية =================

import { MonthlyRecord, QuranPoint, TRACKING_MONTHS } from "@/types/student";
import { calcPagesBetweenAsync } from "@/utils/quranData";

const emptyPoint = (): QuranPoint => ({ surah: null, ayah: null });

const emptyMonthlyRecord = (): MonthlyRecord => ({
  memoFrom: emptyPoint(),
  memoTo: emptyPoint(),
  memoHifzScore: "",
  memoRecitationScore: "",
  reviewFrom: emptyPoint(),
  reviewTo: emptyPoint(),
  reviewHifzScore: "",
  reviewRecitationScore: "",
  attendanceScore: "",
  behaviorScore: "",
});

const rowToRecord = (row: MonthlyRow): MonthlyRecord => ({
  memoFrom: {
    surah: row.memorization_from_surah ?? null,
    ayah: row.memorization_from_ayah ?? null,
  },
  memoTo: { surah: row.memorization_to_surah ?? null, ayah: row.memorization_to_ayah ?? null },
  memoHifzScore: row.memorization_hifz_score?.toString() || "",
  memoRecitationScore: row.memorization_recitation_score?.toString() || "",
  reviewFrom: { surah: row.review_from_surah ?? null, ayah: row.review_from_ayah ?? null },
  reviewTo: { surah: row.review_to_surah ?? null, ayah: row.review_to_ayah ?? null },
  reviewHifzScore: row.review_hifz_score?.toString() || "",
  reviewRecitationScore: row.review_recitation_score?.toString() || "",
  attendanceScore: row.attendance_score?.toString() || "",
  behaviorScore: row.behavior_score?.toString() || "",
});

export const loadMonthlyTrackingForMonth = async (
  year: string,
  month: number,
): Promise<Record<number, MonthlyRecord>> => {
  const result: Record<number, MonthlyRecord> = {};
  const userId = await getUserId();
  if (!userId) return result;

  const rows = await getMonthlyTrackingForMonth(userId, year, month);
  rows.forEach((row) => {
    result[row.student_id] = rowToRecord(row);
  });
  return result;
};

export const loadMonthlyTrackingForStudent = async (
  year: string,
  studentId: number,
): Promise<Record<number, MonthlyRecord>> => {
  const result: Record<number, MonthlyRecord> = {};
  const userId = await getUserId();
  if (!userId) return result;

  const rows = await getMonthlyTrackingForStudent(userId, year, studentId);
  rows.forEach((row) => {
    result[row.month] = rowToRecord(row);
  });
  return result;
};

export const getPreviousMonthEndPoints = async (
  year: string,
  studentId: number,
  beforeMonth: number,
): Promise<{ memoFrom: QuranPoint; reviewFrom: QuranPoint }> => {
  const all = await loadMonthlyTrackingForStudent(year, studentId);
  for (let m = beforeMonth - 1; m >= 1; m--) {
    const rec = all[m];
    if (rec && (rec.memoTo.surah || rec.reviewTo.surah)) {
      return {
        memoFrom: rec.memoTo.surah ? rec.memoTo : emptyPoint(),
        reviewFrom: rec.reviewTo.surah ? rec.reviewTo : emptyPoint(),
      };
    }
  }
  return { memoFrom: emptyPoint(), reviewFrom: emptyPoint() };
};

export const saveMonthlyRecord = async (
  year: string,
  studentId: number,
  month: number,
  record: MonthlyRecord,
): Promise<boolean> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return false;

  await putMonthlyTracking({
    user_id: userId,
    student_id: studentId,
    year,
    month,
    memorization_from_surah: record.memoFrom.surah,
    memorization_from_ayah: record.memoFrom.ayah,
    memorization_to_surah: record.memoTo.surah,
    memorization_to_ayah: record.memoTo.ayah,
    memorization_hifz_score: parseFloat(record.memoHifzScore) || 0,
    memorization_recitation_score: parseFloat(record.memoRecitationScore) || 0,
    review_from_surah: record.reviewFrom.surah,
    review_from_ayah: record.reviewFrom.ayah,
    review_to_surah: record.reviewTo.surah,
    review_to_ayah: record.reviewTo.ayah,
    review_hifz_score: parseFloat(record.reviewHifzScore) || 0,
    review_recitation_score: parseFloat(record.reviewRecitationScore) || 0,
    attendance_score: parseFloat(record.attendanceScore) || 0,
    behavior_score: parseFloat(record.behaviorScore) || 0,
  });

  await recomputeAnnualFromMonthly(year, studentId);
  return true;
};

export const recomputeAnnualFromMonthly = async (year: string, studentId: number) => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return;

  const data = await getMonthlyTrackingForStudent(userId, year, studentId);
  if (data.length === 0) return;

  const pagesPerRow = await Promise.all(
    data.map(async (r) => {
      if (!r.memorization_from_surah || !r.memorization_to_surah) return 0;
      return calcPagesBetweenAsync(
        r.memorization_from_surah,
        r.memorization_from_ayah ?? 1,
        r.memorization_to_surah,
        r.memorization_to_ayah ?? 1,
      );
    }),
  );
  const totalPages = pagesPerRow.reduce((sum, p) => sum + p, 0);

  const monthsWithScores = data.filter(
    (r) => (Number(r.attendance_score) || 0) > 0 || (Number(r.behavior_score) || 0) > 0,
  );
  const totalMonthlyOutOf20 = data.reduce(
    (sum: number, r) => sum + ((Number(r.attendance_score) || 0) + (Number(r.behavior_score) || 0)),
    0,
  );
  const monthCount = monthsWithScores.length || 1;

  const partsFromPages = totalPages / 20;
  const annualScore = totalMonthlyOutOf20 / monthCount;

  const existing = await loadYearData(year, studentId);
  await saveYearData(year, studentId, {
    ...existing,
    parts: partsFromPages > 0 ? partsFromPages.toFixed(2).replace(/\.00$/, "") : existing.parts,
    annual: totalMonthlyOutOf20 > 0 ? annualScore.toFixed(2).replace(/\.00$/, "") : existing.annual,
  });
};

export interface MonthlyRanking {
  studentId: number;
  memoScore: number;
  reviewScore: number;
  pagesThisMonth: number;
}

export const getMonthlyRankings = async (
  year: string,
  month: number,
): Promise<MonthlyRanking[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  const data = await getMonthlyTrackingForMonth(userId, year, month);

  return Promise.all(
    data.map(async (r) => ({
      studentId: r.student_id,
      memoScore:
        (Number(r.memorization_hifz_score) || 0) + (Number(r.memorization_recitation_score) || 0),
      reviewScore: (Number(r.review_hifz_score) || 0) + (Number(r.review_recitation_score) || 0),
      pagesThisMonth:
        r.memorization_from_surah && r.memorization_to_surah
          ? await calcPagesBetweenAsync(
              r.memorization_from_surah,
              r.memorization_from_ayah ?? 1,
              r.memorization_to_surah,
              r.memorization_to_ayah ?? 1,
            )
          : 0,
    })),
  );
};

export const getLatestTrackedPeriod = async (): Promise<{ year: string; month: number } | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  return getLatestMonthlyTrackingPeriod(userId);
};

export { TRACKING_MONTHS };

export interface KhatimEntry {
  studentId: number;
  name: string;
  teacher: string;
  year: string;
  totalScore: string;
  grade: string;
}

export const checkGlobalDuplicateName = async (
  name: string,
  excludeId?: number,
): Promise<{ studentId: number; years: string[] } | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  const normalized = (name || "").trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  // بحث محلي بأسماء طلاب المستخدم نفسه (غير حساس لحالة الأحرف اللاتينية).
  const candidates = await searchCachedStudentsByName(normalized, userId);
  const match = candidates.find((m) => {
    const mNorm = (m.name || "").trim().replace(/\s+/g, " ");
    return mNorm.toLowerCase() === normalized.toLowerCase() && m.id !== excludeId;
  });
  if (!match) return null;

  const yearRows = await getCachedYearDataForStudent(match.id);
  const years = Array.from(new Set(yearRows.map((r) => r.year))).sort();
  return { studentId: match.id, years };
};

export const loadKhatimat = async (): Promise<KhatimEntry[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  const studentIds = new Set(
    (await getCachedStudents())
      .filter((student) => student.user_id === userId)
      .map((student) => student.id),
  );
  const namesById = new Map(
    (await getCachedStudents())
      .filter((student) => student.user_id === userId)
      .map((student) => [student.id, student.name] as const),
  );

  return (await getCachedYearData())
    .filter((r) => studentIds.has(r.student_id) && (parseFloat(r.total_hifz) || 0) >= 30)
    .map((r) => ({
      studentId: r.student_id,
      name: namesById.get(r.student_id) || "",
      teacher: r.teacher || "",
      year: r.year,
      totalScore: r.total || "0",
      grade: r.grade || "",
    }))
    .sort((a, b) => a.year.localeCompare(b.year) || a.name.localeCompare(b.name, "ar"));
};
