/**
 * اختبارات البحث العربي الموحّد (`src/utils/arabicSearch.ts`):
 *   1) تطبيع النص: التشكيل، التطويل، صور الألف، الألف المقصورة، التاء المربوطة،
 *      المسافات الزائدة، وحروف اللاتينية.
 *   2) المطابقة الجزئية بعد التطبيع: «احمد» يجد «أحمد» والعكس.
 *   3) المفتاح المتعدد كلمات يطابق كل كلمة في أي ترتيب.
 *   4) المفتاح الفارغ يطابق كل شيء، والنص الفارغ لا يطابق مفتاحًا حقيقيًا.
 *   5) `arabicIncludesAny` للبحث في صفوف بأكثر من حقل.
 *   6) تكامل كشف الأسماء المكررة (`studentNames`) مع التطبيع المشترك.
 *
 * التشغيل: npm run test:search
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
  const search = await vite.ssrLoadModule("/src/utils/arabicSearch.ts");
  const names = await vite.ssrLoadModule("/src/utils/studentNames.ts");
  const { normalizeArabic, arabicIncludes, arabicIncludesAny } = search;

  console.log("\nتطبيع النص العربي:");
  assert.equal(normalizeArabic("  أحمد  محمَّد "), "احمد محمد", "مسافات زائدة وتشكيل");
  assert.equal(normalizeArabic("محمّــد"), "محمد", "تطويل وتشكيل");
  assert.equal(normalizeArabic("إسلام"), "اسلام", "همزة على الألف");
  assert.equal(normalizeArabic("إسماعيل"), "اسماعيل", "همزة تحت الألف");
  assert.equal(normalizeArabic("آمنة"), "امنه", "همزة مد + تاء مربوطة");
  assert.equal(normalizeArabic("مصطفى"), "مصطفي", "ألف مقصورة");
  assert.equal(normalizeArabic("عبد الله\tبن\nمحمد"), "عبد الله بن محمد", "مسافات وأسطر");
  assert.equal(normalizeArabic("John  DOE"), "john doe", "لاتيني بدون حروف كبيرة");
  assert.equal(normalizeArabic(""), "", "النص الفارغ");
  assert.equal(normalizeArabic(null), "", "قيمة null");
  assert.equal(normalizeArabic(undefined), "", "قيمة undefined");
  ok("توحيد صور الألف والياء والتاء المربوطة والتشكيل والمسافات");

  console.log("\nالمطابقة الجزئية بعد التطبيع:");
  assert.equal(arabicIncludes("أحمد بن محمد", "احمد"), true, "همزة مختلفة");
  assert.equal(arabicIncludes("احمد بن محمد", "أحمد"), true, "العكس");
  assert.equal(arabicIncludes("محمَّد علي", "محمد"), true, "تشكيل في المخزَّن");
  assert.equal(arabicIncludes("محمد علي", "محمَّد"), true, "تشكيل في المفتاح");
  assert.equal(arabicIncludes("فاطمة", "فاطمه"), true, "تاء مربوطة مقابل هاء");
  assert.equal(arabicIncludes("مصطفي", "مصطفى"), true, "ألف مقصورة مقابل ياء");
  assert.equal(arabicIncludes("عبدالله", "عبد الله"), true, "الاسم المركب يُوجد حتى بدون مسافة");
  assert.equal(arabicIncludes("عبد الله", "عبدالله"), true, "والعكس صحيح");
  assert.equal(arabicIncludes("John Doe", "john"), true, "بدون حروف كبيرة");
  assert.equal(arabicIncludes("", "أحمد"), false, "النص الفارغ لا يطابق مفتاحًا");
  assert.equal(arabicIncludes(null, "أحمد"), false, "قيمة null");
  assert.equal(arabicIncludes("أحمد", ""), true, "المفتاح الفارغ يطابق كل شيء");
  assert.equal(arabicIncludes("أحمد", "   "), true, "المفتاح المسافاتي يطابق كل شيء");
  ok("يجد «احمد» عند وجود «أحمد» في كل الاتجاهات");

  console.log("\nالمفتاح المتعدد كلمات (كل كلمة في أي ترتيب):");
  assert.equal(arabicIncludes("أحمد بن محمد", "محمد احمد"), true, "ترتيب مستقل");
  assert.equal(arabicIncludes("أحمد بن محمد", "أحمد محمد"), true, "كلمتان موجودتان");
  assert.equal(arabicIncludes("أحمد بن محمد", "أحمد علي"), false, "كلمة غير موجودة");
  assert.equal(arabicIncludes("عبد الرحمن الشمري", "الشمري عبد"), true, "اسم ثلاثي بترتيب مقلوب");
  ok("«محمد احمد» يجد «أحمد بن محمد»");

  console.log("\nالبحث في صفوف متعددة الحقول:");
  const row = {
    student_name: "زينب عبدالله",
    competition_name: "مسابقة المدينة",
    category: "تحفيظ",
    rank: "المركز الأول",
    organizer: "",
  };
  assert.equal(arabicIncludesAny("زينب", [row.student_name, row.competition_name]), true);
  assert.equal(arabicIncludesAny("المدينه", [row.student_name, row.competition_name]), true);
  assert.equal(arabicIncludesAny("الاول", [row.category, row.rank]), true);
  assert.equal(arabicIncludesAny("غير موجود", [row.student_name, row.competition_name]), false);
  assert.equal(arabicIncludesAny("أي شيء", [row.organizer]), false, "الحقل الفارغ لا يطابق");
  ok("يطابق أي حقل من الحقول بعد التطبيع");

  console.log("\nتكامل كشف الأسماء المكررة:");
  assert.equal(names.normalizeStudentName("  أحمَد "), "احمد");
  const students = [
    { name: "أحمد محمد" },
    { name: "احمد محمد" },
    { name: "أحمد  محمد" },
    { name: "زينب" },
  ];
  const duplicates = names.getDuplicateNameCounts(students);
  assert.equal(duplicates.size, 1, "ثلاثة أشكال لاسم واحد = مجموعة مكررة واحدة");
  assert.equal(duplicates.get("احمد محمد"), 3);
  assert.equal(names.getDuplicateCountFor("آحمد محمّد", duplicates), 3);
  assert.equal(names.getDuplicateCountFor("زينب", duplicates), 0);
  ok("كشف التكرار يستخدم التطبيع نفسه دون تغيير سلوكه");

  console.log("\n✅ نجحت اختبارات البحث العربي الموحّد.");
} finally {
  await vite.close();
}
