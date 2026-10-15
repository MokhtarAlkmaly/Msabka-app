/**
 * اختبارات المرحلة 5 — «السجلات المحلية» (بنك الأسئلة والمعرّفات والتنزيل):
 *   1) `local-ids`: توليد UUID على الجهاز (مع بديلين احتياطيين)، التحويل بين
 *      jsonb والنصّ، والترتيب الثابت متعدد المفاتيح.
 *   2) `cloud-pages`: تنزيل كل الصفوف دون الاقتطاع الصامت عند 1000 صف.
 *   3) `exam-questions`: التحقق، التحويل محليًا/سحابيًا، تطبيع النصّ، كشف
 *      المكرّر، الترشيح، والرسائل العربية.
 *   4) `examStorage`: محلي أولاً — قراءة محلية، تحديث محصور بالعام، حماية
 *      التعديلات المعلّقة، وكتابة تعمل بلا إنترنت.
 *
 * التشغيل: npm run test:records
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
  const ids = await vite.ssrLoadModule("/src/lib/local-ids.ts");
  const pages = await vite.ssrLoadModule("/src/lib/cloud-pages.ts");
  const questions = await vite.ssrLoadModule("/src/lib/exam-questions.ts");
  const storage = await vite.ssrLoadModule("/src/utils/examStorage.ts");
  const db = await vite.ssrLoadModule("/scripts/test-doubles/localDB.mjs");
  const cloud = await vite.ssrLoadModule("/scripts/test-doubles/supabaseClient.mjs");
  const viewAs = await vite.ssrLoadModule("/scripts/test-doubles/viewAs.mjs");
  const sync = await vite.ssrLoadModule("/scripts/test-doubles/storage.mjs");

  const YEAR = "1447";
  const input = (overrides = {}) => ({
    year: YEAR,
    category: "حفظ 5 أجزاء",
    subject: "جزء عمّ",
    question_type: "written",
    question: "اقرأ من قوله تعالى ﴿عَمَّ يَتَسَاءَلُونَ﴾ إلى قوله تعالى ﴿أَلَمْ نَجْعَلِ﴾",
    choices: [],
    correct_answer: "النبأ 1 - 5",
    difficulty: "متوسط",
    notes: null,
    ...overrides,
  });

  // ==========================================================
  section("١) المعرّفات والتحويلات المشتركة (local-ids):");

  const generated = Array.from({ length: 200 }, () => ids.newLocalId());
  assert.ok(
    generated.every((id) => ids.UUID_V4_PATTERN.test(id)),
    "الكل UUID v4",
  );
  assert.equal(new Set(generated).size, 200, "لا تكرار في 200 معرّف");
  ok("newLocalId يُولّد UUID v4 صالحاً وفريداً (200 معرّف بلا تكرار)");

  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const realCrypto = globalThis.crypto;
  try {
    // بلا randomUUID: البديل الأول (getRandomValues) ثم الثاني (Math.random)
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) },
    });
    assert.ok(ids.UUID_V4_PATTERN.test(ids.newLocalId()), "بديل getRandomValues");
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
    assert.ok(ids.UUID_V4_PATTERN.test(ids.newLocalId()), "بديل Math.random");
  } finally {
    if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
  }
  ok("بديلان احتياطيان عند غياب crypto.randomUUID (getRandomValues ثم Math.random)");

  assert.equal(ids.isUuid(generated[0]), true);
  assert.equal(ids.isUuid("not-a-uuid"), false);
  assert.equal(ids.isUuid(42), false);
  ok("isUuid يميّز المعرّفات الصالحة من أي قيمة أخرى");

  assert.deepEqual(ids.parseJsonColumn('["أ","ب"]', []), ["أ", "ب"]);
  assert.deepEqual(ids.parseJsonColumn("{ليس JSON", "بديل"), "بديل");
  assert.deepEqual(ids.parseJsonColumn(null, []), []);
  ok("parseJsonColumn يقرأ النصّ ويرجع البديل عند الفساد بلا استثناء");

  assert.equal(ids.stringifyJsonColumn(["أ", "ب"]), '["أ","ب"]');
  assert.equal(ids.stringifyJsonColumn(null), null);
  ok("stringifyJsonColumn يحوّل القيم إلى نصّ JSON ويترك الفراغ كما هو");

  const unsorted = [
    { service_date: "2026-01-05", id: "b" },
    { service_date: "2026-01-05", id: "a" },
    { service_date: "2026-03-01", id: "c" },
  ];
  assert.deepEqual(
    ids
      .sortRows(unsorted, [{ key: "service_date", dir: "desc" }, { key: "id" }])
      .map((row) => row.id),
    ["c", "a", "b"],
  );
  ok("sortRows يرتب متعدد المفاتيح بثبات (تاريخ تنازلي ثم معرّف تصاعدي)");

  // ==========================================================
  section("٢) تنزيل كل الصفحات (cloud-pages):");

  const seeded = Array.from({ length: 1200 }, (_, index) => ({ id: `q-${index}` }));
  const fetchFrom = (rows) => async (from, to) => rows.slice(from, to + 1);

  assert.equal((await pages.fetchAllPages(fetchFrom(seeded.slice(0, 10)))).length, 10);
  ok("صفحة واحدة ناقصة تكفي — لا استدعاء إضافي بعدها");

  const all = await pages.fetchAllPages(fetchFrom(seeded));
  assert.equal(all.length, 1200, "1200 صف تُحمَّل كاملة رغم سقف Supabase (1000)");
  assert.equal(all[1199].id, "q-1199");
  ok("التنزيل يتجاوز سقف Supabase (1000 صف) بالصفحات حتى آخر صف");

  const ranges = [];
  await pages.fetchAllPages(
    async (from, to) => {
      ranges.push([from, to]);
      return seeded.slice(from, to + 1).slice(0, to - from + 1);
    },
    { pageSize: 100 },
  );
  assert.deepEqual(ranges[0], [0, 99]);
  assert.equal(ranges.length, 13, "12 صفحة ممتلئة + صفحة أخيرة فارغة تُنهي الحلقة");
  ok("حجم الصفحة قابل للتحديد (100 صف × 12 صفحة + صفحة الإنهاء)");

  await assert.rejects(
    () =>
      pages.fetchAllPages(async () => Array.from({ length: 500 }, () => ({ id: "x" })), {
        maxRows: 1200,
      }),
    /حدّ الأمان/,
  );
  ok("حدّ أمان يوقف التنزيل الشاذ برسالة عربية بدل الاستهلاك الصامت");

  // ==========================================================
  section("٣) بنك الأسئلة — المنطق النقي (exam-questions):");

  assert.equal(questions.examQuestionSchema.safeParse(input()).success, true);
  assert.equal(
    questions.examQuestionSchema.safeParse(input({ question: "قص" })).success,
    false,
    "نصّ قصير مرفوض",
  );
  assert.equal(
    questions.examQuestionSchema.safeParse(
      input({ question_type: "mcq", choices: ["واحد"], correct_answer: "واحد" }),
    ).success,
    false,
    "اختيار من متعدد يحتاج خيارين",
  );
  assert.equal(
    questions.examQuestionSchema.safeParse(
      input({ question_type: "mcq", choices: ["أ", "ب"], correct_answer: "ج" }),
    ).success,
    false,
    "الإجابة يجب أن تطابق أحد الخيارات",
  );
  ok("السكيمة ترفض النصّ القصير وخياراً واحداً وإجابة خارج الخيارات");

  const created = questions.createExamQuestion(input(), "owner-a");
  assert.ok(ids.isUuid(created.id), "المعرّف UUID");
  assert.equal(created.user_id, "owner-a");
  assert.ok(created.created_at && created.updated_at && created.local_updated_at);
  const reused = questions.createExamQuestion(input(), "owner-a", created.id);
  assert.equal(reused.id, created.id, "المعرّف يُمرَّر كما هو عند التعديل");
  ok("createExamQuestion يضيف معرّف UUID والمالك والتواريخ");

  const roundTrip = questions.fromExamQuestionRow(questions.toExamQuestionRow(created));
  assert.deepEqual(roundTrip.choices, [], "قائمة فارغة تمرّ بسلام");
  const withChoices = { ...created, choices: ["أ", "ب", "ج"] };
  assert.deepEqual(
    questions.fromExamQuestionRow(questions.toExamQuestionRow(withChoices)).choices,
    ["أ", "ب", "ج"],
  );
  assert.equal(typeof questions.toExamQuestionRow(withChoices).choices, "string");
  ok("تحويل choices في الاتجاهين (مصفوفة ⇄ نصّ JSON) بلا فقدان");

  const payload = questions.toExamCloudPayload(questions.toExamQuestionRow(withChoices), "owner-b");
  assert.deepEqual(payload.choices, ["أ", "ب", "ج"], "jsonb مصفوفة");
  assert.equal(payload.user_id, "owner-b", "المالك يُفرض");
  assert.equal("local_updated_at" in payload, false, "عمود التدقيق المحلي لا يُرفع");
  ok("حمولة السحابة: choices مصفوفة + مالك صريح + بلا أعمدة محلية");

  assert.equal(
    questions.normalizeQuestionText("أَحْمَدُ  بنُ  إبراهيمه"),
    questions.normalizeQuestionText("احمد بن ابراهيمه"),
  );
  assert.equal(questions.normalizeQuestionText("  العم   يتساءلون "), "العم يتساءلون");
  ok("تطبيع النصّ العربي: تشكيل وألفات وياء وتاء مربوطة ومسافات");

  const bank = [{ question: "أَحْمَدُ بن إبراهيمه" }];
  assert.ok(questions.findDuplicateExamQuestion(bank, "احمد بن ابراهيمه"));
  assert.equal(questions.findDuplicateExamQuestion(bank, "سؤال آخر"), null);
  ok("كشف المكرّر محلياً يعتمد التطبيع فيكشف الاختلافات الشكلية");

  const rows = [
    {
      ...created,
      id: "1",
      subject: "جزء عمّ",
      category: "حفظ 5 أجزاء",
      question: "ما معنى الفلق؟",
    },
    {
      ...created,
      id: "2",
      subject: "التجويد",
      category: "حفظ 10 أجزاء",
      question: "ما حكم الغنة؟",
    },
  ];
  assert.equal(questions.filterExamQuestions(rows, { subject: "التجويد" }).length, 1);
  assert.equal(questions.filterExamQuestions(rows, { category: "حفظ 5 أجزاء" }).length, 1);
  assert.equal(questions.filterExamQuestions(rows, { search: "الفلق" }).length, 1);
  assert.equal(questions.filterExamQuestions(rows, {}).length, 2);
  ok("الترشيح بالمادة وفئة الحفظ والبحث النصّي");

  assert.match(questions.examQuestionErrorMessage({ code: "42P01" }), /تحديثًا/);
  assert.match(questions.examQuestionErrorMessage({ code: "42501" }), /صلاحية/);
  assert.match(
    questions.examQuestionErrorMessage(
      questions.examQuestionSchema.safeParse(input({ question: "قص" })).error,
    ),
    /نص السؤال قصير جدًا/,
  );
  ok("رسائل عربية لأخطاء السحابة ولأخطاء التحقق (zod)");

  // ==========================================================
  section("٤) الطبقة المحلية أولاً (examStorage):");

  db.__resetDb();
  cloud.__resetCloud();
  sync.__resetSync();
  viewAs.__setViewAs(null);

  const localOnly = { ...created, id: "local-1", year: YEAR, user_id: "owner-a" };
  db.__seed("exam_questions", [localOnly]);

  const offlineRows = await withNavigator(false, () => storage.loadExamQuestions(YEAR));
  assert.equal(offlineRows.length, 1, "الصف المحلي يظهر بلا نت");
  assert.equal(offlineRows[0].id, "local-1");
  assert.equal(cloud.__cloud.calls.length, 0, "بلا إنترنت: صفر استدعاءات سحابية");
  ok("القراءة محلية بالكامل عند انقطاع الاتصال (بلا استدعاء سحابي واحد)");

  cloud.__seedCloud("exam_questions", [
    { ...created, id: "cloud-1", year: YEAR, user_id: "owner-a", choices: [] },
    { ...created, id: "cloud-2", year: YEAR, user_id: "owner-a", choices: [] },
    { ...created, id: "cloud-b1", year: YEAR, user_id: "owner-b", choices: [] },
    { ...created, id: "cloud-b2", year: YEAR, user_id: "owner-b", choices: [] },
  ]);
  const refreshed = await withNavigator(true, () => storage.loadExamQuestions(YEAR));
  assert.deepEqual(
    refreshed.map((row) => row.id).sort(),
    ["cloud-1", "cloud-2"],
    "السحابة مرجع الصفوف غير المعلّقة (المحلي الذي لا نظير له فيها يُحذف)",
  );
  const cloudCalls = cloud.__cloud.calls.filter((call) => call.table === "exam_questions");
  assert.equal(cloudCalls.length, 1, "التحديث محصور بطلب واحد للصفحة الأولى");
  assert.deepEqual(cloudCalls[0].range, [0, 499]);
  assert.deepEqual(
    cloudCalls[0].filters,
    [
      ["user_id", "owner-a"],
      ["year", YEAR],
    ],
    "التحديث محصور بالمالك والعام",
  );
  ok("التحديث السحابي محصور بالعام المطلوب (طلب واحد بمرشّح المالك والعام)");

  // صف محلي لم يُرفع بعد: يجب أن ينجو من التحديث القادم من السحابة
  const pendingQuestion = await withNavigator(false, () =>
    storage.saveExamQuestion(input(), undefined),
  );
  assert.equal(pendingQuestion.user_id, "owner-a");
  const afterEdit = await withNavigator(true, () => storage.loadExamQuestions(YEAR));
  assert.deepEqual(
    afterEdit.map((row) => row.id).sort(),
    ["cloud-1", "cloud-2", pendingQuestion.id].sort(),
    "الصف ذو التعديل المعلّق لا يُطمس بالتحديث السحابي",
  );
  const pending = await db.getPendingChanges();
  assert.equal(
    pending.filter((change) => change.entity === "exam_question").length,
    1,
    "التغيير مسجَّل في الطابور",
  );
  ok("الصفوف ذات التعديل المعلّق محمية أثناء التحديث ومسجَّلة في الطابور");

  sync.__resetSync();
  const savedOffline = await withNavigator(false, () =>
    storage.saveExamQuestion(input({ question: "سؤال مكتوب بدون إنترنت" }), undefined),
  );
  assert.ok(ids.isUuid(savedOffline.id));
  assert.equal(
    (await db.getCachedExamQuestionsForYear("owner-a", YEAR)).some(
      (row) => row.id === savedOffline.id,
    ),
    true,
    "محفوظ محلياً",
  );
  assert.equal(sync.__sync.queued, 1, "جُدول الرفع");
  ok("الحفظ يعمل بلا إنترنت: كتابة محلية + طابور + جدولة رفع");

  const bulk = await withNavigator(false, () =>
    storage.saveExamQuestions([
      input({ question: "سؤال مكتوب بدون إنترنت" }),
      input({ question: "سؤال جديد تمامًا" }),
      input({ question: "سؤال جديد تمامًا" }),
    ]),
  );
  assert.equal(bulk.saved.length, 1, "سؤال واحد جديد فقط");
  assert.equal(bulk.skipped, 2, "مكرّر مع البنك ومكرّر داخل الدفعة");
  ok("الحفظ الجماعي يتخطّى المكرّر (مقارنة بالبنك المحلي وداخل الدفعة)");

  await withNavigator(false, () => storage.deleteExamQuestion(savedOffline.id));
  assert.equal(
    (await db.getCachedExamQuestionsForYear("owner-a", YEAR)).some(
      (row) => row.id === savedOffline.id,
    ),
    false,
  );
  assert.equal(
    (await db.getPendingChanges()).filter(
      (change) => change.entity === "exam_question" && change.op === "delete",
    ).length,
    1,
    "الحذف معلّق للرفع",
  );
  viewAs.__setViewAs({ id: "owner-b", name: "ب" });
  await assert.rejects(
    () => storage.saveExamQuestion(input(), undefined),
    /وضع الاطلاع للقراءة فقط/,
  );
  const viewRows = await withNavigator(true, () => storage.loadExamQuestions(YEAR));
  assert.ok(
    cloud.__cloud.calls.some((call) =>
      call.filters.some(([key, value]) => key === "user_id" && value === "owner-b"),
    ),
    "وضع الاطلاع يقرأ من السحابة",
  );
  assert.equal(viewRows.length, 2, "بيانات صاحب الحساب (المالك ب) ليست محلية");
  viewAs.__setViewAs(null);
  ok("الحذف محلي + معلّق للرفع، ووضع الاطلاع يقرأ سحابياً ويمنع الكتابة");

  console.log("\n✅ نجحت كل اختبارات السجلات المحلية (المرحلة 5).");
} finally {
  await vite.close();
}
