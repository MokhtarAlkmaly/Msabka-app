/**
 * نظام المصادقة المحلي للنسخة المستقلة (markz-net) — بديل كامل عن Supabase Auth.
 *
 * - الحسابات مخزّنة في جدول app_users داخل قاعدة SQLite المحلية.
 * - الجلسة محفوظة في localStorage وتُتحقق من وجود الحساب عند كل قراءة.
 * - كلمات المرور تُجزَّأ بـ PBKDF2 (عبر Web Crypto) عندما يكون السياق آمنًا،
 *   مع بديل SHA-256 متسلسل نقي بجافاسكربت يعمل على أي سياق (مثل شبكة محلية
 *   بلا HTTPS) — لا يخرج أي شيء من الجهاز إطلاقًا.
 */

import { getDB } from "./sqliteClient";

// ============================================================
// الأنواع
// ============================================================

export interface LocalAuthUser {
  id: string;
  email: string;
  display_name: string;
  /** حقل توافق لصفحات كانت تقرأه من مستخدم Supabase. */
  user_metadata: { display_name: string };
  is_admin: boolean;
  created_at: string;
}

export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";

interface AuthUserRow {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  is_admin: number;
  created_at: string;
}

export const SESSION_KEY = "markznet.session";

// ============================================================
// أحداث المصادقة (بديل onAuthStateChange)
// ============================================================

type AuthListener = (event: AuthEvent, user: LocalAuthUser | null) => void;
const listeners = new Set<AuthListener>();

export const subscribeAuth = (listener: AuthListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const emit = (event: AuthEvent, user: LocalAuthUser | null) => {
  for (const listener of listeners) {
    try {
      listener(event, user);
    } catch (err) {
      console.error("localAuth: خطأ في مستمع الحدث", err);
    }
  }
};

// ============================================================
// تجزئة كلمات المرور
// ============================================================

/** SHA-256 نقي بجافاسكربت — يعمل في أي سياق (احتياط للشبكات المحلية بلا HTTPS). */
const sha256Bytes = async (data: Uint8Array): Promise<Uint8Array> => {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
    return new Uint8Array(digest);
  }
  // تنفيذ SHA-256 يدوي (compact) — يُستعمل فقط عندما لا يتوفر crypto.subtle.
  return sha256Js(data);
};

const sha256Js = (data: Uint8Array): Uint8Array => {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const l = data.length;
  const bitLen = l * 8;
  const withOne = ((l + 8) >> 6) + 1;
  const words = new Uint32Array(withOne * 16);
  for (let i = 0; i < l; i++) {
    words[i >> 2] |= data[i] << ((3 - (i % 4)) * 8);
  }
  words[l >> 2] |= 0x80 << ((3 - (l % 4)) * 8);
  words[withOne * 16 - 1] = bitLen;

  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let j = 0; j < withOne * 16; j += 16) {
    for (let i = 0; i < 16; i++) w[i] = words[j + i];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = H[i] >>> 24;
    out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
    out[i * 4 + 3] = H[i] & 0xff;
  }
  return out;
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (hex: string) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
};

const encodeUtf8 = (text: string) => new TextEncoder().encode(text);

const randomSaltHex = (bytes = 16) => {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = (Math.random() * 256) | 0;
  }
  return toHex(arr);
};

const PBKDF2_ITERATIONS = 150_000;
const FALLBACK_ITERATIONS = 20_000;

/** ينتج نصًا مخزّنًا بصيغة: alg$iterations$saltHex$hashHex */
export const hashPassword = async (
  password: string,
  saltHex?: string,
  alg?: "pbkdf2" | "sha256chain",
): Promise<string> => {
  const salt = saltHex ?? randomSaltHex();
  const saltBytes = fromHex(salt);
  const pwBytes = encodeUtf8(password);

  const subtle =
    typeof crypto !== "undefined" && crypto.subtle
      ? crypto.subtle
      : typeof globalThis !== "undefined"
        ? (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle
        : undefined;

  if (!alg || alg === "pbkdf2") {
    if (subtle) {
      try {
        const key = await subtle.importKey(
          "raw",
          pwBytes as unknown as BufferSource,
          "PBKDF2",
          false,
          ["deriveBits"],
        );
        const bits = await subtle.deriveBits(
          {
            name: "PBKDF2",
            salt: saltBytes as unknown as BufferSource,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
          },
          key,
          256,
        );
        return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${toHex(new Uint8Array(bits))}`;
      } catch {
        // بعض السياقات تحظر الاستيراد — نكمل بالبديل.
      }
    }
  }

  // بديل: سلسلة SHA-256 متكررة (تعمل بلا سياق آمن).
  let h = await sha256Bytes(new Uint8Array([...saltBytes, ...pwBytes]));
  for (let i = 0; i < FALLBACK_ITERATIONS; i++) {
    h = await sha256Bytes(new Uint8Array([...h, ...pwBytes]));
  }
  return `sha256chain$${FALLBACK_ITERATIONS}$${salt}$${toHex(h)}`;
};

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const parts = (stored || "").split("$");
  if (parts.length !== 4) return false;
  const [alg, , salt, expected] = parts;
  if (alg !== "pbkdf2" && alg !== "sha256chain") return false;
  const computed = await hashPassword(password, salt, alg);
  // قارن الجزء الأخير (التجزئة) فقط مع نفس الخوارزمية والملح.
  const computedParts = computed.split("$");
  return (
    computedParts[0] === alg && computedParts[2] === salt && safeEqual(computedParts[3], expected)
  );
};

// ============================================================
// الوصول لجدول الحسابات
// ============================================================

const rowToUser = (row: AuthUserRow): LocalAuthUser => {
  const displayName = row.display_name || row.email;
  return {
    id: row.id,
    email: row.email,
    display_name: displayName,
    user_metadata: { display_name: displayName },
    is_admin: Number(row.is_admin) === 1,
    created_at: row.created_at,
  };
};

const queryUserById = async (id: string): Promise<AuthUserRow | null> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM app_users WHERE id = ? LIMIT 1`, [id]);
  return (res.values?.[0] as AuthUserRow | undefined) ?? null;
};

const queryUserByEmail = async (email: string): Promise<AuthUserRow | null> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM app_users WHERE email = ? LIMIT 1`, [email]);
  return (res.values?.[0] as AuthUserRow | undefined) ?? null;
};

export const listAuthUsers = async (): Promise<LocalAuthUser[]> => {
  const db = await getDB();
  const res = await db.query(`SELECT * FROM app_users ORDER BY created_at`);
  return (res.values ?? []).map((row) => rowToUser(row as AuthUserRow));
};

export const hasAnyUsers = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  const db = await getDB();
  const res = await db.query(`SELECT 1 FROM app_users LIMIT 1`);
  return (res.values?.length ?? 0) > 0;
};

// ============================================================
// الجلسة
// ============================================================

let cachedSessionUser: LocalAuthUser | null | undefined;

const readSessionUserId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string };
    return typeof parsed.userId === "string" && parsed.userId ? parsed.userId : null;
  } catch {
    return null;
  }
};

const writeSession = (userId: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, ts: Date.now() }));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* التخزين غير متاح */
  }
};

/** مستخدم الجلسة الحالي (يتحقق أن الحساب ما يزال موجودًا). */
export const getSessionUser = async (): Promise<LocalAuthUser | null> => {
  if (typeof window === "undefined") return null;
  if (cachedSessionUser !== undefined) return cachedSessionUser;
  const userId = readSessionUserId();
  if (!userId) {
    cachedSessionUser = null;
    return null;
  }
  const row = await queryUserById(userId).catch(() => null);
  cachedSessionUser = row ? rowToUser(row) : null;
  if (!row) writeSession(null); // حساب محذوف — نظف الجلسة.
  return cachedSessionUser;
};

export const getSessionUserId = async (): Promise<string | null> => {
  const user = await getSessionUser();
  return user?.id ?? null;
};

export const isAdminSession = async (): Promise<boolean> => {
  const user = await getSessionUser();
  return !!user?.is_admin;
};

// ============================================================
// تسجيل الدخول / الخروج / إنشاء الحسابات
// ============================================================

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export class LocalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalAuthError";
  }
}

export const signUp = async (input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<LocalAuthUser> => {
  if (typeof window === "undefined") throw new LocalAuthError("غير متاح على السيرفر");
  const email = normalizeEmail(input.email);
  if (!email) throw new LocalAuthError("يرجى إدخال البريد الإلكتروني");
  if (input.password.trim().length < 6)
    throw new LocalAuthError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");

  const db = await getDB();
  const existing = await queryUserByEmail(email);
  if (existing) throw new LocalAuthError("هذا البريد الإلكتروني مستخدم بالفعل");

  // أول حساب في النظام يصبح المسؤول تلقائيًا.
  const countRes = await db.query(`SELECT COUNT(*) AS c FROM app_users`);
  const isFirst = Number((countRes.values?.[0] as { c?: number } | undefined)?.c ?? 0) === 0;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const displayName = (input.displayName || "").trim() || email.split("@")[0];
  const passwordHash = await hashPassword(input.password.trim());
  const createdAt = new Date().toISOString();

  await db.run(
    `INSERT INTO app_users (id, email, display_name, password_hash, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, email, displayName, passwordHash, isFirst ? 1 : 0, createdAt],
    true,
  );

  const user = rowToUser((await queryUserById(id))!);
  return user;
};

export const signIn = async (email: string, password: string): Promise<LocalAuthUser> => {
  if (typeof window === "undefined") throw new LocalAuthError("غير متاح على السيرفر");
  const normalized = normalizeEmail(email);
  if (!normalized) throw new LocalAuthError("يرجى إدخال البريد الإلكتروني");
  if (!password) throw new LocalAuthError("يرجى إدخال كلمة المرور");

  const row = await queryUserByEmail(normalized);
  if (!row) throw new LocalAuthError("البريد الإلكتروني أو كلمة المرور غير صحيحة");

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) throw new LocalAuthError("البريد الإلكتروني أو كلمة المرور غير صحيحة");

  writeSession(row.id);
  cachedSessionUser = rowToUser(row);
  emit("SIGNED_IN", cachedSessionUser);
  return cachedSessionUser;
};

export const signOut = async (): Promise<void> => {
  writeSession(null);
  cachedSessionUser = null;
  emit("SIGNED_OUT", null);
};

// ============================================================
// كلمات المرور والملف الشخصي
// ============================================================

/** تغيير كلمة مرور الحساب الحالي (يتطلب كلمة المرور الحالية). */
export const changeOwnPassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  if (newPassword.trim().length < 6)
    throw new LocalAuthError("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
  const me = await getSessionUser();
  if (!me) throw new LocalAuthError("لا توجد جلسة مستخدم");

  const row = await queryUserById(me.id);
  if (!row) throw new LocalAuthError("الحساب غير موجود");
  if (!(await verifyPassword(currentPassword, row.password_hash)))
    throw new LocalAuthError("كلمة المرور الحالية غير صحيحة");

  const db = await getDB();
  const hash = await hashPassword(newPassword.trim());
  await db.run(`UPDATE app_users SET password_hash = ? WHERE id = ?`, [hash, me.id], true);
};

/** مسؤول يعيد تعيين كلمة مرور مستخدم آخر (بدون معرفة القديمة). */
export const adminSetPassword = async (
  targetUserId: string,
  newPassword: string,
): Promise<void> => {
  if (newPassword.trim().length < 6)
    throw new LocalAuthError("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
  if (!(await isAdminSession())) throw new LocalAuthError("هذه العملية للمسؤول فقط");
  if (!(await queryUserById(targetUserId))) throw new LocalAuthError("الحساب غير موجود");

  const db = await getDB();
  const hash = await hashPassword(newPassword.trim());
  await db.run(`UPDATE app_users SET password_hash = ? WHERE id = ?`, [hash, targetUserId], true);
};

/** تحديث الاسم الظاهر للحساب الحالي. */
export const updateDisplayName = async (name: string): Promise<LocalAuthUser> => {
  const trimmed = name.trim();
  if (!trimmed) throw new LocalAuthError("الاسم مطلوب");
  const me = await getSessionUser();
  if (!me) throw new LocalAuthError("لا توجد جلسة مستخدم");

  const db = await getDB();
  await db.run(`UPDATE app_users SET display_name = ? WHERE id = ?`, [trimmed, me.id], true);

  const row = await queryUserById(me.id);
  cachedSessionUser = row ? rowToUser(row) : null;
  emit("USER_UPDATED", cachedSessionUser);
  return cachedSessionUser!;
};
