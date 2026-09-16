-- ============================================================================
--  نظام المستخدمين والصلاحيات ومشاركة بيانات المسؤول
--  ---------------------------------------------------------------------------
--  ما الذي يفعله هذا الملف؟
--   1) يسمح لأي شخص بإنشاء حساب جديد والدخول، وتبقى بيانات كل مستخدم خاصة به.
--   2) يُنشئ جدول ملفات المستخدمين (profiles) وجدول الأدوار (user_roles).
--   3) يجعل حساب المسؤول (tableta91982@gmail.com) مسؤولاً تلقائياً.
--   4) يُنشئ جدول أذونات الاطلاع (data_access_grants) ليتحكم المسؤول بمن
--      يُسمح له بالاطلاع على بياناته، ويستطيع إيقاف الإذن في أي وقت.
--
--  الملف آمن لإعادة التشغيل أكثر من مرة (idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) البريد الإلكتروني لحساب المسؤول
--    لتغيير المسؤول لاحقاً: عدّل القيمة في الدالة public.admin_email() ثم أعد
--    تشغيل هذا الجزء فقط.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_email()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'tableta91982@gmail.com'::text;
$$;

-- ---------------------------------------------------------------------------
-- 1) نوع الدور
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) جدول ملفات المستخدمين
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3) جدول الأدوار (منفصل عن الملف الشخصي منعاً لتصعيد الصلاحيات)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4) دوال الصلاحيات (SECURITY DEFINER لتفادي التكرار اللانهائي في RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- ---------------------------------------------------------------------------
-- 5) جدول أذونات الاطلاع على بيانات مستخدم آخر
--    owner_id   = صاحب البيانات (المسؤول)
--    grantee_id = المستخدم المسموح له بالاطلاع
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_access_grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grantee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'write')),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, grantee_id),
  CHECK (owner_id <> grantee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_access_grants TO authenticated;
GRANT ALL ON public.data_access_grants TO service_role;
ALTER TABLE public.data_access_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_grants_owner ON public.data_access_grants(owner_id);
CREATE INDEX IF NOT EXISTS idx_grants_grantee ON public.data_access_grants(grantee_id);

-- هل يحق للمستخدم الحالي قراءة بيانات المالك المحدد؟
CREATE OR REPLACE FUNCTION public.can_read_user_data(_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() = _owner_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.data_access_grants g
      WHERE g.owner_id = _owner_id AND g.grantee_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- 6) سياسات RLS للجداول الجديدة
-- ---------------------------------------------------------------------------

-- profiles: كل مستخدم يرى ملفه، والمسؤول يرى الجميع، والمستفيد يرى ملف من شاركه
DROP POLICY IF EXISTS "Profiles are viewable by self, admin and granters" ON public.profiles;
CREATE POLICY "Profiles are viewable by self, admin and granters"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.data_access_grants g
    WHERE g.owner_id = public.profiles.id AND g.grantee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- user_roles: المستخدم يرى دوره فقط، والمسؤول يرى ويدير الجميع
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Only admins manage roles" ON public.user_roles;
CREATE POLICY "Only admins manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- data_access_grants: المالك يدير أذوناته، والمستفيد يرى ما مُنح له
DROP POLICY IF EXISTS "Owner and grantee can view grants" ON public.data_access_grants;
CREATE POLICY "Owner and grantee can view grants"
ON public.data_access_grants FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR grantee_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Owner can create grants" ON public.data_access_grants;
CREATE POLICY "Owner can create grants"
ON public.data_access_grants FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can update grants" ON public.data_access_grants;
CREATE POLICY "Owner can update grants"
ON public.data_access_grants FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can revoke grants" ON public.data_access_grants;
CREATE POLICY "Owner can revoke grants"
ON public.data_access_grants FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) سياسة قراءة مشتركة على كل جداول البيانات
--    (تُضاف بجانب السياسات الحالية، ولا تلغيها. الكتابة تبقى للمالك وحده.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'students', 'hifz_history', 'year_data', 'user_settings',
    'teachers', 'teacher_bonuses', 'donors', 'awards',
    'ceremony_expenses', 'certificates',
    'internal_competitions', 'external_competitions',
    'media', 'monthly_tracking'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Shared read through access grants" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Shared read through access grants" ON public.%I
           FOR SELECT TO authenticated
           USING (public.can_read_user_data(user_id))', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 8) إنشاء الملف الشخصي والدور تلقائياً عند تسجيل أي مستخدم جديد
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      split_part(COALESCE(NEW.email, 'مستخدم'), '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(COALESCE(NEW.email, '')) = lower(public.admin_email())
      THEN 'admin'::public.app_role
      ELSE 'user'::public.app_role
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- تحديث تاريخ التعديل
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_grants_updated_at ON public.data_access_grants;
CREATE TRIGGER update_grants_updated_at
BEFORE UPDATE ON public.data_access_grants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 9) ترحيل المستخدمين الموجودين مسبقاً + ضمان دور المسؤول
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, display_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(u.raw_user_meta_data ->> 'display_name', ''),
    split_part(COALESCE(u.email, 'مستخدم'), '@', 1)
  )
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
WHERE lower(COALESCE(u.email, '')) <> lower(public.admin_email())
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(COALESCE(u.email, '')) = lower(public.admin_email())
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10) دوال يستعملها التطبيق
-- ---------------------------------------------------------------------------

-- قائمة كل المستخدمين للمسؤول (مع عدد الطلاب وحالة إذن الاطلاع)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id             uuid,
  email          text,
  display_name   text,
  created_at     timestamptz,
  is_admin       boolean,
  students_count bigint,
  granted        boolean,
  access_level   text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'غير مصرح: هذه القائمة للمسؤول فقط';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.display_name,
    p.created_at,
    public.has_role(p.id, 'admin'::public.app_role) AS is_admin,
    (SELECT count(*) FROM public.students s WHERE s.user_id = p.id) AS students_count,
    EXISTS (
      SELECT 1 FROM public.data_access_grants g
      WHERE g.owner_id = auth.uid() AND g.grantee_id = p.id
    ) AS granted,
    (
      SELECT g.access_level FROM public.data_access_grants g
      WHERE g.owner_id = auth.uid() AND g.grantee_id = p.id
    ) AS access_level
  FROM public.profiles p
  ORDER BY public.has_role(p.id, 'admin'::public.app_role) DESC, p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ترقية / إنزال دور مستخدم (للمسؤول فقط، ولا يستطيع تغيير دوره هو)
CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'غير مصرح: تغيير الأدوار للمسؤول فقط';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكنك تغيير دورك أنت';
  END IF;

  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, boolean) TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_email() TO authenticated;
