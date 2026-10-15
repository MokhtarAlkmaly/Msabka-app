import { useCallback, useEffect, useState } from "react";
import {
  describeSyncStatus,
  readSyncStatus,
  subscribeConnection,
  type SyncStatus,
} from "@/utils/syncStatus";

/**
 * خطّاف حالة الاتصال والمزامنة.
 * يُحدَّث تلقائياً عند تغيّر الاتصال (online/offline) وعند الطلب (`refresh`).
 */
export const useSyncStatus = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  const refresh = useCallback(async () => {
    const next = await readSyncStatus().catch(() => null);
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeConnection((online) => {
      setStatus((current) => (current ? { ...current, online } : current));
      void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  return {
    status,
    refresh,
    online: status?.online ?? (typeof navigator !== "undefined" ? navigator.onLine : true),
    description: status ? describeSyncStatus(status) : "",
    pendingCount: status?.pendingCount ?? 0,
  };
};
