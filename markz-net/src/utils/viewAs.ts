/**
 * حالة "الاطلاع على بيانات مستخدم آخر".
 *
 * عندما يمنح المسؤول أحد المستخدمين إذن الاطلاع، يستطيع ذلك المستخدم تشغيل
 * وضع العرض. عندها تتعامل كل طبقة التخزين مع بيانات المالك بدل بياناته هو،
 * لكن في وضع "قراءة فقط" — كل عمليات الكتابة معطّلة.
 *
 * تُحفظ الحالة في localStorage لأن `storage.ts` يحتاج قراءتها بشكل متزامن.
 */

export interface ViewAsTarget {
  id: string;
  name: string;
  email: string | null;
}

// مفتاح خاص بهذه النسخة (net.markz.app) — لا يشترك مع تطبيق «مركز إنماء».
const STORAGE_KEY = "markznet.viewAs";

let cached: ViewAsTarget | null | undefined;
const listeners = new Set<(target: ViewAsTarget | null) => void>();

const read = (): ViewAsTarget | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewAsTarget;
    return parsed && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
};

/** الهدف المعروض حالياً، أو null عند العمل على البيانات الخاصة. */
export const getViewAs = (): ViewAsTarget | null => {
  if (typeof window === "undefined") return null;
  if (cached === undefined) cached = read();
  return cached;
};

/** معرّف صاحب البيانات المعروضة، أو null. */
export const getViewAsId = (): string | null => getViewAs()?.id ?? null;

/** هل نحن في وضع الاطلاع (قراءة فقط) على بيانات شخص آخر؟ */
export const isViewingOtherUser = (): boolean => getViewAsId() !== null;

export const setViewAs = (target: ViewAsTarget | null) => {
  if (typeof window === "undefined") return;
  cached = target;
  try {
    if (target) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* التخزين ممتلئ أو محظور — الحالة في الذاكرة تكفي للجلسة الحالية */
  }
  listeners.forEach((fn) => fn(target));
};

export const subscribeViewAs = (fn: (target: ViewAsTarget | null) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
