import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

/**
 * اختبار توليد نماذج الاختبار المخصصة لطلاب المسابقة:
 * ربط فئة الحفظ بإجمالي الحفظ، توزيع النماذج داخل الفئة، تخطي من لا حفظ له،
 * وطباعة ورقة باسم الطالب مع فصل الإجابات في مفتاح التصحيح.
 */
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});
try {
  const generator = await vite.ssrLoadModule("/src/utils/examPaperGenerator.ts");
  const studentPapers = await vite.ssrLoadModule("/src/utils/studentExamPapers.ts");
  const print = await vite.ssrLoadModule("/src/utils/examPaperPrint.ts");
  const data = JSON.parse(
    await readFile(new URL("../public/quran/uthmani.json", import.meta.url), "utf8"),
  );

  const byId = (id) => generator.HIFZ_CATEGORIES.find((c) => c.id === id);
  const fixedRng = () => 0.5;

  // ===== ربط إجمالي الحفظ بالفئة =====
  const expected = [
    [0, null],
    [0.4, null],
    [1, "juz29"],
    [2, "juz29"],
    [3, "juz3"],
    [4, "juz3"],
    [5, "juz5"],
    [9, "juz5"],
    [10, "juz10"],
    [14, "juz10"],
    [15, "juz15"],
    [19, "juz15"],
    [20, "juz20"],
    [29, "juz20"],
    [30, "full"],
    [45, "full"],
  ];
  for (const [hifz, categoryId] of expected) {
    const category = studentPapers.categoryForHifz(hifz);
    assert.equal(
      category?.id ?? null,
      categoryId,
      `categoryForHifz(${hifz}) should be ${categoryId}`,
    );
  }
  // الفئة الصريحة تتجاوز الاشتقاق التلقائي
  assert.equal(studentPapers.resolveStudentCategory(1, "juz10").id, "juz10");
  assert.equal(studentPapers.resolveStudentCategory(30, "auto").id, "full");
  assert.equal(studentPapers.resolveStudentCategory(0, "juz30").id, "juz30");

  // ===== اشتقاق إجمالي الحفظ من بيانات الجدول =====
  const derived = studentPapers.toStudentPaperInput({
    id: 7,
    name: "أحمد",
    teacher: "أ. محمد",
    gender: "ذكر",
    yearData: { baseHifz: "25", parts: "12", totalHifz: "20" },
  });
  assert.equal(derived.totalHifz, 30, "base + parts capped at 30");
  assert.equal(derived.teacher, "أ. محمد");
  const fromYearTeacher = studentPapers.toStudentPaperInput({
    id: 8,
    name: "سارة",
    yearData: { baseHifz: "0", parts: "0", teacher: "أ. فاطمة" },
  });
  assert.equal(fromYearTeacher.teacher, "أ. فاطمة", "falls back to yearData.teacher");
  assert.equal(generator.studentTitle("أنثى"), "الطالبة");
  assert.equal(generator.studentTitle("ذكر"), "الطالب");
  assert.equal(generator.studentTitle(undefined), "الطالب/ة");

  // ===== التلقائي: طلاب من فئات مختلفة =====
  const mixed = [
    { id: 1, name: "طالب عمّ ١", totalHifz: 1 },
    { id: 2, name: "طالب عمّ ٢", totalHifz: 2 },
    { id: 3, name: "طالب عمّ ٣", totalHifz: 1 },
    { id: 4, name: "طالب كامل ١", totalHifz: 30 },
    { id: 5, name: "طالب تبارك", totalHifz: 5 },
    { id: 6, name: "بلا حفظ", totalHifz: 0 },
  ];
  const auto = studentPapers.generateStudentPapers(data, mixed, { rng: fixedRng });
  assert.equal(auto.papers.length, 5);
  assert.equal(auto.skipped.length, 1);
  assert.equal(auto.skipped[0].student.id, 6);
  assert.ok(auto.skipped[0].reason.length > 0);

  const juz29Group = auto.papers.filter((p) => p.category.id === "juz29");
  assert.equal(juz29Group.length, 3);
  assert.equal(
    new Set(juz29Group.map((p) => p.paper.label)).size,
    3,
    "زملاء الفئة الواحدة يجب أن يحصلوا على نماذج مختلفة",
  );
  assert.deepEqual(
    juz29Group.map((p) => p.orderInCategory),
    [1, 2, 3],
  );
  assert.equal(juz29Group[0].categoryTotal, 3);
  const fullPaper = auto.papers.find((p) => p.category.id === "full");
  assert.equal(fullPaper.paper.categoryLabel, byId("full").label);
  assert.equal(fullPaper.orderInCategory, 1);

  // ===== فئة موحّدة للجميع =====
  const forced = studentPapers.generateStudentPapers(data, mixed, {
    categoryId: "juz30",
    rng: fixedRng,
  });
  assert.equal(forced.papers.length, 6, "الفئة الموحّدة تشمل من لا حفظ له أيضًا");
  assert.equal(forced.skipped.length, 0);
  assert.ok(forced.papers.every((p) => p.category.id === "juz30"));
  assert.equal(new Set(forced.papers.map((p) => p.paper.label)).size, 6);

  // ===== نطاق اتجاه «من أول المصحف» =====
  const startRange = studentPapers.generateStudentPapers(data, [mixed[3]], {
    categoryId: "juz5",
    direction: "start",
    rng: fixedRng,
  });
  assert.equal(startRange.papers[0].paper.rangeLabel, "الأجزاء 1–5");

  // ===== عدد طلاب يتجاوز ٣٠: الترقيم يستمر فوق القائمة (031…) بمواضع مستقلة =====
  const crowd = Array.from({ length: 40 }, (_, i) => ({
    id: 100 + i,
    name: `طالب ${i + 1}`,
    totalHifz: 1,
  }));
  const crowded = studentPapers.generateStudentPapers(data, crowd, { rng: fixedRng });
  assert.equal(crowded.papers.length, 40);
  assert.equal(crowded.skipped.length, 0);
  const labels = new Set(crowded.papers.map((p) => p.paper.label));
  assert.equal(labels.size, 40, "٤٠ طالبًا = ٤٠ موضعًا مستقلًا (سقف جزء تبارك ٤٧)");
  assert.equal(
    studentPapers.distinctPaperCount(crowded.papers),
    labels.size,
    "distinctPaperCount = عدد النماذج الفعلية",
  );

  // ===== تسميات النماذج فوق القائمة: 01…30 ثم 031…200 =====
  assert.equal(generator.modelLabel(0), "01");
  assert.equal(generator.modelLabel(29), "30");
  assert.equal(generator.modelLabel(30), "031");
  assert.equal(generator.modelLabel(199), "200");
  const beyond30 = generator.generatePapers(data, {
    category: byId("juz5"),
    direction: "end",
    models: 35,
    rng: fixedRng,
    allowBeyondMax: true,
  });
  assert.equal(beyond30.length, 35);
  assert.equal(new Set(beyond30.map((p) => p.label)).size, 35, "ترقيم فريد فوق ٣٠");
  assert.deepEqual(
    beyond30.slice(30, 35).map((p) => p.label),
    ["031", "032", "033", "034", "035"],
  );
  // بلا الراية: السقف الافتراضي 30 كما كان — سلوك تبويب الاختبارات لم يتغيّر
  assert.equal(
    generator.generatePapers(data, { category: byId("juz5"), direction: "end", models: 50 }).length,
    generator.MAX_MODELS,
  );

  // ===== السقف الحقيقي لكل فئة: دقيق، ينجح عنده ويفشل بعده مباشرة =====
  const EXPECTED_CAPS = {
    juz29: { end: 47, start: 47 },
    juz30: { end: 62, start: 62 },
    juz3: { end: 45, start: 49 },
    juz5: { end: 191, start: 71 },
    juz10: { end: 200, start: 110 },
    juz15: { end: 200, start: 128 },
    juz20: { end: 200, start: 188 },
    full: { end: 200, start: 200 },
  };
  for (const cat of generator.HIFZ_CATEGORIES) {
    for (const direction of ["end", "start"]) {
      const cap = generator.maxFeasibleModels(data, cat, direction);
      assert.equal(
        cap,
        EXPECTED_CAPS[cat.id][direction],
        `سقف ${cat.id}/${direction} يجب أن يكون ${EXPECTED_CAPS[cat.id][direction]}`,
      );
      const atCap = generator.generatePapers(data, {
        category: cat,
        direction,
        models: cap,
        rng: fixedRng,
        allowBeyondMax: true,
      });
      assert.equal(atCap.length, cap, `التوليد ينجح عند سقف ${cat.id}/${direction}`);
      assert.equal(
        new Set(atCap.map((p) => p.label)).size,
        cap,
        `تسميات فريدة عند سقف ${cat.id}/${direction}`,
      );
      if (cap < generator.HARD_MODEL_CEILING) {
        assert.throws(
          () =>
            generator.generatePapers(data, {
              category: cat,
              direction,
              models: cap + 1,
              rng: fixedRng,
              allowBeyondMax: true,
            }),
          /نطاق الحفظ لا يكفي/,
          `التوليد يفشل بعد سقف ${cat.id}/${direction}`,
        );
      }
    }
  }

  // ===== فصل من ٦٠ طالبًا في جزء تبارك: ٤٧ موضعًا يتشاركها اثنان اثنان =====
  const bigClass = Array.from({ length: 60 }, (_, i) => ({
    id: 400 + i,
    name: `طالب الفصل الكبير ${i + 1}`,
    totalHifz: 1,
  }));
  const bigResult = studentPapers.generateStudentPapers(data, bigClass, { rng: fixedRng });
  assert.equal(bigResult.papers.length, 60, "لا يسقط أحد من الفصل الكبير");
  const usage = new Map();
  for (const p of bigResult.papers) {
    usage.set(p.paper.label, (usage.get(p.paper.label) ?? 0) + 1);
  }
  assert.equal(usage.size, 47, "٦٠ طالبًا = ٤٧ موضعًا مستقلًا (سقف جزء تبارك)");
  assert.equal(Math.max(...usage.values()), 2, "أقصى مشاركة: نموذجان لكل موضع");
  assert.equal(
    [...usage.values()].filter((c) => c === 2).length,
    60 - 47,
    "١٣ موضعًا يتشاركها اثنان اثنان",
  );

  // ===== فئة ضيقة مع طلاب كثر: اختيار المعلم الصريح يُحترم دون فشل الدفعة =====
  const narrow = Array.from({ length: 60 }, (_, i) => ({
    id: 200 + i,
    name: `طالب ضيق ${i + 1}`,
    totalHifz: 1,
  }));
  const narrowResult = studentPapers.generateStudentPapers(data, narrow, {
    categoryId: "juz29",
    models: 30,
    rng: fixedRng,
  });
  assert.equal(narrowResult.papers.length, 60, "يجب ألا تسقط الدفعة كاملة");
  assert.equal(
    new Set(narrowResult.papers.map((p) => p.paper.label)).size,
    30,
    "اختيار المعلم ٣٠ نموذجًا يبقى ٣٠ كما هو",
  );

  // ===== عدد النماذج اختيار المعلم: لا يُرفع قسرًا إلى عدد الطلاب =====
  const sixInJuz29 = Array.from({ length: 6 }, (_, i) => ({
    id: 300 + i,
    name: `طالب ٢٩-${i + 1}`,
    totalHifz: 1,
  }));
  const teacherChoice = studentPapers.generateStudentPapers(data, sixInJuz29, {
    categoryId: "juz29",
    models: 2,
    rng: fixedRng,
  });
  assert.equal(teacherChoice.papers.length, 6);
  assert.equal(
    new Set(teacherChoice.papers.map((p) => p.paper.label)).size,
    2,
    "اختيار معلم لنموذجين = نموذجان فقط، والباقي يعيد الاستخدام",
  );
  // الحد الأدنى يُفرض حتى لو طُلب أقل منه
  assert.equal(
    new Set(
      studentPapers
        .generateStudentPapers(data, sixInJuz29, { categoryId: "juz29", models: 1, rng: fixedRng })
        .papers.map((p) => p.paper.label),
    ).size,
    generator.MIN_MODELS,
  );
  // بلا تحديد = الحد الأعلى
  const defaultModels = studentPapers.generateStudentPapers(data, sixInJuz29, {
    categoryId: "juz29",
    rng: fixedRng,
  });
  assert.equal(
    new Set(defaultModels.papers.map((p) => p.paper.label)).size,
    6,
    "افتراضيًا كل طالب في فئة واسعة يحصل على موضع خاص",
  );

  // ===== الطباعة: ورقة باسم الطالب + مفتاح تصحيح مخصص =====
  const entries = auto.papers.map((entry) => ({
    paper: entry.paper,
    student: {
      name: entry.student.name,
      teacher: "أ. محمد",
      gender: "ذكر",
      totalHifz: entry.student.totalHifz,
      orderInCategory: entry.orderInCategory,
      categoryTotal: entry.categoryTotal,
    },
  }));
  const sheet = print.buildPaperHtml(entries[0].paper, "1448", entries[0].student);
  assert.ok(sheet.includes("<b>طالب عمّ ١</b>"), "اسم الطالب يُطبع في الورقة");
  assert.ok(sheet.includes("<b>أ. محمد</b>"), "اسم المعلم يُطبع في الورقة");
  assert.ok(sheet.includes("اسم الطالب:"), "اللقب يتبع الجنس المسجّل");
  assert.ok(sheet.includes("إجمالي الحفظ: 1 جزءًا"));
  assert.ok(sheet.includes("تسلسله في فئته: 1 من 3"));
  assert.ok(sheet.includes('class="paper"') && sheet.includes("وفّقكم الله"));

  // النماذج العامة تبقى بخانات منقّطة (لا أسماء)
  const generic = print.buildPaperHtml(entries[0].paper, "1448");
  assert.ok(generic.includes("اسم الطالب/الطالبة: ."));
  assert.ok(!generic.includes("<b>"));

  // حماية من الحقن في أسماء الطلاب
  const xss = print.buildPaperHtml(entries[0].paper, "1448", {
    name: '<script>alert("x")</script>',
    teacher: "<b>x</b>",
  });
  assert.ok(!xss.includes("<script>"), "يجب تهريب اسم الطالب");
  assert.ok(xss.includes("&lt;script&gt;"));

  const key = print.buildStudentAnswerKeyHtml(entries, "1448");
  assert.ok(key.includes("توزيع النماذج على الطلاب"));
  for (const entry of entries) {
    assert.ok(key.includes(entry.student.name), `المفتاح يذكر ${entry.student.name}`);
  }
  // فصل الإجابات: ورقة الطالب لا تحتوي إجابات الأسئلة الإضافية
  for (const entry of entries) {
    for (const q of entry.paper.supplements) {
      const studentSheet = print.buildPaperHtml(entry.paper, "1448", entry.student);
      assert.ok(!studentSheet.includes(q.answer), "ورقة الطالب يجب ألا تكشف الإجابة");
    }
  }
  for (const q of entries[0].paper.supplements) {
    assert.ok(key.includes(q.answer), "المفتاح يحتوي الإجابة");
  }
  // النماذج المشتركة تُذكر مرة واحدة فقط في جدول المواضع
  const usedOnce = key.split("مواضع أسئلة الحفظ لكل نموذج").length === 2;
  assert.ok(usedOnce);

  // ===== الملخص حسب الفئة =====
  const summary = studentPapers.summarizeByCategory(auto.papers);
  assert.equal(
    summary.reduce((sum, row) => sum + row.count, 0),
    auto.papers.length,
  );
  const order = summary.map((row) => row.category.id);
  const canonical = generator.HIFZ_CATEGORIES.map((c) => c.id);
  assert.deepEqual(
    order,
    [...order].sort((a, b) => canonical.indexOf(a) - canonical.indexOf(b)),
    "ترتيب الملخص يتبع ترتيب الفئات المعتمد",
  );

  console.log(
    `✅ Verified student papers: category mapping, per-category distribution, ` +
      `exact caps (تبرك ٤٧ / عمّ ٦٢ / ٣ أجزاء ٤٥ / ٥ أجزاء ١٩١ …), ` +
      `${crowded.papers.length}+${narrowResult.papers.length}+${bigResult.papers.length} crowded batches, skipping, ` +
      `named sheets, escaping and answer-key separation.`,
  );
} finally {
  await vite.close();
}
