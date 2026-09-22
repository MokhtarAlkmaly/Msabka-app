-- =============================================================
-- Msabka-app — Full database schema (idempotent)
-- ملف واحد يجمع كل migrations بالترتيب. آمن للتنفيذ أكثر من مرة،
-- ويعمل سواء كانت القاعدة فارغة أو تحتوي بعض الجداول مسبقًا.
-- نفّذه كاملًا في Supabase Dashboard > SQL Editor ثم اضغط Run.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- -------------------------------------------------------------
-- From: 20260325213517_ae27fcb4-4fd7-4311-8ea2-d6be8980d926.sql
-- -------------------------------------------------------------
-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  teacher TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hifz_history table
CREATE TABLE IF NOT EXISTS public.hifz_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year_key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, year_key)
);

-- Create year_data table
CREATE TABLE IF NOT EXISTS public.year_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  base_hifz TEXT NOT NULL DEFAULT '0',
  total_hifz TEXT NOT NULL DEFAULT '0',
  parts TEXT NOT NULL DEFAULT '',
  annual TEXT NOT NULL DEFAULT '',
  recitation TEXT NOT NULL DEFAULT '',
  memorization TEXT NOT NULL DEFAULT '',
  total TEXT NOT NULL DEFAULT '0',
  grade TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '0',
  status_prize TEXT NOT NULL DEFAULT '',
  rank TEXT NOT NULL DEFAULT '-',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, year)
);

-- User settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  active_year TEXT NOT NULL DEFAULT '1447',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hifz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.year_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Students policies
DROP POLICY IF EXISTS "Users can view their own students" ON public.students;
CREATE POLICY "Users can view their own students" ON public.students FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own students" ON public.students;
CREATE POLICY "Users can create their own students" ON public.students FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own students" ON public.students;
CREATE POLICY "Users can update their own students" ON public.students FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own students" ON public.students;
CREATE POLICY "Users can delete their own students" ON public.students FOR DELETE USING (auth.uid() = user_id);

-- Hifz history policies
DROP POLICY IF EXISTS "Users can view their own hifz_history" ON public.hifz_history;
CREATE POLICY "Users can view their own hifz_history" ON public.hifz_history FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own hifz_history" ON public.hifz_history;
CREATE POLICY "Users can create their own hifz_history" ON public.hifz_history FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own hifz_history" ON public.hifz_history;
CREATE POLICY "Users can update their own hifz_history" ON public.hifz_history FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own hifz_history" ON public.hifz_history;
CREATE POLICY "Users can delete their own hifz_history" ON public.hifz_history FOR DELETE USING (auth.uid() = user_id);

-- Year data policies
DROP POLICY IF EXISTS "Users can view their own year_data" ON public.year_data;
CREATE POLICY "Users can view their own year_data" ON public.year_data FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own year_data" ON public.year_data;
CREATE POLICY "Users can create their own year_data" ON public.year_data FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own year_data" ON public.year_data;
CREATE POLICY "Users can update their own year_data" ON public.year_data FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own year_data" ON public.year_data;
CREATE POLICY "Users can delete their own year_data" ON public.year_data FOR DELETE USING (auth.uid() = user_id);

-- User settings policies
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own settings" ON public.user_settings;
CREATE POLICY "Users can create their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
DROP TRIGGER IF EXISTS update_students_updated_at ON public.students;
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_year_data_updated_at ON public.year_data;
CREATE TRIGGER update_year_data_updated_at BEFORE UPDATE ON public.year_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -------------------------------------------------------------
-- From: 20260406155120_e3558b0c-2b72-4984-a2fe-8b68d263d26c.sql
-- -------------------------------------------------------------
-- Create media metadata table
CREATE TABLE IF NOT EXISTS public.media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  title TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  file_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own media" ON public.media;
CREATE POLICY "Users can view their own media" ON public.media FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own media" ON public.media;
CREATE POLICY "Users can create their own media" ON public.media FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own media" ON public.media;
CREATE POLICY "Users can delete their own media" ON public.media FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users can view their own media files" ON storage.objects;
CREATE POLICY "Users can view their own media files" ON storage.objects FOR SELECT USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can upload their own media files" ON storage.objects;
CREATE POLICY "Users can upload their own media files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can delete their own media files" ON storage.objects;
CREATE POLICY "Users can delete their own media files" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);


-- -------------------------------------------------------------
-- From: 20260406160125_ecba88f8-9ea2-4995-8c51-761ce8261c96.sql
-- -------------------------------------------------------------
ALTER TABLE public.year_data ADD COLUMN IF NOT EXISTS teacher text NOT NULL DEFAULT '';


-- -------------------------------------------------------------
-- From: 20260503133324_080d5921-5c42-4568-a1d4-112843f3bc9d.sql
-- -------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'media';

DROP POLICY IF EXISTS "Users can view their own media" ON storage.objects;
CREATE POLICY "Users can view their own media" ON storage.objects
FOR SELECT USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
CREATE POLICY "Users can upload their own media" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
CREATE POLICY "Users can update their own media" ON storage.objects
FOR UPDATE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
CREATE POLICY "Users can delete their own media" ON storage.objects
FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);


-- -------------------------------------------------------------
-- From: 20260504163210_1bca2b72-85e0-4601-bcc4-ec639602adec.sql
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own media" ON public.media;
CREATE POLICY "Users can update their own media" ON public.media
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- -------------------------------------------------------------
-- From: 20260505114152_a0f211aa-b69b-4f09-881b-e6fe1e9cfadf.sql
-- -------------------------------------------------------------
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS table_filters jsonb NOT NULL DEFAULT '{}'::jsonb;


-- -------------------------------------------------------------
-- From: 20260509140332_08b2b60a-0dc8-41bd-a7cf-e6c5511a7c4a.sql
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  teacher_name TEXT NOT NULL,
  year TEXT NOT NULL,
  month INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, teacher_name, year, month)
);

ALTER TABLE public.teacher_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own teacher_bonuses" ON public.teacher_bonuses;
CREATE POLICY "Users can view their own teacher_bonuses" ON public.teacher_bonuses FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own teacher_bonuses" ON public.teacher_bonuses;
CREATE POLICY "Users can create their own teacher_bonuses" ON public.teacher_bonuses FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own teacher_bonuses" ON public.teacher_bonuses;
CREATE POLICY "Users can update their own teacher_bonuses" ON public.teacher_bonuses FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own teacher_bonuses" ON public.teacher_bonuses;
CREATE POLICY "Users can delete their own teacher_bonuses" ON public.teacher_bonuses FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_teacher_bonuses_updated_at ON public.teacher_bonuses;
CREATE TRIGGER update_teacher_bonuses_updated_at
BEFORE UPDATE ON public.teacher_bonuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- -------------------------------------------------------------
-- From: 20260510142231_f79308e3-ce7b-40bc-be5a-52f64b6e4906.sql
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, name)
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own teachers" ON public.teachers;
CREATE POLICY "Users can view their own teachers" ON public.teachers FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own teachers" ON public.teachers;
CREATE POLICY "Users can create their own teachers" ON public.teachers FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own teachers" ON public.teachers;
CREATE POLICY "Users can update their own teachers" ON public.teachers FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own teachers" ON public.teachers;
CREATE POLICY "Users can delete their own teachers" ON public.teachers FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_teachers_updated_at ON public.teachers;
CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_teachers_user_year ON public.teachers(user_id, year);


-- -------------------------------------------------------------
-- From: 20260720141412_bb5ec9e4-7235-4a74-8a03-49d457f7db28.sql
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.awards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year text NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('teacher','student')),
  recipient_name text NOT NULL,
  award_type text NOT NULL CHECK (award_type IN ('khatm_bonus','ceremony','annual','certificate')),
  award_kind text NOT NULL DEFAULT 'cash' CHECK (award_kind IN ('cash','in_kind')),
  amount numeric NOT NULL DEFAULT 0,
  item text,
  student_name text,
  notes text,
  awarded_at date NOT NULL DEFAULT (now())::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.awards TO authenticated;
GRANT ALL ON public.awards TO service_role;

ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own awards" ON public.awards;
CREATE POLICY "Users can view their own awards" ON public.awards FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own awards" ON public.awards;
CREATE POLICY "Users can create their own awards" ON public.awards FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own awards" ON public.awards;
CREATE POLICY "Users can update their own awards" ON public.awards FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own awards" ON public.awards;
CREATE POLICY "Users can delete their own awards" ON public.awards FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_awards_user_year ON public.awards(user_id, year);
CREATE INDEX IF NOT EXISTS idx_awards_recipient ON public.awards(user_id, year, recipient_type, recipient_name);

DROP TRIGGER IF EXISTS update_awards_updated_at ON public.awards;
CREATE TRIGGER update_awards_updated_at BEFORE UPDATE ON public.awards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -------------------------------------------------------------
-- From: 20260728090414_f9612995-52a9-43c5-8eb0-e621869d2bd3.sql
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  name text NOT NULL,
  donor_type text NOT NULL DEFAULT 'person',
  phone text,
  pledged_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  in_kind text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donors TO authenticated;
GRANT ALL ON public.donors TO service_role;
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own donors" ON public.donors;
CREATE POLICY "Users can view their own donors" ON public.donors FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own donors" ON public.donors;
CREATE POLICY "Users can create their own donors" ON public.donors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own donors" ON public.donors;
CREATE POLICY "Users can update their own donors" ON public.donors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own donors" ON public.donors;
CREATE POLICY "Users can delete their own donors" ON public.donors FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_donors_updated_at ON public.donors;
CREATE TRIGGER update_donors_updated_at BEFORE UPDATE ON public.donors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ceremony_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  category text NOT NULL DEFAULT 'supplies',
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  spent_at date NOT NULL DEFAULT (now())::date,
  funded_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceremony_expenses TO authenticated;
GRANT ALL ON public.ceremony_expenses TO service_role;
ALTER TABLE public.ceremony_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.ceremony_expenses;
CREATE POLICY "Users can view their own expenses" ON public.ceremony_expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own expenses" ON public.ceremony_expenses;
CREATE POLICY "Users can create their own expenses" ON public.ceremony_expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.ceremony_expenses;
CREATE POLICY "Users can update their own expenses" ON public.ceremony_expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.ceremony_expenses;
CREATE POLICY "Users can delete their own expenses" ON public.ceremony_expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_ceremony_expenses_updated_at ON public.ceremony_expenses;
CREATE TRIGGER update_ceremony_expenses_updated_at BEFORE UPDATE ON public.ceremony_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'student',
  recipient_name text NOT NULL,
  cert_type text NOT NULL DEFAULT 'khatm',
  title text NOT NULL DEFAULT '',
  notes text,
  issued_at date NOT NULL DEFAULT (now())::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own certificates" ON public.certificates;
CREATE POLICY "Users can view their own certificates" ON public.certificates FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own certificates" ON public.certificates;
CREATE POLICY "Users can create their own certificates" ON public.certificates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own certificates" ON public.certificates;
CREATE POLICY "Users can update their own certificates" ON public.certificates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own certificates" ON public.certificates;
CREATE POLICY "Users can delete their own certificates" ON public.certificates FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_certificates_updated_at ON public.certificates;
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.awards ADD COLUMN IF NOT EXISTS funded_by text;


-- -------------------------------------------------------------
-- From: 20260811120000_expand_awards_recipient_type.sql
-- -------------------------------------------------------------
ALTER TABLE public.awards
DROP CONSTRAINT IF EXISTS awards_recipient_type_check;

ALTER TABLE public.awards
ADD CONSTRAINT awards_recipient_type_check
CHECK (
  recipient_type IN (
    'teacher',
    'male_teacher',
    'student',
    'male_student',
    'orphan',
    'needy',
    'other'
  )
);


-- -------------------------------------------------------------
-- From: 20260915120000_add_students_fields_and_competitions.sql
-- -------------------------------------------------------------
-- Add new fields to students table
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS hijri_join_date TEXT,
  ADD COLUMN IF NOT EXISTS initial_hifz TEXT,
  ADD COLUMN IF NOT EXISTS first_competition_year TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'طبيعي',
  ADD COLUMN IF NOT EXISTS school_grade TEXT,
  ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
  ADD COLUMN IF NOT EXISTS student_phone TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create internal_competitions table
CREATE TABLE IF NOT EXISTS public.internal_competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  year TEXT NOT NULL,
  competition_name TEXT NOT NULL,
  category TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  rank TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '',
  notes TEXT,
  date DATE NOT NULL DEFAULT (now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own internal_competitions" ON public.internal_competitions;
CREATE POLICY "Users can view their own internal_competitions" ON public.internal_competitions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own internal_competitions" ON public.internal_competitions;
CREATE POLICY "Users can create their own internal_competitions" ON public.internal_competitions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own internal_competitions" ON public.internal_competitions;
CREATE POLICY "Users can update their own internal_competitions" ON public.internal_competitions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own internal_competitions" ON public.internal_competitions;
CREATE POLICY "Users can delete their own internal_competitions" ON public.internal_competitions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_internal_comp_user_year ON public.internal_competitions(user_id, year);
CREATE INDEX IF NOT EXISTS idx_internal_comp_student ON public.internal_competitions(student_id);

DROP TRIGGER IF EXISTS update_internal_competitions_updated_at ON public.internal_competitions;
CREATE TRIGGER update_internal_competitions_updated_at BEFORE UPDATE ON public.internal_competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create external_competitions table
CREATE TABLE IF NOT EXISTS public.external_competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  year TEXT NOT NULL,
  competition_name TEXT NOT NULL,
  organizer TEXT NOT NULL,
  category TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  rank TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '',
  notes TEXT,
  date DATE NOT NULL DEFAULT (now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.external_competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own external_competitions" ON public.external_competitions;
CREATE POLICY "Users can view their own external_competitions" ON public.external_competitions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own external_competitions" ON public.external_competitions;
CREATE POLICY "Users can create their own external_competitions" ON public.external_competitions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own external_competitions" ON public.external_competitions;
CREATE POLICY "Users can update their own external_competitions" ON public.external_competitions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own external_competitions" ON public.external_competitions;
CREATE POLICY "Users can delete their own external_competitions" ON public.external_competitions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_external_comp_user_year ON public.external_competitions(user_id, year);
CREATE INDEX IF NOT EXISTS idx_external_comp_student ON public.external_competitions(student_id);

DROP TRIGGER IF EXISTS update_external_competitions_updated_at ON public.external_competitions;
CREATE TRIGGER update_external_competitions_updated_at BEFORE UPDATE ON public.external_competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -------------------------------------------------------------
-- From: 20260916120000_user_management_and_data_sharing.sql
-- -------------------------------------------------------------
-- ============================================================================
--  نظام المستخدمين والصلاحيات ومشاركة بيانات المسؤول
--  ---------------------------------------------------------------------------
--  ما الذي يفعله هذا الملف؟
--   1) يسمح لأي شخص بإنشاء حساب جديد والدخول، وتبقى بيانات كل مستخدم خاصة به.
--   2) يُنشئ جدول ملفات المستخدمين (profiles) وجدول الأدوار (user_roles).
--   3) يجعل حساب المسؤول (tableta91982@gmail.com) مسؤولاً تلقائياً.
--   4) يُنشئ جدول أذونات الاطلاع (data_access_grants) ليتحكم المسؤول بمن
--      يُسمح له بالاطلاع على بياناته، ويستطيع إيقاف الإذن في أي وقت.
--
--  الملف آمن لإعادة التشغيل أكثر من مرة (idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) البريد الإلكتروني لحساب المسؤول
--    لتغيير المسؤول لاحقاً: عدّل القيمة في الدالة public.admin_email() ثم أعد
--    تشغيل هذا الجزء فقط.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_email()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'tableta91982@gmail.com'::text;
$$;

-- ---------------------------------------------------------------------------
-- 1) نوع الدور
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) جدول ملفات المستخدمين
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3) جدول الأدوار (منفصل عن الملف الشخصي منعاً لتصعيد الصلاحيات)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4) دوال الصلاحيات (SECURITY DEFINER لتفادي التكرار اللانهائي في RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- ---------------------------------------------------------------------------
-- 5) جدول أذونات الاطلاع على بيانات مستخدم آخر
--    owner_id   = صاحب البيانات (المسؤول)
--    grantee_id = المستخدم المسموح له بالاطلاع
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_access_grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grantee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'write')),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, grantee_id),
  CHECK (owner_id <> grantee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_access_grants TO authenticated;
GRANT ALL ON public.data_access_grants TO service_role;
ALTER TABLE public.data_access_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_grants_owner ON public.data_access_grants(owner_id);
CREATE INDEX IF NOT EXISTS idx_grants_grantee ON public.data_access_grants(grantee_id);

-- هل يحق للمستخدم الحالي قراءة بيانات المالك المحدد؟
CREATE OR REPLACE FUNCTION public.can_read_user_data(_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() = _owner_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.data_access_grants g
      WHERE g.owner_id = _owner_id AND g.grantee_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- 6) سياسات RLS للجداول الجديدة
-- ---------------------------------------------------------------------------

-- profiles: كل مستخدم يرى ملفه، والمسؤول يرى الجميع، والمستفيد يرى ملف من شاركه
DROP POLICY IF EXISTS "Profiles are viewable by self, admin and granters" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by self, admin and granters" ON public.profiles;
CREATE POLICY "Profiles are viewable by self, admin and granters" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.data_access_grants g
    WHERE g.owner_id = public.profiles.id AND g.grantee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- user_roles: المستخدم يرى دوره فقط، والمسؤول يرى ويدير الجميع
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Only admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins manage roles" ON public.user_roles;
CREATE POLICY "Only admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- data_access_grants: المالك يدير أذوناته، والمستفيد يرى ما مُنح له
DROP POLICY IF EXISTS "Owner and grantee can view grants" ON public.data_access_grants;
DROP POLICY IF EXISTS "Owner and grantee can view grants" ON public.data_access_grants;
CREATE POLICY "Owner and grantee can view grants" ON public.data_access_grants FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR grantee_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Owner can create grants" ON public.data_access_grants;
DROP POLICY IF EXISTS "Owner can create grants" ON public.data_access_grants;
CREATE POLICY "Owner can create grants" ON public.data_access_grants FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can update grants" ON public.data_access_grants;
DROP POLICY IF EXISTS "Owner can update grants" ON public.data_access_grants;
CREATE POLICY "Owner can update grants" ON public.data_access_grants FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can revoke grants" ON public.data_access_grants;
DROP POLICY IF EXISTS "Owner can revoke grants" ON public.data_access_grants;
CREATE POLICY "Owner can revoke grants" ON public.data_access_grants FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) سياسة قراءة مشتركة على كل جداول البيانات
--    (تُضاف بجانب السياسات الحالية، ولا تلغيها. الكتابة تبقى للمالك وحده.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'students', 'hifz_history', 'year_data', 'user_settings',
    'teachers', 'teacher_bonuses', 'donors', 'awards',
    'ceremony_expenses', 'certificates',
    'internal_competitions', 'external_competitions',
    'media', 'monthly_tracking'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Shared read through access grants" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Shared read through access grants" ON public.%I
           FOR SELECT TO authenticated
           USING (public.can_read_user_data(user_id))', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 8) إنشاء الملف الشخصي والدور تلقائياً عند تسجيل أي مستخدم جديد
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      split_part(COALESCE(NEW.email, 'مستخدم'), '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(COALESCE(NEW.email, '')) = lower(public.admin_email())
      THEN 'admin'::public.app_role
      ELSE 'user'::public.app_role
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- تحديث تاريخ التعديل
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_grants_updated_at ON public.data_access_grants;
DROP TRIGGER IF EXISTS update_grants_updated_at ON public.data_access_grants;
CREATE TRIGGER update_grants_updated_at
BEFORE UPDATE ON public.data_access_grants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 9) ترحيل المستخدمين الموجودين مسبقاً + ضمان دور المسؤول
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, display_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(u.raw_user_meta_data ->> 'display_name', ''),
    split_part(COALESCE(u.email, 'مستخدم'), '@', 1)
  )
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
WHERE lower(COALESCE(u.email, '')) <> lower(public.admin_email())
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(COALESCE(u.email, '')) = lower(public.admin_email())
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10) دوال يستعملها التطبيق
-- ---------------------------------------------------------------------------

-- قائمة كل المستخدمين للمسؤول (مع عدد الطلاب وحالة إذن الاطلاع)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id             uuid,
  email          text,
  display_name   text,
  created_at     timestamptz,
  is_admin       boolean,
  students_count bigint,
  granted        boolean,
  access_level   text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'غير مصرح: هذه القائمة للمسؤول فقط';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.display_name,
    p.created_at,
    public.has_role(p.id, 'admin'::public.app_role) AS is_admin,
    (SELECT count(*) FROM public.students s WHERE s.user_id = p.id) AS students_count,
    EXISTS (
      SELECT 1 FROM public.data_access_grants g
      WHERE g.owner_id = auth.uid() AND g.grantee_id = p.id
    ) AS granted,
    (
      SELECT g.access_level FROM public.data_access_grants g
      WHERE g.owner_id = auth.uid() AND g.grantee_id = p.id
    ) AS access_level
  FROM public.profiles p
  ORDER BY public.has_role(p.id, 'admin'::public.app_role) DESC, p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ترقية / إنزال دور مستخدم (للمسؤول فقط، ولا يستطيع تغيير دوره هو)
CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'غير مصرح: تغيير الأدوار للمسؤول فقط';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكنك تغيير دورك أنت';
  END IF;

  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, boolean) TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_email() TO authenticated;


-- -------------------------------------------------------------
-- From: 20260918120000_add_managed_user_settings.sql
-- -------------------------------------------------------------
-- ============================================================================
-- إعدادات المستخدم المُدارة من واجهة «إدارة الإعدادات»
-- ---------------------------------------------------------------------------
-- يضيف حقولاً اختيارية إلى جدول user_settings لحفظ:
--   1) الأعمدة المخصصة في سجل الطلاب.
--   2) حالات الطلاب المخصصة.
-- الملف آمن لإعادة التشغيل أكثر من مرة.
-- ============================================================================

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS student_custom_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS student_statuses jsonb NOT NULL DEFAULT '[]'::jsonb;


-- -------------------------------------------------------------
-- From: 20260919120000_add_student_gender.sql
-- -------------------------------------------------------------
-- Keep the Supabase schema in sync with the student gender field used by the app.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS gender TEXT;


-- -------------------------------------------------------------
-- From: 20260920120000_add_monthly_tracking.sql
-- -------------------------------------------------------------
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
DROP POLICY IF EXISTS "Users can view their own monthly_tracking" ON public.monthly_tracking;
CREATE POLICY "Users can view their own monthly_tracking" ON public.monthly_tracking FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own monthly_tracking" ON public.monthly_tracking;
DROP POLICY IF EXISTS "Users can create their own monthly_tracking" ON public.monthly_tracking;
CREATE POLICY "Users can create their own monthly_tracking" ON public.monthly_tracking FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own monthly_tracking" ON public.monthly_tracking;
DROP POLICY IF EXISTS "Users can update their own monthly_tracking" ON public.monthly_tracking;
CREATE POLICY "Users can update their own monthly_tracking" ON public.monthly_tracking FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own monthly_tracking" ON public.monthly_tracking;
DROP POLICY IF EXISTS "Users can delete their own monthly_tracking" ON public.monthly_tracking;
CREATE POLICY "Users can delete their own monthly_tracking" ON public.monthly_tracking FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- توافق مع نظام مشاركة القراءة الذي أُضيف في ترحيل إدارة المستخدمين.
DROP POLICY IF EXISTS "Shared read through access grants" ON public.monthly_tracking;
DROP POLICY IF EXISTS "Shared read through access grants" ON public.monthly_tracking;
CREATE POLICY "Shared read through access grants" ON public.monthly_tracking FOR SELECT TO authenticated
  USING (public.can_read_user_data(user_id));

DROP TRIGGER IF EXISTS update_monthly_tracking_updated_at ON public.monthly_tracking;
DROP TRIGGER IF EXISTS update_monthly_tracking_updated_at ON public.monthly_tracking;
CREATE TRIGGER update_monthly_tracking_updated_at
  BEFORE UPDATE ON public.monthly_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- روابط المعلمين والمعلمات (بوابة المعلم/ة) + وارد المعلمين والمعلمات
-- (مطابق للترحيل 20260922120000_teacher_portal_and_submissions.sql)
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
  -- فارغ في «التقرير اليدوي» (إدخال المالك نيابة عن معلم/ة بلا رابط)
  portal_id UUID REFERENCES public.teacher_portals(id) ON DELETE CASCADE,
  code TEXT,
  -- اسم المعلم/ة (من رابطه، أو مكتوب يدوياً في الإدخال اليدوي)
  teacher_name TEXT,
  -- 'portal' = عبر رابط المعلم/ة، 'manual' = إدخال يدوي (تقرير ورقي)
  source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'manual')),
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
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
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_submissions_portal_student_key
  ON public.monthly_submissions(portal_id, student_id);
-- الإدخال اليدوي (بلا رابط): ترسيل واحد لكل (مستخدم، طالب، عام، شهر)
CREATE UNIQUE INDEX IF NOT EXISTS monthly_submissions_manual_key
  ON public.monthly_submissions(user_id, student_id, year, month)
  WHERE portal_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_monthly_submissions_user_status
  ON public.monthly_submissions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_monthly_submissions_user_year_month
  ON public.monthly_submissions(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_submissions_user_source
  ON public.monthly_submissions(user_id, source);

-- ------------------------------------------------------------
-- RLS — teacher_portals
-- ------------------------------------------------------------
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

-- صلاحية المعلم/ة (دون حساب): قراءة البوابات النشطة فقط.
DROP POLICY IF EXISTS "open_teacher_portal" ON public.teacher_portals;
CREATE POLICY "open_teacher_portal"
  ON public.teacher_portals FOR SELECT TO anon
  USING (active = TRUE);

DROP POLICY IF EXISTS "Shared read through access grants" ON public.teacher_portals;
CREATE POLICY "Shared read through access grants"
  ON public.teacher_portals FOR SELECT TO authenticated
  USING (public.can_read_user_data(user_id));

-- ------------------------------------------------------------
-- RLS — monthly_submissions
-- ------------------------------------------------------------
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

-- صلاحية المعلم/ة (دون حساب): إرسال فقط وبشرط مطابقة كود البوابة النشطة.
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

DROP POLICY IF EXISTS "Shared read through access grants" ON public.monthly_submissions;
CREATE POLICY "Shared read through access grants"
  ON public.monthly_submissions FOR SELECT TO authenticated
  USING (public.can_read_user_data(user_id));

-- ------------------------------------------------------------
-- الدالتان العامتان (بدون تسجيل دخول)
-- ------------------------------------------------------------
-- فتح البوابة: تعيد بيانات الرابط وطلابه (المسجلات بالعام) مع نقطة نهاية
-- الشهر السابق لكل طالب/ة (لتعبئة "ابدأ من نهاية الشهر السابق") وآخر
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

-- إرسال/تحديث ترسيل المعلم/ة. كل الفحوصات تتم داخل الدالة (SECURITY DEFINER)
-- مهما كان الرمز المستخدم. إعادة الإرسال لنفس الطالب/ة تحدّث الصف نفسه
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


-- ------------------------------------------------------------
-- تحديث updated_at تلقائياً
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS update_teacher_portals_updated_at ON public.teacher_portals;
CREATE TRIGGER update_teacher_portals_updated_at
  BEFORE UPDATE ON public.teacher_portals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_submissions_updated_at ON public.monthly_submissions;
CREATE TRIGGER update_monthly_submissions_updated_at
  BEFORE UPDATE ON public.monthly_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
