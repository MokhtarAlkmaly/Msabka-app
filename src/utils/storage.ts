import {
  Student,
  HifzHistory,
  YearData,
  START_YEAR,
  CustomColumnDef,
  DEFAULT_STATUSES,
} from "@/types/student";
import { supabase } from "@/integrations/supabase/client";
import { resolveBaseHifz } from "./calculations";
import {
  cacheStudents, getCachedStudents, putCachedStudent, deleteCachedStudent,
  cacheHifzHistory, getCachedHifzHistory, putCachedHifzRow,
  cacheYearData, getCachedYearData, putCachedYearData,
  setCachedSetting, getCachedSetting,
  setLastSyncTime, isCachePopulated, clearAllCache,
  CachedStudent, CachedHifzRow, CachedYearData,
  cacheTeachers, getCachedTeachers, putCachedTeacher, deleteCachedTeacher,
  cacheTeacherBonuses, getCachedTeacherBonuses, putCachedTeacherBonus, deleteCachedTeacherBonus,
  cacheDonors, getCachedDonors, putCachedDonor, deleteCachedDonor,
  cacheAwards, getCachedAwards, putCachedAward, deleteCachedAward,
  cacheCeremonyExpenses, getCachedCeremonyExpenses, putCachedCeremonyExpense, deleteCachedCeremonyExpense,
  cacheCertificates, getCachedCertificates, putCachedCertificate, deleteCachedCertificate,
  cacheInternalCompetitions, getCachedInternalCompetitions, putCachedInternalCompetition, deleteCachedInternalCompetition,
  cacheExternalCompetitions, getCachedExternalCompetitions, putCachedExternalCompetition, deleteCachedExternalCompetition,
  cacheMedia, getCachedMedia, putCachedMedia, deleteCachedMedia,
  getCachedYearDataForStudent, getCachedYearDataForStudents, getCachedYearDataForYear,
  getCachedStudentsForYear, getCachedHifzHistoryForStudents,
  CachedTeacher, CachedTeacherBonus, CachedDonor, CachedAward,
  CachedCeremonyExpense, CachedCertificate, CachedMedia,
  CachedInternalCompetition, CachedExternalCompetition,
} from "./localDB";
import {
  markDirty, getPendingChanges, clearPending,
  remapPendingStudentId,
} from "./localDB";
import { getViewAsId, isViewingOtherUser, subscribeViewAs } from "./viewAs";

// ===== Helper: get cached user =====
const CACHE_USER_SETTING = 'cache_user_id';

let cachedAuthUserId: string | null = null;
let knownUserId: string | null = null;
let cacheResetInFlight: Promise<void> | null = null;

const clearSessionCache = () => {
  const reset = clearAllCache().catch((error) => {
    console.error('Failed to clear the previous user cache:', error);
  });
  const inFlight = reset.finally(() => {
    if (cacheResetInFlight === inFlight) cacheResetInFlight = null;
  });
  cacheResetInFlight = inFlight;
};

/** معرّف الحساب المسجَّل دخوله فعلياً (وليس الحساب المعروض). */
const getAuthUserId = async (): Promise<string | null> => {
  if (cachedAuthUserId) return cachedAuthUserId;

  const { data: { session } } = await supabase.auth.getSession();
  cachedAuthUserId = session?.user?.id || null;
  if (!cachedAuthUserId && isOnline()) {
    const { data: { user } } = await supabase.auth.getUser();
    cachedAuthUserId = user?.id || null;
  }

  if (cachedAuthUserId) knownUserId = cachedAuthUserId;
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
    super('أنت في وضع الاطلاع على بيانات مستخدم آخر — التعديل غير مسموح');
    this.name = 'ReadOnlyViewError';
  }
}

/** يمنع أي كتابة أثناء وضع الاطلاع. */
const guardWrite = () => {
  if (isViewingOtherUser()) throw new ReadOnlyViewError();
};

supabase.auth.onAuthStateChange((event, session) => {
  const newUserId = session?.user?.id || null;
  cachedAuthUserId = newUserId;

  const identityChanged = knownUserId !== null && newUserId !== null
    && knownUserId !== newUserId;
  const signedOut = event === 'SIGNED_OUT';

  if (newUserId) knownUserId = newUserId;

  if (signedOut || identityChanged) {
    knownUserId = newUserId;
    clearSessionCache();
  }
});

// تبديل الحساب المعروض يُبطل الكاش المحلي، لأن الكاش يخص مالكاً واحداً فقط.
subscribeViewAs(() => {
  clearSessionCache();
});

// ===== Online check =====
const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

const canUseCloud = (userId: string | null): userId is string => !!userId && isOnline();

type UserSettingsRecord = Record<string, unknown> | null;
type SettingsQuery = Promise<{ data: UserSettingsRecord; error: unknown }> & {
  eq: (column: string, value: string) => SettingsQuery;
  maybeSingle: () => Promise<{ data: UserSettingsRecord; error: unknown }>;
};
type SettingsClient = {
  from: (table: string) => {
    select: (columns: string) => SettingsQuery;
    upsert: (
      values: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<{ error: unknown }>;
  };
};
const settingsDb = supabase as unknown as SettingsClient;

const logOptionalSettingsColumnError = (field: string, error: unknown) => {
  if (!error) return;
  console.warn(`تعذّر مزامنة إعداد ${field} مع السحابة. تأكد من تطبيق آخر ترحيلات Supabase:`, error);
};

const loadCloudSettingField = async <T,>(userId: string, field: string): Promise<T | undefined> => {
  const { data, error } = await settingsDb
    .from('user_settings')
    .select(field)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logOptionalSettingsColumnError(field, error);
    return undefined;
  }
  return data?.[field] as T | undefined;
};

const saveCloudSettingFields = async (userId: string, values: Record<string, unknown>) => {
  const { error } = await settingsDb
    .from('user_settings')
    .upsert({ user_id: userId, ...values }, { onConflict: 'user_id' });
  if (error) logOptionalSettingsColumnError(Object.keys(values).join(', '), error);
};

const newLocalId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const ensureCache = async () => {
  const userId = await getUserId();
  if (!userId) return;
  if (cacheResetInFlight) await cacheResetInFlight;

  const hasCache = await isCachePopulated();
  const cacheOwner = await getCachedSetting<string>(CACHE_USER_SETTING);
  const cachedStudents = await getCachedStudents();
  const containsAnotherUsersStudents = cachedStudents.some(
    (student) => student.user_id !== userId
  );

  // The local database is shared by sessions on the same device. Never expose
  // the previous account's students while a new session is being initialized.
  if ((cacheOwner && cacheOwner !== userId) || containsAnotherUsersStudents) {
    clearSessionCache();
    if (cacheResetInFlight) await cacheResetInFlight;

    if (isOnline()) {
      await syncFromCloud();
    }
    return;
  }

  // Adopt a legacy cache only when every cached student already belongs to the
  // current user. This avoids an unnecessary download without weakening the
  // per-user isolation guarantee.
  if (!cacheOwner && cachedStudents.length > 0) {
    await setCachedSetting(CACHE_USER_SETTING, userId);
  }

  if (!hasCache && isOnline()) {
    await syncFromCloud();
  }
};

const belongsToUser = <T extends { user_id: string }>(row: T, userId: string) => row.user_id === userId;

const byYear = <T extends { year: string }>(rows: T[], year?: string) =>
  year ? rows.filter(row => row.year === year) : rows;

// ===== Initial sync: download all data from cloud to local =====
export type ProgressCb = (current: number, total: number, label?: string) => void;

let syncFromCloudInFlight: Promise<boolean> | null = null;

export const syncFromCloud = async (onProgress?: ProgressCb): Promise<boolean> => {
  if (syncFromCloudInFlight) return syncFromCloudInFlight;

  syncFromCloudInFlight = runSyncFromCloud(onProgress).finally(() => {
    syncFromCloudInFlight = null;
  });
  return syncFromCloudInFlight;
};

const runSyncFromCloud = async (onProgress?: ProgressCb): Promise<boolean> => {
  const userId = await getUserId();
  if (!canUseCloud(userId)) return false;

  try {
    // في وضع الاطلاع لا توجد تغييرات محلية تُرفع (الكتابة معطّلة أصلاً)، لذا
    // نتخطى خطوة الرفع ولا نعتبر فشلها سبباً لإلغاء التنزيل.
    if (!isViewingOtherUser()) {
      const pendingBefore = await getPendingChanges();
      if (pendingBefore.length > 0) {
        const pushed = await syncToCloud();
        if (!pushed) return false;
      }
    }

    onProgress?.(0, 13, 'تحميل البيانات');
    const [
      studentsRes,
      historyRes,
      yearDataRes,
      teachersRes,
      teacherBonusesRes,
      donorsRes,
      awardsRes,
      expensesRes,
      certificatesRes,
      internalCompRes,
      externalCompRes,
      mediaRes,
    ] = await Promise.all([
      supabase.from('students').select('*').eq('user_id', userId).order('id'),
      supabase.from('hifz_history').select('*').eq('user_id', userId),
      supabase.from('year_data').select('*').eq('user_id', userId),
      supabase.from('teachers').select('*').eq('user_id', userId),
      supabase.from('teacher_bonuses').select('*').eq('user_id', userId),
      supabase.from('donors').select('*').eq('user_id', userId),
      supabase.from('awards').select('*').eq('user_id', userId),
      supabase.from('ceremony_expenses').select('*').eq('user_id', userId),
      supabase.from('certificates').select('*').eq('user_id', userId),
      supabase.from('internal_competitions' as any).select('*').eq('user_id', userId),
      supabase.from('external_competitions' as any).select('*').eq('user_id', userId),
      supabase.from('media').select('*').eq('user_id', userId),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (historyRes.error) throw historyRes.error;
    if (yearDataRes.error) throw yearDataRes.error;
    if (teachersRes.error) throw teachersRes.error;
    if (teacherBonusesRes.error) throw teacherBonusesRes.error;
    if (donorsRes.error) throw donorsRes.error;
    if (awardsRes.error) throw awardsRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (certificatesRes.error) throw certificatesRes.error;

    onProgress?.(1, 13, 'حفظ الطالبات');
    await cacheStudents(
      (studentsRes.data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        teacher: s.teacher || '',
        user_id: s.user_id,
        gender: s.gender || null,
        hijri_join_date: s.hijri_join_date || null,
        initial_hifz: s.initial_hifz || null,
        first_competition_year: s.first_competition_year || null,
        status: s.status || 'طبيعي',
        school_grade: s.school_grade || null,
        guardian_phone: s.guardian_phone || null,
        student_phone: s.student_phone || null,
        custom_fields: s.custom_fields || {},
        notes: s.notes || null,
      }))
    );

    onProgress?.(2, 13, 'حفظ سجل الحفظ');
    await cacheHifzHistory(
      (historyRes.data || []).map(r => ({ student_id: r.student_id, year_key: r.year_key, value: r.value }))
    );

    onProgress?.(3, 13, 'حفظ بيانات الأعوام');
    await cacheYearData(
      (yearDataRes.data || []).map(r => ({
        student_id: r.student_id, year: r.year,
        base_hifz: r.base_hifz, total_hifz: r.total_hifz, parts: r.parts,
        annual: r.annual, recitation: r.recitation, memorization: r.memorization,
        total: r.total, grade: r.grade, prize: r.prize,
        status_prize: r.status_prize, rank: r.rank, teacher: (r as any).teacher || '',
      }))
    );

    onProgress?.(4, 13, 'حفظ المعلمات');
    await cacheTeachers((teachersRes.data || []) as CachedTeacher[]);

    onProgress?.(5, 13, 'حفظ الإكراميات');
    await cacheTeacherBonuses((teacherBonusesRes.data || []) as CachedTeacherBonus[]);

    onProgress?.(6, 13, 'حفظ الداعمين');
    await cacheDonors((donorsRes.data || []) as CachedDonor[]);

    onProgress?.(7, 13, 'حفظ الجوائز');
    await cacheAwards((awardsRes.data || []) as CachedAward[]);

    onProgress?.(8, 13, 'حفظ المصروفات');
    await cacheCeremonyExpenses((expensesRes.data || []) as CachedCeremonyExpense[]);

    onProgress?.(9, 13, 'حفظ الشهادات');
    await cacheCertificates((certificatesRes.data || []) as CachedCertificate[]);

    onProgress?.(10, 13, 'حفظ المسابقات الداخلية');
    if (!internalCompRes.error && internalCompRes.data) {
      await cacheInternalCompetitions(
        (internalCompRes.data || []) as unknown as CachedInternalCompetition[]
      );
    }

    onProgress?.(11, 13, 'حفظ المسابقات الخارجية');
    if (!externalCompRes.error && externalCompRes.data) {
      await cacheExternalCompetitions(
        (externalCompRes.data || []) as unknown as CachedExternalCompetition[]
      );
    }

    onProgress?.(12, 13, 'حفظ بيانات الوسائط');
    if (!mediaRes.error && mediaRes.data) {
      await cacheMedia((mediaRes.data || []) as CachedMedia[]);
    }

    // Mark the cache owner only after all user-scoped records were downloaded.
    // This lets the next session detect and replace a cache from another user.
    await setCachedSetting(CACHE_USER_SETTING, userId);

    // Cache active year
    const { data: settingsData } = await supabase
      .from('user_settings')
      .select('active_year')
      .eq('user_id', userId)
      .maybeSingle();
    if (settingsData?.active_year) {
      await setCachedSetting('active_year', settingsData.active_year);
    }

    await setLastSyncTime();
    onProgress?.(13, 13, 'اكتمل');
    return true;
  } catch (err) {
    console.error('Sync from cloud failed:', err);
    return false;
  }
};

// ===== Custom Columns Settings =====
export const loadCustomColumns = async (): Promise<CustomColumnDef[]> => {
  await ensureCache();
  const cached = await getCachedSetting<CustomColumnDef[]>('student_custom_columns');
  if (Array.isArray(cached)) return cached;

  const userId = await getUserId();
  if (canUseCloud(userId)) {
    const cloud = await loadCloudSettingField<CustomColumnDef[]>(userId, 'student_custom_columns');
    if (Array.isArray(cloud)) {
      await setCachedSetting('student_custom_columns', cloud);
      return cloud;
    }
  }

  return [];
};

export const saveCustomColumns = async (cols: CustomColumnDef[]) => {
  guardWrite();
  await setCachedSetting('student_custom_columns', cols);

  const userId = await getUserId();
  if (canUseCloud(userId)) {
    await saveCloudSettingFields(userId, { student_custom_columns: cols });
  }
};

// ===== Student Statuses Settings =====
export const loadStudentStatuses = async (): Promise<string[]> => {
  await ensureCache();
  const cached = await getCachedSetting<string[]>('student_statuses');
  if (Array.isArray(cached) && cached.length > 0) return cached;

  const userId = await getUserId();
  if (canUseCloud(userId)) {
    const cloud = await loadCloudSettingField<string[]>(userId, 'student_statuses');
    if (Array.isArray(cloud) && cloud.length > 0) {
      await setCachedSetting('student_statuses', cloud);
      return cloud;
    }
  }

  return DEFAULT_STATUSES;
};

export const saveStudentStatuses = async (statuses: string[]) => {
  guardWrite();
  const normalized = statuses.map((status) => status.trim()).filter(Boolean);
  await setCachedSetting('student_statuses', normalized);

  const userId = await getUserId();
  if (canUseCloud(userId)) {
    await saveCloudSettingFields(userId, { student_statuses: normalized });
  }
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
    getCachedStudentsForYear(currentYear),
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
  baseHifz: '0', totalHifz: '0', parts: '', annual: '', recitation: '',
  memorization: '', total: '0', grade: '', prize: '0', statusPrize: '', rank: '-',
  teacher: ''
});

export interface RecallCandidate {
  id: number;
  name: string;
  teacher: string;
  lastYear: string;
  baseHifz: number;
  years: string[];
}

// الطالبات الموجودات في السجل العام وغير مسجّلات في العام المختار
export const listRecallCandidates = async (year: string): Promise<RecallCandidate[]> => {
  await ensureCache();
  const students = await getCachedStudents();
  const allYearData = await getCachedYearData();
  const allHistory = await getCachedHifzHistory();
  const yearNum = parseInt(year);

  const byStudent = new Map<number, typeof allYearData>();
  allYearData.forEach(row => {
    const list = byStudent.get(row.student_id) || [];
    list.push(row);
    byStudent.set(row.student_id, list);
  });

  const historyMap: Record<number, HifzHistory> = {};
  allHistory.forEach(row => {
    if (!historyMap[row.student_id]) historyMap[row.student_id] = {};
    historyMap[row.student_id][row.year_key] = row.value;
  });

  const candidates: RecallCandidate[] = [];
  for (const s of students) {
    const rows = byStudent.get(s.id) || [];
    if (rows.some(r => r.year === year)) continue;
    const previous = rows.filter(r => parseInt(r.year) < yearNum).sort((a, b) => a.year.localeCompare(b.year));

    const history = { ...(historyMap[s.id] || {}) };
    previous.forEach(r => {
      const parts = parseFloat(r.parts) || 0;
      if (parts > 0) {
        const key = `h${r.year}`;
        if ((parseFloat(history[key]) || 0) < parts) history[key] = parts.toString();
      }
    });

    const last = previous.length > 0 ? previous[previous.length - 1] : null;
    const lastTotalHifz = last ? (parseFloat(last.total_hifz) || 0) : (parseFloat(s.initial_hifz || '0') || 0);
    const baseHifz = resolveBaseHifz(history, yearNum, lastTotalHifz);

    candidates.push({
      id: s.id,
      name: s.name,
      teacher: last?.teacher || s.teacher || '',
      lastYear: last?.year || s.first_competition_year || 'سجل عام',
      baseHifz,
      years: rows.map(r => r.year).sort(),
    });
  }

  return candidates.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
};

// استدعاء طالبات من السجل العام إلى العام المختار مع ترحيل الحفظ التراكمي
export const recallStudentsToYear = async (year: string, ids: number[]): Promise<number> => {
  guardWrite();
  const candidates = await listRecallCandidates(year);
  const map = new Map(candidates.map(c => [c.id, c]));
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

// تسجيل طالبة في العام المختار
export const registerStudentInYear = async (year: string, studentId: number, teacher = '') => {
  guardWrite();
  const student = (await getCachedStudents()).find(s => s.id === studentId);
  const initialBase = student?.initial_hifz ? student.initial_hifz : '0';
  await saveYearData(year, studentId, {
    ...emptyYearData(),
    teacher: teacher || student?.teacher || '',
    baseHifz: initialBase,
    totalHifz: initialBase,
  });
};

// تحميل كل الطلاب المسجلين في كل الأعوام من السجل الرسمي الشامل
export const loadGlobalStudents = async (): Promise<Student[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];

  const students = (await getCachedStudents()).filter(
    (student) => student.user_id === userId
  );
  return students.map(s => ({
    id: s.id,
    name: s.name,
    teacher: s.teacher || '',
    gender: s.gender || undefined,
    hijri_join_date: s.hijri_join_date || undefined,
    initial_hifz: s.initial_hifz || undefined,
    first_competition_year: s.first_competition_year || undefined,
    status: s.status || 'طبيعي',
    school_grade: s.school_grade || undefined,
    guardian_phone: s.guardian_phone || undefined,
    student_phone: s.student_phone || undefined,
    custom_fields: s.custom_fields || {},
    notes: s.notes || undefined,
  })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
};

// ===== Save to LOCAL cache =====
export const saveStudent = async (student: Partial<Student> & { id?: number; name: string }): Promise<number | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;

  const payload: CachedStudent = {
    id: student.id || 0,
    name: (student.name || '').trim(),
    teacher: (student.teacher || '').trim(),
    user_id: userId,
    gender: student.gender || null,
    hijri_join_date: student.hijri_join_date || null,
    initial_hifz: student.initial_hifz || null,
    first_competition_year: student.first_competition_year || null,
    status: student.status || 'طبيعي',
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
    await markDirty('student', 'upsert', { id: targetId });
  } else {
    const TEMP_BASE = 1_000_000_000;
    const existing = await getCachedStudents();
    const maxId = existing.reduce((max, s) => Math.max(max, s.id), TEMP_BASE);
    targetId = maxId + 1;
    payload.id = targetId;
    await putCachedStudent(payload);
    await markDirty('student', 'upsert', { id: targetId });
  }

  // إذا تم تحديد مقدار الحفظ قبل الالتحاق وعام المسابقة الأولى:
  // يُسجّل تلقائياً في عام المسابقة الأولى كحفظ مسبق (hifz_history و base_hifz)
  if (targetId && student.initial_hifz && parseFloat(student.initial_hifz) > 0) {
    const compYear = student.first_competition_year || '1441';
    const historyKey = `h${compYear}`;
    const currentHistory = await loadHifzHistory(targetId);
    if (!currentHistory[historyKey] || currentHistory[historyKey] === '0') {
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
  await markDirty('student', 'delete', { id });
  const allHistory = await getCachedHifzHistory();
  const allYearData = await getCachedYearData();
  const { deleteItem } = await import("./localDB");
  for (const row of allHistory.filter(r => r.student_id === id)) {
    await deleteItem('hifz_history', [row.student_id, row.year_key]);
  }
  for (const row of allYearData.filter(r => r.student_id === id)) {
    await deleteItem('year_data', [row.student_id, row.year]);
  }
  const allInternal = await getCachedInternalCompetitions();
  for (const row of allInternal.filter(r => r.student_id === id)) {
    await deleteItem('internal_competitions', row.id);
  }
  const allExternal = await getCachedExternalCompetitions();
  for (const row of allExternal.filter(r => r.student_id === id)) {
    await deleteItem('external_competitions', row.id);
  }
  queueCloudSync();
};

/**
 * يفصل الطالبة عن عام واحد فقط مع إبقاء سجلها العام وبقية الأعوام كما هي.
 * يُستخدم من صفحات المسابقات ومن شاشة الحذف المتقدم في الإعدادات.
 */
export const deleteStudentFromYear = async (year: string, studentId: number) => {
  guardWrite();
  const { deleteItem } = await import("./localDB");
  const userId = await getUserId();
  const historyKey = `h${year}`;

  if (canUseCloud(userId)) {
    const requests = [
      supabase.from('year_data').delete().eq('user_id', userId).eq('student_id', studentId).eq('year', year),
      supabase.from('hifz_history').delete().eq('user_id', userId).eq('student_id', studentId).eq('year_key', historyKey),
      supabase.from('internal_competitions' as any).delete().eq('user_id', userId).eq('student_id', studentId).eq('year', year),
      supabase.from('external_competitions' as any).delete().eq('user_id', userId).eq('student_id', studentId).eq('year', year),
      supabase.from('monthly_tracking' as any).delete().eq('user_id', userId).eq('student_id', studentId).eq('year', year),
    ];
    const results = await Promise.all(requests);
    results.forEach((result) => {
      if (result.error) console.error('Cloud year association delete failed:', result.error);
    });
  }

  const yearRow = await getCachedYearDataForStudent(studentId);
  const localYearRow = yearRow.find((row) => row.year === year);
  if (localYearRow) {
    await deleteItem('year_data', [studentId, year]);
  }
  await markDirty('year', 'delete', { student_id: studentId, year });

  const history = (await getCachedHifzHistory()).filter(
    (row) => row.student_id === studentId && row.year_key === historyKey,
  );
  for (const row of history) {
    await deleteItem('hifz_history', [row.student_id, row.year_key]);
  }
  await markDirty('hifz', 'delete', { student_id: studentId, year_key: historyKey });

  const internal = (await getCachedInternalCompetitions()).filter(
    (row) => row.student_id === studentId && row.year === year,
  );
  for (const row of internal) {
    await deleteItem('internal_competitions', row.id);
    await markDirty('internal_competition', 'delete', { id: row.id });
  }
  const external = (await getCachedExternalCompetitions()).filter(
    (row) => row.student_id === studentId && row.year === year,
  );
  for (const row of external) {
    await deleteItem('external_competitions', row.id);
    await markDirty('external_competition', 'delete', { id: row.id });
  }

  queueCloudSync();
};

/** حذف عدة طالبات من عام واحد دون المساس بالسجل العام. */
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

  if (canUseCloud(userId)) {
    const [yearResult, historyResult] = await Promise.all([
      supabase.from('year_data').delete().eq('user_id', userId).eq('year', year),
      supabase.from('hifz_history').delete().eq('user_id', userId).eq('year_key', `h${year}`),
    ]);
    if (yearResult.error) console.error('Cloud year data delete failed:', yearResult.error);
    if (historyResult.error) console.error('Cloud hifz history delete failed:', historyResult.error);
  }

  const allYearData = await getCachedYearData();
  for (const row of allYearData.filter((r) => r.year === year)) {
    await deleteItem('year_data', [row.student_id, row.year]);
    await markDirty('year', 'delete', { student_id: row.student_id, year: row.year });
  }
  const allHistory = await getCachedHifzHistory();
  for (const row of allHistory.filter((r) => r.year_key === `h${year}`)) {
    await deleteItem('hifz_history', [row.student_id, row.year_key]);
    await markDirty('hifz', 'delete', { student_id: row.student_id, year_key: row.year_key });
  }
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
  const cloudTables = [
    'teachers', 'teacher_bonuses', 'donors', 'awards', 'ceremony_expenses',
    'certificates', 'internal_competitions', 'external_competitions', 'media',
    'monthly_tracking',
  ];

  if (canUseCloud(userId)) {
    const { data: mediaRows } = await supabase
      .from('media')
      .select('file_path')
      .eq('user_id', userId)
      .eq('year', year);
    const mediaPaths = (mediaRows || []).map((row: any) => row.file_path).filter(Boolean);
    if (mediaPaths.length > 0) {
      const { error } = await supabase.storage.from('media').remove(mediaPaths);
      if (error) console.warn('Could not remove year media files:', error);
    }

    for (const table of cloudTables) {
      const { error } = await supabase.from(table as any).delete().eq('user_id', userId).eq('year', year);
      if (error) console.error(`Cloud full year delete failed for ${table}:`, error);
    }
  }

  const { deleteItem } = await import("./localDB");
  const yearStores: Array<{
    store: string;
    entity: 'teacher' | 'teacher_bonus' | 'donor' | 'award' | 'expense' | 'certificate' | 'internal_competition' | 'external_competition' | 'media';
    rows: Array<{ id: string; year: string }>;
  }> = [
    { store: 'teachers', entity: 'teacher', rows: await getCachedTeachers() },
    { store: 'teacher_bonuses', entity: 'teacher_bonus', rows: await getCachedTeacherBonuses() },
    { store: 'donors', entity: 'donor', rows: await getCachedDonors() },
    { store: 'awards', entity: 'award', rows: await getCachedAwards() },
    { store: 'ceremony_expenses', entity: 'expense', rows: await getCachedCeremonyExpenses() },
    { store: 'certificates', entity: 'certificate', rows: await getCachedCertificates() },
    { store: 'internal_competitions', entity: 'internal_competition', rows: await getCachedInternalCompetitions() },
    { store: 'external_competitions', entity: 'external_competition', rows: await getCachedExternalCompetitions() },
    { store: 'media', entity: 'media', rows: await getCachedMedia() },
  ];

  for (const group of yearStores) {
    for (const row of group.rows.filter((item) => item.year === year)) {
      await deleteItem(group.store, row.id);
      await markDirty(group.entity, 'delete', { id: row.id });
    }
  }
  queueCloudSync();
};

/** حذف قاعدة بيانات المستخدم كاملة، بما في ذلك جميع الجداول الخاصة به. */
export const deleteEntireDatabase = async () => {
  guardWrite();
  const userId = await getUserId();

  if (canUseCloud(userId)) {
    // الملفات نفسها لا تُحذف بحذف سجل media، لذلك نحاول تنظيفها أولاً.
    const { data: mediaRows, error: mediaQueryError } = await supabase
      .from('media')
      .select('file_path')
      .eq('user_id', userId);
    if (mediaQueryError) console.warn('Could not list media files before database wipe:', mediaQueryError);
    const paths = (mediaRows || []).map((row: any) => row.file_path).filter(Boolean);
    if (paths.length > 0) {
      const { error } = await supabase.storage.from('media').remove(paths);
      if (error) console.warn('Could not remove media files during database wipe:', error);
    }

    // نحذف الجداول الابنة أولاً ثم الطلاب لتفادي أي تعارض مفاتيح خارجية في
    // المشاريع القديمة التي لم تُفعّل فيها cascade بعد.
    const childTables = [
      'monthly_tracking', 'hifz_history', 'year_data', 'internal_competitions',
      'external_competitions', 'teachers', 'teacher_bonuses', 'donors', 'awards',
      'ceremony_expenses', 'certificates', 'media',
    ];
    for (const table of childTables) {
      const { error } = await supabase.from(table as any).delete().eq('user_id', userId);
      if (error) console.error(`Cloud database wipe failed for ${table}:`, error);
    }
    const { error: studentsError } = await supabase.from('students').delete().eq('user_id', userId);
    if (studentsError) console.error('Cloud database wipe failed for students:', studentsError);
    const { error: settingsError } = await supabase.from('user_settings').delete().eq('user_id', userId);
    if (settingsError) console.error('Cloud database wipe failed for settings:', settingsError);
  }

  // يمسح أيضاً الإعدادات المحلية والعمليات المعلقة حتى لا تعود البيانات
  // القديمة إلى السحابة في مزامنة لاحقة.
  await clearAllCache();
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
    await putCachedHifzRow({ student_id: studentId, year_key: yearKey, value: value || '0' });
    await markDirty('hifz', 'upsert', { student_id: studentId, year_key: yearKey });
  }
};

export const loadHifzHistory = async (studentId: number): Promise<HifzHistory> => {
  const allHistory = await getCachedHifzHistory();
  const history: HifzHistory = {};
  allHistory.filter(r => r.student_id === studentId).forEach(r => {
    history[r.year_key] = r.value;
  });
  return history;
};

export const saveYearData = async (year: string, studentId: number, data: YearData) => {
  guardWrite();
  await putCachedYearData({
    student_id: studentId, year,
    base_hifz: data.baseHifz, total_hifz: data.totalHifz, parts: data.parts,
    annual: data.annual, recitation: data.recitation, memorization: data.memorization,
    total: data.total, grade: data.grade, prize: data.prize,
    status_prize: data.statusPrize, rank: data.rank, teacher: data.teacher || '',
  });
  await markDirty('year', 'upsert', { student_id: studentId, year });
};

const defaultYearData = (): YearData => ({
  baseHifz: "0", totalHifz: "0", parts: "", annual: "", recitation: "",
  memorization: "", total: "0", grade: "", prize: "0", statusPrize: "", rank: "-",
  teacher: "",
});

const yearRowToData = (row: { base_hifz: string; total_hifz: string; parts: string; annual: string; recitation: string; memorization: string; total: string; grade: string; prize: string; status_prize: string; rank: string; teacher: string }): YearData => ({
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
export const loadYearDataForStudent = async (studentId: number): Promise<Record<string, YearData>> => {
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
        .map((student) => student.id)
    );
    const cached = await getCachedYearData();
    const cachedYears = cached
      .filter((row) => studentIds.has(row.student_id))
      .map((row) => row.year)
      .filter(Boolean);
    if (cachedYears.length) return cachedYears.sort().slice(-1)[0];
  } catch { /* ignore */ }

  if (canUseCloud(userId)) {
    const { data } = await supabase
      .from('year_data')
      .select('year')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .limit(1);
    if (data?.[0]?.year) return data[0].year;
  }

  return String(START_YEAR);
};

export const getActiveYear = async (): Promise<string> => {
  const userId = await getUserId();
  if (!userId) return String(START_YEAR);

  await ensureCache();
  const hasCache = await isCachePopulated();
  if (hasCache) {
    const year = await getCachedSetting<string>('active_year');
    if (year) return year;
    return getLatestDataYear();
  }

  if (!canUseCloud(userId)) return getLatestDataYear();

  const { data } = await supabase
    .from('user_settings')
    .select('active_year')
    .eq('user_id', userId)
    .maybeSingle();

  const year = data?.active_year || (await getLatestDataYear());
  await setCachedSetting('active_year', year);
  return year;
};

export const setActiveYear = async (year: string) => {
  // تبديل العام مجرد تنقل في العرض، لذا يبقى مسموحاً أثناء الاطلاع، لكنه
  // يُحفظ محلياً فقط ولا يمسّ إعدادات صاحب البيانات.
  await setCachedSetting('active_year', year);
  if (isViewingOtherUser()) return;
  const userId = await getUserId();
  if (canUseCloud(userId)) {
    await supabase
      .from('user_settings')
      .upsert({ user_id: userId, active_year: year }, { onConflict: 'user_id' });
  }
};

export const getTableFilters = async <T>(): Promise<T | undefined> => {
  const cached = await getCachedSetting<T>('table_filters');
  if (cached) return cached;

  const userId = await getUserId();
  if (!canUseCloud(userId)) return undefined;

  const { data } = await supabase
    .from('user_settings')
    .select('table_filters')
    .eq('user_id', userId)
    .maybeSingle();

  const filters = data?.table_filters as T | undefined;
  if (filters) {
    await setCachedSetting('table_filters', filters);
  }
  return filters;
};

export const setTableFilters = async (filters: any) => {
  // مرشّحات الجدول تفضيل عرض محلي؛ تُحفظ محلياً فقط أثناء الاطلاع.
  await setCachedSetting('table_filters', filters);
  if (isViewingOtherUser()) return;

  const userId = await getUserId();
  if (!canUseCloud(userId)) return;

  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, table_filters: filters }, { onConflict: 'user_id' });
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

const queueCloudSync = () => {
  if (isViewingOtherUser()) return;
  if (!isOnline()) return;
  window.setTimeout(() => {
    void syncToCloud();
  }, 0);
};

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
  return byYear(rows.filter(r => belongsToUser(r, userId)), year).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
};

export const saveTeacher = async (teacher: Partial<TeacherRow> & { name: string; year: string }): Promise<TeacherRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const existing = teacher.id
    ? undefined
    : (await getCachedTeachers()).find(t => t.user_id === userId && t.year === teacher.year && t.name === teacher.name);
  const row: TeacherRow = {
    id: teacher.id || existing?.id || newLocalId(),
    user_id: userId,
    year: teacher.year,
    name: teacher.name,
    created_at: teacher.created_at || existing?.created_at,
    updated_at: new Date().toISOString(),
  };
  await putCachedTeacher(row);
  await markDirty('teacher', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteTeacherLocal = async (id: string) => {
  guardWrite();
  await deleteCachedTeacher(id);
  await markDirty('teacher', 'delete', { id });
  queueCloudSync();
};

export const loadTeacherBonuses = async (year?: string): Promise<TeacherBonusRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedTeacherBonuses();
  return byYear(rows.filter(r => belongsToUser(r, userId)), year);
};

export const saveTeacherBonus = async (
  bonus: Partial<TeacherBonusRow> & { teacher_name: string; year: string; month: number; amount: number }
): Promise<TeacherBonusRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const existing = bonus.id
    ? undefined
    : (await getCachedTeacherBonuses()).find(b =>
        b.user_id === userId && b.teacher_name === bonus.teacher_name && b.year === bonus.year && b.month === bonus.month
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
  await markDirty('teacher_bonus', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteTeacherBonusLocal = async (id: string) => {
  guardWrite();
  await deleteCachedTeacherBonus(id);
  await markDirty('teacher_bonus', 'delete', { id });
  queueCloudSync();
};

export const loadDonors = async (year?: string): Promise<DonorRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedDonors();
  return byYear(rows.filter(r => belongsToUser(r, userId)), year).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
};

export const saveDonor = async (donor: Partial<DonorRow> & {
  year: string;
  name: string;
  donor_type: string;
  pledged_amount: number;
  paid_amount: number;
  phone?: string | null;
  in_kind?: string | null;
  notes?: string | null;
}): Promise<DonorRow | null> => {
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
  await markDirty('donor', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteDonorLocal = async (id: string) => {
  guardWrite();
  await deleteCachedDonor(id);
  await markDirty('donor', 'delete', { id });
  queueCloudSync();
};

export const loadAwards = async (year?: string): Promise<AwardRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedAwards();
  return byYear(rows.filter(r => belongsToUser(r, userId)), year)
    .sort((a, b) => (b.awarded_at || '').localeCompare(a.awarded_at || ''));
};

export const saveAward = async (award: Partial<AwardRow> & {
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
}): Promise<AwardRow | null> => {
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
  await markDirty('award', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteAwardLocal = async (id: string) => {
  guardWrite();
  await deleteCachedAward(id);
  await markDirty('award', 'delete', { id });
  queueCloudSync();
};

export const loadCeremonyExpenses = async (year?: string): Promise<CeremonyExpenseRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedCeremonyExpenses();
  return byYear(rows.filter(r => belongsToUser(r, userId)), year)
    .sort((a, b) => (b.spent_at || '').localeCompare(a.spent_at || ''));
};

export const saveCeremonyExpense = async (expense: Partial<CeremonyExpenseRow> & {
  year: string;
  category: string;
  description: string;
  amount: number;
  spent_at: string;
  funded_by?: string | null;
  notes?: string | null;
}): Promise<CeremonyExpenseRow | null> => {
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
  await markDirty('expense', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteCeremonyExpenseLocal = async (id: string) => {
  guardWrite();
  await deleteCachedCeremonyExpense(id);
  await markDirty('expense', 'delete', { id });
  queueCloudSync();
};

export const loadCertificates = async (year?: string): Promise<CertificateRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedCertificates();
  return byYear(rows.filter(r => belongsToUser(r, userId)), year).sort((a, b) => a.recipient_name.localeCompare(b.recipient_name, 'ar'));
};

export const saveCertificate = async (certificate: Partial<CertificateRow> & {
  year: string;
  recipient_type: string;
  recipient_name: string;
  cert_type: string;
  title?: string;
  notes?: string | null;
  issued_at: string;
}): Promise<CertificateRow | null> => {
  guardWrite();
  const userId = await getUserId();
  if (!userId) return null;
  const row: CertificateRow = {
    ...certificate,
    id: certificate.id || newLocalId(),
    user_id: userId,
    title: certificate.title || '',
    notes: certificate.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  await putCachedCertificate(row);
  await markDirty('certificate', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const saveCertificates = async (certificates: Array<Parameters<typeof saveCertificate>[0]>) => {
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
  await markDirty('certificate', 'delete', { id });
  queueCloudSync();
};

// ===== Internal Competitions =====
export const loadInternalCompetitions = async (year?: string, studentId?: number): Promise<InternalCompetitionRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  let rows = await getCachedInternalCompetitions();
  rows = rows.filter(r => belongsToUser(r, userId));
  if (year) rows = rows.filter(r => r.year === year);
  if (studentId) rows = rows.filter(r => r.student_id === studentId);
  return rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
};

export const saveInternalCompetition = async (comp: Partial<InternalCompetitionRow> & {
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
}): Promise<InternalCompetitionRow | null> => {
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
  await markDirty('internal_competition', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteInternalCompetitionLocal = async (id: string) => {
  guardWrite();
  await deleteCachedInternalCompetition(id);
  await markDirty('internal_competition', 'delete', { id });
  queueCloudSync();
};

// ===== External Competitions =====
export const loadExternalCompetitions = async (year?: string, studentId?: number): Promise<ExternalCompetitionRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  let rows = await getCachedExternalCompetitions();
  rows = rows.filter(r => belongsToUser(r, userId));
  if (year) rows = rows.filter(r => r.year === year);
  if (studentId) rows = rows.filter(r => r.student_id === studentId);
  return rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
};

export const saveExternalCompetition = async (comp: Partial<ExternalCompetitionRow> & {
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
}): Promise<ExternalCompetitionRow | null> => {
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
  await markDirty('external_competition', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteExternalCompetitionLocal = async (id: string) => {
  guardWrite();
  await deleteCachedExternalCompetition(id);
  await markDirty('external_competition', 'delete', { id });
  queueCloudSync();
};

// ===== Media Metadata =====
export const loadMediaMetadata = async (year?: string): Promise<MediaMetadataRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedMedia();
  return byYear(rows.filter(r => belongsToUser(r, userId)), year)
    .sort((a, b) => a.month - b.month || (b.created_at || '').localeCompare(a.created_at || ''));
};

export const saveMediaMetadata = async (media: Partial<MediaMetadataRow> & {
  year: string;
  month: number;
  title: string;
  file_path: string;
  file_type: 'image' | 'video';
  file_size: number;
}): Promise<MediaMetadataRow | null> => {
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
  await markDirty('media', 'upsert', { id: row.id });
  queueCloudSync();
  return row;
};

export const deleteMediaMetadataLocal = async (id: string) => {
  guardWrite();
  const existing = (await getCachedMedia()).find(item => item.id === id);
  await deleteCachedMedia(id);
  await markDirty('media', 'delete', { id, file_path: existing?.file_path });
  queueCloudSync();
};

// ===== SYNC TO CLOUD: called when user clicks "Save" =====
let syncInFlight: Promise<boolean> | null = null;

export const syncToCloud = async (onProgress?: ProgressCb): Promise<boolean> => {
  // وضع الاطلاع للقراءة فقط: لا نرفع أي شيء إلى حساب صاحب البيانات.
  if (isViewingOtherUser()) return false;
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncToCloud(onProgress).finally(() => { syncInFlight = null; });
  return syncInFlight;
};

const runSyncToCloud = async (onProgress?: ProgressCb): Promise<boolean> => {
  const userId = await getUserId();
  if (!canUseCloud(userId)) return false;

  try {
    const pending = await getPendingChanges();
    if (pending.length === 0) {
      onProgress?.(1, 1, 'لا تغييرات');
      await setLastSyncTime();
      return true;
    }

    const students = await getCachedStudents();
    const allHistory = await getCachedHifzHistory();
    const allYearData = await getCachedYearData();
    const allTeachers = await getCachedTeachers();
    const allTeacherBonuses = await getCachedTeacherBonuses();
    const allDonors = await getCachedDonors();
    const allAwards = await getCachedAwards();
    const allExpenses = await getCachedCeremonyExpenses();
    const allCertificates = await getCachedCertificates();
    const allInternalComps = await getCachedInternalCompetitions();
    const allExternalComps = await getCachedExternalCompetitions();
    const allMedia = await getCachedMedia();

    const { data: cloudStudents } = await supabase
      .from('students').select('id').eq('user_id', userId);
    const cloudIdSet = new Set((cloudStudents || []).map(s => s.id));

    const studentUpserts = pending.filter(p => p.entity === 'student' && p.op === 'upsert');
    const studentDeletes = pending.filter(p => p.entity === 'student' && p.op === 'delete');

    const total = pending.length + 1;
    let done = 0;
    const tick = (label?: string) => onProgress?.(++done, total, label);
    let hadError = false;

    // 1) Student deletes
    const deleteIds = studentDeletes.map(p => p.ref.id).filter(id => cloudIdSet.has(id));
    if (deleteIds.length > 0) {
      const { error } = await supabase.from('students').delete().eq('user_id', userId).in('id', deleteIds);
      if (error) { console.error('Delete students failed:', error); hadError = true; }
    }
    if (!hadError) {
      for (const p of studentDeletes) { await clearPending(p.key); tick('حذف الطالبات'); }
    }

    // 2) Student upserts
    for (const p of studentUpserts) {
      const local = students.find(s => s.id === p.ref.id);
      if (!local) { await clearPending(p.key); tick('رفع الطالبات'); continue; }

      const studentPayload: any = {
        name: local.name,
        teacher: local.teacher,
        gender: local.gender || null,
        hijri_join_date: local.hijri_join_date || null,
        initial_hifz: local.initial_hifz || null,
        first_competition_year: local.first_competition_year || null,
        status: local.status || 'طبيعي',
        school_grade: local.school_grade || null,
        guardian_phone: local.guardian_phone || null,
        student_phone: local.student_phone || null,
        custom_fields: local.custom_fields || {},
        notes: local.notes || null,
      };

      if (cloudIdSet.has(local.id)) {
        const { error } = await supabase.from('students')
          .update(studentPayload)
          .eq('id', local.id).eq('user_id', userId);
        if (error) {
          // Fallback to updating without new columns if supabase table hasn't migrated yet
          const { error: fallbackErr } = await supabase.from('students')
            .update({ name: local.name, teacher: local.teacher })
            .eq('id', local.id).eq('user_id', userId);
          if (fallbackErr) {
            console.error('Update student failed:', fallbackErr);
            hadError = true;
          }
        }
      } else {
        let inserted: any = null;
        let insertErr: any = null;
        const res = await supabase.from('students')
          .insert({ ...studentPayload, user_id: userId })
          .select('id').single();
        if (res.error) {
          const fallbackRes = await supabase.from('students')
            .insert({ name: local.name, teacher: local.teacher, user_id: userId })
            .select('id').single();
          inserted = fallbackRes.data;
          insertErr = fallbackRes.error;
        } else {
          inserted = res.data;
        }

        if (insertErr || !inserted) {
          console.error('Insert student failed:', insertErr);
          hadError = true;
          tick('رفع الطالبات');
          continue;
        }

        if (inserted.id !== local.id) {
          const oldId = local.id;
          const newId = inserted.id;
          await deleteCachedStudent(oldId);
          await putCachedStudent({ ...local, id: newId, user_id: userId });
          local.id = newId;

          const { deleteItem, putItem } = await import("./localDB");
          for (const h of allHistory.filter(r => r.student_id === oldId)) {
            await deleteItem('hifz_history', [oldId, h.year_key]);
            h.student_id = newId;
            await putItem('hifz_history', h);
          }
          for (const y of allYearData.filter(r => r.student_id === oldId)) {
            await deleteItem('year_data', [oldId, y.year]);
            y.student_id = newId;
            await putItem('year_data', y);
          }
          for (const ic of allInternalComps.filter(r => r.student_id === oldId)) {
            ic.student_id = newId;
            await putItem('internal_competitions', ic);
          }
          for (const ec of allExternalComps.filter(r => r.student_id === oldId)) {
            ec.student_id = newId;
            await putItem('external_competitions', ec);
          }
          await remapPendingStudentId(oldId, newId);
          cloudIdSet.add(newId);
        } else {
          cloudIdSet.add(inserted.id);
        }
      }
      await clearPending(p.key);
      tick('رفع الطالبات');
    }

    const pendingAfter = await getPendingChanges();
    const hifzDeletes = pendingAfter.filter(p => p.entity === 'hifz' && p.op === 'delete');
    const hifzPending = pendingAfter.filter(p => p.entity === 'hifz' && p.op === 'upsert');
    const yearDeletes = pendingAfter.filter(p => p.entity === 'year' && p.op === 'delete');
    const yearPending = pendingAfter.filter(p => p.entity === 'year' && p.op === 'upsert');

    // 3) Hifz deletes and upserts
    for (const p of hifzDeletes) {
      const { error } = await supabase.from('hifz_history').delete()
        .eq('user_id', userId)
        .eq('student_id', p.ref.student_id)
        .eq('year_key', p.ref.year_key);
      if (error) {
        console.error('Hifz delete failed:', error);
        hadError = true;
      } else {
        await clearPending(p.key);
        tick('حذف سجل الحفظ');
      }
    }

    if (hifzPending.length > 0) {
      const rows = hifzPending.map(p => {
        const r = allHistory.find(h => h.student_id === p.ref.student_id && h.year_key === p.ref.year_key);
        return r ? { student_id: r.student_id, user_id: userId, year_key: r.year_key, value: r.value || '0' } : null;
      }).filter(Boolean) as any[];
      let hifzOk = true;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from('hifz_history').upsert(chunk, { onConflict: 'student_id,year_key' });
        if (error) { console.error('Hifz upsert failed:', error); hifzOk = false; hadError = true; break; }
      }
      if (hifzOk) {
        for (const p of hifzPending) { await clearPending(p.key); tick('رفع سجل الحفظ'); }
      }
    }

    // 4) Year data deletes and upserts
    for (const p of yearDeletes) {
      const { error } = await supabase.from('year_data').delete()
        .eq('user_id', userId)
        .eq('student_id', p.ref.student_id)
        .eq('year', p.ref.year);
      if (error) {
        console.error('Year data delete failed:', error);
        hadError = true;
      } else {
        await clearPending(p.key);
        tick('حذف بيانات الأعوام');
      }
    }

    if (yearPending.length > 0) {
      const rows = yearPending.map(p => {
        const r = allYearData.find(y => y.student_id === p.ref.student_id && y.year === p.ref.year);
        return r ? {
          student_id: r.student_id, user_id: userId, year: r.year,
          base_hifz: r.base_hifz, total_hifz: r.total_hifz, parts: r.parts,
          annual: r.annual, recitation: r.recitation, memorization: r.memorization,
          total: r.total, grade: r.grade, prize: r.prize,
          status_prize: r.status_prize, rank: r.rank, teacher: r.teacher || '',
        } : null;
      }).filter(Boolean) as any[];
      let yearOk = true;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from('year_data').upsert(chunk, { onConflict: 'student_id,year' });
        if (error) { console.error('Year data upsert failed:', error); yearOk = false; hadError = true; break; }
      }
      if (yearOk) {
        for (const p of yearPending) { await clearPending(p.key); tick('رفع بيانات الأعوام'); }
      }
    }

    const syncCachedEntity = async <T extends { id: string }>(
      entity: string,
      table: string,
      rows: T[],
      toPayload: (row: T) => Record<string, unknown>,
      label: string
    ) => {
      const latestPending = await getPendingChanges();
      const deletes = latestPending.filter(p => p.entity === entity && p.op === 'delete');
      const upserts = latestPending.filter(p => p.entity === entity && p.op === 'upsert');

      for (const p of deletes) {
        if (entity === 'media' && p.ref?.file_path) {
          const { error: storageError } = await supabase.storage.from('media').remove([p.ref.file_path]);
          if (storageError) {
            console.warn('Media file delete failed:', storageError);
          }
        }
        try {
          const { error } = await supabase.from(table as any).delete().eq('user_id', userId).eq('id', p.ref.id);
          if (error) console.error(`${label} delete failed:`, error);
        } catch { /* ignore */ }
        await clearPending(p.key);
        tick(label);
      }

      const payload = upserts
        .map(p => rows.find(row => row.id === p.ref.id))
        .filter(Boolean)
        .map(row => toPayload(row as T));

      if (payload.length > 0) {
        for (let i = 0; i < payload.length; i += 500) {
          const chunk = payload.slice(i, i + 500);
          try {
            const { error } = await supabase.from(table as any).upsert(chunk, { onConflict: 'id' });
            if (error) console.error(`${label} upsert failed:`, error);
          } catch { /* ignore */ }
        }
        for (const p of upserts) {
          await clearPending(p.key);
          tick(label);
        }
      }
    };

    await syncCachedEntity('teacher', 'teachers', allTeachers, r => ({
      id: r.id, user_id: userId, year: r.year, name: r.name,
    }), 'رفع المعلمات');

    await syncCachedEntity('teacher_bonus', 'teacher_bonuses', allTeacherBonuses, r => ({
      id: r.id, user_id: userId, teacher_name: r.teacher_name, year: r.year,
      month: r.month, amount: r.amount,
    }), 'رفع الإكراميات');

    await syncCachedEntity('donor', 'donors', allDonors, r => ({
      id: r.id, user_id: userId, year: r.year, name: r.name, donor_type: r.donor_type,
      phone: r.phone, pledged_amount: r.pledged_amount, paid_amount: r.paid_amount,
      in_kind: r.in_kind, notes: r.notes,
    }), 'رفع الداعمين');

    await syncCachedEntity('award', 'awards', allAwards, r => ({
      id: r.id, user_id: userId, year: r.year, recipient_type: r.recipient_type,
      recipient_name: r.recipient_name, award_type: r.award_type, award_kind: r.award_kind,
      amount: r.amount, item: r.item, student_name: r.student_name, notes: r.notes,
      awarded_at: r.awarded_at, funded_by: r.funded_by,
    }), 'رفع الجوائز');

    await syncCachedEntity('expense', 'ceremony_expenses', allExpenses, r => ({
      id: r.id, user_id: userId, year: r.year, category: r.category,
      description: r.description, amount: r.amount, spent_at: r.spent_at,
      funded_by: r.funded_by, notes: r.notes,
    }), 'رفع المصروفات');

    await syncCachedEntity('certificate', 'certificates', allCertificates, r => ({
      id: r.id, user_id: userId, year: r.year, recipient_type: r.recipient_type,
      recipient_name: r.recipient_name, cert_type: r.cert_type, title: r.title,
      notes: r.notes, issued_at: r.issued_at,
    }), 'رفع الشهادات');

    await syncCachedEntity('internal_competition', 'internal_competitions', allInternalComps, r => ({
      id: r.id, user_id: userId, student_id: r.student_id, student_name: r.student_name,
      year: r.year, competition_name: r.competition_name, category: r.category,
      score: r.score, rank: r.rank, prize: r.prize, notes: r.notes, date: r.date,
    }), 'رفع المسابقات الداخلية');

    await syncCachedEntity('external_competition', 'external_competitions', allExternalComps, r => ({
      id: r.id, user_id: userId, student_id: r.student_id, student_name: r.student_name,
      year: r.year, competition_name: r.competition_name, organizer: r.organizer,
      category: r.category, score: r.score, rank: r.rank, prize: r.prize,
      notes: r.notes, date: r.date,
    }), 'رفع المسابقات الخارجية');

    await syncCachedEntity('media', 'media', allMedia, r => ({
      id: r.id, user_id: userId, year: r.year, month: r.month, title: r.title,
      file_path: r.file_path, file_type: r.file_type, file_size: r.file_size,
      created_at: r.created_at,
    }), 'رفع بيانات الوسائط');

    await setLastSyncTime();
    tick('اكتمل');
    return !hadError;
  } catch (err) {
    console.error('Sync to cloud failed:', err);
    return false;
  }
};

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

  const norm = (s: string) => (s || '').trim().replace(/\s+/g, ' ');
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
      const dupHistory = allHistory.filter(h => h.student_id === dup.id);
      for (const h of dupHistory) {
        const existing = allHistory.find(r => r.student_id === primary.id && r.year_key === h.year_key);
        if (!existing || !existing.value || existing.value === '0') {
          await putCachedHifzRow({ student_id: primary.id, year_key: h.year_key, value: h.value });
          await markDirty('hifz', 'upsert', { student_id: primary.id, year_key: h.year_key });
        }
        await deleteItem('hifz_history', [h.student_id, h.year_key]);
      }
      const dupYears = allYearData.filter(y => y.student_id === dup.id);
      for (const y of dupYears) {
        const existing = allYearData.find(r => r.student_id === primary.id && r.year === y.year);
        if (!existing || (!existing.parts && existing.total === '0')) {
          await putCachedYearData({ ...y, student_id: primary.id });
          await markDirty('year', 'upsert', { student_id: primary.id, year: y.year });
        }
        await deleteItem('year_data', [y.student_id, y.year]);
      }
      const { deleteCachedStudent } = await import("./localDB");
      await deleteCachedStudent(dup.id);
      await markDirty('student', 'delete', { id: dup.id });
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
  memoFrom: emptyPoint(), memoTo: emptyPoint(), memoHifzScore: "", memoRecitationScore: "",
  reviewFrom: emptyPoint(), reviewTo: emptyPoint(), reviewHifzScore: "", reviewRecitationScore: "",
  attendanceScore: "", behaviorScore: "",
});

const rowToRecord = (row: any): MonthlyRecord => ({
  memoFrom: { surah: row.memorization_from_surah ?? null, ayah: row.memorization_from_ayah ?? null },
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
  month: number
): Promise<Record<number, MonthlyRecord>> => {
  const userId = await getUserId();
  const result: Record<number, MonthlyRecord> = {};
  if (!canUseCloud(userId)) return result;

  const { data, error } = await supabase
    .from('monthly_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month);

  if (error) {
    console.error('loadMonthlyTrackingForMonth failed:', error);
    return result;
  }

  (data || []).forEach((row: any) => { result[row.student_id] = rowToRecord(row); });
  return result;
};

export const loadMonthlyTrackingForStudent = async (
  year: string,
  studentId: number
): Promise<Record<number, MonthlyRecord>> => {
  const userId = await getUserId();
  const result: Record<number, MonthlyRecord> = {};
  if (!canUseCloud(userId)) return result;

  const { data, error } = await supabase
    .from('monthly_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('student_id', studentId);

  if (error) {
    console.error('loadMonthlyTrackingForStudent failed:', error);
    return result;
  }

  (data || []).forEach((row: any) => { result[row.month] = rowToRecord(row); });
  return result;
};

export const getPreviousMonthEndPoints = async (
  year: string,
  studentId: number,
  beforeMonth: number
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
  record: MonthlyRecord
): Promise<boolean> => {
  guardWrite();
  const userId = await getUserId();
  if (!canUseCloud(userId)) return false;

  const { error } = await supabase.from('monthly_tracking').upsert({
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
  }, { onConflict: 'student_id,year,month' });

  if (error) {
    console.error('saveMonthlyRecord failed:', error);
    return false;
  }

  await recomputeAnnualFromMonthly(year, studentId);
  return true;
};

export const recomputeAnnualFromMonthly = async (year: string, studentId: number) => {
  guardWrite();
  const userId = await getUserId();
  if (!canUseCloud(userId)) return;

  const { data, error } = await supabase
    .from('monthly_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('student_id', studentId);

  if (error || !data) return;

  const pagesPerRow = await Promise.all(data.map(async (r: any) => {
    if (!r.memorization_from_surah || !r.memorization_to_surah) return 0;
    return calcPagesBetweenAsync(
      r.memorization_from_surah, r.memorization_from_ayah,
      r.memorization_to_surah, r.memorization_to_ayah
    );
  }));
  const totalPages = pagesPerRow.reduce((sum, p) => sum + p, 0);

  const monthsWithScores = data.filter((r: any) => (parseFloat(r.attendance_score) || 0) > 0 || (parseFloat(r.behavior_score) || 0) > 0);
  const totalMonthlyOutOf20 = data.reduce((sum: number, r: any) => sum + ((parseFloat(r.attendance_score) || 0) + (parseFloat(r.behavior_score) || 0)), 0);
  const monthCount = monthsWithScores.length || 1;

  const partsFromPages = totalPages / 20;
  const annualScore = totalMonthlyOutOf20 / monthCount;

  const existing = await loadYearData(year, studentId);
  await saveYearData(year, studentId, {
    ...existing,
    parts: partsFromPages > 0 ? partsFromPages.toFixed(2).replace(/\.00$/, '') : existing.parts,
    annual: totalMonthlyOutOf20 > 0 ? annualScore.toFixed(2).replace(/\.00$/, '') : existing.annual,
  });
  await syncToCloud();
};

export interface MonthlyRanking {
  studentId: number;
  memoScore: number;
  reviewScore: number;
  pagesThisMonth: number;
}

export const getMonthlyRankings = async (
  year: string,
  month: number
): Promise<MonthlyRanking[]> => {
  const userId = await getUserId();
  if (!canUseCloud(userId)) return [];

  const { data, error } = await supabase
    .from('monthly_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month);

  if (error || !data) return [];

  return Promise.all(data.map(async (r: any) => ({
    studentId: r.student_id,
    memoScore: (parseFloat(r.memorization_hifz_score) || 0) + (parseFloat(r.memorization_recitation_score) || 0),
    reviewScore: (parseFloat(r.review_hifz_score) || 0) + (parseFloat(r.review_recitation_score) || 0),
    pagesThisMonth: r.memorization_from_surah && r.memorization_to_surah
      ? await calcPagesBetweenAsync(r.memorization_from_surah, r.memorization_from_ayah, r.memorization_to_surah, r.memorization_to_ayah)
      : 0,
  })));
};

export const getLatestTrackedPeriod = async (): Promise<{ year: string; month: number } | null> => {
  const userId = await getUserId();
  if (!canUseCloud(userId)) return null;

  const { data, error } = await supabase
    .from('monthly_tracking')
    .select('year, month')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return { year: data[0].year, month: data[0].month };
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
  excludeId?: number
): Promise<{ studentId: number; years: string[] } | null> => {
  const userId = await getUserId();
  if (!canUseCloud(userId)) return null;

  const normalized = (name || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return null;

  const { data: matches, error } = await supabase
    .from('students')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', normalized);

  if (error || !matches) return null;

  const match = matches.find((m: any) => {
    const mNorm = (m.name || '').trim().replace(/\s+/g, ' ');
    return mNorm.toLowerCase() === normalized.toLowerCase() && m.id !== excludeId;
  });
  if (!match) return null;

  const { data: yearsData } = await supabase
    .from('year_data')
    .select('year')
    .eq('user_id', userId)
    .eq('student_id', match.id);

  const years = Array.from(new Set((yearsData || []).map((r: any) => r.year))).sort();
  return { studentId: match.id, years };
};

export const loadKhatimat = async (): Promise<KhatimEntry[]> => {
  const userId = await getUserId();
  if (!canUseCloud(userId)) return [];

  const { data, error } = await supabase
    .from('year_data')
    .select('student_id, year, total_hifz, total, grade, teacher, students(name)')
    .eq('user_id', userId);

  if (error || !data) {
    console.error('loadKhatimat failed:', error);
    return [];
  }

  return data
    .filter((r: any) => (parseFloat(r.total_hifz) || 0) >= 30)
    .map((r: any) => ({
      studentId: r.student_id,
      name: r.students?.name || '',
      teacher: r.teacher || '',
      year: r.year,
      totalScore: r.total || '0',
      grade: r.grade || '',
    }))
    .sort((a, b) => a.year.localeCompare(b.year) || a.name.localeCompare(b.name, 'ar'));
};
