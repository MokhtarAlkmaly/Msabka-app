-- Community beneficiaries are independent of Quran students; one row is one
-- enrollment/service, not a unique person. Repeated services are intentional.
CREATE TABLE public.community_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department text NOT NULL CHECK (department IN ('training', 'care')),
  program_id text NOT NULL,
  beneficiary_name text NOT NULL CHECK (length(trim(beneficiary_name)) BETWEEN 2 AND 200),
  beneficiary_type text NOT NULL CHECK (beneficiary_type IN ('individual', 'child', 'family', 'orphan')),
  phone text CHECK (length(phone) <= 40),
  guardian_name text CHECK (length(guardian_name) <= 200),
  address text CHECK (length(address) <= 300),
  service_date date NOT NULL,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'in_progress', 'completed', 'cancelled')),
  group_name text CHECK (length(group_name) <= 200),
  sponsor_name text CHECK (length(sponsor_name) <= 200),
  amount numeric(14,2) CHECK (amount > 0 AND amount <= 999999999999.99),
  currency text CHECK (currency IN ('YER', 'SAR', 'USD')),
  quantity integer CHECK (quantity BETWEEN 1 AND 100000),
  notes text CHECK (length(notes) <= 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_program_department CHECK (
    (department = 'training' AND program_id IN ('kindergarten', 'preschool', 'sewing', 'embroidery', 'naqsh', 'design', 'first-aid')) OR
    (department = 'care' AND program_id IN ('food-baskets', 'cash-assistance', 'orphan-education', 'orphan-sponsorship'))
  ),
  CONSTRAINT community_money CHECK (
    (program_id IN ('cash-assistance', 'orphan-sponsorship') AND amount IS NOT NULL AND currency IS NOT NULL) OR
    (program_id NOT IN ('cash-assistance', 'orphan-sponsorship') AND amount IS NULL AND currency IS NULL)
  ),
  CONSTRAINT community_baskets CHECK (
    (program_id = 'food-baskets' AND quantity IS NOT NULL) OR (program_id <> 'food-baskets' AND quantity IS NULL)
  ),
  CONSTRAINT community_children CHECK (
    (program_id NOT IN ('kindergarten', 'preschool') OR beneficiary_type = 'child') AND
    (program_id NOT IN ('orphan-education', 'orphan-sponsorship') OR beneficiary_type = 'orphan') AND
    (beneficiary_type NOT IN ('child', 'orphan') OR coalesce(length(trim(guardian_name)), 0) > 0)
  )
);
CREATE INDEX community_records_owner_department_date_idx ON public.community_records (user_id, department, service_date DESC, id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_records TO authenticated;
GRANT ALL ON public.community_records TO service_role;
ALTER TABLE public.community_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read owned or shared community records" ON public.community_records FOR SELECT TO authenticated USING (public.can_read_user_data(user_id));
CREATE POLICY "Insert own community records" ON public.community_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own community records" ON public.community_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own community records" ON public.community_records FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_community_records_updated_at BEFORE UPDATE ON public.community_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
