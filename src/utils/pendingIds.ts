/**
 * أدوات مشتركة لطبقات التخزين «محلية أولاً» (سجل المجتمع وبنك الأسئلة).
 *
 * القواعد الثلاث التي تحكم المرحلة 5 في مكان واحد:
 *  1) **وضع الاطلاع** (view-as) للقراءة فقط: القراءة من السحابة (بيانات صاحب
 *     الحساب ليست على جهازنا)، وكل كتابة مرفوضة.
 *  2) **«وضع الجهاز»** (بلا حساب) لا يلمس السحابة إطلاقاً — البيانات محلية
 *     بحتة حتى يُربط الجهاز بحساب.
 *  3) أي كتابة محلية تُسجَّل في طابور التغييرات (`markDirty`) ثم تُجدول
 *     المزامنة (`queueCloudSync`) التي تصمت تماماً عند انقطاع النت.
 */

import { supabase } from "@/integrations/supabase/client";
import { DEVICE_OWNER_ID } from "@/lib/offline-auth";
import { getPendingChanges, markDirty, type PendingEntity, type PendingOp } from "./localDB";
import { getViewAsId, isViewingOtherUser } from "./viewAs";
import { queueCloudSync } from "./storage";

export { isViewingOtherUser };

/** هل الجهاز متصل؟ (نفس تعريف `storage.ts`). */
export const isOnline = (): boolean =>
  typeof navigator === "undefined" || navigator.onLine !== false;

/** معرّف المستخدم من جلسة Supabase، أو خطأ عربي عند عدم الدخول. */
export const sessionUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("يلزم تسجيل الدخول");
  return data.session.user.id;
};

/**
 * مالك البيانات المعروضة: معرّف صاحب الحساب في وضع الاطلاع، وإلا معرّف
 * الجلسة الحالية.
 */
export const resolveOwnerId = async (): Promise<string> => getViewAsId() ?? (await sessionUserId());

/** هل هذا المالك «وضع جهاز» (بيانات بلا حساب)؟ */
export const isDeviceOwner = (userId: string | null | undefined): boolean =>
  userId === DEVICE_OWNER_ID;

/**
 * هل يجوز لهذه العملية أن تقرأ من السحابة؟
 *
 *  - لا في وضع الجهاز (لا حساب، ولا صلاحيات سحابية).
 *  - لا عند انقطاع الاتصال (فشل القراءة ليس خطأً، بل تخطّي).
 */
export const canRefreshFromCloud = (ownerId: string | null | undefined): boolean =>
  Boolean(ownerId) && !isDeviceOwner(ownerId) && isOnline();

/**
 * يتحقق أن الكتابة مسموحة ويرجع مالكها.
 *
 * @throws «وضع الاطلاع للقراءة فقط» أو «تغيّر الحساب؛ أعد فتح الصفحة».
 */
export const assertWritableOwner = async (expectedUserId?: string): Promise<string> => {
  if (isViewingOtherUser()) throw new Error("وضع الاطلاع للقراءة فقط");
  const id = await sessionUserId();
  if (isViewingOtherUser() || (expectedUserId && id !== expectedUserId))
    throw new Error("تغيّر الحساب؛ أعد فتح الصفحة");
  return id;
};

/**
 * معرّفات الصفوف ذات التعديل المعلّق لكيان واحد — تُستعمل لحماية الصفوف
 * المحلية أثناء التحديث المحصور القادم من السحابة (لا نطمس ما لم يُرفع بعد).
 */
export const pendingIdsFor = async (entity: PendingEntity): Promise<Set<string>> => {
  const pending = await getPendingChanges();
  const ids = new Set<string>();
  for (const change of pending) {
    if (change.entity !== entity) continue;
    const id = change.ref?.id;
    if (typeof id === "string" && id) ids.add(id);
  }
  return ids;
};

/**
 * يسجّل تغييراً محلياً في الطابور ويُجدول الرفع.
 * الفشل في الطابور لا يمنع نجاح الكتابة المحلية (البيانات محفوظة على أي حال).
 */
export const markLocalChange = async (
  entity: PendingEntity,
  op: PendingOp,
  ref: { id: string },
): Promise<void> => {
  try {
    await markDirty(entity, op, ref);
  } catch (err) {
    console.error("pendingIds: تعذّر تسجيل التغيير في الطابور", err);
  }
  queueCloudSync();
};
