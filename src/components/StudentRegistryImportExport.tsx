import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { StudentRegistryImport } from "@/components/StudentRegistryImport";
import { StudentRegistryExport } from "@/components/StudentRegistryExport";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { CustomColumnDef, Student } from "@/types/student";
import { getActiveYear, loadCustomColumns, loadGlobalStudentsWithYears } from "@/utils/storage";

interface Props {
  readOnly?: boolean;
}

/** أدوات السجل الشامل في الإعدادات، مستقلة عن بيانات جدول الطلاب وتصفيته. */
export const StudentRegistryImportExport = ({ readOnly = false }: Props) => {
  const { user, viewAs } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumnDef[]>([]);
  const [activeYear, setActiveYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [loadedStudents, columns, year] = await Promise.all([
        loadGlobalStudentsWithYears(),
        loadCustomColumns(),
        getActiveYear(),
      ]);
      setStudents(loadedStudents);
      setCustomColumns(columns);
      setActiveYear(year);
    } catch (error) {
      console.error("Failed to load student registry import/export data:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData, user, viewAs]);

  return (
    <section className="print:hidden space-y-3" aria-labelledby="student-registry-tools-title">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="rounded-xl bg-primary/10 p-1.5 text-primary">
          <FileSpreadsheet className="h-4 w-4" />
        </span>
        <h2 id="student-registry-tools-title" className="text-base font-black text-foreground">
          الاستيراد والتصدير
        </h2>
        <span className="text-xs text-muted-foreground">
          استورد دفعة طلاب إلى السجل الشامل أو صدّره كاملاً من ملفات Excel
        </span>
      </div>

      {readOnly && (
        <p role="note" className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
          وضع الاطلاع يمنع استيراد سجل الطلاب أو تسجيل المستوردين في العام. يمكنك تصدير السجل الشامل
          للاطلاع فقط.
        </p>
      )}

      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          جارٍ تحميل بيانات السجل الشامل...
        </p>
      )}
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          تعذّر تحميل بيانات السجل الشامل.
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            إعادة المحاولة
          </Button>
        </div>
      )}

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <StudentRegistryImport
          onImported={loadData}
          targetYear={activeYear}
          disabled={readOnly || loading || loadError}
        />
        <StudentRegistryExport
          students={students}
          customColumns={customColumns}
          disabled={loading || loadError}
        />
      </div>
    </section>
  );
};
