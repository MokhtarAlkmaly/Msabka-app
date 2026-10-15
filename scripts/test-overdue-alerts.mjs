/**
 * اختبارات «المتأخرات والتنبيهات الذكية»:
 *   1) الشهر الهجري وموسم المتابعة الشهرية (محرم ← رمضان).
 *   2) الطلاب: متابعة فائتة، متابعة بلا تقييم، مواظبة منخفضة، طالب بلا معلم/ة.
 *   3) الطلاب: من السجل العام وغير مسجّلين في العام المختار (بلا تكرار).
 *   4) المعلمون والمعلمات: الإكراميات الشهرية غير المحفوظة، وعدم التنبيه
 *      إذا كان المركز لا يسجّل إكراميات هذا العام أصلاً.
 *   5) المالية: التعهّدات غير المكتملة (مع المبالغ المتبقية)، الداعم بلا مبالغ،
 *      والمصروفات الناقصة.
 *   6) الملخّص والتصفية والبحث العربي والتجميع وكشف الطباعة.
 *
 * التشغيل: npm run test:alerts
 */

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});

const ok = (message) => console.log(`  ✓ ${message}`);

try {
  const lib = await vite.ssrLoadModule("/src/lib/overdue-alerts.ts");

  console.log("\nالشهر الهجري وموسم المتابعة:");
  assert.equal(lib.hijriMonthName(1), "محرم");
  assert.equal(lib.hijriMonthName(9), "رمضان");
  assert.equal(lib.hijriMonthName(12), "ذو الحجة");
  assert.equal(lib.hijriMonthName(99), "ذو الحجة", "قيمة شاذة لا تُخرج الدالة عن النطاق");
  assert.equal(lib.LAST_TRACKING_MONTH, 9);
  assert.equal(lib.isTrackingMonth(1), true);
  assert.equal(lib.isTrackingMonth(9), true);
  assert.equal(lib.isTrackingMonth(11), false, "شوال وما بعده خارج موسم المتابعة");
  ok("أسماء الأشهر وموسم المتابعة الشهرية (محرم ← رمضان)");

  console.log("\nتنبيهات الطلاب (متابعة الشهر والربط بالحلقة):");
  const studentsInYear = [
    { id: 1, name: "أحمد صالح", teacher: "عبدالله أحمد" },
    { id: 2, name: "زينب محمد", teacher: "" },
    { id: 3, name: "سالم عبدالله", teacher: "عبدالله أحمد" },
  ];
  const monthlyRecords = {
    2: { attendanceScore: "4", behaviorScore: "9" }, // مواظبة منخفضة
    3: { attendanceScore: "0", behaviorScore: "" }, // بلا تقييم
    // الطالب 1: لا يوجد سجل ⇒ متابعة فائتة
  };

  const base = lib.buildOverdueAlerts({
    year: "1447",
    month: 3,
    studentsInYear,
    monthlyRecords,
  });
  const kindsOf = (alerts, kind) => alerts.filter((alert) => alert.kind === kind);
  assert.equal(kindsOf(base, "missing-monthly").length, 1);
  assert.equal(kindsOf(base, "missing-monthly")[0].title, "أحمد صالح");
  assert.match(kindsOf(base, "missing-monthly")[0].detail, /ربيع الأول/);
  assert.equal(kindsOf(base, "weak-attendance").length, 1);
  assert.match(kindsOf(base, "weak-attendance")[0].detail, /4 من 10/);
  assert.equal(kindsOf(base, "incomplete-monthly").length, 1);
  assert.equal(kindsOf(base, "incomplete-monthly")[0].title, "سالم عبدالله");
  assert.equal(kindsOf(base, "missing-teacher").length, 1, "زينب بلا معلم/ة فقط");
  assert.equal(kindsOf(base, "missing-teacher")[0].title, "زينب محمد");
  assert.equal(base[0].severity, "high", "الترتيب يبدأ بالأهمية العالية");
  ok("متابعة فائتة + بلا تقييم + مواظبة منخفضة + طالب بلا معلم/ة");

  console.log("\nعند تعذّر جلب المتابعة (بلا اتصال):");
  const offline = lib.buildOverdueAlerts({ year: "1447", month: 3, studentsInYear });
  assert.equal(kindsOf(offline, "missing-monthly").length, 0, "لا تنبيهات متابعة بلا بيانات");
  assert.equal(kindsOf(offline, "weak-attendance").length, 0);
  assert.equal(kindsOf(offline, "missing-teacher").length, 1, "بقية التنبيهات تظل تعمل");
  ok("`monthlyRecords` فارغة/غير متاحة ⇒ تجاوز تنبيهات المتابعة بدل تنبيه كل الطلاب");

  console.log("\nخارج موسم المتابعة (شهر 11):");
  const outside = lib.buildOverdueAlerts({
    year: "1447",
    month: 11,
    studentsInYear,
    monthlyRecords,
  });
  assert.equal(kindsOf(outside, "missing-monthly").length, 0);
  assert.equal(kindsOf(outside, "weak-attendance").length, 0);
  ok("لا تنبيه متابعة في شوال/ذو القعدة/ذو الحجة");

  console.log("\nالمتابعة تُرصد أيضاً في عام ذي الحجة (1447D):");
  const dhulHijjah = lib.buildOverdueAlerts({
    year: "1447D",
    month: 2,
    studentsInYear: [{ id: 9, name: "مريم", teacher: "زينب محمد" }],
    monthlyRecords: {},
    globalStudents: [{ id: 9, name: "مريم", registered_years: ["1447"] }],
  });
  assert.equal(kindsOf(dhulHijjah, "not-registered-in-year").length, 0, "1447D تتبع عام 1447");
  assert.equal(dhulHijjah[0].detail.includes("1447هـ"), true, "يُعرض العام بلا لاحقة D");
  ok("مفتاح العام يُوحَّد (1447D = 1447) بلا تكرار تنبيه التسجيل");

  console.log("\nغير المسجّلين في العام المختار:");
  const globalStudents = [
    { id: 1, name: "أحمد صالح", teacher: "عبدالله أحمد", registered_years: ["1446", "1447"] },
    { id: 5, name: "فاطمة علي", teacher: "زينب محمد", registered_years: ["1446"] },
    { id: 6, name: "خالد سعيد", teacher: "", registered_years: [] },
  ];
  const notRegistered = lib.buildOverdueAlerts({
    year: "1447",
    month: 3,
    studentsInYear,
    globalStudents,
    monthlyRecords,
  });
  const missing = kindsOf(notRegistered, "not-registered-in-year");
  assert.equal(missing.length, 2);
  assert.deepEqual(
    missing.map((alert) => alert.title),
    ["خالد سعيد", "فاطمة علي"],
  );
  assert.match(missing[1].detail, /آخر عام مسجّل: 1446هـ/);
  assert.match(missing[0].detail, /لم يُسجَّل/);
  ok("طلاب السجل العام الغائبون عن العام مع آخر عام مسجّل لهم");

  console.log("\nالإكراميات الشهرية للمعلمين والمعلمات:");
  const bonuses = [
    { teacher_name: "عبدالله أحمد", year: "1447", month: 3 },
    { teacher_name: "زينب محمد", year: "1447", month: 2 },
  ];
  const bonusAlerts = lib.buildOverdueAlerts({
    year: "1447",
    month: 3,
    studentsInYear: [],
    teacherNames: ["أحمد صالح", "زينب محمد", "عبدالله أحمد"],
    bonuses,
  });
  const missingBonus = kindsOf(bonusAlerts, "missing-monthly-bonus");
  assert.deepEqual(
    missingBonus.map((alert) => alert.title),
    ["أحمد صالح", "زينب محمد"],
    "المحفوظ له إكرامية الشهر لا يُنبَّه عليه",
  );
  assert.equal(missingBonus[0].group, "teachers");

  const noBonusRecords = lib.buildOverdueAlerts({
    year: "1447",
    month: 3,
    studentsInYear: [],
    teacherNames: ["أحمد صالح", "زينب محمد"],
    bonuses: [],
  });
  assert.equal(
    kindsOf(noBonusRecords, "missing-monthly-bonus").length,
    0,
    "لا تنبيه إكراميات إذا لم يُسجَّل أي إكرامية في العام",
  );
  ok("تنبيه الإكرامية لمن لم تُحفظ له فقط، وعدم التنبيه إذا لم تُسجَّل إكراميات");

  console.log("\nالمالية: التعهّدات والمصروفات:");
  const donors = [
    { id: "d1", name: "مؤسسة البركة", year: "1447", pledged_amount: 5000, paid_amount: 2000 },
    { id: "d2", name: "أبو محمد", year: "1447", pledged_amount: 1000, paid_amount: 1000 },
    { id: "d3", name: "داعم بلا مبالغ", year: "1447", pledged_amount: 0, paid_amount: 0 },
    { id: "d4", name: "داعم عام سابق", year: "1446", pledged_amount: 900, paid_amount: 0 },
  ];
  const expenses = [
    { id: "e1", year: "1447", category: "حفل", description: "", amount: 0 },
    { id: "e2", year: "1447", category: "جوائز", description: "شراء جوائز", amount: 1500 },
    { id: "e3", year: "1446", category: "قديم", description: "", amount: 0 },
  ];
  const finance = lib.buildOverdueAlerts({
    year: "1447",
    month: 3,
    studentsInYear: [],
    donors,
    expenses,
  });
  const outstanding = kindsOf(finance, "outstanding-pledge");
  assert.equal(outstanding.length, 1);
  assert.equal(outstanding[0].title, "مؤسسة البركة");
  assert.equal(outstanding[0].amount, 3000);
  assert.match(outstanding[0].detail, /المتبقي ٣٬٠٠٠ ريال|المتبقي 3,000 ريال/);
  assert.equal(kindsOf(finance, "incomplete-donor").length, 1);
  assert.equal(kindsOf(finance, "incomplete-expense").length, 1, "مصروف العام فقط");
  assert.equal(kindsOf(finance, "incomplete-expense")[0].link, "/expenses");

  // الكسور في المبالغ لا تُفقد (مهمة في تعهّدات بمبالغ غير صحيحة)
  const withFraction = lib.buildOverdueAlerts({
    year: "1447",
    month: 3,
    studentsInYear: [],
    donors: [{ id: "d5", name: "داعم", year: "1447", pledged_amount: 1000.5, paid_amount: 0 }],
  });
  assert.equal(kindsOf(withFraction, "outstanding-pledge")[0].amount, 1000.5);
  assert.equal(
    lib.formatRiyal(1000.5).includes("1,000.5") || lib.formatRiyal(1000.5).includes("١٬٠٠٠٫٥"),
    true,
  );
  ok("التعهّد غير المكتمل بمبلغه المتبقي (بالكسور) + الداعم بلا مبالغ + المصروف الناقص");

  console.log("\nالملخّص والتصفية والتجميع:");
  const all = lib.buildOverdueAlerts({
    year: "1447",
    month: 3,
    studentsInYear,
    globalStudents,
    monthlyRecords,
    teacherNames: ["أحمد صالح", "زينب محمد", "عبدالله أحمد"],
    bonuses,
    donors,
    expenses,
  });
  const summary = lib.summarizeAlerts(all);
  assert.equal(summary.total, all.length);
  assert.equal(summary.high + summary.medium + summary.low, all.length);
  assert.equal(
    summary.byGroup.students + summary.byGroup.teachers + summary.byGroup.finance,
    all.length,
  );
  assert.equal(summary.byKind["outstanding-pledge"], 1);
  assert.equal(summary.outstandingTotal, 3000);

  const grouped = lib.groupAlerts(all);
  assert.deepEqual(
    grouped.map((group) => group.id),
    ["students", "teachers", "finance"],
  );
  assert.equal(
    grouped.reduce((total, group) => total + group.alerts.length, 0),
    all.length,
  );

  const highOnly = lib.filterAlerts(all, { severity: "high" });
  assert.equal(highOnly.length, summary.high);
  assert.equal(
    highOnly.every((alert) => alert.severity === "high"),
    true,
  );
  const studentsOnly = lib.filterAlerts(all, { kinds: ["missing-monthly", "weak-attendance"] });
  assert.equal(studentsOnly.length, 2);
  const searched = lib.filterAlerts(all, { query: "احمد صالح" });
  assert.equal(searched.length > 0, true, "البحث العربي يجد «أحمد صالح» بلا همزة");
  assert.equal(lib.filterAlerts(all, { query: "غير موجود إطلاقا" }).length, 0);
  assert.equal(lib.filterAlerts(all, {}).length, all.length);
  ok("الملخّص (الأعداد + المبالغ المتأخرة) والتصفية والبحث العربي والتجميع");

  console.log("\nكشف الطباعة:");
  const body = lib.buildAlertsPrintBody(all, {
    year: "1447",
    month: 3,
    logoSrc: "logo.png",
    generatedAt: "الأحد",
  });
  assert.match(body, /كشف المتأخرات والتنبيهات/);
  assert.match(body, /ربيع الأول/);
  assert.match(body, /1447هـ/);
  assert.match(body, /مؤسسة البركة/);
  assert.match(body, /الطلاب/);
  assert.match(body, /إجمالي البنود/);
  assert.equal(
    lib.buildAlertsPrintBody([], { year: "1447", month: 3 }).includes("لا توجد متأخرات"),
    true,
  );
  ok("جسم كشف الطباعة يحتوي الترويسة والبطاقات والأقسام وحالة «لا توجد متأخرات»");

  console.log("\n✅ نجحت اختبارات المتأخرات والتنبيهات الذكية.");
} finally {
  await vite.close();
}
