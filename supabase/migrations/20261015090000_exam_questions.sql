CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  question_type text NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'true_false', 'written')),
  question text NOT NULL DEFAULT '',
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  difficulty text NOT NULL DEFAULT 'متوسط',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own exam_questions" ON public.exam_questions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own exam_questions" ON public.exam_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own exam_questions" ON public.exam_questions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own exam_questions" ON public.exam_questions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_exam_questions_updated_at BEFORE UPDATE ON public.exam_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX exam_questions_owner_year_idx ON public.exam_questions (user_id, year);
