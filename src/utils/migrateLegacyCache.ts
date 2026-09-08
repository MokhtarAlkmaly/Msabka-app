/**
 * ترحيل تلقائي لمرة واحدة: ينقل أي بيانات كانت مخزَّنة سابقًا في IndexedDB
 * (قاعدة "inmaa_cache" القديمة) إلى قاعدة SQLite الجديدة "inmaa_local".
 *
 * الأهم من نقل البيانات المُخزَّنة (الطلاب، الحفظ، إلخ — وهي أصلاً نسخة من
 * السحابة يمكن إعادة تنزيلها) هو نقل "pending_changes": أي تعديلات محلية لم
 * تُرفَع بعد إلى Supabase. فقدانها يعني ضياع عمل المستخدم غير المتزامن.
 *
 * العملية آمنة تمامًا: تُنفَّذ مرة واحدة فقط (بعلامة في جدول meta الجديد)،
 * ولا تحذف أي شيء، وأي خطأ فيها لا يوقف التطبيق (أسوأ الحالات: يُعاد بناء
 * الكاش من السحابة عند أول مزامنة كالمعتاد).
 */

import {
  getItem,
  putItem,
  cacheStudents,
  cacheHifzHistory,
  cacheYearData,
  cacheTeachers,
  cacheTeacherBonuses,
  cacheDonors,
  cacheAwards,
  cacheCeremonyExpenses,
  cacheCertificates,
  cacheMedia,
} from "./localDB";

const LEGACY_DB_NAME = "inmaa_cache";
const MIGRATION_FLAG_KEY = "__migrated_from_indexeddb__";

const LEGACY_STORES = {
  students: "students",
  hifzHistory: "hifz_history",
  yearData: "year_data",
  settings: "settings",
  pending: "pending_changes",
  teachers: "teachers",
  teacherBonuses: "teacher_bonuses",
  donors: "donors",
  awards: "awards",
  ceremonyExpenses: "ceremony_expenses",
  certificates: "certificates",
  media: "media",
} as const;

const legacyDbExists = async (): Promise<boolean> => {
  if (typeof indexedDB === "undefined") return false;
  if (typeof indexedDB.databases === "function") {
    try {
      const dbs = await indexedDB.databases();
      return dbs.some((d) => d.name === LEGACY_DB_NAME);
    } catch {
      // بعض المتصفحات القديمة لا تدعم databases() — نكمل بحذر أدناه
    }
  }
  return true;
};

const openLegacyDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    // بدون تمرير رقم إصدار: يفتح القاعدة كما هي دون أي upgrade
    const req = indexedDB.open(LEGACY_DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });

const readAll = <T>(db: IDBDatabase, storeName: string): Promise<T[]> =>
  new Promise((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    try {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });

export const migrateLegacyIndexedDbCache = async (): Promise<void> => {
  try {
    const already = await getItem<{ key: string; time: number }>("meta", MIGRATION_FLAG_KEY);
    if (already) return;

    if (!(await legacyDbExists())) {
      await putItem("meta", { key: MIGRATION_FLAG_KEY, time: Date.now() });
      return;
    }

    const legacyDb = await openLegacyDb();
    if (!legacyDb) {
      // لن نضع العلامة هنا حتى نحاول مرة أخرى في المرة القادمة
      return;
    }

    const [
      students, hifzHistory, yearData, settings, pending,
      teachers, teacherBonuses, donors, awards, ceremonyExpenses, certificates, media,
    ] = await Promise.all([
      readAll<any>(legacyDb, LEGACY_STORES.students),
      readAll<any>(legacyDb, LEGACY_STORES.hifzHistory),
      readAll<any>(legacyDb, LEGACY_STORES.yearData),
      readAll<any>(legacyDb, LEGACY_STORES.settings),
      readAll<any>(legacyDb, LEGACY_STORES.pending),
      readAll<any>(legacyDb, LEGACY_STORES.teachers),
      readAll<any>(legacyDb, LEGACY_STORES.teacherBonuses),
      readAll<any>(legacyDb, LEGACY_STORES.donors),
      readAll<any>(legacyDb, LEGACY_STORES.awards),
      readAll<any>(legacyDb, LEGACY_STORES.ceremonyExpenses),
      readAll<any>(legacyDb, LEGACY_STORES.certificates),
      readAll<any>(legacyDb, LEGACY_STORES.media),
    ]);
    legacyDb.close();

    if (students.length) await cacheStudents(students);
    if (hifzHistory.length) await cacheHifzHistory(hifzHistory);
    if (yearData.length) await cacheYearData(yearData);
    if (teachers.length) await cacheTeachers(teachers);
    if (teacherBonuses.length) await cacheTeacherBonuses(teacherBonuses);
    if (donors.length) await cacheDonors(donors);
    if (awards.length) await cacheAwards(awards);
    if (ceremonyExpenses.length) await cacheCeremonyExpenses(ceremonyExpenses);
    if (certificates.length) await cacheCertificates(certificates);
    if (media.length) await cacheMedia(media);
    for (const s of settings) await putItem("settings", s);
    // الأهم: التعديلات غير المتزامنة بعد
    for (const p of pending) await putItem("pending_changes", p);

    await putItem("meta", { key: MIGRATION_FLAG_KEY, time: Date.now() });

    // تنظيف: حذف القاعدة القديمة بعد نجاح النقل فعليًا
    try {
      indexedDB.deleteDatabase(LEGACY_DB_NAME);
    } catch {
      // غير حرج — لا تأثير على عمل التطبيق إن بقيت القاعدة القديمة يتيمة
    }
  } catch (err) {
    // فشل الترحيل غير مدمِّر: أسوأ الحالات، الكاش سيُعاد بناؤه من السحابة
    console.error("migrateLegacyCache: فشل ترحيل بيانات IndexedDB القديمة", err);
  }
};
