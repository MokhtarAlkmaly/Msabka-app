/**
 * اختبارات سجل المعلمين والمعلمات العام (مستقل عن الأعوام):
 *   1) توحيد الصفوف: اسم واحد لكل معلم/ة مهما تكرّرت صفوفه في أعوام مختلفة.
 *   2) دمج الأسماء الواردة من الإكراميات/الجوائز/الشهادات.
 *   3) تجميع الطلاب حسب المعلم/ة واستخراج أعوام حلقاتهم.
 *   4) احتساب الإكراميات الشهرية والسنوية (الإجمالي لعام محدد أو لكل الأعوام).
 *
 * التشغيل: npm run test:teachers
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
  const registry = await vite.ssrLoadModule("/src/lib/teacher-registry.ts");
  const shared = await vite.ssrLoadModule("/src/components/teachers/shared.ts");

  console.log("\nالسجل العام — قيمة العام والتوحيد:");
  assert.equal(registry.GLOBAL_TEACHER_YEAR, "all");
  assert.equal(shared.YEARS.length, 10);
  assert.equal(shared.YEARS[0], "1441");
  assert.equal(shared.HIJRI_MONTHS.length, 12);
  ok("قيمة العام للسجل العام والأعوام والأشهر الهجرية");

  const rows = [
    { id: "t1", user_id: "u1", year: "1445", name: " عبدالله أحمد ", updated_at: "2025-01-01" },
    { id: "t2", user_id: "u1", year: "1446", name: "عبدالله أحمد", updated_at: "2026-01-01" },
    { id: "t3", user_id: "u1", year: "1447", name: "زينب محمد", updated_at: "2026-02-01" },
    { id: "t4", user_id: "u1", year: "all", name: "أحمد صالح", updated_at: "2026-03-01" },
    { id: "t5", user_id: "u1", year: "all", name: "   ", updated_at: "2026-03-01" },
  ];
  const deduped = registry.dedupeTeachersByName(rows);
  assert.equal(deduped.length, 3, "اسم واحد لكل معلم/ة + تجاهل الاسم الفارغ");
  assert.deepEqual(
    deduped.map((row) => row.name),
    ["أحمد صالح", "زينب محمد", "عبدالله أحمد"],
    "ترتيب أبجدي عربي",
  );
  const abdullah = deduped.find((row) => row.name === "عبدالله أحمد");
  assert.equal(abdullah.id, "t2", "يُحتفظ بأحدث صف حسب updated_at");
  ok("توحيد التكرار: صف واحد لكل اسم مع أحدث بياناته");

  console.log("\nدمج الأسماء من بقية السجلات:");
  const names = registry.mergeTeacherNames(
    ["عبدالله أحمد", "زينب محمد", "عبدالله أحمد"],
    ["أ. سالم", null, ""],
    [undefined, "زينب محمد"],
  );
  assert.deepEqual(names, ["أ. سالم", "زينب محمد", "عبدالله أحمد"]);
  ok("أسماء السجل + الأسماء الواردة من الإكراميات/الجوائز/الشهادات بلا تكرار");

  console.log("\nطلاب كل معلم/ة وأعوام حلقاتهم:");
  const students = [
    { id: 1, name: "طالب", teacher: "عبدالله أحمد", registered_years: ["1445", "1446"] },
    { id: 2, name: "طالبة", teacher: "عبدالله أحمد", registered_years: ["1446D"] },
    { id: 3, name: "ثالث", teacher: "زينب محمد", registered_years: ["1447"] },
    { id: 4, name: "بلا حلقة", teacher: "", registered_years: ["1447"] },
  ];
  const grouped = registry.groupStudentsByTeacher(students);
  assert.equal(grouped.get("عبدالله أحمد").length, 2);
  assert.equal(grouped.get("زينب محمد").length, 1);
  assert.equal(grouped.has(""), false, "الطالب بلا معلم/ة لا يُحسب في حلقة");
  assert.deepEqual(registry.teacherYears(students, "عبدالله أحمد"), ["1445", "1446"]);
  assert.deepEqual(shared.studentsByTeacher(students).get("زينب محمد").length, 1);
  ok("تجميع الطلاب حسب المعلم/ة واستخراج أعوام الحلقات (ذو الحجة تُحسب لعامها)");

  console.log("\nالإكراميات الشهرية والسنوية:");
  const bonuses = [
    { teacher_name: "عبدالله أحمد", year: "1446", month: 1, amount: 500 },
    { teacher_name: "عبدالله أحمد", year: "1446", month: 2, amount: "250" },
    { teacher_name: "عبدالله أحمد", year: "1447", month: 1, amount: 300 },
    { teacher_name: "زينب محمد", year: "1446", month: 1, amount: 400 },
  ];
  assert.equal(shared.monthlyTotalFor(bonuses, "عبدالله أحمد", "1446"), 750);
  assert.equal(shared.monthlyTotalFor(bonuses, "عبدالله أحمد"), 1050);
  assert.equal(shared.monthlyTotalFor(bonuses, "غير موجود"), 0);

  const awards = [
    {
      recipient_name: "عبدالله أحمد",
      recipient_type: "teacher",
      award_type: "annual",
      year: "1446",
      amount: 1000,
    },
    {
      recipient_name: "عبدالله أحمد",
      recipient_type: "teacher",
      award_type: "annual",
      year: "1447",
      amount: 250,
    },
    {
      recipient_name: "زينب محمد",
      recipient_type: "male_teacher",
      award_type: "annual",
      year: "1446",
      amount: 700,
    },
    {
      recipient_name: "زينب محمد",
      recipient_type: "teacher",
      award_type: "certificate",
      award_kind: "in_kind",
      year: "1446",
      amount: 0,
    },
  ];
  assert.equal(shared.annualTotalFor(awards, "عبدالله أحمد", "1446"), 1000);
  assert.equal(shared.annualTotalFor(awards, "عبدالله أحمد"), 1250);
  assert.equal(shared.annualTotalFor(awards, "زينب محمد", "1446"), 700);
  assert.equal(shared.isTeacherRecipient("male_teacher"), true);
  assert.equal(shared.isTeacherRecipient("student"), false);
  assert.equal(shared.formatAmount(1250), "١٬٢٥٠");
  ok("إجماليات الإكراميات الشهرية والسنوية لكل عام ولكل الأعوام مجتمعة");

  console.log("\n✅ نجحت اختبارات سجل المعلمين والمعلمات العام.");
} finally {
  await vite.close();
}
