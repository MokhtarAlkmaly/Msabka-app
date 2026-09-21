-- روابط المعلمات (بوابة المعلمة) + وارد المعلمات (إرسال المتابعة الشهرية)
--
-- ما يفعل هذا الترحيل:
--   1) جدول teacher_portals: روابط خاصة بكود سرّي بدون حساب — كل رابط يقود
--      معلمة محددة إلى قائمة طالباتها لعام/شهر معين.
--   2) جدول monthly_submissions: ترسيلات المعلمات لشاشة المتابعة الشهرية
--      (نفس حقولها تماماً) بحالة (قيد المراجعة / مٌعتمد / مرفوض) مع سجل
--      التاريخ الكامل. إعادة الإرسال لنفس الطالبة تحدّث الصف نفسه.
--   3) دالتان SECURITY DEFINER تعملان دون تسجيل دخول (anon):
--        open_teacher_portal(code)  → بيانات البوابة + بطاقات الطالبات +
--                                      نهاية الشهر السابق + الإرسال الموجود.
--        submit_teacher_monthly(...) → تسجيل/تحديث ترسيل المعلمة مع كل
--                                      الفحوصات، ثم إخطار عبر NOTIFY pgst.
--   4) صلاحيات RLS: مالك البيانات يدير روابطه وترسيلاتِه، والمعلمة
--      (anon) تفتح البوابة وترسل فقط، ولا ترى أي شيء آخر.

-- ============================================================
-- الجداول
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teacher_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_name TEXT NOT NULL,
  code TEXT NOT NULL,
  year TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_portals_code_key
  ON public.teacher_portals(code);
CREATE INDEX IF NOT EXISTS idx_teacher_portals_user_year
  ON public.teacher_portals(user_id, year, month);

CREATE TABLE IF NOT EXISTS public.monthly_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES public.teacher_portals(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  year TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  -- حقول المتابعة الشهرية (نفس أعمدة monthly_tracking)
  memorization_from_surah INTEGER,
  memorization_from_ayah INTEGER,
  memorization_to_surah INTEGER,
  memorization_to_ayah INTEGER,
  memorization_hifz_score NUMERIC NOT NULL DEFAULT 0,
  memorization_recitation_score NUMERIC NOT NULL DEFAULT 0,
  review_from_surah INTEGER,
  review_from_ayah INTEGER,
  review_to_surah INTEGER,
  review_to_ayah INTEGER,
  review_hifz_score NUMERIC NOT NULL DEFAULT 0,
  review_recitation_score NUMERIC NOT NULL DEFAULT 0,
  attendance_score NUMERIC NOT NULL DEFAULT 0,
  behavior_score NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- إعادة الإرسال لنفس (بوابة، طالبة) تحدّث الصف نفسه بدل تكراره.
CREATE UNIQUE INDEX IF NOT EXISTS monthly_submissions_portal_student_key
  ON public.monthly_submissions(portal_id, student_id);
CREATE INDEX IF NOT EXISTS idx_monthly_submissions_user_status
  ON public.monthly_submissions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_monthly_submissions_user_year_month
  ON public.monthly_submissions(user_id, year, month);

-- ============================================================
-- صلاحيات RLS — teacher_portals
-- ============================================================

ALTER TABLE public.teacher_portals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.teacher_portals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_portals TO authenticated;
GRANT ALL ON public.teacher_portals TO service_role;

DROP POLICY IF EXISTS "Users can view their own teacher_portals" ON public.teacher_portals;
CREATE POLICY "Users can view their own teacher_portals"
  ON public.teacher_portals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own teacher_portals" ON public.teacher_portals;
CREATE POLICY "Users can create their own teacher_portals"
  ON public.teacher_portals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own teacher_portals" ON public.teacher_portals;
CREATE POLICY "Users can update their own teacher_portals"
  ON public.teacher_portals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own teacher_portals" ON public.teacher_portals;
CREATE POLICY "Users can delete their own teacher_portals"
  ON public.teacher_portals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- صلاحية المعلمة (دون حساب): قراءة البوابات النشطة فقط — بها تفتح الرابط.
DROP POLICY IF EXISTS "open_teacher_portal" ON public.teacher_portals;
CREATE POLICY "open_teacher_portal"
  ON public.teacher_portals FOR SELECT TO anon
  USING (active = TRUE);

-- توافق مع نظام مشاركة القراءة (اطلاع المستخدمين بعضهم على بعض).
DROP POLICY IF EXISTS "Shared read through access grants" ON public.teacher_portals;
CREATE POLICY "Shared read through access grants"
  ON public.teacher_portals FOR SELECT TO authenticated
  USING (public.can_read_user_data(user_id));

-- ============================================================
-- صلاحيات RLS — monthly_submissions
-- ============================================================

ALTER TABLE public.monthly_submissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE, DELETE ON public.monthly_submissions TO authenticated;
GRANT INSERT ON public.monthly_submissions TO anon, authenticated;
GRANT ALL ON public.monthly_submissions TO service_role;

DROP POLICY IF EXISTS "Users can view their own monthly_submissions" ON public.monthly_submissions;
CREATE POLICY "Users can view their own monthly_submissions"
  ON public.monthly_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own monthly_submissions" ON public.monthly_submissions;
CREATE POLICY "Users can create their own monthly_submissions"
  ON public.monthly_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own monthly_submissions" ON public.monthly_submissions;
CREATE POLICY "Users can update their own monthly_submissions"
  ON public.monthly_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own monthly_submissions" ON public.monthly_submissions;
CREATE POLICY "Users can delete their own monthly_submissions"
  ON public.monthly_submissions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- صلاحية المعلمة (دون حساب): إرسال فقط، وبشرط أن يطابق الرمز بوابة نشطة.
DROP POLICY IF EXISTS "submit_teacher_monthly" ON public.monthly_submissions;
CREATE POLICY "submit_teacher_monthly"
  ON public.monthly_submissions FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_portals p
      WHERE p.id = monthly_submissions.portal_id
        AND p.code = monthly_submissions.code
        AND p.active = TRUE
    )
  );

-- توافق مع نظام مشاركة القراءة.
DROP POLICY IF EXISTS "Shared read through access grants" ON public.monthly_submissions;
CREATE POLICY "Shared read through access grants"
  ON public.monthly_submissions FOR SELECT TO authenticated
  USING (public.can_read_user_data(user_id));

-- ============================================================
-- الدوال (تعمل للمعلمة دون تسجيل دخول)
-- ============================================================

-- فتح البوابة: تعيد بيانات الرابط وطالباته (المسجلات بالعام) مع نقطة نهاية
-- الشهر السابق لكل طالبة (لتعبئة "ابدأ من نهاية الشهر السابق") وآخر
-- ترسيل لها إن وجد.
CREATE OR REPLACE FUNCTION public.open_teacher_portal(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  teacher_name TEXT,
  year TEXT,
  month INTEGER,
  student_id BIGINT,
  student_name TEXT,
  prev_memo_surah INTEGER,
  prev_memo_ayah INTEGER,
  prev_review_surah INTEGER,
  prev_review_ayah INTEGER,
  submission JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH portal AS (
    SELECT id, user_id, teacher_name, code, year, month
    FROM public.teacher_portals
    WHERE code = p_code AND active = TRUE
  )
  SELECT
    pt.code,
    pt.teacher_name,
    pt.year,
    pt.month,
    s.id,
    s.name,
    mtprev.memorization_to_surah,
    mtprev.memorization_to_ayah,
    mtprev.review_to_surah,
    mtprev.review_to_ayah,
    (
      SELECT jsonb_build_object(
        'status', sub.status,
        'memorization_from_surah', sub.memorization_from_surah,
        'memorization_from_ayah', sub.memorization_from_ayah,
        'memorization_to_surah', sub.memorization_to_surah,
        'memorization_to_ayah', sub.memorization_to_ayah,
        'memorization_hifz_score', sub.memorization_hifz_score,
        'memorization_recitation_score', sub.memorization_recitation_score,
        'review_from_surah', sub.review_from_surah,
        'review_from_ayah', sub.review_from_ayah,
        'review_to_surah', sub.review_to_surah,
        'review_to_ayah', sub.review_to_ayah,
        'review_hifz_score', sub.review_hifz_score,
        'review_recitation_score', sub.review_recitation_score,
        'attendance_score', sub.attendance_score,
        'behavior_score', sub.behavior_score,
        'notes', sub.notes,
        'submitted_at', sub.updated_at
      )
      FROM public.monthly_submissions sub
      WHERE sub.portal_id = pt.id AND sub.student_id = s.id
      LIMIT 1
    ) AS submission
  FROM portal pt
  JOIN public.students s ON s.user_id = pt.user_id
  JOIN public.year_data yd ON yd.student_id = s.id AND yd.year = pt.year
  LEFT JOIN public.monthly_tracking mtprev
    ON mtprev.student_id = s.id
   AND mtprev.year = pt.year
   AND mtprev.month = pt.month - 1
  ORDER BY s.name;
$$;

GRANT EXECUTE ON FUNCTION public.open_teacher_portal(TEXT) TO anon, authenticated;

-- إرسال/تحديث ترسيل المعلمة. كل الفحوصات تتم داخل الدالة (SECURITY DEFINER)
-- مهما كان الرمز المستخدم. إعادة الإرسال لنفس الطالبة تحدّث الصف نفسه
-- وتعيده لحالة "قيد المراجعة".
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
    RAISE EXCEPTION 'الطالبة غير موجودة في قائمتك' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.monthly_submissions (
    user_id, portal_id, code, student_id, student_name, year, month,
    memorization_from_surah, memorization_from_ayah,
    memorization_to_surah, memorization_to_ayah,
    memorization_hifz_score, memorization_recitation_score,
    review_from_surah, review_from_ayah, review_to_surah, review_to_ayah,
    review_hifz_score, review_recitation_score,
    attendance_score, behavior_score, notes, status
  ) VALUES (
    v_portal.user_id, v_portal.id, v_portal.code, p_student_id, p_student_name,
    p_year, p_month,
    p_memorization_from_surah, p_memorization_from_ayah,
    p_memorization_to_surah, p_memorization_to_ayah,
    COALESCE(p_memorization_hifz_score, 0), COALESCE(p_memorization_recitation_score, 0),
    p_review_from_surah, p_review_from_ayah, p_review_to_surah, p_review_to_ayah,
    COALESCE(p_review_hifz_score, 0), COALESCE(p_review_recitation_score, 0),
    COALESCE(p_attendance_score, 0), COALESCE(p_behavior_score, 0),
    p_notes, 'pending'
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

-- ============================================================
-- تحديث updated_at تلقائياً
-- ============================================================

DROP TRIGGER IF EXISTS update_teacher_portals_updated_at ON public.teacher_portals;
CREATE TRIGGER update_teacher_portals_updated_at
  BEFORE UPDATE ON public.teacher_portals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_submissions_updated_at ON public.monthly_submissions;
CREATE TRIGGER update_monthly_submissions_updated_at
  BEFORE UPDATE ON public.monthly_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
