-- حذف كل جداول المشروع وبياناتها من قاعدة البيانات (public schema)
-- شغّل هذا الملف في: Supabase Dashboard > SQL Editor > New query > Run
-- تحذير: هذا الحذف نهائي ولا يمكن التراجع عنه.

DROP TABLE IF EXISTS public.year_data CASCADE;
DROP TABLE IF EXISTS public.hifz_history CASCADE;
DROP TABLE IF EXISTS public.teacher_bonuses CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.ceremony_expenses CASCADE;
DROP TABLE IF EXISTS public.donors CASCADE;
DROP TABLE IF EXISTS public.awards CASCADE;
DROP TABLE IF EXISTS public.media CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- في حال بقي أي جدول آخر في public، هذا السطر يحذف الباقي أيضاً:
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t.tablename);
  END LOOP;
END $$;

-- حذف ملفات الوسائط المخزّنة (اختياري)
-- DELETE FROM storage.objects WHERE bucket_id = 'media';
