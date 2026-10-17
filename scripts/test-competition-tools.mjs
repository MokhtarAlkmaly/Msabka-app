/**
 * اختبارات أدوات المسابقة بعد نقلها من صفحة المسابقة إلى الإعدادات:
 *   1) منطق العام والنوع المشترك (`src/lib/competition-year.ts`): مفاتيح الأعوام
 *      (1447 و1447D)، التسميات، القيم غير الصالحة، قائمة الأعوام.
 *   2) مشاركة نوع المسابقة مع صفحة المسابقة عبر localStorage (بما فيه القيم
 *      التالفة وغياب المتصفح).
 *   3) أنماط الحذف وعبارات التأكيد.
 *   4) التركيب: صفحة المسابقة لم تعد تحتوي الأدوات، والإعدادات تستضيف اللوحة.
 *   5) عرض اللوحة فعلياً (SSR): الأدوات والوضع العادي ووضع الاطلاع.
 *
 * التشغيل: npm run test:competition-tools
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTestVite } from "./test-doubles/vite-plugin.mjs";

const vite = await createTestVite({
  "/utils/storage.ts": "competitionStorage.mjs",
  "/utils/viewAs.ts": "viewAs.mjs",
});

const ok = (message) => console.log(`  ✓ ${message}`);
const section = (title) => console.log(`\n${title}`);
const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/** تخزين محلي وهمي يُزرع في globalThis ويُزال بعد الاختبار. */
const withLocalStorage = async (initial, fn) => {
  const store = new Map(Object.entries(initial ?? {}));
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  });
  try {
    return await fn(store);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previous });
  }
};

try {
  const competition = await vite.ssrLoadModule("/src/lib/competition-year.ts");
  const { START_YEAR, END_YEAR, formatYearKey } = await vite.ssrLoadModule("/src/types/student.ts");
  const {
    COMPETITION_LABELS,
    COMPETITION_DELETE_MODES,
    COMPETITION_TYPE_STORAGE_KEY,
    competitionBaseYear,
    competitionDeletePhrase,
    competitionLabelFor,
    competitionYearKey,
    competitionYearLabel,
    competitionYears,
    normalizeCompetitionType,
    readStoredCompetitionType,
    storeCompetitionType,
  } = competition;

  // ==========================================================
  section("١) مفاتيح الأعوام والتسميات:");

  assert.equal(competitionYearKey("1447", "ramadan"), "1447", "رمضان = العام نفسه");
  assert.equal(competitionYearKey("1447", "dhul_hijjah"), "1447D", "عشر ذي الحجة = عام + D");
  assert.equal(
    competitionYearKey("1447D", "ramadan"),
    "1447",
    "التبديل من ذي الحجة إلى رمضان يزيل اللاحقة",
  );
  assert.equal(
    competitionYearKey("1447D", "dhul_hijjah"),
    "1447D",
    "لا تتضاعف اللاحقة عند إعادة الاختيار",
  );
  assert.equal(competitionBaseYear("1447D"), "1447");
  assert.equal(competitionBaseYear("1447"), "1447");
  ok("competitionYearKey يبني 1447 و1447D دون تكرار اللاحقة");

  assert.equal(competitionLabelFor("ramadan"), "المسابقة الرمضانية");
  assert.equal(competitionLabelFor("dhul_hijjah"), "مسابقة عشر ذي الحجة");
  assert.equal(
    competitionYearLabel("1447", "dhul_hijjah"),
    formatYearKey("1447D"),
    "تسمية العام تطابق تنسيق مفاتيح الأعوام في التطبيق",
  );
  ok("تسميات المسابقة والعام مطابقة لما تعرضه صفحة المسابقة");

  assert.equal(normalizeCompetitionType("dhul_hijjah"), "dhul_hijjah");
  assert.equal(normalizeCompetitionType("ramadan"), "ramadan");
  assert.equal(normalizeCompetitionType(null), "ramadan", "قيمة فارغة تسقط إلى الافتراضي");
  assert.equal(normalizeCompetitionType("غير معروف"), "ramadan");
  assert.equal(
    normalizeCompetitionType("غير معروف", "dhul_hijjah"),
    "dhul_hijjah",
    "يمكن تحديد بديل آخر",
  );
  assert.equal(competitionLabelFor("قيمة تالفة"), COMPETITION_LABELS.ramadan);
  ok("normalizeCompetitionType لا يكسر الصفحة عند قيمة تالفة");

  const years = competitionYears();
  assert.equal(years[0], String(START_YEAR), "أول عام في النطاق");
  assert.equal(years.at(-1), String(END_YEAR), "آخر عام في النطاق");
  assert.equal(years.length, END_YEAR - START_YEAR + 1, "عدد الأعوام");
  assert.ok(
    years.every((year) => /^\d+$/.test(year)),
    "كلها نصوص رقمية لمكوّن Select",
  );
  ok(`competitionYears يغطي ${START_YEAR}هـ حتى ${END_YEAR}هـ`);

  // ==========================================================
  section("٢) مشاركة نوع المسابقة مع صفحة المسابقة:");

  assert.equal(COMPETITION_TYPE_STORAGE_KEY, "competitionType", "نفس مفتاح صفحة المسابقة");
  await withLocalStorage({}, async (store) => {
    assert.equal(readStoredCompetitionType(), "ramadan", "الافتراضي عند عدم وجود قيمة");
    storeCompetitionType("dhul_hijjah");
    assert.equal(store.get(COMPETITION_TYPE_STORAGE_KEY), "dhul_hijjah", "يُكتب في التخزين");
    assert.equal(readStoredCompetitionType(), "dhul_hijjah", "ويُقرأ منه");
    store.set(COMPETITION_TYPE_STORAGE_KEY, "قيمة تالفة");
    assert.equal(readStoredCompetitionType(), "ramadan", "القيمة التالفة تسقط إلى الافتراضي");
  });
  ok("الحفظ والقراءة يعملان عبر localStorage بنفس مفتاح صفحة المسابقة");

  await withLocalStorage({}, async (store) => {
    store.getItem = () => {
      throw new Error("التخزين محظور");
    };
    store.setItem = () => {
      throw new Error("التخزين محظور");
    };
    assert.equal(readStoredCompetitionType(), "ramadan", "لا يرمي عند حظر التخزين");
    storeCompetitionType("dhul_hijjah");
  });
  ok("لا استثناء عندما يرفض المتصفح التخزين (وضع خاص)");

  const previousLocalStorage = globalThis.localStorage;
  delete globalThis.localStorage;
  assert.equal(readStoredCompetitionType(), "ramadan", "خارج المتصفح");
  storeCompetitionType("dhul_hijjah");
  if (previousLocalStorage !== undefined) {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: previousLocalStorage,
    });
  }
  ok("يعمل بدون متصفح (SSR) دون استثناء");

  // ==========================================================
  section("٣) أنماط الحذف وعبارات التأكيد:");

  assert.deepEqual(Object.keys(COMPETITION_DELETE_MODES).sort(), ["selected", "year"]);
  for (const [mode, definition] of Object.entries(COMPETITION_DELETE_MODES)) {
    assert.ok(definition.title?.length > 0, `عنوان ${mode}`);
    assert.ok(definition.description?.length > 0, `وصف ${mode}`);
    assert.ok(definition.phrase?.length > 0, `عبارة تأكيد ${mode}`);
  }
  assert.notEqual(
    COMPETITION_DELETE_MODES.year.phrase,
    COMPETITION_DELETE_MODES.selected.phrase,
    "عبارتا التأكيد مختلفتان",
  );
  assert.equal(competitionDeletePhrase("selected"), COMPETITION_DELETE_MODES.selected.phrase);
  assert.equal(
    competitionDeletePhrase("نمط غير موجود"),
    COMPETITION_DELETE_MODES.year.phrase,
    "نمط غير معروف يسقط إلى حذف العام",
  );
  ok("نمطان للحذف فقط (عام/طلاب) — الحذف الكامل بقي في «الحذف المتقدم»");

  // ==========================================================
  section("٤) النقل من صفحة المسابقة إلى الإعدادات:");

  const competitionSource = await readSource("src/pages/Competition.tsx");
  const settingsSource = await readSource("src/pages/Settings.tsx");
  const panelSource = await readSource("src/components/CompetitionToolsPanel.tsx");

  assert.doesNotMatch(
    competitionSource,
    /components\/ImportExport/,
    "لا استيراد/تصدير في المسابقة",
  );
  assert.doesNotMatch(
    competitionSource,
    /StudentRegistryImport/,
    "لا استيراد سجل طلاب في المسابقة",
  );
  assert.doesNotMatch(
    competitionSource,
    /handleConfirmDelete|deleteDialogOpen|deleteStudentsFromYear/,
    "لا حوار حذف جماعي في المسابقة",
  );
  assert.match(competitionSource, /to="\/settings"/, "رابط يوجّه المستخدم إلى الإعدادات");
  assert.match(
    competitionSource,
    /competitionYearKey\(currentYear, competitionType\)/,
    "الصفحة تستخدم المنطق المشترك لمفتاح العام",
  );
  ok("صفحة المسابقة: الأدوات أُزيلت وبقي رابط للإعدادات ونفس مفتاح العام");

  assert.match(
    settingsSource,
    /<StudentRegistryImportExport readOnly=\{readOnly\} \/>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<CompetitionToolsPanel readOnly=\{readOnly\} activeYear=\{currentYear\} \/>/,
    "لوحة المسابقة بعد أدوات السجل الشامل وبنفس وضع الاطلاع",
  );
  assert.match(
    settingsSource,
    /<CompetitionToolsPanel readOnly=\{readOnly\} activeYear=\{currentYear\} \/>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<SyncBackupPanel \/>/,
    "لوحة المسابقة تسبق لوحة المزامنة",
  );
  ok("الإعدادات تستضيف لوحة أدوات المسابقة بوضع الاطلاع والعام النشط");

  assert.match(panelSource, /deleteYearData\(dataYearKey\)/, "حذف العام يعمل على مفتاح المسابقة");
  assert.match(
    panelSource,
    /deleteStudentsFromYear\(dataYearKey, Array\.from\(selectedIds\)\)/,
    "حذف الطلاب المحددين يعمل على مفتاح المسابقة",
  );
  assert.match(
    panelSource,
    /competitionYearKey\(year, competitionType\)/,
    "المفتاح يُبنى من النوع والعام معاً",
  );
  assert.match(
    panelSource,
    /confirmation\.trim\(\) !== requiredPhrase/,
    "الحذف لا ينفذ بدون عبارة التأكيد",
  );
  ok("الحذف في اللوحة محصور بمفتاح المسابقة ويشترط عبارة التأكيد");

  // ==========================================================
  section("٥) عرض لوحة الأدوات فعلياً:");

  const { CompetitionToolsPanel } = await vite.ssrLoadModule(
    "/src/components/CompetitionToolsPanel.tsx",
  );
  const render = (props) => renderToStaticMarkup(createElement(CompetitionToolsPanel, props));

  const html = render({ readOnly: false, activeYear: "1447" });
  for (const expected of [
    "أدوات المسابقة",
    COMPETITION_LABELS.ramadan,
    COMPETITION_LABELS.dhul_hijjah,
    "استيراد سجل الطلاب",
    "استيراد وتصدير بيانات المسابقة",
    COMPETITION_DELETE_MODES.year.title,
    COMPETITION_DELETE_MODES.selected.title,
    "1447هـ",
  ]) {
    assert.ok(html.includes(expected), `اللوحة تعرض: ${expected}`);
  }
  ok("اللوحة تعرض المسابقتين وأدوات Excel وأداتي الحذف وعام 1447هـ");

  /**
   * خاصية `disabled` الحقيقية في وسم الزر الذي يحوي العنوان. لا يكفي البحث عن
   * كلمة disabled لأنها جزء من أصناف Tailwind (`disabled:opacity-50`).
   */
  const isButtonDisabled = (markup, title) => {
    const index = markup.indexOf(title);
    assert.ok(index > -1, `يوجد زر: ${title}`);
    const start = markup.lastIndexOf("<button", index);
    assert.ok(start > -1, `العنوان داخل وسم زر: ${title}`);
    const openTag = markup.slice(start, markup.indexOf(">", start) + 1);
    return /\sdisabled=""/.test(openTag);
  };
  for (const title of [
    COMPETITION_DELETE_MODES.year.title,
    COMPETITION_DELETE_MODES.selected.title,
  ]) {
    assert.equal(isButtonDisabled(html, title), false, `زر «${title}» مُفعّل لمالك البيانات`);
  }
  ok("أدوات الحذف متاحة لمالك البيانات");

  const readOnlyHtml = render({ readOnly: true, activeYear: "1447" });
  assert.ok(readOnlyHtml.includes("وضع الاطلاع"), "تنبيه وضع الاطلاع");
  for (const title of [
    COMPETITION_DELETE_MODES.year.title,
    COMPETITION_DELETE_MODES.selected.title,
  ]) {
    assert.equal(isButtonDisabled(readOnlyHtml, title), true, `زر «${title}» معطّل في وضع الاطلاع`);
  }
  ok("وضع الاطلاع يعطّل الحذف والاستيراد ويبقي التصدير");

  await vite.close();
  console.log("\n✅ كل اختبارات أدوات المسابقة ناجحة.");
} catch (error) {
  await vite.close();
  console.error("\n❌ فشل اختبار أدوات المسابقة:", error);
  process.exitCode = 1;
}
