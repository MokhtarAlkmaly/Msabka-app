import { supabase } from "@/integrations/supabase/client";
import { getViewAsId, isViewingOtherUser } from "./viewAs";
import {
  communityRecordSchema,
  type CommunityRecord,
  type CommunityRecordInput,
} from "@/lib/community-records";
import type { CommunityDepartment } from "@/lib/center-programs";

export function communityErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (["42P01", "PGRST205", "42703", "PGRST204"].includes(code ?? "")) {
    return "قاعدة البيانات تحتاج تحديثًا: طبّق ملف 20261015100000_community_records.sql ثم أعد المحاولة.";
  }
  if (code === "42501") return "ليست لديك صلاحية لهذه العملية. تحقق من الحساب وإذن الاطلاع.";
  return "تعذرت العملية. تحقق من اتصال الإنترنت والصلاحيات ثم أعد المحاولة. لم يتم تأكيد الحفظ.";
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("يلزم تسجيل الدخول");
  return data.session.user.id;
}
function requireConnection() {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new Error("يتطلب هذا السجل اتصالًا بالإنترنت");
}
async function writableUserId(expectedUserId: string) {
  requireConnection();
  if (isViewingOtherUser()) throw new Error("وضع الاطلاع للقراءة فقط");
  const id = await currentUserId();
  if (isViewingOtherUser() || id !== expectedUserId)
    throw new Error("تغيّر الحساب؛ أعد فتح الصفحة");
  return id;
}

export async function loadCommunityRecords(
  department: CommunityDepartment,
  signal?: AbortSignal,
): Promise<CommunityRecord[]> {
  requireConnection();
  const owner = getViewAsId() ?? (await currentUserId());
  const rows: CommunityRecord[] = [];
  // Supabase caps each response at 1000 rows; never silently truncate the registry.
  for (let offset = 0; ; offset += 500) {
    let query = supabase
      .from("community_records")
      .select("*")
      .eq("user_id", owner)
      .eq("department", department)
      .order("service_date", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows;
}

export async function saveCommunityRecord(
  input: CommunityRecordInput,
  id: string | undefined,
  expectedUserId: string,
): Promise<CommunityRecord> {
  const values = communityRecordSchema.parse(input);
  const user_id = await writableUserId(expectedUserId);
  // Updates do not use upsert: a deleted/missing record must not be recreated.
  const query = id
    ? supabase
        .from("community_records")
        .update(values)
        .eq("id", id)
        .eq("user_id", user_id)
        .eq("department", values.department)
    : supabase.from("community_records").insert({ ...values, user_id });
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteCommunityRecord(
  id: string,
  department: CommunityDepartment,
  expectedUserId: string,
) {
  const owner = await writableUserId(expectedUserId);
  const { data, error } = await supabase
    .from("community_records")
    .delete()
    .eq("id", id)
    .eq("user_id", owner)
    .eq("department", department)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
