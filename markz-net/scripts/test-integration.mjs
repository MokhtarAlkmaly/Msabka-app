/**
 * الاختبارات التكاملية للنسخة المستقلة — تحزّم الشيفرة الحقيقية
 * (storage + localAuth + users + teacherPortal + localDB) وتشغّلها فوق
 * sql.js بنفس المخطط الحقيقي، مع محاكاة متصفح (window/localStorage).
 *
 * السيناريوهات: المصادقة وأول مسؤول، الصلاحيات ومنح الاطلاع، عزل بيانات
 * المستخدمين، وضع الاطلاع للقراءة فقط، حذف قاعدة بيانات مستخدم، بوابة
 * المعلمين/المعلمات والتقرير اليدوي.
 *
 *   node scripts/test-integration.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTestBundle, installBrowserShim, createTestRunner } from "./test-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const win = installBrowserShim();

const outfile = await buildTestBundle({
  stdinSource: `
export * as localAuth from ${JSON.stringify(path.join(ROOT, "src/utils/localAuth.ts"))};
export * as users from ${JSON.stringify(path.join(ROOT, "src/utils/users.ts"))};
export * as storage from ${JSON.stringify(path.join(ROOT, "src/utils/storage.ts"))};
export * as teacherPortal from ${JSON.stringify(path.join(ROOT, "src/utils/teacherPortal.ts"))};
export * as viewAs from ${JSON.stringify(path.join(ROOT, "src/utils/viewAs.ts"))};
`,
  outfile: path.join(ROOT, ".output/tests/test-integration.mjs"),
});

const { localAuth, users, storage, teacherPortal, viewAs } = await import(outfile);

const { ok, finish } = createTestRunner();
console.log("الاختبارات التكاملية للنسخة المستقلة (sql.js + المخطط الحقيقي)\n");

/** دخول بحساب معيّن (يكتب الجلسة في localStorage المحاكى). */
const loginAs = async (email, password) => {
  const user = await localAuth.signIn(email, password);
  return user;
};

const setViewAs = (target) => {
  // مثل التطبيق الحقيقي: عبر setViewAs (تحدّث الذاكرة المؤقتة + localStorage)
  viewAs.setViewAs(target);
};

const adminEmail = "admin@markz.local";
const ownerEmail = "owner@markz.local";
const viewerEmail = "viewer@markz.local";

// ============================================================
// 1) المصادقة وأول مسؤول
// ============================================================

let adminUser, ownerUser, viewerUser;

await ok("المصادقة: أول حساب يصبح مسؤولاً تلقائياً", async () => {
  if ((await localAuth.hasAnyUsers()) !== false)
    throw new Error("قاعدة جديدة يجب أن تكون بلا حسابات");
  adminUser = await localAuth.signUp({
    email: adminEmail,
    password: "admin-pass-123",
    displayName: "المسؤولة",
  });
  if (!adminUser.is_admin) throw new Error("أول حساب يجب أن يكون مسؤولاً");
  if (adminUser.email !== adminEmail) throw new Error("البريد غير مطبّع (normalize)");

  ownerUser = await localAuth.signUp({
    email: ownerEmail,
    password: "owner-pass-123",
    displayName: "صاحبة البيانات",
  });
  if (ownerUser.is_admin) throw new Error("الحساب الثاني يجب ألا يكون مسؤولاً");

  viewerUser = await localAuth.signUp({
    email: viewerEmail,
    password: "viewer-pass-123",
    displayName: "المطالِعة",
  });
  if (viewerUser.is_admin) throw new Error("الحساب الثالث يجب ألا يكون مسؤولاً");

  const listed = await localAuth.listAuthUsers();
  if (listed.length !== 3) throw new Error(`عدد الحسابات ${listed.length} بدل 3`);
});

await ok("المصادقة: الدخول الصحيح والخاطئ وتغيير كلمة المرور", async () => {
  const bad = await localAuth.signIn(ownerEmail, "wrong-password").then(
    () => null,
    (e) => e,
  );
  if (!bad) throw new Error("يجب رفض كلمة المرور الخاطئة");

  const session = await localAuth.signIn(ownerEmail, "owner-pass-123");
  if (session.id !== ownerUser.id) throw new Error("جلسة الدخول لا تطابق الحساب");

  const fromStorage = await localAuth.getSessionUser();
  if (!fromStorage || fromStorage.id !== ownerUser.id)
    throw new Error("الجلسة لا تُقرأ من التخزين");

  await localAuth.changeOwnPassword("owner-pass-123", "owner-pass-456");
  await localAuth.signIn(ownerEmail, "owner-pass-123").then(
    () => {
      throw new Error("كلمة المرور القديمة يجب ألا تعمل بعد التغيير");
    },
    () => {},
  );
  await localAuth.signIn(ownerEmail, "owner-pass-456");
});

await ok("المصادقة: المسؤول يعيد تعيين كلمة مرور مستخدم", async () => {
  await loginAs(adminEmail, "admin-pass-123");
  await localAuth.adminSetPassword(ownerUser.id, "owner-pass-789");
  await loginAs(ownerEmail, "owner-pass-789");
  const again = await localAuth.getSessionUser();
  if (!again || again.id !== ownerUser.id) throw new Error("فشل الدخول بعد إعادة التعيين");

  // مستخدم عادي لا يستطيع
  await loginAs(viewerEmail, "viewer-pass-123");
  const denied = await localAuth.adminSetPassword(ownerUser.id, "hacked-123").then(
    () => null,
    (e) => e,
  );
  if (!denied) throw new Error("غير المسؤول يجب ألا يستطيع إعادة تعيين كلمات المرور");
});

// ============================================================
// 2) بيانات المالك: طلاب + متابعة شهرية
// ============================================================

await ok("التخزين: حفظ طالب وتسجيله بعام ثم قراءته", async () => {
  await loginAs(ownerEmail, "owner-pass-789");

  const id = await storage.saveStudent({
    name: "طالبة الاختبار",
    teacher: "معلمة الرياض",
    gender: "female",
  });
  if (!id || id <= 0) throw new Error("لم يُرجع معرّفاً صالحاً");

  const id2 = await storage.saveStudent({ name: "طالبة ثانية", teacher: "معلمة الرياض" });
  if (id2 === id) throw new Error("المعرفات يجب أن تكون فريدة");

  await storage.registerStudentInYear("1447", id, "معلمة الرياض");
  await storage.registerStudentInYear("1447", id2, "معلمة الرياض");

  const students = await storage.loadStudentsForYear("1447");
  if (students.length !== 2) throw new Error(`عدد طلاب العام ${students.length} بدل 2`);
  if (students[0].name !== "طالبة الاختبار" && students[1].name !== "طالبة الاختبار") {
    throw new Error("الطالبة غير موجودة في قائمة العام");
  }

  await storage.saveYearData("1447", id, {
    baseHifz: "5",
    totalHifz: "6",
    parts: "1",
    annual: "",
    recitation: "38",
    memorization: "35",
    total: "89",
    grade: "جيد جداً",
    prize: "0",
    statusPrize: "",
    rank: "1",
    teacher: "معلمة الرياض",
  });
  const yearData = await storage.loadYearData("1447", id);
  if (yearData.total !== "89" || yearData.teacher !== "معلمة الرياض") {
    throw new Error("قراءة بيانات العام خاطئة");
  }

  await storage.saveHifzHistory(id, { h1446: "5", h1447: "1" });
  const history = await storage.loadHifzHistory(id);
  if (history.h1446 !== "5" || history.h1447 !== "1") throw new Error("قراءة سجل الحفظ خاطئة");
});

await ok("التخزين: المتابعة الشهرية والترتيب وأحدث فترة (محلية بالكامل)", async () => {
  await loginAs(ownerEmail, "owner-pass-789");
  const students = await storage.loadStudentsForYear("1447");
  const id = students.find((s) => s.name === "طالبة الاختبار").id;

  const saved = await storage.saveMonthlyRecord("1447", id, 9, {
    memoFrom: { surah: 1, ayah: 1 },
    memoTo: { surah: 2, ayah: 20 },
    memoHifzScore: "22",
    memoRecitationScore: "13",
    reviewFrom: { surah: 1, ayah: 1 },
    reviewTo: { surah: 1, ayah: 141 },
    reviewHifzScore: "20",
    reviewRecitationScore: "12",
    attendanceScore: "9",
    behaviorScore: "8",
  });
  if (saved !== true) throw new Error("حفظ المتابعة فشل");

  const forMonth = await storage.loadMonthlyTrackingForMonth("1447", 9);
  if (!forMonth[id]) throw new Error("المتابعة غير مقروءة لشهرها");
  if (forMonth[id].memoHifzScore !== "22") throw new Error("قيمة درجة غير مطابقة");

  const prev = await storage.getPreviousMonthEndPoints("1447", id, 10);
  if (prev.memoFrom.surah !== 2 || prev.memoFrom.ayah !== 20) {
    throw new Error("نقطة نهاية الشهر السابق خاطئة");
  }

  const rankings = await storage.getMonthlyRankings("1447", 9);
  if (rankings.length !== 1 || rankings[0].studentId !== id) throw new Error("الترتيب الشهري خاطئ");

  const latest = await storage.getLatestTrackedPeriod();
  if (latest?.year !== "1447" || latest?.month !== 9) throw new Error("أحدث فترة متابعة خاطئة");

  // إعادة الحساب السنوي بعد المتابعة
  const yearData = await storage.loadYearData("1447", id);
  if (!yearData.parts || parseFloat(yearData.parts) <= 0) {
    throw new Error("لم تُحدَّث الأجزاء السنوية من المتابعة الشهرية");
  }

  // فحص الازدواج global
  const dup = await storage.checkGlobalDuplicateName("طالبة  الاختبار");
  if (!dup || dup.studentId !== id) throw new Error("فحص الاسم المكرر لم يجد المطابق");
  const noDup = await storage.checkGlobalDuplicateName("طالبة غير موجودة");
  if (noDup) throw new Error("فحص الاسم المكرر أعاد نتيجة خاطئة");
});

// ============================================================
// 3) الصلاحيات ومنح الاطلاع
// ============================================================

await ok("الصلاحيات: checkIsAdmin وgrant/revoke وlistSharedWithMe", async () => {
  await loginAs(adminEmail, "admin-pass-123");
  if ((await users.checkIsAdmin()) !== true) throw new Error("المسؤول لم يُتعرف عليه");

  const all = await users.listAllUsers();
  if (all.length !== 3) throw new Error(`قائمة المستخدمين ${all.length} بدل 3`);
  if (all[0].is_admin !== true) throw new Error("المسؤول يجب أن يتصدر القائمة");

  // منح الاطلاع: صاحبة البيانات تسمح للمطالِعة
  await loginAs(ownerEmail, "owner-pass-789");
  if ((await users.checkIsAdmin()) !== false) throw new Error("المستخدم العادي عُدّ مسؤولاً");
  await users.grantAccess(viewerUser.id);

  await loginAs(viewerEmail, "viewer-pass-123");
  let shared = await users.listSharedWithMe();
  if (shared.length !== 1 || shared[0].owner_id !== ownerUser.id) {
    throw new Error("المنحة لا تظهر لدى المستفيدة");
  }

  // سحب المنحة يقطع فوراً
  await loginAs(ownerEmail, "owner-pass-789");
  await users.revokeAccess(viewerUser.id);
  await loginAs(viewerEmail, "viewer-pass-123");
  shared = await users.listSharedWithMe();
  if (shared.length !== 0) throw new Error("المنحة المسحوبة ما زالت ظاهرة");
});

await ok("الصلاحيات: ترقية مستخدم لمسؤول (مسؤول فقط) وحدود المستخدم العادي", async () => {
  await loginAs(viewerEmail, "viewer-pass-123");
  const denied = await users.setUserRole(viewerUser.id, true).then(
    () => null,
    (e) => e,
  );
  if (!denied) throw new Error("المستخدم العادي رقّى نفسه بنجاح — خطأ أمني");

  await loginAs(adminEmail, "admin-pass-123");
  await users.setUserRole(viewerUser.id, true);
  await loginAs(viewerEmail, "viewer-pass-123");
  if ((await users.checkIsAdmin()) !== true) throw new Error("الترقية لم تنجح");
  // إرجاعها لحالة عادية لبقية الاختبارات
  await loginAs(adminEmail, "admin-pass-123");
  await users.setUserRole(viewerUser.id, false);
});

// ============================================================
// 4) وضع الاطلاع (قراءة فقط) وعزل البيانات
// ============================================================

await ok("وضع الاطلاع: قراءة مسموحة وكتابة مرفوضة بـ ReadOnlyViewError", async () => {
  await loginAs(ownerEmail, "owner-pass-789");
  await users.grantAccess(viewerUser.id);

  await loginAs(viewerEmail, "viewer-pass-123");
  setViewAs({ id: ownerUser.id, name: "صاحبة البيانات", email: ownerEmail });

  const students = await storage.loadStudentsForYear("1447");
  if (students.length !== 2) throw new Error(`المطالِعة ترى ${students.length} بدل 2`);

  const err = await storage.saveStudent({ name: "محاولة تعديل" }).then(
    () => null,
    (e) => e,
  );
  if (!err || err.name !== "ReadOnlyViewError") {
    throw new Error(`الكتابة أثناء الاطلاع يجب أن ترمي ReadOnlyViewError (رمت: ${err?.name})`);
  }
  const monthlyErr = await storage
    .saveMonthlyRecord("1447", students[0].id, 10, {
      memoFrom: { surah: 1, ayah: 1 },
      memoTo: { surah: 1, ayah: 1 },
      memoHifzScore: "1",
      memoRecitationScore: "1",
      reviewFrom: { surah: 1, ayah: 1 },
      reviewTo: { surah: 1, ayah: 1 },
      reviewHifzScore: "1",
      reviewRecitationScore: "1",
      attendanceScore: "1",
      behaviorScore: "1",
    })
    .then(
      () => null,
      (e) => e,
    );
  if (!monthlyErr || monthlyErr.name !== "ReadOnlyViewError") {
    throw new Error("حفظ المتابعة أثناء الاطلاع يجب أن يُرفض");
  }

  setViewAs(null);
});

await ok("العزل: مستخدم آخر لا يرى طلاب المالك ولا يطّلع دون منحة", async () => {
  await loginAs(adminEmail, "admin-pass-123");
  // المسؤول أنشأ طالبة خاصة به
  const adminStudentId = await storage.saveStudent({ name: "طالبة المسؤولة", teacher: "" });
  await storage.registerStudentInYear("1447", adminStudentId, "");

  const adminStudents = await storage.loadStudentsForYear("1447");
  if (adminStudents.length !== 1 || adminStudents[0].name !== "طالبة المسؤولة") {
    throw new Error("المسؤول يرى طلاب غيره");
  }

  // المطالِعة بلا منحة (سُحبت في اختبار سابق) لا ترى شيئاً
  await loginAs(viewerEmail, "viewer-pass-123");
  const none = await storage.loadStudentsForYear("1447");
  if (none.length !== 0) throw new Error(`المطالِعة بلا منحة ترى ${none.length} طالبة`);

  // وبلا جلسة أصلاً لا شيء
  await localAuth.signOut();
  const anon = await storage.loadStudentsForYear("1447");
  if (anon.length !== 0) throw new Error("بدون تسجيل دخول تُقرأ بيانات");
});

// ============================================================
// 5) حذف قاعدة بيانات مستخدم (عزل الحذف)
// ============================================================

await ok("deleteEntireDatabase: يمسح بيانات الحساب الحالي فقط", async () => {
  await loginAs(ownerEmail, "owner-pass-789");
  await storage.deleteEntireDatabase();

  const ownerStudents = await storage.loadStudentsForYear("1447");
  if (ownerStudents.length !== 0) throw new Error("بيانات المالك لم تُمسح");

  // المسؤول وحساباته وباقي البيانات تبقى
  await loginAs(adminEmail, "admin-pass-123");
  const adminStudents = await storage.loadStudentsForYear("1447");
  if (adminStudents.length !== 1) throw new Error("حذف المالك مسّ بيانات المسؤول");

  const listed = await localAuth.listAuthUsers();
  if (listed.length !== 3) throw new Error("حذف قاعدة بيانات مستخدم مسّ جدول الحسابات");
});

// ============================================================
// 6) بوابة المعلمين والمعلمات + التقرير اليدوي
// ============================================================

await ok("بوابة المعلمين: إنشاء رابط وفتحه بالكود دون تسجيل دخول", async () => {
  await loginAs(ownerEmail, "owner-pass-789");
  const id = await storage.saveStudent({ name: "طالبة البوابة", teacher: "معلمة البوابة" });
  await storage.registerStudentInYear("1447", id, "معلمة البوابة");

  const portal = await teacherPortal.createPortal(ownerUser.id, {
    teacher_name: "معلمة البوابة",
    year: "1447",
    month: 9,
  });
  if (!portal.code || portal.code.length !== 8) throw new Error("كود الرابط غير صالح");
  if (portal.active !== true) throw new Error("الرابط يجب أن يبدأ نشطاً");

  const link = teacherPortal.getPortalLink(portal, "http://localhost:8080");
  if (!link.includes(`/teacher?t=${portal.code}&y=1447&m=9`))
    throw new Error(`الرابط خاطئ: ${link}`);

  // فتح البوابة دون جلسة (تم تسجيل الخروج سابقاً ولسنا داخل بيانات أحد)
  await localAuth.signOut();
  const { portal: view, error } = await teacherPortal.openPortalByCode(portal.code);
  if (error || !view) throw new Error(`فتح البوابة فشل: ${error}`);
  if (view.teacher_name !== "معلمة البوابة") throw new Error("اسم المعلمة خاطئ");
  if (view.students.length !== 1 || view.students[0].student_name !== "طالبة البوابة") {
    throw new Error(`طلاب البوابة ${view.students.length} بدل 1`);
  }
  if (view.students[0].existing !== null) throw new Error("يجب ألا يكون هناك ترسيل سابق");

  // كود خاطئ
  const bad = await teacherPortal.openPortalByCode("wrongcode");
  if (!bad.error) throw new Error("الكود الخاطئ يجب أن يُرفض");
});

await ok("بوابة المعلمين: إرسال واعتماد ورفض وتحديث الترسيل", async () => {
  await loginAs(ownerEmail, "owner-pass-789");
  const portals = await teacherPortal.loadPortals(ownerUser.id, "1447");
  if (portals.length !== 1) throw new Error("قائمة الروابط خاطئة");
  const portal = portals[0];

  await localAuth.signOut();
  const res = await teacherPortal.submitTeacherMonthly({
    code: portal.code,
    student_id: portal.code
      ? (await teacherPortal.openPortalByCode(portal.code)).portal.students[0].student_id
      : 0,
    student_name: "طالبة البوابة",
    year: "1447",
    month: 9,
    memorization_from_surah: 1,
    memorization_from_ayah: 1,
    memorization_to_surah: 2,
    memorization_to_ayah: 25,
    memorization_hifz_score: 23,
    memorization_recitation_score: 14,
    review_from_surah: 1,
    review_from_ayah: 1,
    review_to_surah: 1,
    review_to_ayah: 141,
    review_hifz_score: 21,
    review_recitation_score: 13,
    attendance_score: 10,
    behavior_score: 9,
    notes: "ترسيل أول",
  });
  if (!res.ok) throw new Error(`الإرسال فشل: ${res.error}`);

  // رابط لا يطابق العام/الشهر يُرفض
  const mismatch = await teacherPortal.submitTeacherMonthly({
    code: portal.code,
    student_id: 1,
    student_name: "طالبة البوابة",
    year: "1448",
    month: 9,
    memorization_from_surah: null,
    memorization_from_ayah: null,
    memorization_to_surah: null,
    memorization_to_ayah: null,
    memorization_hifz_score: 0,
    memorization_recitation_score: 0,
    review_from_surah: null,
    review_from_ayah: null,
    review_to_surah: null,
    review_to_ayah: null,
    review_hifz_score: 0,
    review_recitation_score: 0,
    attendance_score: 0,
    behavior_score: 0,
  });
  if (mismatch.ok) throw new Error("عدم مطابقة العام/الشهر يجب أن يُرفض");

  await loginAs(ownerEmail, "owner-pass-789");
  let subs = await teacherPortal.loadSubmissions(ownerUser.id, { status: "pending" });
  if (subs.length !== 1) throw new Error(`الوارد ${subs.length} بدل 1 (قيد المراجعة)`);
  const sub = subs[0];
  if (sub.source !== "portal" || sub.portal_teacher_name !== "معلمة البوابة") {
    throw new Error("بيانات الترسيل خاطئة");
  }

  // رفض مع سبب ثم يظهر للمعلمة في بوابتها
  await teacherPortal.setSubmissionStatus(ownerUser.id, sub.id, "rejected", "ناقص الدرجة");
  subs = await teacherPortal.loadSubmissions(ownerUser.id, { status: "rejected" });
  if (subs.length !== 1 || subs[0].review_note !== "ناقص الدرجة") throw new Error("الرفض لم يُسجل");

  await localAuth.signOut();
  const afterReject = await teacherPortal.openPortalByCode(portal.code);
  const existing = afterReject.portal?.students[0]?.existing;
  if (!existing || existing.status !== "rejected" || existing.review_note !== "ناقص الدرجة") {
    throw new Error("الرفض لا يظهر في بوابة المعلمة");
  }

  // إعادة الإرسال تحدّث نفس الترسيل وتعيده للمراجعة
  const res2 = await teacherPortal.submitTeacherMonthly({
    code: portal.code,
    student_id: existing.student_id,
    student_name: "طالبة البوابة",
    year: "1447",
    month: 9,
    memorization_from_surah: 1,
    memorization_from_ayah: 1,
    memorization_to_surah: 3,
    memorization_to_ayah: 10,
    memorization_hifz_score: 24,
    memorization_recitation_score: 14,
    review_from_surah: 1,
    review_from_ayah: 1,
    review_to_surah: 2,
    review_to_ayah: 30,
    review_hifz_score: 24,
    review_recitation_score: 14,
    attendance_score: 10,
    behavior_score: 10,
    notes: "ترسيل محدث",
  });
  if (!res2.ok) throw new Error(`إعادة الإرسال فشلت: ${res2.error}`);

  await loginAs(ownerEmail, "owner-pass-789");
  subs = await teacherPortal.loadSubmissions(ownerUser.id);
  if (subs.length !== 1) throw new Error("إعادة الإرسال يجب أن تحدّث لا أن تكرر");
  if (subs[0].status !== "pending") throw new Error("إعادة الإرسال تعيد للحالة قيد المراجعة");

  // الاعتماد: مثل صفحة الوارد — كتابة المتابعة الشهرية أولاً ثم تغيير الحالة
  const record = teacherPortal.formToRecord(teacherPortal.formFromSubmission(subs[0]));
  const wrote = await storage.saveMonthlyRecord("1447", subs[0].student_id, 9, record);
  if (wrote !== true) throw new Error("تعذّرت كتابة المتابعة الشهرية");
  await teacherPortal.setSubmissionStatus(ownerUser.id, subs[0].id, "approved");
  const monthly = await storage.loadMonthlyTrackingForMonth("1447", 9);
  const row = monthly[subs[0].student_id];
  if (!row || row.memoHifzScore !== "24") {
    throw new Error("الاعتماد لم يكتب الترسيل في المتابعة الشهرية");
  }
});

await ok("التقرير اليدوي: إدخال واعتماد فوري وتحديث دون تكرار", async () => {
  await loginAs(ownerEmail, "owner-pass-789");
  const students = await storage.loadStudentsForYear("1447");
  const student = students.find((s) => s.name === "طالبة البوابة");

  const manualForm = teacherPortal.emptyForm();
  Object.assign(manualForm, {
    memoFromSurah: "3",
    memoFromAyah: "11",
    memoToSurah: "4",
    memoToAyah: "5",
    memoHifz: "23",
    memoRecite: "14",
    reviewFromSurah: "2",
    reviewFromAyah: "31",
    reviewToSurah: "3",
    reviewToAyah: "10",
    reviewHifz: "23",
    reviewRecite: "13",
    attendance: "9",
    behavior: "10",
    notes: "تقرير ورقي",
  });

  const manual = await teacherPortal.saveManualSubmission(ownerUser.id, {
    teacher_name: "معلمة البوابة",
    student_id: student.id,
    student_name: student.name,
    year: "1447",
    month: 10,
    form: manualForm,
    status: "approved",
  });
  if (manual.source !== "manual" || manual.status !== "approved") {
    throw new Error("التقرير اليدوي لم يُحفظ معتمداً");
  }
  if (manual.portal_id !== null || manual.code !== null) {
    throw new Error("الإدخال اليدوي يجب ألا يرتبط برابط");
  }

  // مثل صفحة الوارد: الاعتماد الفوري يكتب في المتابعة الشهرية أيضاً
  const wrote = await storage.saveMonthlyRecord(
    "1447",
    student.id,
    10,
    teacherPortal.formToRecord(manualForm),
  );
  if (wrote !== true) throw new Error("تعذّرت كتابة المتابعة الشهرية للتقرير اليدوي");
  const monthly = await storage.loadMonthlyTrackingForMonth("1447", 10);
  if (!monthly[student.id] || monthly[student.id].memoHifzScore !== "23") {
    throw new Error("الاعتماد الفوري لم يكتب في المتابعة الشهرية");
  }

  // إدخال ثانٍ لنفس (الطالبة، العام، الشهر) يحدّث لا يكرر
  const again = await teacherPortal.saveManualSubmission(ownerUser.id, {
    teacher_name: "معلمة البوابة",
    student_id: student.id,
    student_name: student.name,
    year: "1447",
    month: 10,
    form: {
      memoFromSurah: "3",
      memoFromAyah: "11",
      memoToSurah: "4",
      memoToAyah: "5",
      memoHifz: "25",
      memoRecite: "15",
      reviewFromSurah: "2",
      reviewFromAyah: "31",
      reviewToSurah: "3",
      reviewToAyah: "10",
      reviewHifz: "25",
      reviewRecite: "15",
      attendance: "10",
      behavior: "10",
      notes: "تقرير ورقي محدث",
    },
    status: "approved",
  });
  if (again.id !== manual.id) throw new Error("الإدخال اليدوي الثاني كرر الترسيل");

  const subs = await teacherPortal.loadSubmissions(ownerUser.id, { status: "approved" });
  const manualSubs = subs.filter((s) => s.source === "manual");
  if (manualSubs.length !== 1) throw new Error("عدد الترسيلات اليدوية خاطئ");

  // إيقاف الرابط يمنع الإرسال الجديد ويبقي القديم
  const portals = await teacherPortal.loadPortals(ownerUser.id, "1447");
  await teacherPortal.updatePortal(ownerUser.id, portals[0].id, { active: false });
  await localAuth.signOut();
  const stopped = await teacherPortal.openPortalByCode(portals[0].code);
  if (!stopped.error) throw new Error("الرابط الموقوف يجب ألا يفتح");
});

finish("الاختبارات التكاملية");
