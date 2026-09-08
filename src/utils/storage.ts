import { Student, HifzHistory, YearData, START_YEAR } from "@/types/student";
import { resolveBaseHifz } from "./calculations";
import { LOCAL_USER_ID } from "@/hooks/useAuth";
import {
  getCachedStudents, putCachedStudent, deleteCachedStudent,
  getCachedHifzHistory, putCachedHifzRow,
  getCachedYearData, putCachedYearData,
  setCachedSetting, getCachedSetting,
  setLastSyncTime, isCachePopulated,
  getCachedTeachers, putCachedTeacher, deleteCachedTeacher,
  getCachedTeacherBonuses, putCachedTeacherBonus, deleteCachedTeacherBonus,
  getCachedDonors, putCachedDonor, deleteCachedDonor,
  getCachedAwards, putCachedAward, deleteCachedAward,
  getCachedCeremonyExpenses, putCachedCeremonyExpense, deleteCachedCeremonyExpense,
  getCachedCertificates, putCachedCertificate, deleteCachedCertificate,
  getCachedMedia, putCachedMedia, deleteCachedMedia,
  CachedTeacher, CachedTeacherBonus, CachedDonor, CachedAward,
  CachedCeremonyExpense, CachedCertificate, CachedMedia,
  getAllCachedMonthlyTracking, putCachedMonthlyTracking, CachedMonthlyTracking,
} from "./localDB";
import {
  markDirty, getPendingChanges, clearPending,
} from "./localDB";

// ===== Local-only mode =====
// There is no cloud backend anymore: everything lives in this device's
// local database (IndexedDB, see ./localDB.ts). A single fixed user id is
// used everywhere the data layer used to need a Supabase auth user id.
const getUserId = async (): Promise<string | null> => LOCAL_USER_ID;

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
  const hasCache = await isCachePopulated();
  if (!hasCache) {
    await syncFromCloud();
  }
};

const belongsToUser = <T extends { user_id: string }>(row: T, userId: string) => row.user_id === userId;

const byYear = <T extends { year: string }>(rows: T[], year?: string) =>
  year ? rows.filter(row => row.year === year) : rows;

// ===== Initial sync: download all data from cloud to local =====
export type ProgressCb = (current: number, total: number, label?: string) => void;

export const syncFromCloud = async (onProgress?: ProgressCb): Promise<boolean> => {
  // Local-only mode: there is no cloud to pull from. The local database
  // IS the database, so this is a trivial success.
  onProgress?.(1, 1, 'اكتمل');
  await setLastSyncTime();
  return true;
};
export const loadAllStudentsWithData = async (currentYear: string): Promise<Student[]> => {
  const hasCache = await isCachePopulated();
  if (!hasCache) {
    await syncFromCloud();
  }

  const students = await getCachedStudents();
  const allHistory = await getCachedHifzHistory();
  const allYearData = await getCachedYearData();

  const historyMap: Record<number, HifzHistory> = {};
  allHistory.forEach(row => {
    if (!historyMap[row.student_id]) historyMap[row.student_id] = {};
    historyMap[row.student_id][row.year_key] = row.value;
  });

  // Derive history from year_data.parts for ALL years (not just immediately previous).
  // This ensures cumulative "previous hifz" reflects every prior year a student had parts in.
  allYearData.forEach(row => {
    const parts = parseFloat(row.parts) || 0;
    if (parts <= 0) return;
    if (!historyMap[row.student_id]) historyMap[row.student_id] = {};
    const key = `h${row.year}`;
    const existing = parseFloat(historyMap[row.student_id][key]) || 0;
    if (parts > existing) {
      historyMap[row.student_id][key] = parts.toString();
    }
  });

  const yearDataMap: Record<number, YearData> = {};
  allYearData
    .filter(r => r.year === currentYear)
    .forEach(row => {
      yearDataMap[row.student_id] = {
        baseHifz: row.base_hifz, totalHifz: row.total_hifz, parts: row.parts,
        annual: row.annual, recitation: row.recitation, memorization: row.memorization,
        total: row.total, grade: row.grade, prize: row.prize,
        statusPrize: row.status_prize, rank: row.rank, teacher: row.teacher || '',
      };
    });

  // كل سنة مستقلة: نعرض فقط الطالبات المسجّلات في السنة المختارة
  return students
    .filter(s => yearDataMap[s.id])
    .map(s => ({
      id: s.id,
      name: s.name,
      teacher: yearDataMap[s.id]?.teacher || s.teacher || '',
      hifzHistory: historyMap[s.id] || {},
      yearData: yearDataMap[s.id],
    }));
};

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

// الطالبات الموجودات في أعوام أخرى وغير مسجّلات في العام المختار
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
    if (previous.length === 0) continue;

    const history = { ...(historyMap[s.id] || {}) };
    previous.forEach(r => {
      const parts = parseFloat(r.parts) || 0;
      if (parts > 0) {
        const key = `h${r.year}`;
        if ((parseFloat(history[key]) || 0) < parts) history[key] = parts.toString();
      }
    });

    const last = previous[previous.length - 1];
    const lastTotalHifz = parseFloat(last.total_hifz) || 0;
    const baseHifz = resolveBaseHifz(history, yearNum, lastTotalHifz);

    candidates.push({
      id: s.id,
      name: s.name,
      teacher: last.teacher || s.teacher || '',
      lastYear: last.year,
      baseHifz,
      years: rows.map(r => r.year).sort(),
    });
  }

  return candidates.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
};

// استدعاء طالبات من الأعوام السابقة إلى العام المختار مع ترحيل الحفظ التراكمي
export const recallStudentsToYear = async (year: string, ids: number[]): Promise<number> => {
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

// تسجيل طالبة في العام المختار (لطالبة جديدة)
export const registerStudentInYear = async (year: string, studentId: number, teacher = '') => {
  await saveYearData(year, studentId, { ...emptyYearData(), teacher });
};

export const loadGlobalStudents = async (): Promise<Student[]> => {
  const students = await getCachedStudents();
  return students.map(s => ({ id: s.id, name: s.name, teacher: s.teacher }));
};

// ===== Save to LOCAL cache only (not cloud) =====
export const saveStudent = async (student: { id?: number; name: string; teacher: string }): Promise<number | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  if (student.id) {
    await putCachedStudent({ id: student.id, name: student.name, teacher: student.teacher, user_id: userId });
    await markDirty('student', 'upsert', { id: student.id });
    return student.id;
  } else {
    // Temporary ID in a high range so it can never collide with a real cloud id
    // (cloud ids come from a normal sequence). Remapped on first successful sync.
    const TEMP_BASE = 1_000_000_000;
    const existing = await getCachedStudents();
    const maxId = existing.reduce((max, s) => Math.max(max, s.id), TEMP_BASE);
    const newId = maxId + 1;
    await putCachedStudent({ id: newId, name: student.name, teacher: student.teacher, user_id: userId });
    await markDirty('student', 'upsert', { id: newId });
    return newId;
  }
};

export const deleteStudent = async (id: number) => {
  await deleteCachedStudent(id);
  await markDirty('student', 'delete', { id });
  // Also delete related cache
  const allHistory = await getCachedHifzHistory();
  const allYearData = await getCachedYearData();
  for (const row of allHistory.filter(r => r.student_id === id)) {
    const { deleteItem } = await import("./localDB");
    await deleteItem('hifz_history', [row.student_id, row.year_key]);
  }
  for (const row of allYearData.filter(r => r.student_id === id)) {
    const { deleteItem } = await import("./localDB");
    await deleteItem('year_data', [row.student_id, row.year]);
  }
};

export const deleteAllStudents = async () => {
  const { clearStore } = await import("./localDB");

  await clearStore('students');
  await clearStore('hifz_history');
  await clearStore('year_data');

  // Drop any stale pending-sync bookkeeping for these entities (harmless
  // leftovers from before local-only mode).
  const pending = await getPendingChanges();
  for (const p of pending.filter(item => ['student', 'hifz', 'year'].includes(item.entity))) {
    await clearPending(p.key);
  }
};

export const saveHifzHistory = async (studentId: number, history: HifzHistory) => {
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
  await putCachedYearData({
    student_id: studentId, year,
    base_hifz: data.baseHifz, total_hifz: data.totalHifz, parts: data.parts,
    annual: data.annual, recitation: data.recitation, memorization: data.memorization,
    total: data.total, grade: data.grade, prize: data.prize,
    status_prize: data.statusPrize, rank: data.rank, teacher: data.teacher || '',
  });
  await markDirty('year', 'upsert', { student_id: studentId, year });
};

export const loadYearData = async (year: string, studentId: number): Promise<YearData> => {
  const defaultData: YearData = {
    baseHifz: '0', totalHifz: '0', parts: '', annual: '', recitation: '',
    memorization: '', total: '0', grade: '', prize: '0', statusPrize: '', rank: '-',
    teacher: ''
  };

  const allYearData = await getCachedYearData();
  const row = allYearData.find(r => r.student_id === studentId && r.year === year);
  if (!row) return defaultData;

  return {
    baseHifz: row.base_hifz, totalHifz: row.total_hifz, parts: row.parts,
    annual: row.annual, recitation: row.recitation, memorization: row.memorization,
    total: row.total, grade: row.grade, prize: row.prize,
    statusPrize: row.status_prize, rank: row.rank, teacher: row.teacher || '',
  };
};

// Latest Hijri year that actually has data; falls back to the first competition year
const getLatestDataYear = async (): Promise<string> => {
  try {
    const cached = await getCachedYearData();
    const cachedYears = cached.map(r => r.year).filter(Boolean);
    if (cachedYears.length) return cachedYears.sort().slice(-1)[0];
  } catch { /* ignore */ }

  return String(START_YEAR);
};

export const getActiveYear = async (): Promise<string> => {
  const year = await getCachedSetting<string>('active_year');
  if (year) return year;
  return getLatestDataYear();
};

export const setActiveYear = async (year: string) => {
  await setCachedSetting('active_year', year);
};

export const getTableFilters = async <T>(): Promise<T | undefined> => {
  return getCachedSetting<T>('table_filters');
};

export const setTableFilters = async (filters: any) => {
  await setCachedSetting('table_filters', filters);
};

export const migrateYearData = async (newYear: string, students: { id: number }[]) => {
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

// Kept as a no-op call site so every save function below doesn't need editing:
// there's no cloud to push to anymore, the write to IndexedDB above already
// *is* the durable save.
const queueCloudSync = () => {};

// ===== Local-first CRUD for additional modules =====

export type TeacherRow = CachedTeacher;
export type TeacherBonusRow = CachedTeacherBonus;
export type DonorRow = CachedDonor;
export type AwardRow = CachedAward;
export type CeremonyExpenseRow = CachedCeremonyExpense;
export type CertificateRow = CachedCertificate;
export type MediaMetadataRow = CachedMedia;

export const loadTeachers = async (year?: string): Promise<TeacherRow[]> => {
  await ensureCache();
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await getCachedTeachers();
  return byYear(rows.filter(r => belongsToUser(r, userId)), year).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
};

export const saveTeacher = async (teacher: Partial<TeacherRow> & { name: string; year: string }): Promise<TeacherRow | null> => {
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
  const saved: CertificateRow[] = [];
  for (const certificate of certificates) {
    const row = await saveCertificate(certificate);
    if (row) saved.push(row);
  }
  return saved;
};

export const deleteCertificateLocal = async (id: string) => {
  await deleteCachedCertificate(id);
  await markDirty('certificate', 'delete', { id });
  queueCloudSync();
};

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
  const existing = (await getCachedMedia()).find(item => item.id === id);
  await deleteCachedMedia(id);
  await markDirty('media', 'delete', { id, file_path: existing?.file_path });
  queueCloudSync();
};

// ===== SYNC TO CLOUD: called when user clicks "Save" =====
let syncInFlight: Promise<boolean> | null = null;

// ===== Local-only mode: "syncing" is just clearing local bookkeeping =====
// The old code pushed queued offline changes to Supabase here. There's no
// cloud anymore, so this simply reports success — every save already wrote
// straight into the local database.
export const syncToCloud = async (onProgress?: ProgressCb): Promise<boolean> => {
  const pending = await getPendingChanges();
  const total = Math.max(pending.length, 1);
  let done = 0;
  for (const p of pending) {
    await clearPending(p.key);
    onProgress?.(++done, total, 'اكتمل');
  }
  if (pending.length === 0) onProgress?.(1, 1, 'لا تغييرات');
  await setLastSyncTime();
  return true;
};

// Legacy sync-compatible wrappers (for ImportExport component)
export const saveGlobalStudents = async (students: Student[]) => {
  // handled per-student via saveStudent
};

// ===== Merge duplicate students by name (case-insensitive, trimmed) =====
export const mergeDuplicateStudents = async (): Promise<number> => {
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
    // Keep the one with the smallest id as primary
    group.sort((a, b) => a.id - b.id);
    const primary = group[0];
    const dupes = group.slice(1);

    for (const dup of dupes) {
      // Move hifz history (don't overwrite existing primary keys with empty values)
      const dupHistory = allHistory.filter(h => h.student_id === dup.id);
      for (const h of dupHistory) {
        const existing = allHistory.find(r => r.student_id === primary.id && r.year_key === h.year_key);
        if (!existing || !existing.value || existing.value === '0') {
          await putCachedHifzRow({ student_id: primary.id, year_key: h.year_key, value: h.value });
          await markDirty('hifz', 'upsert', { student_id: primary.id, year_key: h.year_key });
        }
        await deleteItem('hifz_history', [h.student_id, h.year_key]);
      }
      // Move year data
      const dupYears = allYearData.filter(y => y.student_id === dup.id);
      for (const y of dupYears) {
        const existing = allYearData.find(r => r.student_id === primary.id && r.year === y.year);
        if (!existing || (!existing.parts && existing.total === '0')) {
          await putCachedYearData({ ...y, student_id: primary.id });
          await markDirty('year', 'upsert', { student_id: primary.id, year: y.year });
        }
        await deleteItem('year_data', [y.student_id, y.year]);
      }
      // Delete duplicate student
      const { deleteCachedStudent } = await import("./localDB");
      await deleteCachedStudent(dup.id);
      await markDirty('student', 'delete', { id: dup.id });
      mergedCount++;
    }
  }

  return mergedCount;
};

// ================= المتابعة الشهرية =================
// محفوظة بالكامل محلياً على هذا الجهاز (IndexedDB)، بنفس أسلوب باقي
// البيانات — لا حاجة لاتصال إنترنت للحفظ أو القراءة.

import { MonthlyRecord, QuranPoint, TRACKING_MONTHS } from "@/types/student";
import { calcPagesBetweenAsync } from "@/utils/quranData";

const emptyPoint = (): QuranPoint => ({ surah: null, ayah: null });

const emptyMonthlyRecord = (): MonthlyRecord => ({
  memoFrom: emptyPoint(), memoTo: emptyPoint(), memoHifzScore: "", memoRecitationScore: "",
  reviewFrom: emptyPoint(), reviewTo: emptyPoint(), reviewHifzScore: "", reviewRecitationScore: "",
  attendanceScore: "", behaviorScore: "",
});

const rowToRecord = (row: CachedMonthlyTracking): MonthlyRecord => ({
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

// يحمّل سجل شهر واحد لكل الطالبات لعام معيّن (لعرض جدول شهر بعينه)
export const loadMonthlyTrackingForMonth = async (
  year: string,
  month: number
): Promise<Record<number, MonthlyRecord>> => {
  const all = await getAllCachedMonthlyTracking();
  const result: Record<number, MonthlyRecord> = {};
  all.filter(r => r.year === year && r.month === month)
    .forEach(row => { result[row.student_id] = rowToRecord(row); });
  return result;
};

// يحمّل كل الأشهر (1-9) لطالبة واحدة خلال عام معيّن (لعرض بطاقتها الكاملة)
export const loadMonthlyTrackingForStudent = async (
  year: string,
  studentId: number
): Promise<Record<number, MonthlyRecord>> => {
  const all = await getAllCachedMonthlyTracking();
  const result: Record<number, MonthlyRecord> = {};
  all.filter(r => r.year === year && r.student_id === studentId)
    .forEach(row => { result[row.month] = rowToRecord(row); });
  return result;
};

// يجيب "إلى" آخر شهر مسبوق فيه بيانات لهذي الطالبة (لكلا القسمين)
// حتى تُستخدم تلقائياً كنقطة بداية ("من") للشهر الحالي
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

// يحفظ سجل شهر واحد لطالبة، ثم يعيد احتساب الإجماليات السنوية تلقائياً
// ويحدّث "حفظ جديد" و"السنوية" بالجدول الرئيسي (year_data) — مع بقائها
// قابلة للتعديل اليدوي لاحقاً (مثلاً لإضافة حفظ إضافي بعطلة رمضان قبل المسابقة).
export const saveMonthlyRecord = async (
  year: string,
  studentId: number,
  month: number,
  record: MonthlyRecord
): Promise<boolean> => {
  const userId = await getUserId();
  if (!userId) return false;

  const row: CachedMonthlyTracking = {
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
  };

  await putCachedMonthlyTracking(row);
  await recomputeAnnualFromMonthly(year, studentId);
  return true;
};

// يعيد احتساب "حفظ جديد" (من مجموع أوجه قسم الحفظ المحسوبة تلقائياً ÷ 20)
// و"السنوية" (متوسط السلوك+المواظبة الشهري من 20) من كل سجلات المتابعة
// الشهرية للطالبة، ويكتبها بجدول بيانات العام الرئيسي (year_data) — القيم
// تبقى قابلة للتعديل اليدوي بعدها (مثلاً لإضافة حفظ إضافي بعطلة رمضان).
export const recomputeAnnualFromMonthly = async (year: string, studentId: number) => {
  const all = await getAllCachedMonthlyTracking();
  const data = all.filter(r => r.year === year && r.student_id === studentId);
  if (data.length === 0) return;

  const pagesPerRow = await Promise.all(data.map(async (r) => {
    if (!r.memorization_from_surah || !r.memorization_to_surah) return 0;
    return calcPagesBetweenAsync(
      r.memorization_from_surah, r.memorization_from_ayah,
      r.memorization_to_surah, r.memorization_to_ayah
    );
  }));
  const totalPages = pagesPerRow.reduce((sum, p) => sum + p, 0);

  const monthsWithScores = data.filter(r => (r.attendance_score || 0) > 0 || (r.behavior_score || 0) > 0);
  const totalMonthlyOutOf20 = data.reduce((sum, r) => sum + ((r.attendance_score || 0) + (r.behavior_score || 0)), 0);
  const monthCount = monthsWithScores.length || 1;

  const partsFromPages = totalPages / 20; // 20 وجه = جزء
  const annualScore = totalMonthlyOutOf20 / monthCount; // متوسط من 20

  const existing = await loadYearData(year, studentId);
  await saveYearData(year, studentId, {
    ...existing,
    parts: partsFromPages > 0 ? partsFromPages.toFixed(2).replace(/\.00$/, '') : existing.parts,
    annual: totalMonthlyOutOf20 > 0 ? annualScore.toFixed(2).replace(/\.00$/, '') : existing.annual,
  });
};

// ===== إحصائيات الحفظ والمراجعة (منفصلة عن درجات المسابقة الرمضانية) =====
// تُستخدم لترشيح: أفضل طالب/ة بالحفظ خلال شهر معيّن، وأفضل طالب/ة بالمراجعة
export interface MonthlyRanking {
  studentId: number;
  memoScore: number;   // تسميع الحفظ + تلاوة الحفظ (من 40)
  reviewScore: number; // تسميع المراجعة + تلاوة المراجعة (من 40)
  pagesThisMonth: number;
}

export const getMonthlyRankings = async (
  year: string,
  month: number
): Promise<MonthlyRanking[]> => {
  const all = await getAllCachedMonthlyTracking();
  const data = all.filter(r => r.year === year && r.month === month);

  return Promise.all(data.map(async (r) => ({
    studentId: r.student_id,
    memoScore: (r.memorization_hifz_score || 0) + (r.memorization_recitation_score || 0),
    reviewScore: (r.review_hifz_score || 0) + (r.review_recitation_score || 0),
    pagesThisMonth: r.memorization_from_surah && r.memorization_to_surah
      ? await calcPagesBetweenAsync(r.memorization_from_surah, r.memorization_from_ayah, r.memorization_to_surah, r.memorization_to_ayah)
      : 0,
  })));
};

// يجيب آخر عام وشهر تم تسجيل متابعة فيهما فعلياً (لأي طالبة)، لفتح صفحة
// المتابعة الشهرية تلقائياً على آخر نقطة توقف عندها العمل، بدل قيمة ثابتة
export const getLatestTrackedPeriod = async (): Promise<{ year: string; month: number } | null> => {
  const all = await getAllCachedMonthlyTracking();
  if (all.length === 0) return null;

  const sorted = [...all].sort((a, b) => b.year.localeCompare(a.year) || b.month - a.month);
  return { year: sorted[0].year, month: sorted[0].month };
};

export { TRACKING_MONTHS };



// ========== استيراد نسخة احتياطية كاملة (من نسخة IndexedDB القديمة) ==========

export const importFullBackupFromFile = async (file: File) => {
  const text = await file.text();
  const backup = JSON.parse(text);
  const { importFullBackup } = await import("./localDB");
  return importFullBackup(backup);
};
