-- التقرير اليدوي + صياغة تشمل الذكور والإناث
--
-- ما يفعله هذا الترحيل:
--   1) يسمح بتسجيل متابعة شهرية «يدوياً» من قِبل مالك البيانات نيابة عن
--      معلم/ة لا يملك جوالاً أو لا يستخدم الإنترنت (تقرير ورقي):
--        - portal_id و code يصبحان اختياريين (لا رابط وراء الإدخال اليدوي).
--        - عمود teacher_name: اسم المعلم/ة المخزّن مباشرة على الترسيل.
--        - عمود source: 'portal' (عبر رابط المعلم/ة) أو 'manual' (إدخال يدوي).
--        - فهرس فريد خاص بالإدخالات اليدوية: ترسيل واحد لكل
--          (مستخدم، طالب، عام، شهر).
--   2) يحدّث رسالة الخطأ في submit_teacher_monthly إلى صيغة تشمل الذكور
--      والإناث («الطالب/ة غير موجود في قائمتك»).

-- ============================================================
-- الأعمدة الجديدة
-- ============================================================

ALTER TABLE public.monthly_submissions ALTER COLUMN portal_id DROP NOT NULL;
ALTER TABLE public.monthly_submissions ALTER COLUMN code DROP NOT NULL;

ALTER TABLE public.monthly_submissions
  ADD COLUMN IF NOT EXISTS teacher_name TEXT;

ALTER TABLE public.monthly_submissions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal'
    CHECK (source IN ('portal', 'manual'));

-- تعبئة اسم المعلم/ة للترسيلات القديمة من رابطها.
UPDATE public.monthly_submissions s
SET teacher_name = p.teacher_name
FROM public.teacher_portals p
WHERE p.id = s.portal_id
  AND s.teacher_name IS NULL;

-- الإدخال اليدوي ليس وراءه رابط، لذا يُمنع تكراره بهذا الفهرس الجزئي
-- (الفهرس القديم على (portal_id, student_id) لا يشمله لأن portal_id فارغ).
CREATE UNIQUE INDEX IF NOT EXISTS monthly_submissions_manual_key
  ON public.monthly_submissions(user_id, student_id, year, month)
  WHERE portal_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_submissions_user_source
  ON public.monthly_submissions(user_id, source);

-- ============================================================
-- دالة الإرسال عبر الرابط (نفس المنطق، بصياغة تشمل الجنسين)
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_teacher_monthly(
  p_code TEXT,
  p_student_id BIGINT,
  p_student_name TEXT,
  p_year TEXT,
  p_month INTEGER,
  p_memorization_from_surah INTEGER DEFAULT NULL,
  p_memorization_from_ayah INTEGER DEFAULT NULL,
  p_memorization_to_surah INTEGER DEFAULT NULL,
  p_memorization_to_ayah INTEGER DEFAULT NULL,
  p_memorization_hifz_score NUMERIC DEFAULT 0,
  p_memorization_recitation_score NUMERIC DEFAULT 0,
  p_review_from_surah INTEGER DEFAULT NULL,
  p_review_from_ayah INTEGER DEFAULT NULL,
  p_review_to_surah INTEGER DEFAULT NULL,
  p_review_to_ayah INTEGER DEFAULT NULL,
  p_review_hifz_score NUMERIC DEFAULT 0,
  p_review_recitation_score NUMERIC DEFAULT 0,
  p_attendance_score NUMERIC DEFAULT 0,
  p_behavior_score NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.monthly_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal public.teacher_portals;
  v_sub public.monthly_submissions;
BEGIN
  SELECT * INTO v_portal
  FROM public.teacher_portals
  WHERE code = p_code
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الرابط غير صالح' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_portal.active THEN
    RAISE EXCEPTION 'تم إيقاف هذا الرابط' USING ERRCODE = 'P0001';
  END IF;

  IF p_year IS DISTINCT FROM v_portal.year OR p_month IS DISTINCT FROM v_portal.month THEN
    RAISE EXCEPTION 'الرابط لا يطابق العام أو الشهر المحدد' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = p_student_id AND s.user_id = v_portal.user_id
  ) THEN
    RAISE EXCEPTION 'الطالب/ة غير موجود في قائمتك' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.monthly_submissions (
    user_id, portal_id, code, student_id, student_name, year, month,
    memorization_from_surah, memorization_from_ayah,
    memorization_to_surah, memorization_to_ayah,
    memorization_hifz_score, memorization_recitation_score,
    review_from_surah, review_from_ayah, review_to_surah, review_to_ayah,
    review_hifz_score, review_recitation_score,
    attendance_score, behavior_score, notes, status, teacher_name, source
  ) VALUES (
    v_portal.user_id, v_portal.id, v_portal.code, p_student_id, p_student_name,
    p_year, p_month,
    p_memorization_from_surah, p_memorization_from_ayah,
    p_memorization_to_surah, p_memorization_to_ayah,
    COALESCE(p_memorization_hifz_score, 0), COALESCE(p_memorization_recitation_score, 0),
    p_review_from_surah, p_review_from_ayah, p_review_to_surah, p_review_to_ayah,
    COALESCE(p_review_hifz_score, 0), COALESCE(p_review_recitation_score, 0),
    COALESCE(p_attendance_score, 0), COALESCE(p_behavior_score, 0),
    p_notes, 'pending', v_portal.teacher_name, 'portal'
  )
  ON CONFLICT (portal_id, student_id) DO UPDATE SET
    student_name = EXCLUDED.student_name,
    memorization_from_surah = EXCLUDED.memorization_from_surah,
    memorization_from_ayah = EXCLUDED.memorization_from_ayah,
    memorization_to_surah = EXCLUDED.memorization_to_surah,
    memorization_to_ayah = EXCLUDED.memorization_to_ayah,
    memorization_hifz_score = EXCLUDED.memorization_hifz_score,
    memorization_recitation_score = EXCLUDED.memorization_recitation_score,
    review_from_surah = EXCLUDED.review_from_surah,
    review_from_ayah = EXCLUDED.review_from_ayah,
    review_to_surah = EXCLUDED.review_to_surah,
    review_to_ayah = EXCLUDED.review_to_ayah,
    review_hifz_score = EXCLUDED.review_hifz_score,
    review_recitation_score = EXCLUDED.review_recitation_score,
    attendance_score = EXCLUDED.attendance_score,
    behavior_score = EXCLUDED.behavior_score,
    notes = EXCLUDED.notes,
    status = 'pending',
    review_note = NULL,
    reviewed_at = NULL,
    teacher_name = v_portal.teacher_name,
    updated_at = now()
  RETURNING * INTO v_sub;

  -- إخطار (يمكن لأي مكوّن يستمع على قناة pgst تحديث ذاكرته فوراً).
  PERFORM pg_notify(
    'pgst',
    json_build_object(
      'event', 'teacher_submission',
      'submission_id', v_sub.id,
      'user_id', v_sub.user_id,
      'student_id', v_sub.student_id,
      'year', v_sub.year,
      'month', v_sub.month
    )::text
  );

  RETURN v_sub;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_teacher_monthly(
  TEXT, BIGINT, TEXT, TEXT, INTEGER,
  INTEGER, INTEGER, INTEGER, INTEGER,
  NUMERIC, NUMERIC,
  INTEGER, INTEGER, INTEGER, INTEGER,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT
) TO anon, authenticated;
