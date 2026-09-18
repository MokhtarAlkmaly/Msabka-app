/**
 * طبقة التعامل مع المستخدمين والأدوار وأذونات الاطلاع على بيانات المسؤول.
 * تعتمد على الجداول والدوال المعرّفة في:
 *   supabase/migrations/20260916120000_user_management_and_data_sharing.sql
 */

import { supabase } from "@/integrations/supabase/client";

export interface AppUser {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
  students_count: number;
  /** هل منحتُ هذا المستخدم إذن الاطلاع على بياناتي؟ */
  granted: boolean;
  access_level: "read" | "write" | null;
}

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

/** صاحب بيانات منحني إذن الاطلاع عليها. */
export interface SharedOwner {
  owner_id: string;
  name: string;
  email: string | null;
  access_level: "read" | "write";
}

/**
 * الجداول والدوال الجديدة غير موجودة في الأنواع المولَّدة
 * (src/integrations/supabase/types.ts)، لذا نستعمل عميلاً غير مُقيَّد بالأنواع
 * لهذه الاستدعاءات فقط، مع الحفاظ على أنواع صريحة للمخرجات.
 */
type QueryResult = Promise<{ data: unknown; error: unknown }>;
type FilterBuilder = QueryResult & {
  eq: (column: string, value: string) => FilterBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
};

type UntypedClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (columns: string) => FilterBuilder;
    upsert: (
      values: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<{ error: unknown }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: unknown }>;
    };
    delete: () => FilterBuilder;
  };
};

const db = supabase as unknown as UntypedClient;

/** هل الحساب الحالي مسؤول؟ */
export const checkIsAdmin = async (): Promise<boolean> => {
  const { data, error } = await db.rpc("is_admin");
  if (error) {
    console.error("تعذّر التحقق من صلاحية المسؤول:", error);
    return false;
  }
  return data === true;
};

/** قائمة كل المستخدمين — للمسؤول فقط. */
export const listAllUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await db.rpc("admin_list_users");
  if (error) throw error;
  return (data || []) as AppUser[];
};

/** منح مستخدم إذن الاطلاع على بيانات الحساب الحالي. */
export const grantAccess = async (
  granteeId: string,
  accessLevel: "read" | "write" = "read",
): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error("لا توجد جلسة مستخدم");
  if (ownerId === granteeId) throw new Error("لا يمكنك منح نفسك إذناً");

  const { error } = await db
    .from("data_access_grants")
    .upsert(
      { owner_id: ownerId, grantee_id: granteeId, access_level: accessLevel },
      { onConflict: "owner_id,grantee_id" },
    );
  if (error) throw error;
};

/** سحب إذن الاطلاع من مستخدم. */
export const revokeAccess = async (granteeId: string): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error("لا توجد جلسة مستخدم");

  const { error } = await db
    .from("data_access_grants")
    .delete()
    .eq("owner_id", ownerId)
    .eq("grantee_id", granteeId);
  if (error) throw error;
};

/** ترقية مستخدم إلى مسؤول أو إنزاله. */
export const setUserRole = async (userId: string, makeAdmin: boolean): Promise<void> => {
  const { error } = await db.rpc("admin_set_role", {
    _user_id: userId,
    _make_admin: makeAdmin,
  });
  if (error) throw error;
};

/**
 * الحسابات التي منحت المستخدم الحالي إذن الاطلاع على بياناتها.
 * تُستعمل لعرض زر "الاطلاع على بيانات المسؤول".
 */
export const listSharedWithMe = async (): Promise<SharedOwner[]> => {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];

  const { data, error } = await db
    .from("data_access_grants")
    .select(
      "owner_id, access_level, profiles!data_access_grants_owner_id_fkey(display_name, email)",
    )
    .eq("grantee_id", me);

  if (error) {
    console.error("تعذّر جلب أذونات الاطلاع:", error);
    return [];
  }

  type GrantRow = {
    owner_id: string;
    access_level: "read" | "write";
    profiles?: { display_name: string | null; email: string | null } | null;
  };

  return ((data as GrantRow[]) || []).map((row) => ({
    owner_id: row.owner_id,
    access_level: row.access_level,
    name: row.profiles?.display_name || row.profiles?.email || "المسؤول",
    email: row.profiles?.email ?? null,
  }));
};

/** ملف الحساب الحالي. */
export const getMyProfile = async (): Promise<UserProfile | null> => {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return null;

  const { data, error } = await db
    .from("profiles")
    .select("id,email,display_name,created_at")
    .eq("id", me)
    .maybeSingle();
  if (error) throw error;
  return (data as UserProfile | null) ?? null;
};

/** تحديث الاسم الظاهر للحساب الحالي. */
export const updateMyDisplayName = async (name: string): Promise<void> => {
  const trimmed = name.trim();
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("لا توجد جلسة مستخدم");

  const { error } = await db.from("profiles").update({ display_name: trimmed }).eq("id", me);
  if (error) throw error;

  // حدّث بيانات Auth أيضاً حتى يظهر الاسم الجديد في الجلسات والأجهزة الحديثة.
  const { error: authError } = await supabase.auth.updateUser({
    data: { display_name: trimmed },
  });
  if (authError) console.warn("تم تحديث الملف الشخصي، لكن تعذّر تحديث بيانات الجلسة:", authError);
};
