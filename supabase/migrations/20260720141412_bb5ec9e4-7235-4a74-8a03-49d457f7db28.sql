
CREATE TABLE public.awards (
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

CREATE POLICY "Users can view their own awards" ON public.awards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own awards" ON public.awards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own awards" ON public.awards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own awards" ON public.awards FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_awards_user_year ON public.awards(user_id, year);
CREATE INDEX idx_awards_recipient ON public.awards(user_id, year, recipient_type, recipient_name);

CREATE TRIGGER update_awards_updated_at BEFORE UPDATE ON public.awards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
