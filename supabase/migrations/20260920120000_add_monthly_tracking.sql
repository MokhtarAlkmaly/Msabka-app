-- المتابعة الشهرية كانت مستخدمة في الواجهة دون ترحيل ينشئ جدولها.
-- هذا الترحيل يجعل الميزة قابلة للتثبيت على مشروع Supabase جديد ويحمي بيانات كل مستخدم.

CREATE TABLE IF NOT EXISTS public.monthly_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- مطلوب لاستعمال upsert(..., { onConflict: 'student_id,year,month' }) في التطبيق.
CREATE UNIQUE INDEX IF NOT EXISTS monthly_tracking_student_year_month_key
  ON public.monthly_tracking(student_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_tracking_user_year_month
  ON public.monthly_tracking(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_tracking_student
  ON public.monthly_tracking(student_id);

ALTER TABLE public.monthly_tracking ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_tracking TO authenticated;
GRANT ALL ON public.monthly_tracking TO service_role;

DROP POLICY IF EXISTS "Users can view their own monthly_tracking" ON public.monthly_tracking;
CREATE POLICY "Users can view their own monthly_tracking"
  ON public.monthly_tracking FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own monthly_tracking" ON public.monthly_tracking;
CREATE POLICY "Users can create their own monthly_tracking"
  ON public.monthly_tracking FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own monthly_tracking" ON public.monthly_tracking;
CREATE POLICY "Users can update their own monthly_tracking"
  ON public.monthly_tracking FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own monthly_tracking" ON public.monthly_tracking;
CREATE POLICY "Users can delete their own monthly_tracking"
  ON public.monthly_tracking FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- توافق مع نظام مشاركة القراءة الذي أُضيف في ترحيل إدارة المستخدمين.
DROP POLICY IF EXISTS "Shared read through access grants" ON public.monthly_tracking;
CREATE POLICY "Shared read through access grants"
  ON public.monthly_tracking FOR SELECT TO authenticated
  USING (public.can_read_user_data(user_id));

DROP TRIGGER IF EXISTS update_monthly_tracking_updated_at ON public.monthly_tracking;
CREATE TRIGGER update_monthly_tracking_updated_at
  BEFORE UPDATE ON public.monthly_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
