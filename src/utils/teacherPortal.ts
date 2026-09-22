/**
 * روابط المعلمين والمعلمات (بوابة المعلم/ة) + وارد المعلمين والمعلمات (ترسيلات المتابعة الشهرية).
 *
 * طبقة البيانات الخاصة بالمزيج الجديد:
 *  - إدارة الروابط (authenticated): إنشاء/تعديل كود/إيقاف/حذف.
 *  - فتح البوابة (anon): عبر دالة open_teacher_portal دون تسجيل دخول.
 *  - إرسال/مراجعة الترسيلات: دالة submit_teacher_monthly للمعلم/ة، ودوال
 *    تحديث الحالة والتعديل للمالك (صفحة «وارد المعلمين والمعلمات»).
 */

import { supabase } from "@/integrations/supabase/client";
import type { MonthlyRecord, QuranPoint } from "@/types/student";

// ============================================================
// الأنواع
// ============================================================

export type SubmissionStatus = "pending" | "approved" | "rejected";

/**
 * مصدر الترسيل:
 *  - `portal`: أرسله المعلم/ة بنفسه عبر رابطه الخاص.
 *  - `manual`: «التقرير اليدوي» — أدخله المالك نيابة عن معلم/ة لا يملك
 *    جوالاً أو لا يستخدم الإنترنت (تقرير ورقي).
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
// إدارة الروابط (للمالك)
// ============================================================

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const generatePortalCode = async (
  userId: string,
  year: string,
  month: number,
): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    const { data } = await supabase
      .from("teacher_portals")
      .select("id")
      .eq("user_id", userId)
      .eq("code", code);
    if (!data || data.length === 0) return code;
  }
  // احتياط: يضمن التفرّد برقم تسلسلي قصير.
  return `${year}${String(month).padStart(2, "0")}${Date.now().toString(36).slice(-4)}`;
};

export const loadPortals = async (userId: string, year?: string): Promise<TeacherPortal[]> => {
  let query = supabase.from("teacher_portals").select("*").eq("user_id", userId);
  if (year) query = query.eq("year", year);
  const { data, error } = await query.order("year").order("month");
  if (error) throw error;
  return (data || []) as TeacherPortal[];
};

export const createPortal = async (
  userId: string,
  input: { teacher_name: string; year: string; month: number },
): Promise<TeacherPortal> => {
  const code = await generatePortalCode(userId, input.year, input.month);
  const { data, error } = await supabase
    .from("teacher_portals")
    .insert({
      user_id: userId,
      teacher_name: input.teacher_name.trim(),
      code,
      year: input.year,
      month: input.month,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TeacherPortal;
};

export const updatePortal = async (
  userId: string,
  id: string,
  patch: Partial<Pick<TeacherPortal, "teacher_name" | "code" | "active">>,
): Promise<TeacherPortal | null> => {
  const { data, error } = await supabase
    .from("teacher_portals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as TeacherPortal | null) ?? null;
};

export const deletePortal = async (userId: string, id: string): Promise<void> => {
  const { error } = await supabase
    .from("teacher_portals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
};

/** رابط المعلم/ة الكامل (يُرسل لها على واتساب). */
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

export const openPortalByCode = async (
  code: string,
): Promise<{ portal: PortalView | null; error: string | null }> => {
  const { data, error } = await supabase.rpc("open_teacher_portal", {
    p_code: code,
  });
  if (error) return { portal: null, error: error.message };

  // شكل حقل submission (JSONB) كما تعيده الدالة.
  interface SubJson {
    status: string | null;
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
    notes: string | null;
    submitted_at: string | null;
  }

  const rows = (data || []) as NonNullable<typeof data>;
  if (rows.length === 0) {
    return { portal: null, error: "الرابط غير صحيح أو تم إيقافه. راجع المشرف/ة." };
  }

  const first = rows[0];
  const students: PortalStudent[] = rows.map((row) => {
    const sub = (row.submission as unknown as SubJson | null) ?? null;
    return {
      student_id: row.student_id,
      student_name: row.student_name,
      prevMemo: { surah: row.prev_memo_surah, ayah: row.prev_memo_ayah },
      prevReview: { surah: row.prev_review_surah, ayah: row.prev_review_ayah },
      existing: sub
        ? ({
            id: "",
            user_id: "",
            portal_id: "",
            code: first.code,
            student_id: row.student_id,
            student_name: row.student_name,
            year: first.year,
            month: first.month,
            memorization_from_surah: sub.memorization_from_surah ?? null,
            memorization_from_ayah: sub.memorization_from_ayah ?? null,
            memorization_to_surah: sub.memorization_to_surah ?? null,
            memorization_to_ayah: sub.memorization_to_ayah ?? null,
            memorization_hifz_score: Number(sub.memorization_hifz_score) || 0,
            memorization_recitation_score: Number(sub.memorization_recitation_score) || 0,
            review_from_surah: sub.review_from_surah ?? null,
            review_from_ayah: sub.review_from_ayah ?? null,
            review_to_surah: sub.review_to_surah ?? null,
            review_to_ayah: sub.review_to_ayah ?? null,
            review_hifz_score: Number(sub.review_hifz_score) || 0,
            review_recitation_score: Number(sub.review_recitation_score) || 0,
            attendance_score: Number(sub.attendance_score) || 0,
            behavior_score: Number(sub.behavior_score) || 0,
            notes: (sub.notes as string | null) ?? null,
            status: (sub.status as SubmissionStatus) ?? "pending",
            source: "portal" as SubmissionSource,
            teacher_name: first.teacher_name,
            review_note: null,
            reviewed_at: null,
            created_at: (sub.submitted_at as string) ?? "",
            updated_at: (sub.submitted_at as string) ?? "",
          } satisfies Submission)
        : null,
    };
  });

  return {
    portal: {
      code: first.code,
      teacher_name: first.teacher_name,
      year: first.year,
      month: first.month,
      students,
    },
    error: null,
  };
};

/** إرسال/تحديث ترسيل المعلم/ة. يعيد رسالة الخطأ العربية إن أخطأت الدالة. */
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
  const { error } = await supabase.rpc("submit_teacher_monthly", {
    p_code: params.code,
    p_student_id: params.student_id,
    p_student_name: params.student_name,
    p_year: params.year,
    p_month: params.month,
    p_memorization_from_surah: params.memorization_from_surah,
    p_memorization_from_ayah: params.memorization_from_ayah,
    p_memorization_to_surah: params.memorization_to_surah,
    p_memorization_to_ayah: params.memorization_to_ayah,
    p_memorization_hifz_score: params.memorization_hifz_score,
    p_memorization_recitation_score: params.memorization_recitation_score,
    p_review_from_surah: params.review_from_surah,
    p_review_from_ayah: params.review_from_ayah,
    p_review_to_surah: params.review_to_surah,
    p_review_to_ayah: params.review_to_ayah,
    p_review_hifz_score: params.review_hifz_score,
    p_review_recitation_score: params.review_recitation_score,
    p_attendance_score: params.attendance_score,
    p_behavior_score: params.behavior_score,
    p_notes: params.notes ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
};

// ============================================================
// وارد المعلمين والمعلمات (للمالك)
// ============================================================

export const loadSubmissions = async (
  userId: string,
  filters?: { year?: string; month?: number; status?: SubmissionStatus },
): Promise<Submission[]> => {
  let query = supabase
    .from("monthly_submissions")
    .select("*, portal:teacher_portals(teacher_name)")
    .eq("user_id", userId);
  if (filters?.year) query = query.eq("year", filters.year);
  if (filters?.month) query = query.eq("month", filters.month);
  if (filters?.status) query = query.eq("status", filters.status);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => {
    const portal = (row as Record<string, unknown>).portal as
      { teacher_name?: string } | null | undefined;
    const rec = row as unknown as Submission;
    return {
      ...rec,
      source: (rec.source === "manual" ? "manual" : "portal") as SubmissionSource,
      portal_teacher_name: portal?.teacher_name ?? rec.teacher_name ?? "",
    };
  });
};

export const updateSubmissionFields = async (
  userId: string,
  sub: Submission,
  form: PortalForm,
): Promise<Submission | null> => {
  const record = formToRecord(form);
  const { data, error } = await supabase
    .from("monthly_submissions")
    .update({
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
    })
    .eq("id", sub.id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as Submission | null) ?? null;
};

export const setSubmissionStatus = async (
  userId: string,
  subId: string,
  status: SubmissionStatus,
  reviewNote?: string,
): Promise<void> => {
  const { error } = await supabase
    .from("monthly_submissions")
    .update({
      status,
      review_note: reviewNote ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subId)
    .eq("user_id", userId);
  if (error) throw error;
};

export const deleteSubmission = async (userId: string, subId: string): Promise<void> => {
  const { error } = await supabase
    .from("monthly_submissions")
    .delete()
    .eq("id", subId)
    .eq("user_id", userId);
  if (error) throw error;
};

/**
 * التقرير اليدوي — تسجيل/تحديث متابعة شهرية نيابة عن معلم/ة لا يستخدم
 * الرابط (بلا جوال أو بلا إنترنت): يُدخلها المالك من الورقة مباشرة.
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
  const payload = {
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
    reviewed_at: status === "pending" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // إدخال يدوي سابق لنفس (الطالب، العام، الشهر) يُحدَّث بدل أن يتكرر.
  const { data: existing, error: findError } = await supabase
    .from("monthly_submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("student_id", input.student_id)
    .eq("year", input.year)
    .eq("month", input.month)
    .is("portal_id", null)
    .maybeSingle();
  if (findError) throw findError;

  const { data, error } = existing?.id
    ? await supabase
        .from("monthly_submissions")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select()
        .maybeSingle()
    : await supabase.from("monthly_submissions").insert(payload).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("تعذّر حفظ التقرير اليدوي");

  const rec = data as unknown as Submission;
  return { ...rec, source: "manual", portal_teacher_name: rec.teacher_name ?? "" };
};
