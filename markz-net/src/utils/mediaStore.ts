/**
 * مخزن ملفات الوسائط المحلي (markz-net) — بديل كامل عن Supabase Storage.
 *
 * الملفات (صور/فيديوهات) تُخزَّن كـ Blob داخل IndexedDB الخاص بالمتصفح
 * (أو WebView أندرويد)، والمسارات في جدول media تشير إلى مفاتيح هذا المخزن.
 * لا يخرج أي ملف من الجهاز، ويعمل بلا إنترنت تمامًا.
 */

const DB_NAME = "markznet_media";
const STORE_NAME = "files";

let dbPromise: Promise<IDBDatabase> | null = null;

const openMediaDB = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB غير متاح في هذه البيئة"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("تعذّر فتح مخزن الوسائط"));
    };
  });
  return dbPromise;
};

/** حفظ ملف تحت مفتاح محدد وإرجاع المفتاح. */
export const putMediaFile = async (key: string, file: Blob): Promise<string> => {
  const db = await openMediaDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("تعذّر حفظ الملف"));
    tx.onabort = () => reject(tx.error ?? new Error("أُلغيت عملية الحفظ"));
  });
  return key;
};

/** توليد مفتاح جديد لملف. */
export const makeMediaKey = (userId: string, ext: string) =>
  `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

/** قراءة ملف وإرجاع رابط كائن محلي قابل للعرض، أو null. */
export const getMediaObjectUrl = async (key: string): Promise<string | null> => {
  try {
    const db = await openMediaDB();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

/** قراءة عدة مفاتيح دفعة واحدة وإرجاع خريطة روابط كائنات. */
export const getMediaObjectUrls = async (keys: string[]): Promise<Record<string, string>> => {
  const map: Record<string, string> = {};
  await Promise.all(
    Array.from(new Set(keys)).map(async (key) => {
      const url = await getMediaObjectUrl(key);
      if (url) map[key] = url;
    }),
  );
  return map;
};

/** حذف ملف واحد. */
export const deleteMediaFile = async (key: string): Promise<void> => {
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* تجاهل — الحذف أفضل جهد */
  }
};

/** حذف عدة ملفات. */
export const deleteMediaFiles = async (keys: string[]): Promise<void> => {
  await Promise.all(keys.filter(Boolean).map((key) => deleteMediaFile(key)));
};
