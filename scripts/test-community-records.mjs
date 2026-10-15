/**
 * اختبارات سجل المجتمع — بعد المرحلة 5 (محلي أولاً):
 *   1) المنطق النقي في `community-records`: تحقق البرامج، الترشيح، الملخّص
 *      المالي، الأعمدة، التطبيع، حمولة السحابة، والترتيب.
 *   2) التخزين في `communityStorage`: قراءة محلية، تنزيل بالصفحات، تحديث
 *      محصور بالقسم، حماية التعديلات المعلّقة، حفظ/حذف بلا إنترنت.
 *   3) الحدود: وضع الاطلاع، تغيّر الحساب، غياب الجلسة، وضع الجهاز، ورسائل
 *      الخطأ العربية.
 *
 * البدائل (SQLite/Supabase/الجلسة/الاطلاع) تُحقن عبر خطاف `load` في إضافة
 * Vite — الوحدة تحت الاختبار حقيقية، وحدودها فقط هي البديلة.
 *
 * التشغيل: npm run test:community
 */

import assert from "node:assert/strict";
import { createTestVite } from "./test-doubles/vite-plugin.mjs";

const vite = await createTestVite({
  "/integrations/supabase/client.ts": "supabaseClient.mjs",
  "/utils/viewAs.ts": "viewAs.mjs",
  "/utils/localDB.ts": "localDB.mjs",
  "/utils/storage.ts": "storage.mjs",
});

const ok = (message) => console.log(`  ✓ ${message}`);
const section = (title) => console.log(`\n${title}`);

const withNavigator = async (onLine, fn) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine } });
  try {
    return await fn();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
};

try {
  const model = await vite.ssrLoadModule("/src/lib/community-records.ts");
  const storage = await vite.ssrLoadModule("/src/utils/communityStorage.ts");
  const db = await vite.ssrLoadModule("/scripts/test-doubles/localDB.mjs");
  const cloud = await vite.ssrLoadModule("/scripts/test-doubles/supabaseClient.mjs");
  const viewAs = await vite.ssrLoadModule("/scripts/test-doubles/viewAs.mjs");
  const sync = await vite.ssrLoadModule("/scripts/test-doubles/storage.mjs");

  const base = {
    department: "training",
    program_id: "sewing",
    beneficiary_name: "مستفيد المجتمع",
    beneficiary_type: "individual",
    phone: null,
    guardian_name: null,
    address: null,
    service_date: "2026-10-15",
    status: "registered",
    group_name: null,
    sponsor_name: null,
    amount: null,
    currency: null,
    quantity: null,
    notes: null,
  };
  const row = (overrides = {}) => ({
    ...base,
    id: "record-a",
    user_id: "owner-a",
    created_at: "2026-10-01T08:00:00.000Z",
    updated_at: "2026-10-01T08:00:00.000Z",
    ...overrides,
  });

  const reset = () => {
    db.__resetDb();
    cloud.__resetCloud();
    sync.__resetSync();
    viewAs.__setViewAs(null);
  };

  reset();

  // ==========================================================
  section("١) المنطق النقي (community-records):");

  for (const department of ["training", "care"]) {
    for (const program of model.getDepartmentPrograms(department)) {
      const orphan = model.isOrphanProgram(program.id);
      const child = model.isChildProgram(program.id);
      const money = model.isMoneyProgram(program.id);
      assert.ok(
        model.communityRecordSchema.safeParse({
          ...base,
          department,
          program_id: program.id,
          beneficiary_type: orphan ? "orphan" : child ? "child" : "individual",
          guardian_name: orphan || child ? "الوصي" : null,
          amount: money ? 200 : null,
          currency: money ? "YER" : null,
          quantity: program.id === "food-baskets" ? 1 : null,
        }).success,
        `Valid program: ${program.id}`,
      );
    }
  }
  ok("كل البرامج مقبولة داخل قسمها الصحيح (تدريب/رعاية)");

  for (const changes of [
    { beneficiary_name: " " },
    { program_id: "unknown" },
    { department: "care" },
    { service_date: "2026-02-30" },
    { status: "invalid" },
    { quantity: 1 },
    { amount: 1, currency: "YER" },
    { beneficiary_type: "child" },
    { beneficiary_type: "orphan" },
    { department: "care", program_id: "cash-assistance", amount: -1, currency: "YER" },
    { department: "care", program_id: "cash-assistance", amount: 100 },
    { department: "care", program_id: "food-baskets", quantity: 1.5 },
    { department: "care", program_id: "food-baskets", quantity: 0 },
    { notes: "x".repeat(3001) },
  ])
    assert.equal(
      model.communityRecordSchema.safeParse({ ...base, ...changes }).success,
      false,
      JSON.stringify(changes),
    );
  ok("14 حالة غير صالحة مرفوضة (مبالغ بلا عملة، سلال بلا عدد، تواريخ…)، ومنزلتان عشريتان فقط");

  const searchable = row({
    phone: "777123456",
    group_name: "دفعة أولى",
    sponsor_name: "كافل تجريبي",
  });
  for (const term of ["المجتمع", "777", "دفعة", "كافل"])
    assert.equal(model.filterCommunityRecords([searchable], term, "all", "all").length, 1);
  assert.equal(model.filterCommunityRecords([searchable], "", "sewing", "registered").length, 1);
  assert.equal(model.filterCommunityRecords([searchable], "", "design", "registered").length, 0);
  assert.equal(model.filterCommunityRecords([searchable], "", "all", "completed").length, 0);
  assert.equal(model.filterCommunityRecords([searchable], "غير موجود", "all", "all").length, 0);
  ok("الترشيح: بحث عربي/أرقام + برنامج + حالة");

  const summary = model.summarizeCompletedServices([
    row({ status: "completed", amount: 0.1, currency: "YER" }),
    row({ status: "completed", amount: 0.2, currency: "YER" }),
    row({ status: "completed", amount: 20, currency: "SAR" }),
    row({ status: "cancelled", amount: 1000, currency: "USD" }),
    row({ status: "in_progress", amount: 1000, currency: "YER" }),
    row({ status: "completed", program_id: "food-baskets", quantity: 3 }),
    row({ status: "registered", program_id: "food-baskets", quantity: 5 }),
  ]);
  assert.deepEqual(summary, { baskets: 3, amounts: { YER: 0.3, SAR: 20, USD: 0 } });
  ok("الملخّص المالي يجمع بالوحدات الصغرى (0.1 + 0.2 = 0.3 بلا أثر فاصلة عائمة)");

  assert.equal(
    model.communityRecordSchema.safeParse({
      ...base,
      department: "care",
      program_id: "cash-assistance",
      amount: 1.001,
      currency: "YER",
    }).success,
    false,
  );
  ok("رفض المبلغ بأكثر من منزلتين عشريتين (حماية عمود numeric(14,2))");

  assert.ok(model.COMMUNITY_RECORD_COLUMNS.includes("service_date"));
  assert.ok(!model.COMMUNITY_RECORD_COLUMNS.includes("local_updated_at"));
  assert.deepEqual(
    model.LOCAL_COMMUNITY_RECORD_COLUMNS.filter(
      (column) => !model.COMMUNITY_RECORD_COLUMNS.includes(column),
    ),
    ["local_updated_at"],
  );
  ok("الأعمدة: السحابية بلا local_updated_at، والمحلية تضيفه وحده");

  const normalized = model.normalizeCommunityRecord({
    ...base,
    id: "record-x",
    user_id: "owner-a",
    phone: "   ",
    group_name: "  دفعة  ",
    amount: 500,
    currency: "YER",
    quantity: 2,
    service_date: "not-a-date",
  });
  assert.equal(normalized.phone, null, "النصّ الفارغ null");
  assert.equal(normalized.group_name, "دفعة");
  assert.equal(normalized.amount, null, "المبلغ يُسقَط في غير البرامج النقدية");
  assert.equal(normalized.currency, null);
  assert.equal(normalized.quantity, null, "العدد يُسقَط في غير السلال");
  assert.match(normalized.service_date, /^\d{4}-\d{2}-\d{2}$/, "تاريخ ناقص يُستبدل بتاريخ اليوم");
  ok("التطبيع: نصوص فارغة null + إسقاط الحقول غير المناسبة للبرنامج + تاريخ بديل");

  const payload = model.toCommunityCloudPayload(
    { ...normalized, local_updated_at: "2026-10-15T00:00:00.000Z" },
    "owner-b",
  );
  assert.equal(payload.user_id, "owner-b", "المالك يُفرض");
  assert.equal("local_updated_at" in payload, false, "عمود التدقيق المحلي لا يُرفع");
  assert.deepEqual(
    Object.keys(payload).filter((key) => !model.COMMUNITY_RECORD_COLUMNS.includes(key)),
    [],
    "لا عمود خارج السحابة",
  );
  ok("حمولة السحابة: أعمدة السحابة فقط + مالك صريح + بلا أعمدة محلية");

  const unsorted = [
    row({ id: "b", service_date: "2026-01-05" }),
    row({ id: "a", service_date: "2026-01-05" }),
    row({ id: "c", service_date: "2026-03-01" }),
  ];
  assert.deepEqual(
    model.sortCommunityRecords(unsorted).map((item) => item.id),
    ["c", "a", "b"],
  );
  ok("الترتيب موحّد مع السحابة: تاريخ الخدمة تنازلي ثم المعرّف");

  // ==========================================================
  section("٢) التخزين المحلي أولاً (communityStorage):");

  reset();
  db.__seed("community_records", [row({ id: "local-1", beneficiary_name: "محلي بلا نت" })]);
  const offline = await withNavigator(false, () => storage.loadCommunityRecords("training"));
  assert.equal(offline.length, 1);
  assert.equal(offline[0].beneficiary_name, "محلي بلا نت");
  assert.equal(cloud.__cloud.calls.length, 0, "بلا إنترنت: صفر استدعاءات سحابية");
  ok("القراءة محلية بالكامل عند انقطاع الاتصال (بلا استدعاء سحابي واحد)");

  reset();
  cloud.__seedCloud(
    "community_records",
    Array.from({ length: 501 }, (_, index) => row({ id: `cloud-${index}` })),
  );
  const controller = new AbortController();
  const paged = await withNavigator(true, () =>
    storage.loadCommunityRecords("training", controller.signal),
  );
  assert.equal(paged.length, 501, "لا اقتطاع عند 1000 صف");
  assert.deepEqual(cloud.__cloud.calls[0].range, [0, 499]);
  assert.deepEqual(cloud.__cloud.calls[1].range, [500, 999]);
  assert.equal(cloud.__cloud.calls[0].signal, controller.signal);
  ok("التنزيل بالصفحات: 501 سجل عبر صفحتين + تمرير إشارة الإلغاء");

  reset();
  cloud.__seedCloud("community_records", [row({ id: "cloud-1" }), row({ id: "cloud-2" })]);
  db.__seed("community_records", [row({ id: "local-1" })]);
  const refreshed = await withNavigator(true, () => storage.loadCommunityRecords("training"));
  assert.deepEqual(
    refreshed.map((item) => item.id),
    ["cloud-1", "cloud-2"],
  );
  assert.deepEqual(cloud.__cloud.calls.at(-1).filters, [
    ["user_id", "owner-a"],
    ["department", "training"],
  ]);
  assert.equal(
    (await storage.loadCommunityRecords("care")).length,
    0,
    "قسم آخر لا يُنزَّل ضمن تحديث هذا القسم",
  );
  ok("التحديث محصور بالقسم المطلوب (مرشّح المالك + القسم فقط)");

  reset();
  cloud.__seedCloud("community_records", [row({ id: "cloud-1" })]);
  const edited = await withNavigator(false, () =>
    storage.saveCommunityRecord(base, undefined, "owner-a"),
  );
  const afterEdit = await withNavigator(true, () => storage.loadCommunityRecords("training"));
  assert.deepEqual(
    afterEdit.map((item) => item.id).sort(),
    ["cloud-1", edited.id].sort(),
    "السجل المعلّق لا يُحذف بالتحديث السحابي",
  );
  assert.equal(
    (await db.getPendingChanges()).filter((change) => change.entity === "community_record").length,
    1,
  );
  ok("الصفوف ذات التعديل المعلّق محمية أثناء التحديث ومسجَّلة في الطابور");

  reset();
  cloud.__failCloudWith({ code: "42P01", message: "relation does not exist" });
  db.__seed("community_records", [row({ id: "local-1" })]);
  const tolerant = await withNavigator(true, () => storage.loadCommunityRecords("training"));
  assert.equal(tolerant.length, 1, "البيانات المحلية تُعرض رغم فشل السحابة");
  cloud.__failCloudWith(null);
  ok("فشل السحابة تحذير لا شاشة خطأ — تبقى البيانات المحلية معروضة");

  reset();
  sync.__resetSync();
  const saved = await withNavigator(false, () =>
    storage.saveCommunityRecord(
      { ...base, beneficiary_name: "مستفيد بلا إنترنت" },
      undefined,
      "owner-a",
    ),
  );
  assert.equal(
    (await db.getCachedCommunityRecordsForDepartment("owner-a", "training")).length,
    1,
    "محفوظ محلياً",
  );
  assert.equal(sync.__sync.queued, 1, "جُدول الرفع");
  assert.equal(cloud.__cloud.calls.length, 0, "بلا نت: لا محاولة رفع");
  ok("الحفظ يعمل بلا إنترنت: كتابة محلية + طابور + جدولة رفع");

  assert.ok(/^[0-9a-f-]{36}$/i.test(saved.id), "معرّف UUID");
  assert.equal(saved.user_id, "owner-a");
  ok("المعرّف UUID يُولَّد على الجهاز (بلا مطابقة معرّفات لاحقة)");

  const updated = await withNavigator(false, () =>
    storage.saveCommunityRecord({ ...base, status: "completed" }, saved.id, "owner-a"),
  );
  assert.equal(updated.id, saved.id, "نفس السجل");
  assert.equal(updated.status, "completed");
  assert.equal(updated.created_at, saved.created_at, "تاريخ الإنشاء الأصلي محفوظ");
  ok("التعديل يحدّث السجل نفسه ويحفظ تاريخ إنشائه");

  await withNavigator(false, () => storage.deleteCommunityRecord(saved.id, "training", "owner-a"));
  assert.equal((await db.getCachedCommunityRecordsForDepartment("owner-a", "training")).length, 0);
  assert.equal(
    (await db.getPendingChanges()).filter(
      (change) => change.entity === "community_record" && change.op === "delete",
    ).length,
    1,
  );
  ok("الحذف محلي فوراً ومعلّق في الطابور حتى يُرفع");

  reset();
  db.__seed("community_records", [row({ id: "mine" }), row({ id: "theirs", user_id: "owner-z" })]);
  const mine = await withNavigator(false, () => storage.loadCommunityRecords("training"));
  assert.deepEqual(
    mine.map((item) => item.id),
    ["mine"],
    "صفوف حساب آخر لا تظهر",
  );
  ok("عزل البيانات: صفوف حساب آخر في نفس الجدول لا تظهر");

  // ==========================================================
  section("٣) الحدود والصلاحيات:");

  reset();
  cloud.__seedCloud("community_records", [row({ id: "theirs-1", user_id: "owner-b" })]);
  viewAs.__setViewAs({ id: "owner-b", name: "ب" });
  await assert.rejects(
    () => storage.saveCommunityRecord(base, undefined, "owner-a"),
    /وضع الاطلاع للقراءة فقط/,
  );
  await assert.rejects(
    () => storage.deleteCommunityRecord("theirs-1", "training", "owner-a"),
    /وضع الاطلاع للقراءة فقط/,
  );
  const viewed = await withNavigator(true, () => storage.loadCommunityRecords("training"));
  assert.deepEqual(
    viewed.map((item) => item.id),
    ["theirs-1"],
    "القراءة من السحابة",
  );
  assert.ok(
    cloud.__cloud.calls
      .at(-1)
      .filters.some(([key, value]) => key === "user_id" && value === "owner-b"),
  );
  viewAs.__setViewAs(null);
  ok("وضع الاطلاع: قراءة سحابية ورفض كل كتابة");

  cloud.__cloud.session = { user: { id: "owner-b" } };
  await assert.rejects(
    () => storage.saveCommunityRecord(base, undefined, "owner-a"),
    /تغيّر الحساب/,
  );
  cloud.__cloud.session = { user: { id: "owner-a" } };
  ok("تبدّل الحساب يُرفض الحفظ (حماية من كتابة بيانات على حساب آخر)");

  cloud.__cloud.session = null;
  await assert.rejects(() => storage.loadCommunityRecords("training"), /تسجيل الدخول/);
  cloud.__cloud.session = { user: { id: "owner-a" } };
  ok("غياب الجلسة يرفع خطأً عربيًا واضحًا بدل تعطّل صامت");

  reset();
  cloud.__cloud.session = { user: { id: "local-device" } };
  db.__seed("community_records", [row({ id: "device-1", user_id: "local-device" })]);
  const deviceRows = await withNavigator(true, () => storage.loadCommunityRecords("training"));
  assert.equal(deviceRows.length, 1);
  assert.equal(cloud.__cloud.calls.length, 0, "وضع الجهاز لا يلمس السحابة إطلاقاً");
  cloud.__cloud.session = { user: { id: "owner-a" } };
  ok("«وضع الجهاز» يعمل محلياً بالكامل بلا أي استدعاء سحابي");

  assert.match(model.communityErrorMessage({ code: "42P01" }), /20261015100000/);
  assert.match(model.communityErrorMessage({ code: "42501" }), /صلاحية/);
  assert.match(model.communityErrorMessage({ code: "23505" }), /تكرار/);
  ok("رسائل عربية لكل رمز خطأ متوقع من السحابة");

  reset();
  const beforeInvalid = db.__db.writes.length;
  await assert.rejects(
    () => storage.saveCommunityRecord({ ...base, beneficiary_name: " " }, undefined, "owner-a"),
    (error) => Array.isArray(error.issues) || /الاسم|حرفان|beneficiary_name/.test(error.message),
  );
  assert.equal(db.__db.writes.length, beforeInvalid, "لا كتابة محلية ببيانات غير صالحة");
  ok("التحقق يسبق الكتابة: سجل غير صالح لا يُكتب محلياً ولا يُدرَج في الطابور");

  console.log("\n✅ نجحت كل اختبارات سجل المجتمع (المنطق النقي + التخزين المحلي + الحدود).");
} finally {
  await vite.close();
}
