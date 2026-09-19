-- Keep the Supabase schema in sync with the student gender field used by the app.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS gender TEXT;
