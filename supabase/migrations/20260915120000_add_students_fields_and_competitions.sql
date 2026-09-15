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

CREATE POLICY "Users can view their own internal_competitions" ON public.internal_competitions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own internal_competitions" ON public.internal_competitions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own internal_competitions" ON public.internal_competitions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own internal_competitions" ON public.internal_competitions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_internal_comp_user_year ON public.internal_competitions(user_id, year);
CREATE INDEX IF NOT EXISTS idx_internal_comp_student ON public.internal_competitions(student_id);

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

CREATE POLICY "Users can view their own external_competitions" ON public.external_competitions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own external_competitions" ON public.external_competitions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own external_competitions" ON public.external_competitions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own external_competitions" ON public.external_competitions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_external_comp_user_year ON public.external_competitions(user_id, year);
CREATE INDEX IF NOT EXISTS idx_external_comp_student ON public.external_competitions(student_id);

CREATE TRIGGER update_external_competitions_updated_at BEFORE UPDATE ON public.external_competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
