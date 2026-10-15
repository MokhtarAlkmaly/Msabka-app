/**
 * حالة الاتصال والمزامنة — مصدر واحد تقرأه كل الشارات واللوحات.
 *
 * يجمع:
 *  - حالة الاتصال الفعلية (`navigator.onLine` + مستمعا online/offline).
 *  - نمط المالك الحالي: سحابي / محلي بهوية محفوظة / وضع الجهاز.
 *  - عدد التغييرات المعلّقة في طابور الترحيل.
 *  - آخر مزامنة، وآخر ترحيل شامل، وآخر نسخة احتياطية.
 *  - أحجام الجداول المحلية (كم صفاً على الجهاز).
 */

import {
  getMetaTime,
  getPendingChanges,
  setMetaTime,
  getLocalRowCounts,
  SNAPSHOT_TABLES,
} from "./localDB";
import { getLocalOwnerId, isDeviceMode } from "./localAuth";
import type { SessionMode } from "@/lib/offline-auth";

export const META_LAST_MIGRATION = "lastFullMigration";
export const META_LAST_BACKUP = "lastBackup";

export type SyncStatus = {
  online: boolean;
  /** نمط الجلسة الحالية. */
  mode: SessionMode | "none";
  /** معرّف مالك البيانات المحلي (أو null إذا لم تُفتح جلسة). */
  ownerId: string | null;
  pendingCount: number;
  pendingDeletes: number;
  lastSyncAt: number | null;
  lastMigrationAt: number | null;
  lastBackupAt: number | null;
  counts: Record<string, number>;
  totalRows: number;
  /** هل يلزم PIN لفتح التطبيق بدون نت؟ */
  ready: boolean;
};

const isOnlineNow = () => typeof navigator !== "undefined" && navigator.onLine;

export const recordMigrationTime = () => setMetaTime(META_LAST_MIGRATION);
export const recordBackupTime = () => setMetaTime(META_LAST_BACKUP);

/** لقطة كاملة لحالة المزامنة (تُقرأ من SQLite — لذلك هي غير متزامنة). */
export const readSyncStatus = async (): Promise<SyncStatus> => {
  const [pending, ownerId, device, lastSync, lastMigration, lastBackup, counts] = await Promise.all(
    [
      getPendingChanges().catch(() => []),
      getLocalOwnerId().catch(() => null),
      isDeviceMode().catch(() => false),
      getMetaTime("lastSync").catch(() => null),
      getMetaTime(META_LAST_MIGRATION).catch(() => null),
      getMetaTime(META_LAST_BACKUP).catch(() => null),
      getLocalRowCounts(SNAPSHOT_TABLES).catch(() => ({}) as Record<string, number>),
    ],
  );

  const mode: SyncStatus["mode"] = device ? "device" : ownerId ? "offline" : "none";
  return {
    online: isOnlineNow(),
    mode,
    ownerId,
    pendingCount: pending.length,
    pendingDeletes: pending.filter((change) => change.op === "delete").length,
    lastSyncAt: lastSync,
    lastMigrationAt: lastMigration,
    lastBackupAt: lastBackup,
    counts,
    totalRows: Object.values(counts).reduce((sum, n) => sum + n, 0),
    ready: Boolean(ownerId),
  };
};

/** نص عربي قصير يصف الحالة — يُعرض في الشارات والتلميحات. */
export const describeSyncStatus = (status: SyncStatus): string => {
  if (!status.online) {
    return status.pendingCount > 0
      ? `بدون إنترنت — ${status.pendingCount} تغيير محفوظ على الجهاز بانتظار الترحيل`
      : "بدون إنترنت — تعمل على بيانات الجهاز";
  }
  if (status.mode === "device") return "متصل — جهاز بلا حساب (يلزم الربط قبل الترحيل)";
  if (status.pendingCount > 0) return `متصل — ${status.pendingCount} تغيير بانتظار الترحيل`;
  return "متصل — البيانات متزامنة";
};

type Listener = (online: boolean) => void;

/** اشتراك في تغيّر حالة الاتصال (يُستعمل في الخطافات). */
export const subscribeConnection = (listener: Listener): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const goOnline = () => listener(true);
  const goOffline = () => listener(false);
  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  return () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
  };
};

/** تنسيق طابع زمني بالعربية (تاريخ + وقت). */
export const formatTimestamp = (time: number | null): string => {
  if (!time) return "—";
  try {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(time));
  } catch {
    return new Date(time).toLocaleString();
  }
};
