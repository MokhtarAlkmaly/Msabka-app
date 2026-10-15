/**
 * النسخ الاحتياطي الظاهر — «الطريقة أ» من خطة العمل بدون إنترنت.
 *
 * القاعدة الحيّة تبقى في ذاكرة التطبيق (الأسرع والأأمن)، وهذه الوحدة تضيف:
 *  1. **لقطة JSON شاملة** لكل الجداول (مقروءة، قابلة للنقل بين الأجهزة).
 *  2. **نسخة ملف قاعدة بيانات حقيقية** (`.db`) عبر `VACUUM INTO` (أندرويد).
 *  3. حفظها في مجلد ظاهر: `Documents/Msabka/` على ذاكرة الهاتف، مع خيار
 *     «حفظ في مكان آخر» عبر مشاركة النظام (يصل إلى بطاقة الميموري أو Drive).
 *  4. الاستعادة من أي ملف يلتقطه المستخدم (JSON أو `.db`) من أي مجلد.
 *
 * ملاحظات المنصة:
 *  - أندرويد 11+: التطبيق يكتب/يقرأ ملفاته التي أنشأها في `Documents` بلا إذن
 *    خاص، ونطلب الإذن فقط للأجهزة الأقدم (حتى API 28).
 *  - المتصفح: لا يوجد نظام ملفات → ننزّل الملف كتنزيل عادي، والاستعادة عبر
 *    مُنتقي الملفات نفسه.
 */

import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import {
  getDB,
  persistNow,
  isNativePlatform,
  exportDatabaseFile,
  importDatabaseFile,
} from "./sqliteClient";
import {
  getTableRows,
  replaceTableRows,
  getLocalRowCounts,
  getTablePk,
  isKnownTable,
  SNAPSHOT_TABLES,
  SNAPSHOT_INTERNAL_TABLES,
} from "./localDB";
import { getDeviceId, getLocalOwnerId } from "./localAuth";
import { recordBackupTime } from "./syncStatus";
import {
  buildSnapshot,
  dbFileName,
  mergeTableRows,
  parseSnapshot,
  snapshotFileName,
  type DbSnapshot,
  type MergeOutcome,
  type MergeStrategy,
  type ParseResult,
  type SnapshotRow,
} from "@/lib/db-snapshot";

/** اسم المجلد الظاهر الذي تُحفظ فيه النسخ. */
export const BACKUP_FOLDER = "Msabka";

const ALL_SNAPSHOT_TABLES = [...SNAPSHOT_TABLES, ...SNAPSHOT_INTERNAL_TABLES];

export type SaveResult = {
  fileName: string;
  /** المسار داخل التخزين (نسبي للمجلد المختار). */
  path: string;
  /** وصف عربي لمكان الحفظ يُعرض للمستخدم. */
  locationLabel: string;
  /** رابط يمكن مشاركته/فتحه (file:// على الجهاز). */
  uri: string | null;
  bytes: number;
};

export type BackupFileInfo = {
  name: string;
  size: number;
  modifiedAt: number | null;
  kind: "json" | "db" | "other";
};

/** نتيجة استعادة جدول واحد. */
export type RestoredTable = {
  table: string;
  /** عدد الصفوف التي صارت في الجدول بعد الاستعادة. */
  written: number;
  inserted: number;
  updated: number;
  keptLocal: number;
  conflicts: number;
};

export type RestoreReport = {
  strategy: MergeStrategy;
  tables: RestoredTable[];
  totals: { inserted: number; updated: number; keptLocal: number; conflicts: number };
};

const assertBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("النسخ الاحتياطي متاح داخل التطبيق/المتصفح فقط (client-side).");
  }
};

// ============================================================
// بناء اللقطة وقراءتها
// ============================================================

/** يبني لقطة JSON شاملة من القاعدة المحلية الحالية. */
export const createSnapshot = async (): Promise<DbSnapshot> => {
  assertBrowser();
  await persistNow();
  const tables: Record<string, SnapshotRow[]> = {};
  for (const table of ALL_SNAPSHOT_TABLES) {
    tables[table] = (await getTableRows<SnapshotRow>(table)) as SnapshotRow[];
  }
  const [deviceId, ownerId] = await Promise.all([getDeviceId(), getLocalOwnerId()]);
  return buildSnapshot(tables, { deviceId, ownerId });
};

/** يقرأ نص ملف نسخة ويتحقق من صلاحيته. */
export const readSnapshotText = (text: string): ParseResult => parseSnapshot(text);

/**
 * استعادة لقطة إلى القاعدة المحلية.
 * مع `replace` تُمسح الجداول المشمولة أولاً؛ ومع سياسات الدمج يُقارن صف بصف.
 */
export const restoreSnapshot = async (
  snapshot: DbSnapshot,
  strategy: MergeStrategy = "merge-newest",
): Promise<RestoreReport> => {
  assertBrowser();
  await persistNow();

  const tables: RestoredTable[] = [];
  const totals = { inserted: 0, updated: 0, keptLocal: 0, conflicts: 0 };

  for (const [tableName, incoming] of Object.entries(snapshot.tables)) {
    if (!isKnownTable(tableName)) continue;
    if (!ALL_SNAPSHOT_TABLES.includes(tableName)) continue;

    const pk = getTablePk(tableName);
    const local = strategy === "replace" ? [] : await getTableRows<SnapshotRow>(tableName);
    const outcome = mergeTableRows(local, (incoming ?? []) as SnapshotRow[], pk, strategy);

    await replaceTableRows(tableName, outcome.rows);
    totals.inserted += outcome.inserted;
    totals.updated += outcome.updated;
    totals.keptLocal += outcome.keptLocal;
    totals.conflicts += outcome.conflicts;
    tables.push({
      table: tableName,
      written: outcome.rows.length,
      inserted: outcome.inserted,
      updated: outcome.updated,
      keptLocal: outcome.keptLocal,
      conflicts: outcome.conflicts,
    });
  }

  await persistNow();
  return { strategy, tables, totals };
};

// ============================================================
// كتابة الملفات على الجهاز
// ============================================================

const directoryCandidates: { directory: Directory; label: string }[] = [
  { directory: Directory.Documents, label: `مجلد المستندات (Documents/${BACKUP_FOLDER})` },
  { directory: Directory.External, label: `ذاكرة التطبيق الخارجية (${BACKUP_FOLDER})` },
  { directory: Directory.Data, label: `ذاكرة التطبيق الداخلية (${BACKUP_FOLDER})` },
];

/** يطلب إذن التخزين للأجهزة القديمة (لا يؤثر على أندرويد 11+). */
const ensureStoragePermission = async (): Promise<void> => {
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === "granted" || status.publicStorage === "prompt") {
      if (status.publicStorage !== "granted") await Filesystem.requestPermissions();
    }
  } catch {
    // بعض المنصات لا تدعم الاستعلام — نكمل ونعتمد على الارتداد بين المجلدات.
  }
};

const ensureFolder = async (directory: Directory): Promise<void> => {
  try {
    await Filesystem.mkdir({ path: BACKUP_FOLDER, directory, recursive: true });
  } catch {
    // المجلد موجود غالباً — الخطأ هنا غير قاتل.
  }
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

/** تنزيل ملف في المتصفح (لا يوجد نظام ملفات متاح في الويب). */
const downloadInBrowser = (fileName: string, data: string | Blob): SaveResult => {
  const blob = typeof data === "string" ? new Blob([data], { type: "application/json" }) : data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return {
    fileName,
    path: fileName,
    locationLabel: "تنزيلات المتصفح",
    uri: url,
    bytes: blob.size,
  };
};

/** يكتب نصاً في أول مجلد يسمح به الجهاز، ويرجع مكان الحفظ الفعلي. */
const writeTextToVisibleFolder = async (fileName: string, content: string): Promise<SaveResult> => {
  if (!(await isNativePlatform())) return downloadInBrowser(fileName, content);

  await ensureStoragePermission();
  let lastError: unknown = null;

  for (const candidate of directoryCandidates) {
    try {
      await ensureFolder(candidate.directory);
      const path = `${BACKUP_FOLDER}/${fileName}`;
      await Filesystem.writeFile({
        path,
        data: content,
        directory: candidate.directory,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      const uri = await Filesystem.getUri({ path, directory: candidate.directory }).catch(
        () => null,
      );
      return {
        fileName,
        path,
        locationLabel: candidate.label,
        uri: uri?.uri ?? null,
        bytes: new Blob([content]).size,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `تعذّر حفظ النسخة في أي مجلد متاح: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
};

// ============================================================
// واجهات الحفظ والاستعادة
// ============================================================

/** يحفظ لقطة JSON في مجلد ظاهر. */
export const saveSnapshotToFile = async (snapshot?: DbSnapshot): Promise<SaveResult> => {
  const data = snapshot ?? (await createSnapshot());
  const ownerId = data.owner_id ?? (await getLocalOwnerId());
  const fileName = snapshotFileName(new Date(), ownerId);
  const result = await writeTextToVisibleFolder(fileName, JSON.stringify(data));
  await recordBackupTime().catch(() => undefined);
  return result;
};

/**
 * نسخة `.db` طبق الأصل من ملف القاعدة (أندرويد/iOS).
 * تُنفَّذ عبر `VACUUM INTO` فتُنتج قاعدة سليمة ومضغوطة بلا معاملات عالقة.
 */
export const saveDatabaseFileCopy = async (): Promise<SaveResult> => {
  assertBrowser();
  if (!(await isNativePlatform())) {
    throw new Error("نسخ ملف القاعدة (.db) متاح في تطبيق أندرويد — في المتصفح استخدم لقطة JSON.");
  }
  await persistNow();

  const fileName = dbFileName(new Date());
  // VACUUM INTO يحتاج مساراً حقيقياً على نظام الملفات، لا رابط file:// ولا
  // Directory مجرداً — لذلك نحلّ المسار أولاً ثم ننفّذ الأمر.
  const target = await resolveWritablePath(fileName);
  await exportDatabaseFile(target.absolutePath);
  const bytes = await fileSize(target.relativePath, target.directory).catch(() => 0);
  await recordBackupTime().catch(() => undefined);

  return {
    fileName,
    path: target.relativePath,
    locationLabel: target.locationLabel,
    uri: target.uri,
    bytes,
  };
};

type ResolvedPath = {
  absolutePath: string;
  relativePath: string;
  directory: Directory;
  locationLabel: string;
  uri: string | null;
};

/** يوجد مساراً حقيقياً قابلاً للكتابة (يُستعمل لأوامر SQLite التي لا تعرف Directory). */
const resolveWritablePath = async (fileName: string): Promise<ResolvedPath> => {
  await ensureStoragePermission();
  let lastError: unknown = null;

  for (const candidate of directoryCandidates) {
    try {
      await ensureFolder(candidate.directory);
      const relativePath = `${BACKUP_FOLDER}/${fileName}`;
      const uriResult = await Filesystem.getUri({
        path: relativePath,
        directory: candidate.directory,
      });
      const absolutePath = uriResult.uri.replace(/^file:\/\//, "");
      return {
        absolutePath,
        relativePath,
        directory: candidate.directory,
        locationLabel: candidate.label,
        uri: uriResult.uri,
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `تعذّر إيجاد مجلد قابل للكتابة: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
};

const fileSize = async (path: string, directory: Directory): Promise<number> => {
  const stat = await Filesystem.stat({ path, directory });
  return Number(stat.size ?? 0);
};

/** قائمة النسخ المحفوظة في مجلد النسخ (إن وُجد). */
export const listBackupFiles = async (): Promise<BackupFileInfo[]> => {
  assertBrowser();
  if (!(await isNativePlatform())) return [];
  const out: BackupFileInfo[] = [];

  for (const candidate of directoryCandidates) {
    try {
      const result = await Filesystem.readdir({
        path: BACKUP_FOLDER,
        directory: candidate.directory,
      });
      for (const entry of result.files) {
        const name = typeof entry === "string" ? entry : entry.name;
        const size = typeof entry === "string" ? 0 : Number(entry.size ?? 0);
        const mtime =
          typeof entry === "string" || !entry.mtime ? null : new Date(entry.mtime).getTime();
        out.push({
          name,
          size,
          modifiedAt: mtime,
          kind: name.endsWith(".json") ? "json" : name.endsWith(".db") ? "db" : "other",
        });
      }
      if (out.length > 0) break; // أول مجلد موجود يكفي
    } catch {
      // المجلد غير موجود في هذه الوجهة — نجرب التالية.
    }
  }

  return out.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
};

export type PickedFile =
  { name: string; kind: "json"; text: string } | { name: string; kind: "db"; bytes: Uint8Array };

/**
 * يلتقط ملف نسخة من أي مجلد (بما فيه بطاقة الميموري) عبر مُنتقي الملفات.
 * يعمل في المتصفح وفي WebView أندرويد بنفس الآلية المستعملة لاستيراد Excel.
 */
export const pickBackupFile = (): Promise<PickedFile | null> => {
  assertBrowser();
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.db,application/json,application/octet-stream";
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => input.remove();
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };
    input.onchange = async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return resolve(null);
      try {
        const buffer = new Uint8Array(await file.arrayBuffer());
        if (file.name.toLowerCase().endsWith(".db")) {
          resolve({ name: file.name, kind: "db", bytes: buffer });
        } else {
          resolve({ name: file.name, kind: "json", text: new TextDecoder("utf-8").decode(buffer) });
        }
      } catch (err) {
        console.error("تعذّرت قراءة الملف:", err);
        resolve(null);
      }
    };
    input.click();
  });
};

/**
 * يستعيد من ملف التقطه المستخدم: JSON عبر الدمج، أو `.db` عبر ربطه كقاعدة
 * قراءة ونسخ جداوله (أندرويد فقط).
 */
export const restoreFromPickedFile = async (
  file: PickedFile,
  strategy: MergeStrategy = "merge-newest",
): Promise<RestoreReport> => {
  if (file.kind === "json") {
    const parsed = parseSnapshot(file.text);
    if (!parsed.ok) throw new Error(parsed.error);
    return restoreSnapshot(parsed.snapshot, strategy);
  }

  if (!(await isNativePlatform())) {
    throw new Error("استعادة ملف قاعدة بيانات (.db) مدعومة في تطبيق أندرويد فقط.");
  }

  // ننسخ الملف الملتقط إلى ذاكرة التطبيق ثم نربطه — ATTACH يحتاج مساراً حقيقياً.
  const stagingPath = `${BACKUP_FOLDER}/restore-${Date.now()}.db`;
  await ensureFolder(Directory.Data);
  await Filesystem.writeFile({
    path: stagingPath,
    data: toBase64(file.bytes),
    directory: Directory.Data,
    recursive: true,
  });
  const uri = await Filesystem.getUri({ path: stagingPath, directory: Directory.Data });
  const absolute = uri.uri.replace(/^file:\/\//, "");

  try {
    await persistNow();
    await importDatabaseFile(
      absolute,
      ALL_SNAPSHOT_TABLES,
      strategy === "replace" ? "replace" : "merge",
    );
    // بعد الاستعادة الثنائية نطبّق سياسة الدمج على اللقطة الناتجة إن لزم.
    const counts = await getLocalRowCounts(SNAPSHOT_TABLES);
    return {
      strategy,
      tables: Object.entries(counts).map(([table, rows]) => ({
        table,
        written: rows,
        inserted: rows,
        updated: 0,
        keptLocal: 0,
        conflicts: 0,
      })),
      totals: {
        inserted: Object.values(counts).reduce((sum, n) => sum + n, 0),
        updated: 0,
        keptLocal: 0,
        conflicts: 0,
      },
    };
  } finally {
    await Filesystem.deleteFile({ path: stagingPath, directory: Directory.Data }).catch(
      () => undefined,
    );
  }
};

/** يشارك ملف نسخة عبر نظام أندرويد (حفظ في Files/الميموري/Drive/واتساب…). */
export const shareSavedFile = async (result: SaveResult, title: string): Promise<boolean> => {
  if (!(await isNativePlatform()) || !result.uri) return false;
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, files: [result.uri], dialogTitle: title });
    return true;
  } catch (err) {
    console.warn("تعذّرت مشاركة الملف:", err);
    return false;
  }
};

/**
 * نسخة أمان تلقائية قبل أي عملية خطيرة (ترحيل شامل / استعادة / مسح).
 * تُكتب في مجلد النسخ ولا تُعرض للمستخدم إلا عند الفشل.
 */
export const createSafetySnapshot = async (): Promise<SaveResult | null> => {
  try {
    const snapshot = await createSnapshot();
    const fileName = `auto-${snapshotFileName(new Date(), snapshot.owner_id)}`;
    const result = await writeTextToVisibleFolder(fileName, JSON.stringify(snapshot));
    await recordBackupTime().catch(() => undefined);
    return result;
  } catch (err) {
    console.warn("تعذّر إنشاء نسخة الأمان التلقائية:", err);
    return null;
  }
};

/** عدد صفوف الجداول المحلية — يُعرض في لوحة حالة المزامنة. */
export const getLocalCounts = () => getLocalRowCounts(ALL_SNAPSHOT_TABLES);

/** يضمن أن اتصال القاعدة مفتوح (يُستعمل قبل عمليات النسخ من الواجهات). */
export const ensureDatabaseReady = async () => {
  assertBrowser();
  await getDB();
  await persistNow();
};
