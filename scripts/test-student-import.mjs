/**
 * اختبارات استيراد سجل الطلاب (`src/lib/student-registry-import.ts`):
 *   1) قالب الاستيراد: الأعمدة والتعليمات وقراءة صف كامل.
 *   2) مرادفات الأعمدة وفروق الهمزات والتاء المربوطة والمسافات.
 *   3) كشف غياب عمود الاسم.
 *   4) تطبيع الجنس والهواتف والأرقام العربية والأعوام.
 *
 * التشغيل: npm run test:student-import
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
  const mod = await vite.ssrLoadModule("/src/lib/student-registry-import.ts");
  const {
    STUDENT_IMPORT_HEADERS,
    STUDENT_IMPORT_INSTRUCTIONS,
    buildStudentRowReader,
    readStudentImportRow,
    normalizeGenderInput,
    normalizePhoneInput,
    normalizeDecimalInput,
    normalizeYearInput,
    toAsciiDigits,
  } = mod;

  console.log("\nقالب الاستيراد:");
  assert.equal(STUDENT_IMPORT_HEADERS.length, 11, "عدد الأعمدة");
  assert.equal(STUDENT_IMPORT_HEADERS[0], "الاسم", "الاسم أولاً");
  assert.ok(
    STUDENT_IMPORT_INSTRUCTIONS.some((row) => row[0] === "الاسم" && row[1] === "نعم"),
    "ورقة التعليمات تشرح عمود الاسم",
  );

  const templateReader = buildStudentRowReader(STUDENT_IMPORT_HEADERS);
  assert.equal(templateReader.hasNameColumn, true, "قالب الاستيراد يحتوي عمود الاسم");
  const templateRow = {
    الاسم: " فاطمة   أحمد ",
    الجنس: "أنثى",
    "المعلم/ة": "سمية",
    "السنة الدراسية": "الرابع الابتدائي",
    الحالة: "يتيمة",
    "تاريخ هجري الالتحاق": "1447-03-15",
    "الحفظ قبل الالتحاق": "5",
    "عام أول مسابقة": "1447",
    "رقم ولي الأمر": "0777123456",
    "رقم الطالب": "733123456",
    ملاحظات: "ملاحظة",
  };
  const templateValues = readStudentImportRow(templateReader, templateRow);
  assert.equal(templateValues.name, "فاطمة أحمد", "توحيد مسافات الاسم");
  assert.equal(templateValues.gender, "أنثى");
  assert.equal(templateValues.teacher, "سمية");
  assert.equal(templateValues.schoolGrade, "الرابع الابتدائي");
  assert.equal(templateValues.status, "يتيمة");
  assert.equal(templateValues.hijriJoinDate, "1447-03-15");
  assert.equal(templateValues.initialHifz, "5");
  assert.equal(templateValues.firstCompetitionYear, "1447");
  assert.equal(templateValues.guardianPhone, "0777123456");
  assert.equal(templateValues.studentPhone, "0733123456");
  assert.equal(templateValues.notes, "ملاحظة");
  ok("يقرأ أعمدة القالب ويطبّع قيم الصف كاملة");

  console.log("\nمرادفات الأعمدة والتطبيع العربي:");
  const aliasReader = buildStudentRowReader([
    "اسم الطالبة",
    "الجنس",
    "المعلمة",
    "الصف",
    "الحاله",
    "تاريخ الالتحاق",
    "الحفظ السابق",
    "أول عام مسابقة",
    "جوال ولي الأمر",
    "هاتف الطالب",
    "الملاحظات",
  ]);
  assert.equal(aliasReader.hasNameColumn, true);
  const aliasValues = readStudentImportRow(aliasReader, {
    "اسم الطالبة": "زينب",
    الجنس: "بنت",
    المعلمة: "أ. مريم",
    الصف: "الثاني الإعدادي",
    الحاله: "طبيعي",
    "تاريخ الالتحاق": "1446-09-01",
    "الحفظ السابق": "3",
    "أول عام مسابقة": "1445",
    "جوال ولي الأمر": "777000111",
    "هاتف الطالب": "733000222",
    الملاحظات: "",
  });
  assert.equal(aliasValues.name, "زينب");
  assert.equal(aliasValues.gender, "أنثى", "بنت ← أنثى");
  assert.equal(aliasValues.teacher, "أ. مريم");
  assert.equal(aliasValues.schoolGrade, "الثاني الإعدادي");
  assert.equal(aliasValues.status, "طبيعي");
  assert.equal(aliasValues.hijriJoinDate, "1446-09-01");
  assert.equal(aliasValues.initialHifz, "3");
  assert.equal(aliasValues.firstCompetitionYear, "1445");
  assert.equal(aliasValues.guardianPhone, "0777000111", "إضافة الصفر البادئ للجوال");
  assert.equal(aliasValues.studentPhone, "0733000222");
  assert.equal(aliasValues.notes, "");
  ok("يقبل المرادفات وفروق الهمزات والتاء المربوطة ويعيد تطبيع القيم");

  assert.equal(buildStudentRowReader(["الطالب", "الجنس"]).hasNameColumn, false);
  assert.equal(buildStudentRowReader([]).hasNameColumn, false);
  ok("يكشف غياب عمود الاسم بوضوح");

  console.log("\nتطبيع القيم:");
  assert.equal(normalizeGenderInput("أنثى"), "أنثى");
  assert.equal(normalizeGenderInput("انثي"), "أنثى");
  assert.equal(normalizeGenderInput("بنت"), "أنثى");
  assert.equal(normalizeGenderInput("female"), "أنثى");
  assert.equal(normalizeGenderInput("ذكر"), "ذكر");
  assert.equal(normalizeGenderInput("ذكور"), "ذكر");
  assert.equal(normalizeGenderInput("ولد"), "ذكر");
  assert.equal(normalizeGenderInput("male"), "ذكر");
  assert.equal(normalizeGenderInput("غير محدد"), undefined);
  assert.equal(normalizeGenderInput(""), undefined);
  ok("الجنس: يقبل ذكر/أنثى وصيغها الشائعة ويتجاهل غير المفهوم");

  assert.equal(normalizePhoneInput("٧٧٧١٢٣٤٥٦"), "0777123456", "أرقام عربية بلا صفر");
  assert.equal(normalizePhoneInput("777123456"), "0777123456", "صفر بادئ مُضاف");
  assert.equal(normalizePhoneInput("0777 123 456"), "0777123456", "مسافات");
  assert.equal(normalizePhoneInput("+967 777 123 456"), "+967777123456", "رقم دولي");
  assert.equal(normalizePhoneInput(""), "");
  ok("الهواتف: أرقام عربية/مسافات/صفر بادئ/رقم دولي");

  assert.equal(normalizeDecimalInput("٥٫٥"), "5.5", "فاصلة عشرية عربية");
  assert.equal(normalizeDecimalInput("5,5"), "5.5", "فاصلة عشرية لاتينية");
  assert.equal(normalizeDecimalInput("5 أجزاء"), "5", "نص حول الرقم");
  assert.equal(normalizeDecimalInput("abc"), "");
  ok("الأجزاء: يقبل الفواصل العربية واللاتينية والنص المرافق");

  assert.equal(normalizeYearInput("١٤٤٧هـ"), "1447");
  assert.equal(normalizeYearInput("1447"), "1447");
  assert.equal(toAsciiDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  ok("الأعوام والأرقام العربية تُحوَّل إلى أرقام إنجليزية");

  const numericReader = buildStudentRowReader(["الاسم", "الحفظ قبل الالتحاق"]);
  assert.equal(
    readStudentImportRow(numericReader, { الاسم: "طالب", "الحفظ قبل الالتحاق": 5 }).initialHifz,
    "5",
    "خلايا Excel الرقمية تُقرأ كنص",
  );
  ok("خلايا Excel الرقمية تُقرأ كنصوص دون فقدان القيمة");

  console.log("\n✅ نجحت اختبارات استيراد سجل الطلاب.");
} finally {
  await vite.close();
}
