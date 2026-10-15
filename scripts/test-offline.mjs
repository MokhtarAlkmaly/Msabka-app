/**
 * اختبارات «العمل بدون إنترنت ثم الترحيل إلى السحابة»:
 *   1) الدخول المحلي: بصمة SHA-256 (WebCrypto والبديل الخالص)، رمز PIN،
 *      الهوية المحفوظة، الجلسة المحلية وصلاحياتها، وإعادة نسب الصفوف.
 *   2) لقطة قاعدة البيانات: البناء، القراءة والتحقق، وسياسات الدمج الثلاث
 *      (استبدال / الأحدث يفوز / إضافة الناقص)، والمقارنة والملخّص وأسماء الملفات.
 *   3) خطة الترحيل الشامل: ترتيب الجداول، التقسيم إلى دفعات، فصل الطلاب
 *      المؤقتين وإعادة ترقيمهم، سياسات التعارض، بناء الحمولة، والتقرير.
 *
 * التشغيل: npm run test:offline
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});

const ok = (message) => console.log(`  ✓ ${message}`);
const nodeSha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

let failures = 0;
const section = (title) => console.log(`\n${title}`);

try {
  // ==========================================================
  section("١) الدخول بدون إنترنت (offline-auth):");
  const auth = await vite.ssrLoadModule("/src/lib/offline-auth.ts");

  // --- SHA-256 ---
  for (const sample of ["1234", "msabka-pin:abc:4321", "مركز إنماء الأهلي الخيري", ""]) {
    assert.equal(await auth.sha256Hex(sample), nodeSha256(sample), `sha256Hex("${sample}")`);
    const bytes = new TextEncoder().encode(sample);
    const fallbackHex = Array.from(auth.sha256BytesFallback(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    assert.equal(fallbackHex, nodeSha256(sample), `البديل الخالص لـ("${sample}")`);
  }
  ok("SHA-256 عبر WebCrypto والبديل الخالص يطابقان node:crypto (بما فيه النص العربي)");

  // --- PIN ---
  assert.equal(auth.normalizePin("1234"), "1234");
  assert.equal(auth.normalizePin(" 12ab34 "), "1234", "الأحرف غير الرقمية تُتجاهل");
  assert.equal(auth.normalizePin("123"), null, "أقل من 4 أرقام مرفوض");
  assert.equal(auth.normalizePin("123456789"), null, "أكثر من 8 أرقام مرفوض");
  ok("تنظيم رمز PIN (4-8 أرقام فقط)");

  const pinRecord = await auth.hashPin("2468");
  assert.ok(pinRecord, "hashPin يرجع سجلاً");
  assert.equal(pinRecord.salt.length, 32, "الملح 16 بايت = 32 حرفاً ستعشرياً");
  assert.notEqual(pinRecord.salt, (await auth.hashPin("2468")).salt, "الملح عشوائي في كل مرة");
  assert.ok(!Object.values(pinRecord).includes("2468"), "الرمز لا يُخزَّن صريحاً أبداً");
  assert.equal(await auth.verifyPinHash("2468", pinRecord), true, "الرمز الصحيح مقبول");
  assert.equal(await auth.verifyPinHash("2469", pinRecord), false, "الرمز الخاطئ مرفوض");
  assert.equal(await auth.verifyPinHash("", pinRecord), false, "الرمز الفارغ مرفوض");
  assert.equal(await auth.hashPin("12"), null, "رمز قصير لا يُقبل");
  ok("بصمة رمز PIN: تحقق صحيح/خاطئ + ملح عشوائي + لا تخزين صريح");

  // --- الهوية والجلسة ---
  const identity = {
    user_id: "11111111-2222-3333-4444-555555555555",
    email: "teacher@inmaa.org",
    name: "أبو عبدالله",
    saved_at: Date.now(),
  };
  const session = auth.sessionFromIdentity(identity);
  assert.equal(session.mode, "offline");
  assert.equal(session.user_id, identity.user_id);
  assert.equal(session.email, identity.email);
  assert.equal(auth.canUseLocalSession(session), true, "جلسة جديدة صالحة");

  const stale = { ...session, last_used_at: Date.now() - auth.LOCAL_SESSION_TTL_MS - 1000 };
  assert.equal(auth.isLocalSessionExpired(stale), true, "جلسة قديمة منتهية");
  assert.equal(auth.canUseLocalSession(stale), false);
  assert.equal(auth.canUseLocalSession(null), false);
  ok("الجلسة المحلية: إنشاء + انتهاء صلاحية بعد 30 يوماً");

  const device = auth.deviceSession();
  assert.equal(device.mode, "device");
  assert.equal(device.user_id, auth.DEVICE_OWNER_ID);
  ok("وضع الجهاز بمعرّف ثابت معروف");

  // --- إعادة النسب ---
  const rows = [
    { id: "a", user_id: auth.DEVICE_OWNER_ID, name: "سالم" },
    { id: "b", user_id: auth.DEVICE_OWNER_ID, name: "سمية" },
    { id: "c", user_id: "someone-else", name: "لا يمس" },
  ];
  const reassigned = auth.reassignOwnedRows(rows, auth.DEVICE_OWNER_ID, identity.user_id);
  assert.equal(reassigned.length, 2, "يُعاد نسب صفَي وضع الجهاز فقط");
  assert.ok(reassigned.every((row) => row.user_id === identity.user_id));
  assert.equal(
    auth.reassignOwnedRows(rows, identity.user_id, identity.user_id).length,
    0,
    "لا شيء يتغيّر عند تطابق المالكين",
  );
  assert.equal(rows[2].user_id, "someone-else", "بيانات الحسابات الأخرى لا تُمَس");
  ok("إعادة نسب صفوف وضع الجهاز إلى حساب حقيقي (دون المساس بغيرها)");

  // ==========================================================
  section("٢) لقطة قاعدة البيانات (db-snapshot):");
  const snap = await vite.ssrLoadModule("/src/lib/db-snapshot.ts");

  const tables = {
    students: [
      { id: 1, name: "سالم", user_id: "u1" },
      { id: 2, name: "سمية", user_id: "u1" },
    ],
    monthly_tracking: [{ student_id: 1, year: "1447", month: 3, attendance_score: 9 }],
    settings: [],
  };
  const snapshot = snap.buildSnapshot(tables, { deviceId: "dev-1", ownerId: "u1" });
  assert.equal(snapshot.kind, "msabka-snapshot");
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.counts.students, 2);
  assert.equal(snapshot.counts.settings, 0);
  assert.equal(snap.snapshotRowCount(snapshot), 3);
  assert.deepEqual(snap.listSnapshotTables(snapshot), ["monthly_tracking", "settings", "students"]);
  ok("بناء اللقطة مع أعداد الصفوف");

  // قراءة صحيحة
  const parsed = snap.parseSnapshot(JSON.stringify(snapshot));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.snapshot.counts.students, 2);

  // قراءة فاشلة
  assert.equal(snap.parseSnapshot("{ليس JSON").ok, false);
  assert.equal(snap.parseSnapshot('{"foo":1}').ok, false);
  const excelLike = snap.parseSnapshot(JSON.stringify({ students: [{ name: "سالم" }] }));
  assert.equal(excelLike.ok, false);
  assert.match(excelLike.error, /تصدير طلاب/);
  ok("رفض الملفات التالفة وغير المعروفة برسائل عربية واضحة");

  // ملف جداول فقط (بلا ترويسة) يُقبل مع تحذير
  const loose = snap.parseSnapshot(JSON.stringify({ tables }));
  assert.equal(loose.ok, true);
  assert.equal(loose.warnings.length, 1);
  ok("التسامح مع ملف جداول بلا ترويسة (مع تحذير)");

  // إصدار أحدث من التطبيق
  const future = snap.parseSnapshot(JSON.stringify({ ...snapshot, version: 99 }));
  assert.equal(future.ok, true);
  assert.match(future.warnings[0], /أحدث من إصدار التطبيق/);
  ok("لقطة من إصدار أحدث تُقبل مع تحذير");

  // --- سياسات الدمج ---
  const local = [
    { id: 1, name: "سالم المحلي", updated_at: "2026-10-01T00:00:00Z" },
    { id: 2, name: "سمية المحلية", updated_at: "2026-10-05T00:00:00Z" },
    { id: 3, name: "محلي فقط" },
  ];
  const incoming = [
    { id: 1, name: "سالم من النسخة", updated_at: "2026-10-03T00:00:00Z" },
    { id: 2, name: "سمية من النسخة", updated_at: "2026-10-02T00:00:00Z" },
    { id: 4, name: "جديد من النسخة" },
  ];

  const replaced = snap.mergeTableRows(local, incoming, ["id"], "replace");
  assert.equal(replaced.rows.length, incoming.length, "الاستبدال يمسح المحلي ويضع النسخة");
  assert.equal(replaced.inserted, incoming.length);
  assert.equal(replaced.updated, 0);

  const newest = snap.mergeTableRows(local, incoming, ["id"], "merge-newest");
  assert.equal(newest.rows.length, 4, "الاتحاد: 3 محلية + 1 جديدة");
  const byId = new Map(newest.rows.map((row) => [row.id, row]));
  assert.equal(byId.get(1).name, "سالم من النسخة", "النسخة أحدث (10-03 > 10-01) فتفوز");
  assert.equal(byId.get(2).name, "سمية المحلية", "المحلي أحدث (10-05 > 10-02) فيبقى");
  assert.equal(byId.get(3).name, "محلي فقط");
  assert.equal(byId.get(4).name, "جديد من النسخة");
  assert.equal(newest.inserted, 1);
  assert.equal(newest.updated, 1);
  assert.equal(newest.keptLocal, 1);
  assert.ok(newest.conflicts >= 1, "التعارضات تُحسب ولا تُخفى");

  const filled = snap.mergeTableRows(local, incoming, ["id"], "merge-fill");
  assert.equal(filled.rows.length, 4);
  assert.equal(filled.updated, 0, "لا يُعدَّل أي صف موجود");
  assert.equal(filled.inserted, 1);
  ok("سياسات الدمج الثلاث: استبدال / الأحدث يفوز / إضافة الناقص فقط");

  // مفتاح مركّب
  const composite = snap.mergeTableRows(
    [{ student_id: 1, year: "1447", month: 3, behavior_score: 5 }],
    [{ student_id: 1, year: "1447", month: 4, behavior_score: 7 }],
    ["student_id", "year", "month"],
    "merge-fill",
  );
  assert.equal(composite.rows.length, 2, "المفتاح المركّب يميّز الشهرين");
  ok("الدمج بمفتاح أساسي مركّب (طالب + عام + شهر)");

  // المقارنة والملخّص وأسماء الملفات
  const compared = snap.compareCounts({ students: 5 }, snapshot);
  assert.deepEqual(
    compared.find((entry) => entry.table === "students"),
    { table: "students", local: 5, incoming: 2 },
  );
  const summary = snap.snapshotSummary(snapshot, { students: "الطلاب" });
  assert.ok(summary.some((line) => line.startsWith("الطلاب: 2")));
  assert.match(
    snap.snapshotFileName(new Date(2026, 9, 15, 9, 5), "abcdef123456"),
    /^msabka-backup-20261015-0905-abcdef12\.json$/,
  );
  assert.match(snap.dbFileName(new Date(2026, 9, 15)), /^inmaa_local-20261015\.db$/);
  ok("مقارنة الأعداد + الملخّص العربي + أسماء الملفات الموحّدة");

  // ==========================================================
  section("٣) خطة الترحيل الشامل (migration-plan):");
  const plan = await vite.ssrLoadModule("/src/lib/migration-plan.ts");

  assert.equal(plan.TEMP_ID_BASE, 1_000_000_000);
  assert.equal(plan.isTempStudentId(1_000_000_001), true);
  assert.equal(plan.isTempStudentId(42), false);
  assert.equal(plan.isTempStudentId(null), false);
  ok("تمييز الطلاب المُنشئين بدون نت (معرّف مؤقت ≥ مليار)");

  const order = plan.orderedMigrationTables().map((spec) => spec.table);
  assert.equal(order[0], "students", "الطلاب أولاً");
  assert.ok(
    order.indexOf("year_data") < order.indexOf("teachers"),
    "الجداول المرتبطة بالطالب قبل البقية",
  );
  assert.ok(order.indexOf("monthly_tracking") > order.indexOf("students"));
  assert.equal(new Set(order).size, order.length, "لا جدول مكرراً");
  assert.equal(
    new Set(plan.MIGRATION_TABLES.map((t) => t.onConflict)).has("student_id,year,month"),
    true,
  );
  assert.equal(
    plan.getTableSpec("teacher_bonuses").fallbackConflict,
    "user_id,teacher_name,year,month",
    "قيد الإكراميات الفريد الثانوي معروف",
  );
  ok("ترتيب الجداول ومفاتيح التعارض (مع البدائل للقيود الثانوية)");

  assert.equal(plan.chunkRows([], 500).length, 0);
  assert.deepEqual(plan.chunkRows([1, 2, 3], 2), [[1, 2], [3]]);
  assert.equal(plan.chunkRows(Array.from({ length: 1200 }, (_, i) => i)).length, 3);
  assert.equal(
    plan.chunkRows(Array.from({ length: 1200 }, (_, i) => i))[2].length,
    200,
    "الدفعة الأخيرة تحمل الباقي",
  );
  ok("التقسيم إلى دفعات ≤ 500 صف (حد Supabase)");

  const students = [{ id: 5 }, { id: 1_000_000_001 }, { id: 6 }, { id: 1_000_000_002 }];
  const partitioned = plan.partitionStudentsByTempId(students);
  assert.deepEqual(
    partitioned.existing.map((s) => s.id),
    [5, 6],
  );
  assert.deepEqual(
    partitioned.temporary.map((s) => s.id),
    [1_000_000_001, 1_000_000_002],
  );
  ok("فصل الطلاب المؤقتين عن المعروفين في السحابة");

  const remapMap = new Map([
    [1_000_000_001, 101],
    [1_000_000_002, 102],
  ]);
  const remapped = plan.remapStudentReferences(
    [
      { student_id: 1_000_000_001, year: "1447" },
      { student_id: 7, year: "1447" },
      { student_id: 1_000_000_002, year: "1447", month: 3 },
    ],
    remapMap,
  );
  assert.deepEqual(
    remapped.rows.map((row) => row.student_id),
    [101, 7, 102],
  );
  assert.equal(remapped.changed, 2);
  ok("إعادة ترقيم الصفوف المرتبطة بعد مطابقة المعرّفات");

  // --- سياسات التعارض ---
  const cloudRow = { id: 1, updated_at: "2026-10-01T00:00:00Z" };
  assert.equal(plan.shouldPushRow({ id: 1 }, null, "skip-existing"), true, "جديد يُرفع دائماً");
  assert.equal(plan.shouldPushRow({ id: 1 }, cloudRow, "local-wins"), true);
  assert.equal(plan.shouldPushRow({ id: 1 }, cloudRow, "skip-existing"), false);
  assert.equal(
    plan.shouldPushRow(
      { id: 1, local_updated_at: "2026-10-02T00:00:00Z" },
      cloudRow,
      "newest-wins",
    ),
    true,
    "الأحدث محلياً يُرفع",
  );
  assert.equal(
    plan.shouldPushRow(
      { id: 1, local_updated_at: "2026-09-02T00:00:00Z" },
      cloudRow,
      "newest-wins",
    ),
    false,
    "الأقدم محلياً يُتخطى",
  );
  assert.equal(
    plan.shouldPushRow({ id: 1 }, { id: 1 }, "newest-wins"),
    true,
    "بلا تواريخ → نرفع (لا مرجّح)",
  );
  ok("سياسات التعارض الثلاث + أولوية تاريخ الجهاز المحلي");

  // --- الحمولة ---
  const payload = plan.buildCloudPayload(
    {
      id: "abc",
      name: "سالم",
      user_id: "WRONG",
      local_updated_at: "2026-10-10T00:00:00Z",
      extra_local: 1,
    },
    "owner-1",
    ["id", "name", "user_id"],
    ["local_updated_at"],
  );
  assert.deepEqual(payload, { id: "abc", name: "سالم", user_id: "owner-1" });
  ok("بناء الحمولة: فرض user_id الصحيح + إسقاط الأعمدة المحلية");

  // --- التقرير ---
  const report = plan.newMigrationReport("owner-1", "local-wins");
  const spec = plan.getTableSpec("students");
  const result = plan.emptyTableResult(spec, 10);
  result.pushed = 8;
  result.skipped = 1;
  result.failed = 1;
  for (let i = 0; i < 9; i++) plan.pushTableError(result, `خطأ ${i}`);
  assert.equal(result.errors.length, 5, "التقرير لا يطول: أول 5 أخطاء فقط");
  report.tables.push(result);
  report.remapped_students = 3;
  report.deletes_applied = 2;
  plan.finishMigrationReport(report);
  assert.equal(report.ok, false, "وجود فشل يعني تقريراً غير ناجح");
  assert.deepEqual(plan.reportTotals(report), { total: 10, pushed: 8, skipped: 1, failed: 1 });

  const text = plan.summarizeReport(report);
  assert.match(text, /أخطاء/);
  assert.match(text, /8 سجل مرفوع/);
  assert.match(text, /طلاب أُنشئوا بدون نت/);
  assert.match(text, /عمليات حذف نُفّذت/);
  assert.match(text, /الطلاب والطالبات: 8\/10/);
  ok("تقرير الترحيل: إجماليات + ملخّص عربي قابل للمشاركة");

  result.failed = 0;
  plan.finishMigrationReport(report);
  assert.equal(report.ok, true);
  assert.match(plan.summarizeReport(report), /✅ اكتمل الترحيل/);
  ok("تقرير ناجح عند صف فشل = 0");

  // أخطاء مطابقة الطلاب الجدد تُسجَّل في حقل مستقل حتى لا تُضخّم الإجماليات
  const before = plan.reportTotals(report).total;
  report.temp_student_errors.push("سالم: تعارض تكرار بيانات");
  plan.finishMigrationReport(report);
  assert.equal(report.ok, false, "فشل إدخال طالب جديد يُفشل التقرير");
  assert.equal(plan.reportTotals(report).total, before, "الإجماليات لا تتضخّم بخطوات المطابقة");
  assert.match(plan.summarizeReport(report), /طالب جديد تعذّر إدخاله/);
  ok("أخطاء الطلاب المُنشئين بدون نت في حقل مستقل (بلا تضخيم للإجماليات)");

  assert.match(plan.explainCloudError({ code: "23505", details: "duplicate key" }), /تعارض تكرار/);
  assert.match(plan.explainCloudError({ code: "42501" }), /RLS/);
  assert.match(plan.explainCloudError({ code: "42703", message: "column x" }), /ترحيل SQL/);
  assert.match(plan.explainCloudError({ code: "23503" }), /غير موجودة/);
  assert.equal(plan.explainCloudError({ message: "boom" }), "boom");
  assert.equal(plan.explainCloudError(null), "خطأ غير معروف");
  ok("ترجمة أخطاء Supabase إلى رسائل عربية مفهومة");

  const preview = plan.previewMigration({ students: 12, year_data: 30, settings: 5 }, 4);
  assert.equal(preview.total, 46, "المجموع = الصفوف + الحذف المعلّق");
  assert.equal(preview.pendingDeletes, 4);
  assert.ok(
    !preview.tables.some((entry) => entry.table === "settings"),
    "الجداول غير السحابية تُستثنى",
  );
  assert.equal(preview.tables[0].label, "الطلاب والطالبات");
  ok("معاينة الترحيل قبل التنفيذ");

  // ==========================================================
  section("٤) المرحلة 5 — سجل المجتمع وبنك الأسئلة (محلي أولاً):");

  const localDb = await vite.ssrLoadModule("/src/utils/localDB.ts");
  const community = await vite.ssrLoadModule("/src/lib/community-records.ts");
  const exams = await vite.ssrLoadModule("/src/lib/exam-questions.ts");

  for (const table of ["community_records", "exam_questions"]) {
    const spec = plan.MIGRATION_TABLES.find((entry) => entry.table === table);
    assert.ok(spec, `${table} في خطة الترحيل الشامل`);
    assert.equal(spec.idKind, "uuid", `${table}: مفتاح UUID محلي بلا مطابقة`);
    assert.deepEqual(spec.pk, ["id"]);
    assert.equal(spec.onConflict, "id");
    assert.ok(localDb.SNAPSHOT_TABLES.includes(table), `${table} في اللقطة/الترحيل`);
  }
  assert.deepEqual(
    plan.MIGRATION_TABLES.filter((spec) => spec.idKind === "uuid").length >= 10,
    true,
    "الجداول ذات المفتاح UUID تُرفع بمعرفاتها كما وُلّدت على الجهاز",
  );
  ok("المرحلة 5: الجدولان يدخلان الترحيل الشامل والنسخ وعدّادات اللوحة بمفتاح UUID محلي");

  const transformed = plan.buildCloudPayload(
    { id: "q-1", user_id: "u", choices: '[\"أ\",\"ب\"]', local_updated_at: "2026-10-15" },
    "owner-1",
    ["id", "user_id", "choices"],
    ["local_updated_at"],
    { choices: (value) => (typeof value === "string" ? JSON.parse(value) : value) },
  );
  assert.deepEqual(transformed.choices, ["أ", "ب"], "نصّ JSON ← مصفوفة jsonb");
  assert.equal(transformed.user_id, "owner-1");
  assert.equal("local_updated_at" in transformed, false);

  // ===== اختبار انحراف الأعمدة =====
  // يُقرأ ملف السكيمة السحابي وتُقارن أعمدته بالأعمدة المحلية: أي عمود سحابي
  // جديد بلا نظير محلي يعني فقدان بيانات صامت عند الترحيل — فشل فوري.
  const schemaSql = await readFile(new URL("../supabase/full-schema.sql", import.meta.url), "utf8");
  const parseCloudColumns = (table) => {
    const start = schemaSql.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
    assert.notEqual(start, -1, `${table} موجود في full-schema.sql`);
    const body = schemaSql.slice(start, schemaSql.indexOf("\n);", start));
    return body
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .map((line) => line.match(/^([a-z_][a-z0-9_]*)\s/)?.[1])
      .filter(Boolean);
  };
  for (const [table, libColumns] of [
    ["public.community_records", community.COMMUNITY_RECORD_COLUMNS],
    ["public.exam_questions", exams.EXAM_QUESTION_COLUMNS],
  ]) {
    const cloudColumns = parseCloudColumns(table);
    const localColumns = localDb
      .getTableColumns(table.replace("public.", ""))
      .filter((column) => column !== "local_updated_at");
    assert.deepEqual(localColumns, cloudColumns, `انحراف أعمدة ${table}: محلي ≠ سحابي`);
    assert.deepEqual([...libColumns], cloudColumns, `انحراف أعمدة ${table}: lib ≠ سحابي`);
  }
  ok("تحويلات الأعمدة عند الرفع + اختبار انحراف أعمدة السكيمة السحابية مقابل المحلية");

  console.log("\n✅ كل اختبارات العمل بدون إنترنت والترحيل نجحت.");
} catch (error) {
  failures = 1;
  console.error("\n❌ فشل الاختبار:", error && error.message ? error.message : error);
  if (error && error.stack) console.error(error.stack.split("\n").slice(0, 6).join("\n"));
} finally {
  await vite.close();
}

process.exit(failures === 0 ? 0 : 1);
