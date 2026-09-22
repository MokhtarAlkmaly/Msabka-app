/**
 * روابط المعلمين والمعلمات (بوابة المعلم/ة) + وارد المعلمين والمعلمات (ترسيلات المتابعة الشهرية).
 *
 * في النسخة المستقلة (markz-net) كل شيء محلي: جدولا teacher_portals و
 * monthly_submissions داخل قاعدة SQLite على الجهاز. الروابط تعمل على نفس
 * الجهاز أو ضمن الشبكة المحلية التي يُقدَّم منها النظام — بلا إنترنت.
 *
 *  - إدارة الروابط (authenticated): إنشاء/تعديل/كود/إيقاف/حذف.
 *  - فتح البوابة: عبر الكود دون تسجيل دخول (نفس منطق دالة open_teacher_portal).
 *  - إرسال/مراجعة الترسيلات: نفس منطق submit_teacher_monthly (upsert لكل
 *    رابط+طالب، ويعيد الترسيل لحالة "قيد المراجعة").
 */

import { getDB } from "./sqliteClient";
import {
  putTeacherPortal,
  getTeacherPortals,
  getTeacherPortalByCode,
  deleteTeacherPortal as deletePortalRow,
  putSubmission,
  getSubmissions,
  getSubmissionByPortalAndStudent,
  getManualSubmission,
  deleteSubmission as deleteSubmissionRow,
  type CachedTeacherPortal,
  type CachedSubmission,
} from "./localDB";
import type { MonthlyRecord, QuranPoint } from "@/types/student";

// ============================================================
// الأنواع
// ============================================================

export type SubmissionStatus = "pending" | "approved" | "rejected";

/**
 * مصدر الترسيل:
 *  - `portal`: أرسله المعلم/ة بنفسه عبر رابطه الخاص.
 *  - `manual`: «التقرير اليدوي» — أدخله المالك نيابة عن معلم/ة لا يملك
 *    جوالاً أو لا يستخدم النظام (تقرير ورقي).
 */
export type SubmissionSource = "portal" | "manual";

export interface TeacherPortal {
  id: string;
  user_id: string;
  teacher_name: string;
  code: string;
  year: string;
  month: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  /** فارغ في الإدخال اليدوي (لا رابط وراءه). */
  portal_id: string | null;
  /** فارغ في الإدخال اليدوي. */
  code: string | null;
  student_id: number;
  student_name: string;
  year: string;
  month: number;
  memorization_from_surah: number | null;
  memorization_from_ayah: number | null;
  memorization_to_surah: number | null;
  memorization_to_ayah: number | null;
  memorization_hifz_score: number;
  memorization_recitation_score: number;
  review_from_surah: number | null;
  review_from_ayah: number | null;
  review_to_surah: number | null;
  review_to_ayah: number | null;
  review_hifz_score: number;
  review_recitation_score: number;
  attendance_score: number;
  behavior_score: number;
  notes: string | null;
  status: SubmissionStatus;
  /** مصدر الترسيل: رابط المعلم/ة أو إدخال يدوي. */
  source: SubmissionSource;
  /** اسم المعلم/ة المخزّن على الترسيل نفسه. */
  teacher_name: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** اسم معلم/ة الرابط (عند جلب التفاصيل). */
  portal_teacher_name?: string;
}

/** إطلالة المعلم/ة على البوابة: بيانات الرابط + بطاقات الطلاب. */
export interface PortalStudent {
  student_id: number;
  student_name: string;
  /** نقطة نهاية الشهر السابق (قسم الحفظ الجديد). */
  prevMemo: QuranPoint;
  /** نقطة نهاية الشهر السابق (قسم المراجعة). */
  prevReview: QuranPoint;
  /** آخر ترسيل لهذا الطالب/ة إن وجد (لتعبئة النموذج وإظهار الحالة). */
  existing: Submission | null;
}

export interface PortalView {
  code: string;
  teacher_name: string;
  year: string;
  month: number;
  students: PortalStudent[];
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مٌعتمد",
  rejected: "مرفوض",
};

export const SUBMISSION_STATUS_COLORS: Record<SubmissionStatus, string> = {
  pending: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  approved: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  rejected: "bg-rose-400/15 text-rose-300 ring-rose-400/30",
};

export const SUBMISSION_SOURCE_LABELS: Record<SubmissionSource, string> = {
  portal: "عبر الرابط",
  manual: "إدخال يدوي",
};

export const SUBMISSION_SOURCE_COLORS: Record<SubmissionSource, string> = {
  portal: "bg-white/10 text-white/50 ring-white/10",
  manual: "bg-violet-400/15 text-violet-300 ring-violet-400/30",
};

// ============================================================
// نموذج النموذج (مشاركة بين صفحة المعلم/ة وصفحة الوارد)
// ============================================================

export interface PortalForm {
  memoFromSurah: string;
  memoFromAyah: string;
  memoToSurah: string;
  memoToAyah: string;
  memoHifz: string;
  memoRecite: string;
  reviewFromSurah: string;
  reviewFromAyah: string;
  reviewToSurah: string;
  reviewToAyah: string;
  reviewHifz: string;
  reviewRecite: string;
  attendance: string;
  behavior: string;
  notes: string;
}

export const emptyForm = (): PortalForm => ({
  memoFromSurah: "",
  memoFromAyah: "",
  memoToSurah: "",
  memoToAyah: "",
  memoHifz: "",
  memoRecite: "",
  reviewFromSurah: "",
  reviewFromAyah: "",
  reviewToSurah: "",
  reviewToAyah: "",
  reviewHifz: "",
  reviewRecite: "",
  attendance: "",
  behavior: "",
  notes: "",
});

const pointToStr = (p: QuranPoint | null | undefined): [string, string] =>
  p?.surah ? [String(p.surah), p.ayah ? String(p.ayah) : ""] : ["", ""];

export const formFromSubmission = (s: Submission): PortalForm => {
  const [memoFromSurah, memoFromAyah] = pointToStr({
    surah: s.memorization_from_surah,
    ayah: s.memorization_from_ayah,
  });
  const [memoToSurah, memoToAyah] = pointToStr({
    surah: s.memorization_to_surah,
    ayah: s.memorization_to_ayah,
  });
  const [reviewFromSurah, reviewFromAyah] = pointToStr({
    surah: s.review_from_surah,
    ayah: s.review_from_ayah,
  });
  const [reviewToSurah, reviewToAyah] = pointToStr({
    surah: s.review_to_surah,
    ayah: s.review_to_ayah,
  });
  return {
    memoFromSurah,
    memoFromAyah,
    memoToSurah,
    memoToAyah,
    memoHifz: s.memorization_hifz_score ? String(s.memorization_hifz_score) : "",
    memoRecite: s.memorization_recitation_score ? String(s.memorization_recitation_score) : "",
    reviewFromSurah,
    reviewFromAyah,
    reviewToSurah,
    reviewToAyah,
    reviewHifz: s.review_hifz_score ? String(s.review_hifz_score) : "",
    reviewRecite: s.review_recitation_score ? String(s.review_recitation_score) : "",
    attendance: s.attendance_score ? String(s.attendance_score) : "",
    behavior: s.behavior_score ? String(s.behavior_score) : "",
    notes: s.notes || "",
  };
};

/** يحوّل النموذج إلى Record المتابعة الشهرية (نفس حقول monthly_tracking). */
export const formToRecord = (f: PortalForm): MonthlyRecord => ({
  memoFrom: {
    surah: f.memoFromSurah ? parseInt(f.memoFromSurah) : null,
    ayah: f.memoFromAyah ? parseInt(f.memoFromAyah) : null,
  },
  memoTo: {
    surah: f.memoToSurah ? parseInt(f.memoToSurah) : null,
    ayah: f.memoToAyah ? parseInt(f.memoToAyah) : null,
  },
  memoHifzScore: f.memoHifz,
  memoRecitationScore: f.memoRecite,
  reviewFrom: {
    surah: f.reviewFromSurah ? parseInt(f.reviewFromSurah) : null,
    ayah: f.reviewFromAyah ? parseInt(f.reviewFromAyah) : null,
  },
  reviewTo: {
    surah: f.reviewToSurah ? parseInt(f.reviewToSurah) : null,
    ayah: f.reviewToAyah ? parseInt(f.reviewToAyah) : null,
  },
  reviewHifzScore: f.reviewHifz,
  reviewRecitationScore: f.reviewRecite,
  attendanceScore: f.attendance,
  behaviorScore: f.behavior,
});

// ============================================================
// تحويلات الصفوف
// ============================================================

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const portalFromRow = (row: CachedTeacherPortal): TeacherPortal => ({
  id: row.id,
  user_id: row.user_id,
  teacher_name: row.teacher_name,
  code: row.code,
  year: row.year,
  month: row.month,
  active: !!row.active,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const submissionFromRow = (row: CachedSubmission): Submission => ({
  id: row.id,
  user_id: row.user_id,
  portal_id: row.portal_id ?? null,
  code: row.code ?? null,
  student_id: row.student_id,
  student_name: row.student_name,
  year: row.year,
  month: row.month,
  memorization_from_surah: row.memorization_from_surah ?? null,
  memorization_from_ayah: row.memorization_from_ayah ?? null,
  memorization_to_surah: row.memorization_to_surah ?? null,
  memorization_to_ayah: row.memorization_to_ayah ?? null,
  memorization_hifz_score: Number(row.memorization_hifz_score) || 0,
  memorization_recitation_score: Number(row.memorization_recitation_score) || 0,
  review_from_surah: row.review_from_surah ?? null,
  review_from_ayah: row.review_from_ayah ?? null,
  review_to_surah: row.review_to_surah ?? null,
  review_to_ayah: row.review_to_ayah ?? null,
  review_hifz_score: Number(row.review_hifz_score) || 0,
  review_recitation_score: Number(row.review_recitation_score) || 0,
  attendance_score: Number(row.attendance_score) || 0,
  behavior_score: Number(row.behavior_score) || 0,
  notes: row.notes ?? null,
  status: (row.status as SubmissionStatus) || "pending",
  source: row.source === "manual" ? "manual" : "portal",
  teacher_name: row.teacher_name ?? null,
  review_note: row.review_note ?? null,
  reviewed_at: row.reviewed_at ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// ============================================================
// إدارة الروابط (للمالك)
// ============================================================

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const generatePortalCode = async (
  userId: string,
  year: string,
  month: number,
): Promise<string> => {
  const existing = await getTeacherPortals(userId);
  const codes = new Set(existing.map((p) => p.code));
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!codes.has(code)) return code;
  }
  // احتياط: يضمن التفرّد برقم تسلسلي قصير.
  return `${year}${String(month).padStart(2, "0")}${Date.now().toString(36).slice(-4)}`;
};

export const loadPortals = async (userId: string, year?: string): Promise<TeacherPortal[]> => {
  const rows = await getTeacherPortals(userId);
  return rows
    .filter((row) => !year || row.year === year)
    .map(portalFromRow)
    .sort((a, b) => a.year.localeCompare(b.year) || a.month - b.month);
};

export const createPortal = async (
  userId: string,
  input: { teacher_name: string; year: string; month: number },
): Promise<TeacherPortal> => {
  const code = await generatePortalCode(userId, input.year, input.month);
  const now = new Date().toISOString();
  const row: CachedTeacherPortal = {
    id: newId(),
    user_id: userId,
    teacher_name: input.teacher_name.trim(),
    code,
    year: input.year,
    month: input.month,
    active: true,
    created_at: now,
    updated_at: now,
  };
  await putTeacherPortal(row);
  return portalFromRow(row);
};

export const updatePortal = async (
  userId: string,
  id: string,
  patch: Partial<Pick<TeacherPortal, "teacher_name" | "code" | "active">>,
): Promise<TeacherPortal | null> => {
  const rows = await getTeacherPortals(userId);
  const existing = rows.find((row) => row.id === id);
  if (!existing) return null;

  const updated: CachedTeacherPortal = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await putTeacherPortal(updated);
  return portalFromRow(updated);
};

export const deletePortal = async (userId: string, id: string): Promise<void> => {
  const rows = await getTeacherPortals(userId);
  const existing = rows.find((row) => row.id === id);
  if (!existing) return;
  await deletePortalRow(id);
};

/** رابط المعلم/ة الكامل (يُرسل لها على واتساب أو يُشارك داخل الشبكة). */
export const getPortalLink = (
  portal: Pick<TeacherPortal, "code" | "year" | "month">,
  origin?: string,
): string => {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/teacher?t=${portal.code}&y=${portal.year}&m=${portal.month}`;
};

// ============================================================
// فتح البوابة (المعلم/ة — دون تسجيل دخول)
// ============================================================

interface PortalStudentRow {
  id: number;
  name: string;
}

interface PrevRow {
  memorization_to_surah: number | null;
  memorization_to_ayah: number | null;
  review_to_surah: number | null;
  review_to_ayah: number | null;
}

export const openPortalByCode = async (
  code: string,
): Promise<{ portal: PortalView | null; error: string | null }> => {
  if (typeof window === "undefined") return { portal: null, error: "غير متاح على السيرفر" };
  if (!code) return { portal: null, error: "الرابط غير صحيح أو تم إيقافه. راجع المشرف/ة." };

  const portalRow = await getTeacherPortalByCode(code.trim());
  if (!portalRow || !portalRow.active) {
    return { portal: null, error: "الرابط غير صحيح أو تم إيقافه. راجع المشرف/ة." };
  }

  const db = await getDB();

  // كل طلاب المالك المسجلين في عام الرابط (نفس منطق دالة SQL الأصلية).
  const studentsRes = await db.query(
    `SELECT DISTINCT s.id, s.name
     FROM students s
     INNER JOIN year_data yd ON yd.student_id = s.id AND yd.year = ?
     WHERE s.user_id = ?
     ORDER BY s.name`,
    [portalRow.year, portalRow.user_id],
  );
  const studentRows = (studentsRes.values ?? []) as PortalStudentRow[];

  // نقاط نهاية الشهر السابق من المتابعة الشهرية المحلية.
  const prevRes = await db.query(
    `SELECT student_id, memorization_to_surah, memorization_to_ayah, review_to_surah, review_to_ayah
     FROM monthly_tracking
     WHERE user_id = ? AND year = ? AND month = ?`,
    [portalRow.user_id, portalRow.year, portalRow.month - 1],
  );
  const prevByStudent = new Map<number, PrevRow>();
  (prevRes.values ?? []).forEach((row) => {
    const r = row as PrevRow & { student_id: number };
    prevByStudent.set(r.student_id, r);
  });

  // آخر ترسيل لكل طالب على هذا الرابط.
  const students: PortalStudent[] = await Promise.all(
    studentRows.map(async (row) => {
      const prev = prevByStudent.get(row.id);
      const subRow = await getSubmissionByPortalAndStudent(portalRow.id, row.id);
      return {
        student_id: row.id,
        student_name: row.name,
        prevMemo: {
          surah: prev?.memorization_to_surah ?? null,
          ayah: prev?.memorization_to_ayah ?? null,
        },
        prevReview: {
          surah: prev?.review_to_surah ?? null,
          ayah: prev?.review_to_ayah ?? null,
        },
        existing: subRow ? submissionFromRow(subRow) : null,
      };
    }),
  );

  return {
    portal: {
      code: portalRow.code,
      teacher_name: portalRow.teacher_name,
      year: portalRow.year,
      month: portalRow.month,
      students,
    },
    error: null,
  };
};

/** إرسال/تحديث ترسيل المعلم/ة. يعيد رسالة الخطأ العربية عند الفشل. */
export const submitTeacherMonthly = async (
  params: {
    code: string;
    student_id: number;
    student_name: string;
    year: string;
    month: number;
  } & Pick<
    Submission,
    | "memorization_from_surah"
    | "memorization_from_ayah"
    | "memorization_to_surah"
    | "memorization_to_ayah"
    | "memorization_hifz_score"
    | "memorization_recitation_score"
    | "review_from_surah"
    | "review_from_ayah"
    | "review_to_surah"
    | "review_to_ayah"
    | "review_hifz_score"
    | "review_recitation_score"
    | "attendance_score"
    | "behavior_score"
  > & { notes?: string | null },
): Promise<{ ok: boolean; error: string | null }> => {
  if (typeof window === "undefined") return { ok: false, error: "غير متاح على السيرفر" };

  const portalRow = await getTeacherPortalByCode(params.code.trim());
  if (!portalRow) return { ok: false, error: "الرابط غير صالح" };
  if (!portalRow.active) return { ok: false, error: "تم إيقاف هذا الرابط" };
  if (params.year !== portalRow.year || params.month !== portalRow.month) {
    return { ok: false, error: "الرابط لا يطابق العام أو الشهر المحدد" };
  }

  // التحقق أن الطالب/ة من طلاب صاحب الرابط.
  const db = await getDB();
  const studentRes = await db.query(`SELECT 1 FROM students WHERE id = ? AND user_id = ? LIMIT 1`, [
    params.student_id,
    portalRow.user_id,
  ]);
  if ((studentRes.values?.length ?? 0) === 0) {
    return { ok: false, error: "الطالبة غير موجودة في قائمتك" };
  }

  const now = new Date().toISOString();
  const existing = await getSubmissionByPortalAndStudent(portalRow.id, params.student_id);

  const row: CachedSubmission = {
    id: existing?.id ?? newId(),
    user_id: portalRow.user_id,
    portal_id: portalRow.id,
    code: portalRow.code,
    student_id: params.student_id,
    student_name: params.student_name,
    year: params.year,
    month: params.month,
    memorization_from_surah: params.memorization_from_surah ?? null,
    memorization_from_ayah: params.memorization_from_ayah ?? null,
    memorization_to_surah: params.memorization_to_surah ?? null,
    memorization_to_ayah: params.memorization_to_ayah ?? null,
    memorization_hifz_score: Number(params.memorization_hifz_score) || 0,
    memorization_recitation_score: Number(params.memorization_recitation_score) || 0,
    review_from_surah: params.review_from_surah ?? null,
    review_from_ayah: params.review_from_ayah ?? null,
    review_to_surah: params.review_to_surah ?? null,
    review_to_ayah: params.review_to_ayah ?? null,
    review_hifz_score: Number(params.review_hifz_score) || 0,
    review_recitation_score: Number(params.review_recitation_score) || 0,
    attendance_score: Number(params.attendance_score) || 0,
    behavior_score: Number(params.behavior_score) || 0,
    notes: params.notes ?? null,
    status: "pending",
    source: "portal",
    teacher_name: portalRow.teacher_name,
    review_note: null,
    reviewed_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await putSubmission(row);
  return { ok: true, error: null };
};

// ============================================================
// وارد المعلمين والمعلمات (للمالك)
// ============================================================

export const loadSubmissions = async (
  userId: string,
  filters?: { year?: string; month?: number; status?: SubmissionStatus },
): Promise<Submission[]> => {
  const rows = await getSubmissions(userId, filters);
  const portals = await getTeacherPortals(userId);
  const portalTeacher = new Map(portals.map((p) => [p.id, p.teacher_name]));

  return rows.map((row) => {
    const rec = submissionFromRow(row);
    const teacher = rec.portal_id ? portalTeacher.get(rec.portal_id) : undefined;
    return {
      ...rec,
      portal_teacher_name: teacher ?? rec.teacher_name ?? "",
    };
  });
};

export const updateSubmissionFields = async (
  userId: string,
  sub: Submission,
  form: PortalForm,
): Promise<Submission | null> => {
  const record = formToRecord(form);
  const rows = await getSubmissions(userId);
  const existing = rows.find((row) => row.id === sub.id);
  if (!existing) return null;

  const updated: CachedSubmission = {
    ...existing,
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
    notes: form.notes || null,
    status: "pending",
    review_note: null,
    reviewed_at: null,
    updated_at: new Date().toISOString(),
  };
  await putSubmission(updated);
  return submissionFromRow(updated);
};

export const setSubmissionStatus = async (
  userId: string,
  subId: string,
  status: SubmissionStatus,
  reviewNote?: string,
): Promise<void> => {
  const rows = await getSubmissions(userId);
  const existing = rows.find((row) => row.id === subId);
  if (!existing) return;

  const now = new Date().toISOString();
  await putSubmission({
    ...existing,
    status,
    review_note: reviewNote ?? null,
    reviewed_at: now,
    updated_at: now,
  });
};

export const deleteSubmission = async (userId: string, subId: string): Promise<void> => {
  const rows = await getSubmissions(userId);
  const existing = rows.find((row) => row.id === subId);
  if (!existing) return;
  await deleteSubmissionRow(subId);
};

/**
 * التقرير اليدوي — تسجيل/تحديث متابعة شهرية نيابة عن معلم/ة لا يستخدم
 * الرابط: يُدخلها المالك من الورقة مباشرة.
 * لا يُنشئ رابطاً ولا كوداً، ويُخزّن اسم المعلم/ة على الترسيل نفسه.
 */
export const saveManualSubmission = async (
  userId: string,
  input: {
    teacher_name: string;
    student_id: number;
    student_name: string;
    year: string;
    month: number;
    form: PortalForm;
    /** "pending" = يبقى للمراجعة، "approved" = يُعتمد فوراً. */
    status?: SubmissionStatus;
  },
): Promise<Submission> => {
  const record = formToRecord(input.form);
  const status: SubmissionStatus = input.status ?? "pending";
  const now = new Date().toISOString();

  // إدخال يدوي سابق لنفس (الطالب، العام، الشهر) يُحدَّث بدل أن يتكرر.
  const existing = await getManualSubmission(userId, input.student_id, input.year, input.month);

  const row: CachedSubmission = {
    id: existing?.id ?? newId(),
    user_id: userId,
    portal_id: null,
    code: null,
    teacher_name: input.teacher_name.trim(),
    student_id: input.student_id,
    student_name: input.student_name,
    year: input.year,
    month: input.month,
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
    notes: input.form.notes || null,
    source: "manual",
    status,
    review_note: null,
    reviewed_at: status === "pending" ? null : now,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await putSubmission(row);

  const rec = submissionFromRow(row);
  return { ...rec, source: "manual", portal_teacher_name: rec.teacher_name ?? "" };
};
