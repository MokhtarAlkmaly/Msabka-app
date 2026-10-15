import { supabase } from "@/integrations/supabase/client";
import { queryRaw, runRawSql, persistNow } from "./sqliteClient";
import { getCachedMediaItem, putCachedMedia } from "./localDB";

// Base64 is portable across native and web SQLite, including JSON/DB backups.
// A bounded file size avoids exhausting the web SQLite/WASM heap.
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
export const validateMediaFile = (file: Blob) => {
  if (!/^(image|video)\//.test(file.type)) throw new Error("نوع ملف غير مدعوم");
  if (file.size > MAX_MEDIA_BYTES) throw new Error("الحد الأقصى للملف 20 ميجابايت");
};

export const saveMediaFile = async (id: string, file: Blob) => {
  validateMediaFile(file);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
  await runRawSql("INSERT OR REPLACE INTO media_files (id, mime_type, data) VALUES (?, ?, ?)", [
    id,
    file.type,
    data,
  ]);
  await persistNow(true);
};

export const readMediaFile = async (id: string): Promise<Blob | null> => {
  const [row] = await queryRaw("SELECT mime_type, data FROM media_files WHERE id = ?", [id]);
  if (!row) return null;
  const bytes = Uint8Array.from(atob(String(row.data)), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: String(row.mime_type) });
};

export const removeMediaFile = async (id: string) => {
  await runRawSql("DELETE FROM media_files WHERE id = ?", [id]);
  await persistNow(true);
};

/** Upload before metadata; retries use the same path, including after device linking. */
export const ownedMediaPath = (path: string, ownerId: string) =>
  `${ownerId}/${path.split("/").slice(1).join("/")}`;

export const uploadMediaFile = async (id: string, ownerId: string) => {
  const row = await getCachedMediaItem(id);
  if (!row) throw new Error("لم يعد سجل الوسائط موجوداً");
  const blob = await readMediaFile(id);
  if (!blob) return; // Legacy/cloud-only metadata has no local binary.
  const path = ownedMediaPath(row.file_path, ownerId);
  const { error } = await supabase.storage.from("media").upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  });
  if (error) throw error;
  const current = await getCachedMediaItem(id);
  if (current && path !== current.file_path && current.file_path === row.file_path) {
    await putCachedMedia({ ...current, file_path: path });
  }
};

/** Cloud downloads are bounded and authenticated, never cached by the service worker. */
export const mediaObjectUrl = async (
  id: string,
  path: string,
  fileSize = 0,
): Promise<string | null> => {
  // Existing large cloud videos remain playable online without loading them into SQLite.
  if (fileSize > MAX_MEDIA_BYTES) {
    if (!navigator.onLine) return null;
    const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 3600);
    return error ? null : (data?.signedUrl ?? null);
  }
  let blob = await readMediaFile(id);
  if (!blob && navigator.onLine) {
    const { data, error } = await supabase.storage.from("media").download(path);
    if (error || !data) return null;
    validateMediaFile(data);
    await saveMediaFile(id, data);
    blob = data;
  }
  return blob ? URL.createObjectURL(blob) : null;
};
