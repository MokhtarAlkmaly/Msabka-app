/**
 * لقطة قاعدة البيانات المحلية (Snapshot) — منطق نقي بلا متصفح ولا SQLite.
 *
 * تُستعمل في:
 *  1. النسخ الاحتياطي الظاهر في مجلد على الهاتف/بطاقة الميموري (ملف JSON).
 *  2. الاستعادة من نسخة (استيراد الملف إلى القاعدة المحلية).
 *  3. الترحيل الشامل إلى السحابة (نفس اللقطة تُقرأ وتُرفع دفعة واحدة).
 *
 * كل الدوال هنا نقية وقابلة للاختبار: `npm run test:offline`.
 */

import { z } from "zod";

export const SNAPSHOT_KIND = "msabka-snapshot";
export const SNAPSHOT_VERSION = 1;

/** صف عام: أعمدة JSON بسيطة (SQLite يرجعها كذلك). */
export type SnapshotRow = Record<string, string | number | boolean | null>;

export const snapshotSchema = z.object({
  kind: z.literal(SNAPSHOT_KIND),
  version: z.number().int().positive(),
  exported_at: z.string(),
  device_id: z.string().optional().nullable(),
  owner_id: z.string().optional().nullable(),
  counts: z.record(z.number()).optional(),
  // الجدول غير مُقيَّد بأسماء محددة: السكيمة تتطور، والملفات القديمة يجب أن تُقرأ.
  tables: z.record(z.array(z.record(z.unknown()))),
});

export type DbSnapshot = {
  kind: typeof SNAPSHOT_KIND;
  version: number;
  exported_at: string;
  device_id: string | null;
  owner_id: string | null;
  counts: Record<string, number>;
  tables: Record<string, SnapshotRow[]>;
};

export type SnapshotMeta = {
  deviceId?: string | null;
  ownerId?: string | null;
  exportedAt?: Date | string | null;
};

/** يبني لقطة من صفوف الجداول، مع حساب العدد لكل جدول. */
export const buildSnapshot = (
  tables: Record<string, SnapshotRow[]>,
  meta: SnapshotMeta = {},
): DbSnapshot => {
  const counts: Record<string, number> = {};
  for (const [name, rows] of Object.entries(tables)) counts[name] = rows.length;
  const exportedAt = meta.exportedAt ? new Date(meta.exportedAt) : new Date();
  return {
    kind: SNAPSHOT_KIND,
    version: SNAPSHOT_VERSION,
    exported_at: exportedAt.toISOString(),
    device_id: meta.deviceId ?? null,
    owner_id: meta.ownerId ?? null,
    counts,
    tables,
  };
};

export type ParseResult =
  { ok: true; snapshot: DbSnapshot; warnings: string[] } | { ok: false; error: string };

/** يقرأ نص ملف ويتحقّق أنه لقطة صالحة (رسائل الأخطاء بالعربية للمستخدم). */
export const parseSnapshot = (text: string): ParseResult => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "الملف ليس بصيغة JSON صالحة." };
  }

  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) {
    // نتسامح مع الملفات المصدَّرة من أدوات أخرى إذا احتوت جداول فقط.
    const loose = raw as { tables?: unknown; students?: unknown };
    if (loose && typeof loose === "object" && loose.tables && typeof loose.tables === "object") {
      const asSnapshot: DbSnapshot = {
        kind: SNAPSHOT_KIND,
        version: SNAPSHOT_VERSION,
        exported_at: new Date().toISOString(),
        device_id: null,
        owner_id: null,
        counts: {},
        tables: loose.tables as Record<string, SnapshotRow[]>,
      };
      return {
        ok: true,
        snapshot: asSnapshot,
        warnings: ["الملف لا يحتوي ترويسة كاملة — قُبل كلقطة جداول فقط."],
      };
    }
    if (loose && Array.isArray(loose.students)) {
      return {
        ok: false,
        error: "هذا ملف تصدير طلاب (Excel/JSON قديم) وليس نسخة قاعدة بيانات كاملة.",
      };
    }
    return { ok: false, error: "بنية الملف غير معروفة — تأكد أنه نسخة من هذا التطبيق." };
  }

  const snapshot = parsed.data as unknown as DbSnapshot;
  const warnings: string[] = [];
  if (snapshot.version > SNAPSHOT_VERSION) {
    warnings.push(
      `النسخة أحدث من إصدار التطبيق (v${snapshot.version}) — ستُستورد الجداول المعروفة فقط.`,
    );
  }
  return { ok: true, snapshot, warnings };
};

/** أسماء الجداول الموجودة في اللقطة مرتبة أبجدياً. */
export const listSnapshotTables = (snapshot: DbSnapshot): string[] =>
  Object.keys(snapshot.tables).sort();

/** عدد الصفوف الكلي في اللقطة. */
export const snapshotRowCount = (snapshot: DbSnapshot): number =>
  Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0);

/**
 * ملخّص عربي جاهز للعرض: «الطلاب: 120 صفًا» …
 * يُستعمل في شاشة الاستعادة قبل التأكيد (حتى يعرف المستخدم ماذا سيحدث).
 */
export const snapshotSummary = (
  snapshot: DbSnapshot,
  labels: Record<string, string> = {},
): string[] =>
  listSnapshotTables(snapshot)
    .filter((table) => snapshot.tables[table].length > 0)
    .map((table) => `${labels[table] ?? table}: ${snapshot.tables[table].length}`);

// ============================================================
// الدمج (الاستعادة) — مع سياسات حلّ التعارض
// ============================================================

/**
 * سياسة الدمج عند الاستعادة:
 *  - `replace`: النسخة المستوردة تحل محل البيانات الحالية (استعادة كاملة).
 *  - `merge-newest`: يُؤخذ الأحدث بحسب `updated_at` عند التعارض (الأكثر أماناً).
 *  - `merge-fill`: تُضاف الصفوف الناقصة فقط ولا يُعدَّل أي صف موجود.
 */
export type MergeStrategy = "replace" | "merge-newest" | "merge-fill";

export const MERGE_STRATEGIES: { id: MergeStrategy; label: string; description: string }[] = [
  {
    id: "replace",
    label: "استعادة كاملة (استبدال)",
    description: "يمسح بيانات الجهاز الحالية ويضع بيانات النسخة مكانها.",
  },
  {
    id: "merge-newest",
    label: "دمج — الأحدث يفوز",
    description: "يبقي الأحدث بين نسخة الجهاز والنسخة المستوردة لكل سجل.",
  },
  {
    id: "merge-fill",
    label: "دمج — إضافة الناقص فقط",
    description: "لا يمس أي سجل موجود، ويضيف السجلات غير الموجودة فقط.",
  },
];

const rowKey = (row: SnapshotRow, pk: string[]) =>
  pk.map((col) => String(row[col] ?? "")).join("|");

const updatedAtOf = (row: SnapshotRow): number => {
  const value = row.updated_at ?? row.created_at;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value) {
    const time = Date.parse(value);
    if (!Number.isNaN(time)) return time;
  }
  return 0;
};

export type MergeOutcome = {
  /** الصفوف النهائية الواجب كتابتها في الجدول. */
  rows: SnapshotRow[];
  inserted: number;
  updated: number;
  keptLocal: number;
  conflicts: number;
};

/**
 * يدمج صفوف لقطة مع صفوف الجدول الحالية حسب السياسة والمفتاح الأساسي.
 * مع `replace` تُرجع صفوف النسخة كما هي (والمنادي يمسح الجدول قبلها).
 */
export const mergeTableRows = (
  localRows: SnapshotRow[],
  incomingRows: SnapshotRow[],
  pk: string[],
  strategy: MergeStrategy,
): MergeOutcome => {
  if (strategy === "replace") {
    return {
      rows: incomingRows,
      inserted: incomingRows.length,
      updated: 0,
      keptLocal: 0,
      conflicts: 0,
    };
  }

  const localByKey = new Map(localRows.map((row) => [rowKey(row, pk), row]));
  const result: SnapshotRow[] = [];
  let inserted = 0;
  let updated = 0;
  let keptLocal = 0;
  let conflicts = 0;

  for (const incoming of incomingRows) {
    const key = rowKey(incoming, pk);
    const existing = localByKey.get(key);
    if (!existing) {
      localByKey.set(key, incoming);
      inserted++;
      continue;
    }
    if (strategy === "merge-fill") {
      keptLocal++;
      continue;
    }
    // merge-newest
    const localTime = updatedAtOf(existing);
    const incomingTime = updatedAtOf(incoming);
    if (incomingTime >= localTime) {
      localByKey.set(key, incoming);
      updated++;
      if (localTime > 0 && incomingTime > localTime) conflicts++;
    } else {
      keptLocal++;
      conflicts++;
    }
  }

  for (const row of localByKey.values()) result.push(row);
  return { rows: result, inserted, updated, keptLocal, conflicts };
};

/**
 * يقارن أعداد صفوف الجهاز بأعداد صفوف اللقطة — يُعرض قبل التأكيد.
 */
export const compareCounts = (
  localCounts: Record<string, number>,
  snapshot: DbSnapshot,
): { table: string; local: number; incoming: number }[] => {
  const tables = new Set([...Object.keys(localCounts), ...Object.keys(snapshot.tables)]);
  return Array.from(tables)
    .sort()
    .map((table) => ({
      table,
      local: localCounts[table] ?? 0,
      incoming: snapshot.tables[table]?.length ?? 0,
    }));
};

/** اسم ملف النسخة الاحتياطية الموحّد (يُستعمل للحفظ والمشاركة). */
export const snapshotFileName = (date = new Date(), ownerId: string | null = null): string => {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(
    2,
    "0",
  )}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  const owner = ownerId && ownerId !== "local-device" ? `-${ownerId.slice(0, 8)}` : "";
  return `msabka-backup-${stamp}${owner}.json`;
};

/** اسم ملف نسخة قاعدة البيانات الثنائية (SQLite .db). */
export const dbFileName = (date = new Date()): string => {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  return `inmaa_local-${stamp}.db`;
};
