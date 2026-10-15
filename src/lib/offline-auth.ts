/**
 * منطق «الدخول بدون إنترنت» النقي — بلا أي اعتماد على المتصفح أو SQLite أو
 * Supabase، حتى يكون قابلاً للاختبار الآلي مباشرة (`npm run test:offline`).
 *
 * الفكرة:
 *  - عند آخر تسجيل دخول ناجح عبر Supabase نحفظ **هوية الحساب** محلياً
 *    (user_id + البريد + الاسم) مع بصمة رمز PIN محلي.
 *  - عند انقطاع النت يُفتح التطبيق بهذه الهوية المحفوظة بعد إدخال PIN،
 *    فتُكتب البيانات بنفس user_id الحقيقي — أي أن الترحيل اللاحق إلى السحابة
 *    لا يحتاج أي تحويل أو إعادة نسب.
 *  - من لم يسجّل الدخول أبداً (أو اختار ذلك صراحةً) يعمل بـ«وضع الجهاز»
 *    بمعرّف محلي ثابت، ثم يربط جهازه بحساب حقيقي لاحقاً فتُعاد نسبة كل صفوفه.
 */

import { z } from "zod";

/** معرّف مالك البيانات في «وضع الجهاز» (بلا حساب سحابي بعد). */
export const DEVICE_OWNER_ID = "local-device";

/** أقصى طول مسموح لرمز PIN محلي. */
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

/**
 * مدة صلاحية الجلسة المحلية المفتوحة (بدون إعادة إدخال PIN) — 30 يوماً من
 * آخر استخدام. بعدها يطلب التطبيق PIN مرة أخرى حتى لو كان الجهاز بلا نت.
 */
export const LOCAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** كل جداول البيانات تحمل user_id — يُستعمل في إعادة النسب عند ربط الجهاز. */
export type OwnedRow = { user_id: string | null };

// ============================================================
// التجزئة (SHA-256) — مع بديل JS خالص إذا لم يتوفر WebCrypto
// ============================================================

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 خالص بـ JavaScript — يُستعمل فقط عندما لا يتوفر `crypto.subtle`. */
export function sha256BytesFallback(bytes: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 9) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const encodeUtf8 = (text: string): Uint8Array => {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  // بديل بسيط يكفي لرمز PIN (أرقام/أحرف لاتينية) والنصوص العربية عبر escape.
  const bin = unescape(encodeURIComponent(text));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** SHA-256 بالنصوص الستعشرية — عبر WebCrypto إن وُجد وإلا بالبديل الخالص. */
export const sha256Hex = async (text: string): Promise<string> => {
  const bytes = encodeUtf8(text);
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest("SHA-256", bytes as BufferSource);
      return toHex(new Uint8Array(digest));
    } catch {
      // سياق غير آمن (http) أو بيئة لا تدعم WebCrypto → البديل الخالص.
    }
  }
  return toHex(sha256BytesFallback(bytes));
};

// ============================================================
// رمز PIN المحلي
// ============================================================

/**
 * ينظّف رمز PIN: أرقام فقط، بطول 4–8. يرجع null إذا لم يكن صالحاً.
 * (لا نُخزّن PIN أبداً كنص صريح — فقط بصمته مع ملح عشوائي.)
 */
export const normalizePin = (pin: string): string | null => {
  const digits = String(pin ?? "")
    .replace(/\D/g, "")
    .trim();
  if (digits.length < PIN_MIN_LENGTH || digits.length > PIN_MAX_LENGTH) return null;
  return digits;
};

/** ملح عشوائي (16 بايت) — من WebCrypto إن وُجد وإلا من Math.random. */
export const makeSalt = (): string => {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return toHex(bytes);
};

export const pinRecordSchema = z.object({
  salt: z.string().min(8),
  hash: z.string().min(32),
  updated_at: z.number(),
});
export type PinRecord = z.infer<typeof pinRecordSchema>;

/** يبني سجل بصمة PIN من رمز صريح. */
export const hashPin = async (pin: string, salt = makeSalt()): Promise<PinRecord | null> => {
  const normalized = normalizePin(pin);
  if (!normalized) return null;
  return {
    salt,
    hash: await sha256Hex(`msabka-pin:${salt}:${normalized}`),
    updated_at: Date.now(),
  };
};

/** تحقّق آمن من PIN مقابل السجل المحفوظ (مقارنة بطول ثابت لتقليل التوقيت الجانبي). */
export const verifyPinHash = async (pin: string, record: PinRecord): Promise<boolean> => {
  const normalized = normalizePin(pin);
  if (!normalized) return false;
  const candidate = await sha256Hex(`msabka-pin:${record.salt}:${normalized}`);
  if (candidate.length !== record.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ record.hash.charCodeAt(i);
  }
  return diff === 0;
};

// ============================================================
// الهوية المحفوظة والجلسة المحلية
// ============================================================

export const offlineIdentitySchema = z.object({
  user_id: z.string().min(1),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  saved_at: z.number(),
});
export type OfflineIdentity = z.infer<typeof offlineIdentitySchema>;

/**
 * وضع المالك الحالي للبيانات المحلية:
 *  - `cloud`:  جلسة Supabase حقيقية (متصل).
 *  - `offline`: جلسة محلية بهوية حساب معروف (غير متصل).
 *  - `device`: وضع الجهاز — بيانات محلية بلا حساب بعد.
 */
export const sessionModeSchema = z.enum(["cloud", "offline", "device"]);
export type SessionMode = z.infer<typeof sessionModeSchema>;

export const localSessionSchema = z.object({
  mode: sessionModeSchema,
  user_id: z.string().min(1),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  activated_at: z.number(),
  last_used_at: z.number(),
});
export type LocalSession = z.infer<typeof localSessionSchema>;

/** يبني جلسة محلية من هوية محفوظة (وضع offline). */
export const sessionFromIdentity = (identity: OfflineIdentity): LocalSession => {
  const now = Date.now();
  return {
    mode: "offline",
    user_id: identity.user_id,
    email: identity.email ?? null,
    name: identity.name ?? null,
    activated_at: now,
    last_used_at: now,
  };
};

/** يبني جلسة «وضع الجهاز» (بلا حساب). */
export const deviceSession = (): LocalSession => {
  const now = Date.now();
  return {
    mode: "device",
    user_id: DEVICE_OWNER_ID,
    email: null,
    name: null,
    activated_at: now,
    last_used_at: now,
  };
};

/** هل انتهت صلاحية الجلسة المحلية (تحتاج PIN من جديد)؟ */
export const isLocalSessionExpired = (
  session: LocalSession,
  now = Date.now(),
  ttlMs = LOCAL_SESSION_TTL_MS,
): boolean => now - (session.last_used_at || session.activated_at) > ttlMs;

/**
 * إعادة نسب صفوف البيانات من مالك محلي إلى حساب حقيقي (ربط الجهاز بالسحابة).
 * تُرجع الصفوف التي تغيّرت فعلاً فقط، حتى لا نلمس بقية الحسابات على الجهاز.
 */
export const reassignOwnedRows = <T extends OwnedRow>(
  rows: T[],
  fromUserId: string,
  toUserId: string,
): T[] => {
  if (fromUserId === toUserId) return [];
  return rows
    .filter((row) => row.user_id === fromUserId)
    .map((row) => ({ ...row, user_id: toUserId }));
};

/**
 * هل هذه الجلسة صالحة لفتح التطبيق بدون نت؟
 * يشترط: وجود هوية، وعدم انتهاء الصلاحية، وأن تكون الجلسة قد فُتحت صراحةً.
 */
export const canUseLocalSession = (session: LocalSession | null, now = Date.now()): boolean => {
  if (!session) return false;
  if (!session.user_id) return false;
  return !isLocalSessionExpired(session, now);
};
