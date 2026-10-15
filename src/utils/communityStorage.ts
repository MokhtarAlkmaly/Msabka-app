/**
 * سجل المجتمع — تخزين **محلي أولاً** (المرحلة 5).
 *
 * قبل هذه المرحلة كان كل شيء هنا سحابياً: أي محاولة حفظ بلا إنترنت ترمي
 * «يتطلب هذا السجل اتصالًا بالإنترنت». الآن:
 *
 *  1) القراءة من SQLite دائماً (تعمل بلا نت، وفورية).
 *  2) تحديث **محصور بالقسم المطلوب فقط** من السحابة عند الاتصال — لا تنزيل
 *     كامل لكل الأقسام عند فتح تبويب واحد. الصفوف ذات التعديل المعلّق محمية:
 *     لا تُستبدل ولا تُحذف حتى تُرفع.
 *  3) الكتابة محلية + `markDirty` + `queueCloudSync` — تعمل بلا نت وتُرفع
 *     لاحقاً من تلقاء نفسها.
 *  4) فشل السحابة (جدول غير موجود / صلاحية / انقطاع) **تحذير في الطرفية**،
 *     لا شاشة خطأ: البيانات محلية والعمل مستمر.
 *
 * استثناء واحد مقصود: **وضع الاطلاع** يبقى سحابياً (بيانات صاحب الحساب ليست
 * على جهازنا) والكتابة فيه مرفوضة. و«وضع الجهاز» لا يلمس السحابة إطلاقاً.
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/cloud-pages";
import type { CommunityDepartment } from "@/lib/center-programs";
import {
  communityRecordSchema,
  newCommunityRecordId,
  normalizeCommunityRecord,
  sortCommunityRecords,
  type CommunityRecord,
  type CommunityRecordInput,
  type CommunityRecordRow,
} from "@/lib/community-records";
import {
  deleteCachedCommunityRecord,
  getCachedCommunityRecord,
  getCachedCommunityRecordsForDepartment,
  putCachedCommunityRecord,
  replaceScopedRows,
} from "./localDB";
import {
  assertWritableOwner,
  canRefreshFromCloud,
  isViewingOtherUser,
  markLocalChange,
  pendingIdsFor,
  resolveOwnerId,
} from "./pendingIds";

const TABLE = "community_records";

/** تنزيل كل صفوف قسم واحد من السحابة (بلا اقتطاع عند 1000 صف). */
const fetchDepartmentFromCloud = async (
  ownerId: string,
  department: CommunityDepartment,
  signal?: AbortSignal,
): Promise<CommunityRecordRow[]> => {
  const rows = await fetchAllPages<CommunityRecord>(async (from, to) => {
    let query = supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", ownerId)
      .eq("department", department)
      .order("service_date", { ascending: false })
      .order("id")
      .range(from, to);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as CommunityRecord[];
  });
  return rows.map((row) => normalizeCommunityRecord(row));
};

/**
 * كل سجلات قسم واحد: محلية فوراً، ثم تحديث محصور من السحابة إن توفّر الاتصال.
 *
 * @param signal إلغاء اختياري (يُمرَّر من react-query عند إلغاء الطلب).
 */
export async function loadCommunityRecords(
  department: CommunityDepartment,
  signal?: AbortSignal,
): Promise<CommunityRecord[]> {
  const ownerId = await resolveOwnerId();

  // وضع الاطلاع: القراءة من السحابة مباشرة — بيانات المالك ليست على الجهاز.
  if (isViewingOtherUser()) {
    return sortCommunityRecords(await fetchDepartmentFromCloud(ownerId, department, signal));
  }

  let rows = await getCachedCommunityRecordsForDepartment(ownerId, department);

  if (canRefreshFromCloud(ownerId)) {
    try {
      const cloudRows = await fetchDepartmentFromCloud(ownerId, department, signal);
      const protectedIds = await pendingIdsFor("community_record");
      await replaceScopedRows<CommunityRecordRow>(
        TABLE,
        { user_id: ownerId, department },
        cloudRows,
        protectedIds,
      );
      rows = await getCachedCommunityRecordsForDepartment(ownerId, department);
    } catch (err) {
      // انقطاع أو جدول غير محدَّث: نكتفي بالبيانات المحلية (تحذير لا خطأ).
      console.warn("communityStorage: تعذّر تحديث سجل المجتمع من السحابة", err);
    }
  }

  return sortCommunityRecords(rows);
}

/** حفظ سجل (إضافة أو تعديل) — محلي أولاً ثم الرفع في الخلفية. */
export async function saveCommunityRecord(
  input: CommunityRecordInput,
  id: string | undefined,
  expectedUserId: string,
): Promise<CommunityRecord> {
  const ownerId = await assertWritableOwner(expectedUserId);
  const values = communityRecordSchema.parse(input);
  const stamp = new Date().toISOString();
  const recordId = id ?? newCommunityRecordId();
  const previous = id ? await getCachedCommunityRecord(id) : undefined;

  const record: CommunityRecordRow = {
    ...values,
    id: recordId,
    user_id: ownerId,
    created_at: previous?.created_at ?? stamp,
    updated_at: stamp,
    local_updated_at: stamp,
  };
  await putCachedCommunityRecord(record);
  await markLocalChange("community_record", "upsert", { id: recordId });
  return record;
}

/** حذف سجل — محلياً، والحذف السحابي يمرّ بالطابور. */
export async function deleteCommunityRecord(
  id: string,
  _department: CommunityDepartment,
  expectedUserId: string,
): Promise<{ id: string }> {
  await assertWritableOwner(expectedUserId);
  await deleteCachedCommunityRecord(id);
  await markLocalChange("community_record", "delete", { id });
  return { id };
}

export { communityErrorMessage } from "@/lib/community-records";
