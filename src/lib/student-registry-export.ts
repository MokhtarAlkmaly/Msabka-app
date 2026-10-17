import { CustomColumnDef, Student, formatYearKey } from "@/types/student";
import { loadXLSX, saveWorkbook } from "@/utils/excel";

/**
 * تصدير السجل الشامل (كل الأعوام) إلى Excel.
 *
 * المنطق مشترك بين زر «تصدير Excel» داخل الجدول (يُصدّر نتائج البحث/التصفية
 * الحالية) وزر التصدير في صفحة الطلاب الرئيسية (يُصدّر السجل كاملاً)، حتى
 * يبقى ترتيب الأعمدة وأسماؤها متطابقاً في الحالتين.
 */

export const REGISTRY_EXPORT_FILE_NAME = "سجل_الطلاب_الشامل_كل_الأعوام_مركز_إنماء.xlsx";

export type RegistryExportRow = Record<string, string | number>;

/** يبني صفوف ملف Excel من قائمة طلاب وأعمدة مخصّصة. */
export const buildRegistryExportRows = (
  students: Student[],
  customColumns: CustomColumnDef[] = [],
  dirtyMap: Record<number, Student> = {},
): RegistryExportRow[] =>
  students.map((student, index) => {
    const current = dirtyMap[student.id] || student;
    const row: RegistryExportRow = {
      م: index + 1,
      "رقم القيد": current.id,
      "اسم الطالب": current.name,
      الجنس: current.gender || "",
      "تاريخ هجري الالتحاق": current.hijri_join_date || "",
      "الحفظ قبل الالتحاق": current.initial_hifz || "0",
      "الحفظ التراكمي (آخر عام)": current.latest_total_hifz || "0",
      "عام أول مسابقة": current.first_competition_year || "",
      "الأعوام المسجل بها": (current.registered_years || [])
        .map((year) => formatYearKey(year))
        .join("، "),
      الحالة: current.status || "طبيعي",
      "السنة الدراسية وقت الالتحاق": current.school_grade || "",
      "رقم ولي الأمر": current.guardian_phone || "",
      "رقم الطالب": current.student_phone || "",
    };

    customColumns.forEach((column) => {
      row[column.name] = current.custom_fields?.[column.id] || "";
    });

    return row;
  });

/** يصدّر قائمة الطلاب إلى ملف Excel ويحفظه (تنزيل بالمتصفح / مشاركة بالتطبيق). */
export const exportStudentsRegistry = async (
  students: Student[],
  customColumns: CustomColumnDef[] = [],
  fileName: string = REGISTRY_EXPORT_FILE_NAME,
  dirtyMap: Record<number, Student> = {},
): Promise<number> => {
  if (students.length === 0) {
    throw new Error("لا يوجد طلاب في السجل لتصديرهم");
  }

  const rows = buildRegistryExportRows(students, customColumns, dirtyMap);
  const XLSX = await loadXLSX();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "سجل الطلاب الشامل");
  worksheet["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }));

  await saveWorkbook(workbook, fileName);
  return rows.length;
};
