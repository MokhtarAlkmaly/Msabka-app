CREATE TABLE public.donors (
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
CREATE POLICY "Users can view their own donors" ON public.donors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own donors" ON public.donors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own donors" ON public.donors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own donors" ON public.donors FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_donors_updated_at BEFORE UPDATE ON public.donors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ceremony_expenses (
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
CREATE POLICY "Users can view their own expenses" ON public.ceremony_expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own expenses" ON public.ceremony_expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses" ON public.ceremony_expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses" ON public.ceremony_expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_ceremony_expenses_updated_at BEFORE UPDATE ON public.ceremony_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.certificates (
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
CREATE POLICY "Users can view their own certificates" ON public.certificates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own certificates" ON public.certificates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own certificates" ON public.certificates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own certificates" ON public.certificates FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.awards ADD COLUMN IF NOT EXISTS funded_by text;