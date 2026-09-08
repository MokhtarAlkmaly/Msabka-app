CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, name)
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own teachers" ON public.teachers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own teachers" ON public.teachers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own teachers" ON public.teachers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own teachers" ON public.teachers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_teachers_user_year ON public.teachers(user_id, year);