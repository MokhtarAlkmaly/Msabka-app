/**
 * تحميل كسول لمكتبة Excel.
 *
 * حزمة xlsx تزن ~485KB (≈200KB مضغوطة) وكانت تُستورد استيرادًا ثابتًا في
 * ثلاث شاشات (السجل الشامل، الاستيراد/التصدير، البحث)، فتدخل ضمن الحزمة
 * الأولية لكل من يفتح التطبيق — حتى لو لم يصدّر ملفًا واحدًا أبدًا.
 *
 * هنا نحمّلها عند أول استخدام فعلي فقط، ونحتفظ بها بعد ذلك في الذاكرة.
 */

type XLSXModule = typeof import("xlsx");

let xlsxPromise: Promise<XLSXModule> | null = null;

/** يحمّل (مرة واحدة) مكتبة xlsx ويعيدها. */
export const loadXLSX = (): Promise<XLSXModule> => {
  xlsxPromise ??= import("xlsx");
  return xlsxPromise;
};

/**
 * يحفظ مصنّف Excel: تنزيل مباشر في المتصفح، أو حفظ ثم مشاركة عبر أدوات
 * Capacitor داخل التطبيق المثبَّت (WebView لا يدعم التنزيل المباشر).
 */
export const saveWorkbook = async (
  workbook: import("xlsx").WorkBook,
  fileName: string,
): Promise<void> => {
  const XLSX = await loadXLSX();
  const { Capacitor } = await import("@capacitor/core");

  if (!Capacitor.isNativePlatform()) {
    XLSX.writeFile(workbook, fileName);
    return;
  }

  // أدوات النظام الأصلية تُحمَّل فقط داخل التطبيق المثبَّت.
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);

  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const result = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
  });
  await Share.share({ title: fileName, url: result.uri });
};
