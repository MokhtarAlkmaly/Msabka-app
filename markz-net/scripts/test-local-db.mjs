/**
 * اختبار قاعدة البيانات المحلية — يشغّل طبقة localDB الحقيقية فوق sql.js
 * بنفس المخطط الحقيقي المستخرج من sqliteClient.ts.
 *
 *   node scripts/test-local-db.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTestBundle, installBrowserShim, createTestRunner } from "./test-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

installBrowserShim();

const outfile = await buildTestBundle({
  stdinSource: `
export * from ${JSON.stringify(path.join(ROOT, "src/utils/localDB.ts"))};
export { getDB } from "./sqliteClient";
`,
  outfile: path.join(ROOT, ".output/tests/test-local-db.mjs"),
});

const db = await import(outfile);

const { ok, finish } = createTestRunner();
console.log("اختبار قاعدة البيانات المحلية (sql.js + المخطط الحقيقي)\n");

const USER_A = "user-a";
const USER_B = "user-b";

await ok("المخطط: كل الجداول العشرين موجودة", async () => {
  const conn = await db.getDB();
  const res = await conn.query(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  );
  const names = (res.values ?? []).map((r) => r.name).sort();
  const expected = [
    "app_users",
    "awards",
    "certificates",
    "ceremony_expenses",
    "data_grants",
    "donors",
    "external_competitions",
    "hifz_history",
    "internal_competitions",
    "media",
    "meta",
    "monthly_submissions",
    "monthly_tracking",
    "pending_changes",
    "settings",
    "students",
    "teacher_bonuses",
    "teacher_portals",
    "teachers",
    "year_data",
  ].sort();
  const missing = expected.filter((t) => !names.includes(t));
  if (missing.length > 0) throw new Error(`جداول مفقودة: ${missing.join(", ")}`);
  if (names.length !== expected.length) {
    throw new Error(`عدد الجداول ${names.length} بدل ${expected.length}: ${names.join(",")}`);
  }
});

await ok("الطلاب: putItem/getItem/getAllItems/deleteItem", async () => {
  await db.putCachedStudent({
    id: 1,
    name: "طالبة تجريبية",
    teacher: "معلمة أولى",
    user_id: USER_A,
    gender: "female",
    hijri_join_date: null,
    initial_hifz: null,
    first_competition_year: null,
    status: "طبيعي",
    school_grade: null,
    guardian_phone: null,
    student_phone: null,
    custom_fields: { عمود: "قيمة" },
    notes: null,
  });
  await db.putCachedStudent({
    id: 2,
    name: "طالبة ثانية",
    teacher: "",
    user_id: USER_A,
    gender: null,
    hijri_join_date: null,
    initial_hifz: null,
    first_competition_year: null,
    status: "طبيعي",
    school_grade: null,
    guardian_phone: null,
    student_phone: null,
    custom_fields: {},
    notes: null,
  });

  const all = await db.getCachedStudents();
  if (all.length !== 2) throw new Error(`عدد الطلاب ${all.length} بدل 2`);
  if (all[0].name !== "طالبة تجريبية") throw new Error("الاسم غير مطابق");
  if (typeof all[0].custom_fields !== "object" || all[0].custom_fields.عمود !== "قيمة") {
    throw new Error("الحقول المخصصة لم تُخزَّن/تُسترجع ككائن");
  }

  await db.deleteCachedStudent(2);
  const after = await db.getCachedStudents();
  if (after.length !== 1) throw new Error("الحذف لم يعمل");

  // تحديث صف قائم يعمل upsert لا تكراراً
  await db.putCachedStudent({ ...all[0], name: "اسم محدث" });
  const renamed = await db.getCachedStudents();
  if (renamed.length !== 1 || renamed[0].name !== "اسم محدث") {
    throw new Error("التحديث (upsert) لم يعمل");
  }
});

await ok("بيانات الأعوام والحفظ: كتابة وقراءة لعام واحد", async () => {
  await db.putCachedYearData({
    student_id: 1,
    year: "1447",
    base_hifz: "5",
    total_hifz: "7",
    parts: "2",
    annual: "18",
    recitation: "40",
    memorization: "35",
    total: "93",
    grade: "ممتاز",
    prize: "15000",
    status_prize: "",
    rank: "1",
    teacher: "معلمة أولى",
  });
  await db.putCachedHifzRow({ student_id: 1, year_key: "h1447", value: "2" });

  const forYear = await db.getCachedYearDataForYear("1447");
  if (forYear.length !== 1 || forYear[0].total !== "93") throw new Error("قراءة عام خاطئة");

  const history = await db.getCachedHifzHistoryForStudents([1]);
  if (history.length !== 1 || history[0].value !== "2") throw new Error("قراءة الحفظ خاطئة");

  const forStudent = await db.getCachedYearDataForStudent(1);
  if (forStudent.length !== 1) throw new Error("قراءة طالب خاطئة");
});

await ok("الإعدادات: مفاتيح مقيدة بالمستخدم", async () => {
  await db.setCachedSetting(`${USER_A}:active_year`, "1447");
  await db.setCachedSetting(`${USER_B}:active_year`, "1448");

  const a = await db.getCachedSetting(`${USER_A}:active_year`);
  const b = await db.getCachedSetting(`${USER_B}:active_year`);
  if (a !== "1447" || b !== "1448") throw new Error("الإعدادات غير معزولة");
});

await ok("المتابعة الشهرية والبوابة والترسيلات: CRUD كامل", async () => {
  await db.putMonthlyTracking({
    user_id: USER_A,
    student_id: 1,
    year: "1447",
    month: 9,
    memorization_from_surah: 1,
    memorization_from_ayah: 1,
    memorization_to_surah: 2,
    memorization_to_ayah: 20,
    memorization_hifz_score: 22,
    memorization_recitation_score: 13,
    review_from_surah: 1,
    review_from_ayah: 1,
    review_to_surah: 1,
    review_to_ayah: 100,
    review_hifz_score: 20,
    review_recitation_score: 12,
    attendance_score: 9,
    behavior_score: 8,
  });
  const month = await db.getMonthlyTrackingForMonth(USER_A, "1447", 9);
  if (month.length !== 1 || month[0].memorization_hifz_score !== 22) {
    throw new Error("قراءة المتابعة الشهرية خاطئة");
  }
  const forStudent = await db.getMonthlyTrackingForStudent(USER_A, "1447", 1);
  if (forStudent.length !== 1) throw new Error("قراءة متابعة الطالب خاطئة");
  const latest = await db.getLatestMonthlyTrackingPeriod(USER_A);
  if (latest?.year !== "1447" || latest?.month !== 9) throw new Error("أحدث فترة خاطئة");

  await db.putTeacherPortal({
    id: "portal-1",
    user_id: USER_A,
    teacher_name: "معلمة أولى",
    code: "abcd2345",
    year: "1447",
    month: 9,
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
  const byCode = await db.getTeacherPortalByCode("abcd2345");
  if (!byCode || byCode.teacher_name !== "معلمة أولى") throw new Error("قراءة الرابط بالكود خاطئة");

  await db.putSubmission({
    id: "sub-1",
    user_id: USER_A,
    portal_id: "portal-1",
    code: "abcd2345",
    student_id: 1,
    student_name: "طالبة تجريبية",
    year: "1447",
    month: 9,
    memorization_from_surah: 1,
    memorization_from_ayah: 1,
    memorization_to_surah: 2,
    memorization_to_ayah: 20,
    memorization_hifz_score: 22,
    memorization_recitation_score: 13,
    review_from_surah: null,
    review_from_ayah: null,
    review_to_surah: null,
    review_to_ayah: null,
    review_hifz_score: 0,
    review_recitation_score: 0,
    attendance_score: 9,
    behavior_score: 8,
    notes: null,
    status: "pending",
    source: "portal",
    teacher_name: "معلمة أولى",
    review_note: null,
    reviewed_at: null,
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  });
  const subs = await db.getSubmissions(USER_A, { status: "pending" });
  if (subs.length !== 1) throw new Error("قراءة الترسيلات بالمرشح خاطئة");
  const byPortal = await db.getSubmissionByPortalAndStudent("portal-1", 1);
  if (!byPortal || byPortal.id !== "sub-1") throw new Error("قراءة ترسيل البوابة خاطئة");

  await db.deleteMonthlyTrackingForStudentYear(USER_A, "1447", 1);
  const afterDelete = await db.getMonthlyTrackingForStudent(USER_A, "1447", 1);
  if (afterDelete.length !== 0) throw new Error("حذف متابعة الطالب/العام لم يعمل");
});

await ok("deleteAllRowsForUser: حذف مستخدم لا يمسّ بيانات غيره ولا الحسابات", async () => {
  // بيانات لمستخدم ثانٍ + حسابات مستخدمين في جدول app_users
  const conn = await db.getDB();
  await conn.run(
    `INSERT INTO app_users (id, email, password_hash, display_name, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["u-admin", "admin@markz.local", "x", "المسؤولة", 1, "2026-01-01T00:00:00.000Z"],
  );
  await db.putCachedStudent({
    id: 50,
    name: "طالبة المستخدم الثاني",
    teacher: "",
    user_id: USER_B,
    gender: null,
    hijri_join_date: null,
    initial_hifz: null,
    first_competition_year: null,
    status: "طبيعي",
    school_grade: null,
    guardian_phone: null,
    student_phone: null,
    custom_fields: {},
    notes: null,
  });
  await db.setCachedSetting(`${USER_B}:active_year`, "1448");

  await db.deleteAllRowsForUser(USER_A);

  const studentsLeft = await db.getCachedStudents();
  if (studentsLeft.length !== 1 || studentsLeft[0].user_id !== USER_B) {
    throw new Error("حذف بيانات المستخدم الأول مسّ بيانات الثاني");
  }
  const bSetting = await db.getCachedSetting(`${USER_B}:active_year`);
  if (bSetting !== "1448") throw new Error("إعدادات المستخدم الثاني حُذفت خطأً");
  const users = await conn.query(`SELECT id FROM app_users`);
  if ((users.values ?? []).length !== 1) throw new Error("جدول الحسابات تأثر بالحذف");
  const subsLeft = await db.getSubmissions(USER_A);
  if (subsLeft.length !== 0) throw new Error("ترسيلات المستخدم الأول لم تُحذف");
});

finish("اختبار قاعدة البيانات المحلية");
