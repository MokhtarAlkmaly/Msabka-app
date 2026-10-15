/**
 * الدخول بدون إنترنت — الطبقة المخزِّنة (فوق SQLite المحلي).
 *
 * لماذا هذه الطبقة؟
 *  رمز وصول Supabase صلاحيته ساعة واحدة، وتجديده يحتاج نت. بدون هذه الطبقة
 *  يُطرد المستخدم إلى شاشة الدخول بعد ساعة من انقطاع الاتصال، فتصبح كل
 *  البيانات المحلية بلا فائدة. هنا نحفظ:
 *   1. **هوية الحساب** عند آخر دخول ناجح (user_id + البريد + الاسم).
 *   2. **بصمة رمز PIN محلي** (لا يُخزَّن الرمز صريحاً أبداً).
 *   3. **جلسة محلية مفتوحة** (mode: offline | device) بصلاحية 30 يوماً.
 *
 * والنتيجة: التطبيق يُفتح ويعمل بالكامل بدون نت، والبيانات تُكتب بنفس
 * `user_id` الحقيقي، فلا يحتاج الترحيل اللاحق إلى أي تحويل.
 */

import {
  countRowsOwnedBy,
  getCachedSetting,
  setCachedSetting,
  reassignTableOwner,
  SNAPSHOT_TABLES,
} from "./localDB";
import {
  DEVICE_OWNER_ID,
  deviceSession,
  hashPin,
  isLocalSessionExpired,
  localSessionSchema,
  offlineIdentitySchema,
  pinRecordSchema,
  sessionFromIdentity,
  verifyPinHash,
  type LocalSession,
  type OfflineIdentity,
  type PinRecord,
} from "@/lib/offline-auth";

const KEY_IDENTITY = "local_auth:identity";
const KEY_PIN = "local_auth:pin";
const KEY_SESSION = "local_auth:session";
const KEY_DEVICE_ID = "local_auth:device_id";

/** معرّف ثابت للجهاز — يُستعمل في أسماء النسخ الاحتياطية وتقارير الترحيل. */
export const getDeviceId = async (): Promise<string> => {
  const existing = await getCachedSetting<string>(KEY_DEVICE_ID);
  if (existing) return existing;
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await setCachedSetting(KEY_DEVICE_ID, created);
  return created;
};

// ============================================================
// الهوية المحفوظة (من آخر دخول سحابي ناجح)
// ============================================================

export const saveOfflineIdentity = async (identity: {
  user_id: string;
  email?: string | null;
  name?: string | null;
}): Promise<OfflineIdentity> => {
  const record: OfflineIdentity = {
    user_id: identity.user_id,
    email: identity.email ?? null,
    name: identity.name ?? null,
    saved_at: Date.now(),
  };
  await setCachedSetting(KEY_IDENTITY, record);
  return record;
};

export const getOfflineIdentity = async (): Promise<OfflineIdentity | null> => {
  const raw = await getCachedSetting<unknown>(KEY_IDENTITY);
  if (!raw) return null;
  const parsed = offlineIdentitySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

export const clearOfflineIdentity = async () => {
  await setCachedSetting(KEY_IDENTITY, null);
};

// ============================================================
// رمز PIN المحلي
// ============================================================

export const getPinRecord = async (): Promise<PinRecord | null> => {
  const raw = await getCachedSetting<unknown>(KEY_PIN);
  if (!raw) return null;
  const parsed = pinRecordSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

export const hasLocalPin = async (): Promise<boolean> => (await getPinRecord()) !== null;

/** يضبط/يغيّر رمز PIN المحلي. يُرجع رسالة خطأ عربية أو null عند النجاح. */
export const setLocalPin = async (pin: string): Promise<string | null> => {
  const record = await hashPin(pin);
  if (!record) return "الرمز يجب أن يكون من 4 إلى 8 أرقام.";
  await setCachedSetting(KEY_PIN, record);
  return null;
};

export const clearLocalPin = async () => {
  await setCachedSetting(KEY_PIN, null);
};

/**
 * تحقّق من الرمز المُدخل. إذا لم يُضبط رمز أصلاً فالدخول مسموح بلا رمز
 * (الهوية المحفوظة وحدها تكفي) — يمكن للمستخدم ضبط رمز لاحقاً من الإعدادات.
 */
export const verifyLocalPin = async (pin: string): Promise<boolean> => {
  const record = await getPinRecord();
  if (!record) return true;
  return verifyPinHash(pin, record);
};

// ============================================================
// الجلسة المحلية
// ============================================================

export const getLocalSession = async (): Promise<LocalSession | null> => {
  const raw = await getCachedSetting<unknown>(KEY_SESSION);
  if (!raw) return null;
  const parsed = localSessionSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (isLocalSessionExpired(parsed.data)) return null;
  return parsed.data;
};

const writeSession = async (session: LocalSession): Promise<LocalSession> => {
  await setCachedSetting(KEY_SESSION, session);
  return session;
};

/** يفتح جلسة محلية بهوية حساب محفوظ (بعد تحقّق PIN من شاشة الدخول). */
export const activateOfflineSession = async (
  identity?: OfflineIdentity | null,
): Promise<LocalSession | null> => {
  const stored = identity ?? (await getOfflineIdentity());
  if (!stored) return null;
  return writeSession(sessionFromIdentity(stored));
};

/** يفتح «وضع الجهاز» — عمل محلي كامل بلا حساب، يُربط بالسحابة لاحقاً. */
export const activateDeviceSession = async (): Promise<LocalSession> =>
  writeSession(deviceSession());

/** يحدّث آخر استخدام حتى لا تنتهي الصلاحية أثناء الاستخدام المستمر. */
export const touchLocalSession = async (): Promise<LocalSession | null> => {
  const session = await getLocalSession();
  if (!session) return null;
  return writeSession({ ...session, last_used_at: Date.now() });
};

export const clearLocalSession = async () => {
  await setCachedSetting(KEY_SESSION, null);
};

/** هل الجهاز يعمل الآن في «وضع الجهاز» (بلا حساب سحابي)؟ */
export const isDeviceMode = async (): Promise<boolean> =>
  (await getLocalSession())?.mode === "device";

/**
 * معرّف مالك البيانات الفعّال محلياً (بدون الرجوع إلى Supabase).
 * يُستعمل من طبقة التخزين عندما لا تتوفر جلسة سحابية.
 */
export const getLocalOwnerId = async (): Promise<string | null> => {
  const session = await getLocalSession();
  return session?.user_id ?? null;
};

/**
 * هل يلزم إدخال PIN لفتح التطبيق بدون نت؟
 * (نعم إذا كان رمز مضبوطاً ولا توجد جلسة مفتوحة صالحة.)
 */
export const isPinRequired = async (): Promise<boolean> => {
  if (!(await hasLocalPin())) return false;
  return (await getLocalSession()) === null;
};

/**
 * ربط بيانات «وضع الجهاز» بحساب سحابي حقيقي: يُعاد نسب كل صفوف الجداول
 * المحلية من `local-device` إلى معرّف الحساب، ثم تُستبدل الجلسة.
 * يُرجع عدد الصفوف التي أُعيد نسبها لكل جدول.
 */
export const linkDeviceToAccount = async (
  userId: string,
): Promise<{ tables: Record<string, number>; total: number }> => {
  const tables: Record<string, number> = {};
  let total = 0;
  for (const table of SNAPSHOT_TABLES) {
    const changed = await reassignTableOwner(table, DEVICE_OWNER_ID, userId);
    if (changed > 0) {
      tables[table] = changed;
      total += changed;
    }
  }

  const identity = await getOfflineIdentity();
  if (identity?.user_id === userId) {
    await writeSession(sessionFromIdentity(identity));
  } else {
    await writeSession({
      mode: "offline",
      user_id: userId,
      email: null,
      name: null,
      activated_at: Date.now(),
      last_used_at: Date.now(),
    });
  }

  return { tables, total };
};

/** هل توجد بيانات محلية منسوبة لوضع الجهاز ولم تُربط بحساب بعد؟ */
export const hasUnlinkedDeviceData = async (): Promise<boolean> =>
  (await countRowsOwnedBy(DEVICE_OWNER_ID)) > 0;

/** عدد سجلات وضع الجهاز المنتظرة الربط. */
export const countUnlinkedDeviceRows = () => countRowsOwnedBy(DEVICE_OWNER_ID);
