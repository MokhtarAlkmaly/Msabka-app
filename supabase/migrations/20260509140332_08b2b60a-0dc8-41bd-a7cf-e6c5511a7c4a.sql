
CREATE TABLE public.teacher_bonuses (
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

CREATE POLICY "Users can view their own teacher_bonuses"
ON public.teacher_bonuses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own teacher_bonuses"
ON public.teacher_bonuses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own teacher_bonuses"
ON public.teacher_bonuses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own teacher_bonuses"
ON public.teacher_bonuses FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_teacher_bonuses_updated_at
BEFORE UPDATE ON public.teacher_bonuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
