/**
 * طبقة التعامل مع المستخدمين والأدوار وأذونات الاطلاع على بيانات المستخدمين.
 * في النسخة المستقلة (markz-net) كل شيء محلي: جدولا app_users و data_grants
 * داخل قاعدة SQLite على الجهاز نفسه — لا سحابة ولا إنترنت.
 */

import { getDB } from "./sqliteClient";
import { getSessionUser, listAuthUsers, adminSetPassword, type LocalAuthUser } from "./localAuth";

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

interface GrantRow {
  owner_id: string;
  grantee_id: string;
  access_level: string;
}

const getGrants = async (): Promise<GrantRow[]> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM data_grants`);
  return (res.values ?? []) as GrantRow[];
};

/** هل الحساب الحالي مسؤول؟ */
export const checkIsAdmin = async (): Promise<boolean> => {
  const user = await getSessionUser();
  return !!user?.is_admin;
};

/** قائمة كل المستخدمين — للمسؤول فقط. */
export const listAllUsers = async (): Promise<AppUser[]> => {
  const me = await getSessionUser();
  if (!me) throw new Error("لا توجد جلسة مستخدم");
  if (!me.is_admin) throw new Error("هذه الصفحة للمسؤول فقط");

  const db = await getDB();
  const [users, grants, countRes] = await Promise.all([
    listAuthUsers(),
    getGrants(),
    db.query(`SELECT user_id, COUNT(*) AS c FROM students GROUP BY user_id`),
  ]);
  const countMap = new Map<string, number>();
  (countRes.values ?? []).forEach((row) => {
    const r = row as { user_id?: string; c?: number };
    if (r.user_id) countMap.set(r.user_id, Number(r.c) || 0);
  });

  return users
    .map((u: LocalAuthUser) => {
      const grant = grants.find((g) => g.owner_id === me.id && g.grantee_id === u.id);
      return {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        created_at: u.created_at,
        is_admin: u.is_admin,
        students_count: countMap.get(u.id) ?? 0,
        granted: !!grant,
        access_level: grant ? (grant.access_level as "read" | "write") : null,
      };
    })
    .sort(
      (a, b) => Number(b.is_admin) - Number(a.is_admin) || b.created_at.localeCompare(a.created_at),
    );
};

/** منح مستخدم إذن الاطلاع على بيانات الحساب الحالي. */
export const grantAccess = async (
  granteeId: string,
  accessLevel: "read" | "write" = "read",
): Promise<void> => {
  const me = await getSessionUser();
  if (!me) throw new Error("لا توجد جلسة مستخدم");
  if (me.id === granteeId) throw new Error("لا يمكنك منح نفسك إذناً");

  const db = await getDB();
  await db.run(
    `INSERT OR REPLACE INTO data_grants (owner_id, grantee_id, access_level, created_at)
     VALUES (?, ?, ?, ?)`,
    [me.id, granteeId, accessLevel, new Date().toISOString()],
    true,
  );
};

/** سحب إذن الاطلاع من مستخدم. */
export const revokeAccess = async (granteeId: string): Promise<void> => {
  const me = await getSessionUser();
  if (!me) throw new Error("لا توجد جلسة مستخدم");

  const db = await getDB();
  await db.run(
    `DELETE FROM data_grants WHERE owner_id = ? AND grantee_id = ?`,
    [me.id, granteeId],
    true,
  );
};

/** ترقية مستخدم إلى مسؤول أو إنزاله. */
export const setUserRole = async (userId: string, makeAdmin: boolean): Promise<void> => {
  const me = await getSessionUser();
  if (!me?.is_admin) throw new Error("هذه العملية للمسؤول فقط");

  const db = await getDB();
  await db.run(`UPDATE app_users SET is_admin = ? WHERE id = ?`, [makeAdmin ? 1 : 0, userId], true);
};

/** إعادة تعيين كلمة مرور مستخدم — للمسؤول فقط. */
export const adminResetPassword = adminSetPassword;

/**
 * الحسابات التي منحت المستخدم الحالي إذن الاطلاع على بياناتها.
 * تُستعمل لعرض زر "الاطلاع على بيانات المسؤول".
 */
export const listSharedWithMe = async (): Promise<SharedOwner[]> => {
  const me = await getSessionUser();
  if (!me) return [];

  const [grants, users] = await Promise.all([getGrants(), listAuthUsers()]);
  return grants
    .filter((g) => g.grantee_id === me.id)
    .map((g) => {
      const owner = users.find((u) => u.id === g.owner_id);
      return {
        owner_id: g.owner_id,
        access_level: (g.access_level === "write" ? "write" : "read") as "read" | "write",
        name: owner?.display_name || owner?.email || "المسؤول",
        email: owner?.email ?? null,
      };
    });
};

/** ملف الحساب الحالي. */
export const getMyProfile = async (): Promise<UserProfile | null> => {
  const me = await getSessionUser();
  if (!me) return null;
  return {
    id: me.id,
    email: me.email,
    display_name: me.display_name,
    created_at: me.created_at,
  };
};

/** تحديث الاسم الظاهر للحساب الحالي. */
export const updateMyDisplayName = async (name: string): Promise<void> => {
  const { updateDisplayName } = await import("./localAuth");
  await updateDisplayName(name);
};
