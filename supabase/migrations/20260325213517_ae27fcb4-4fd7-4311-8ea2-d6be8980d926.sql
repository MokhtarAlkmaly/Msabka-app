
-- Create students table
CREATE TABLE public.students (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  teacher TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hifz_history table
CREATE TABLE public.hifz_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year_key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, year_key)
);

-- Create year_data table
CREATE TABLE public.year_data (
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
CREATE TABLE public.user_settings (
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
CREATE POLICY "Users can view their own students" ON public.students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own students" ON public.students FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own students" ON public.students FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own students" ON public.students FOR DELETE USING (auth.uid() = user_id);

-- Hifz history policies
CREATE POLICY "Users can view their own hifz_history" ON public.hifz_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own hifz_history" ON public.hifz_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own hifz_history" ON public.hifz_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own hifz_history" ON public.hifz_history FOR DELETE USING (auth.uid() = user_id);

-- Year data policies
CREATE POLICY "Users can view their own year_data" ON public.year_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own year_data" ON public.year_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own year_data" ON public.year_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own year_data" ON public.year_data FOR DELETE USING (auth.uid() = user_id);

-- User settings policies
CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
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
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_year_data_updated_at BEFORE UPDATE ON public.year_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
