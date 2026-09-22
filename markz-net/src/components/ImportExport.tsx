import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Download, FileSpreadsheet, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadXLSX, saveWorkbook } from "@/utils/excel";
import {
  loadGlobalStudents,
  saveStudent,
  loadYearData,
  saveYearData,
  mergeDuplicateStudents,
} from "@/utils/storage";
import { Student } from "@/types/student";
import { Progress } from "@/components/ui/progress";

interface Props {
  onDataImported: () => void;
  currentYear: string;
  displayYear?: string;
}

export const ImportExport = ({ onDataImported, currentYear, displayYear }: Props) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [merging, setMerging] = useState(false);

  const labelYear = displayYear || currentYear;
  const yearCols = {
    parts: `حفظ_جديد_${labelYear}`,
    annual: `سنة_${labelYear}`,
    recitation: `تلاوة_${labelYear}`,
    memorization: `حفظ_درجة_${labelYear}`,
    total: `مجموع_${labelYear}`,
    grade: `تقدير_${labelYear}`,
    prize: `مكافأة_${labelYear}`,
  };

  const handleExport = async () => {
    const XLSX = await loadXLSX();
    const { loadAllStudentsWithData } = await import("@/utils/storage");
    const students = await loadAllStudentsWithData(currentYear);

    if (students.length === 0) {
      toast({
        title: "لا توجد بيانات",
        description: `لا يوجد طلاب مسجّلون بعام ${labelYear}هـ لتصديرها`,
        variant: "destructive",
      });
      return;
    }

    const exportData: Record<string, string>[] = [];
    for (const student of students) {
      const yearData = student.yearData || (await loadYearData(currentYear, student.id));
      exportData.push({
        الاسم: student.name,
        الجنس: student.gender || "",
        "المعلم/ة": yearData.teacher || "",
        [yearCols.parts]: yearData.parts || "",
        [yearCols.annual]: yearData.annual || "",
        [yearCols.recitation]: yearData.recitation || "",
        [yearCols.memorization]: yearData.memorization || "",
        [yearCols.total]: yearData.total || "",
        [yearCols.grade]: yearData.grade || "",
        [yearCols.prize]: yearData.prize || "",
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `بيانات ${labelYear}`);
    const cols = Object.keys(exportData[0] || {}).map(() => ({ wch: 20 }));
    worksheet["!cols"] = cols;
    try {
      await saveWorkbook(workbook, `بيانات_المسابقة_${labelYear}.xlsx`);
      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير بيانات ${students.length} طالب/ة لعام ${labelYear}هـ`,
      });
    } catch (e) {
      console.error("Export failed:", e);
      toast({
        title: "تعذّر التصدير",
        description: "حدث خطأ أثناء حفظ الملف",
        variant: "destructive",
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await loadXLSX();
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast({
            title: "خطأ",
            description: "الملف فارغ أو لا يحتوي على بيانات صحيحة",
            variant: "destructive",
          });
          return;
        }

        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const existingStudents = await loadGlobalStudents();
        const norm = (s: string) => (s || "").trim().replace(/\s+/g, " ");
        const seenInFile = new Set<string>();

        setImportProgress({ current: 0, total: jsonData.length });

        for (let i = 0; i < jsonData.length; i++) {
          const row = (jsonData[i] ?? {}) as Record<string, unknown>;
          const name = String(row["الاسم"] ?? "").trim();
          if (!name) {
            setImportProgress({ current: i + 1, total: jsonData.length });
            continue;
          }

          const nameKey = norm(name);
          if (seenInFile.has(nameKey)) {
            skippedCount++;
            setImportProgress({ current: i + 1, total: jsonData.length });
            continue;
          }
          seenInFile.add(nameKey);

          const genderRaw = String(row["الجنس"] ?? "").trim();
          const gender = genderRaw === "ذكر" || genderRaw === "أنثى" ? genderRaw : undefined;

          const student = existingStudents.find((s) => norm(s.name) === nameKey);
          let studentId: number;

          if (!student) {
            const newId = await saveStudent({ name, teacher: "", gender });
            if (!newId) {
              setImportProgress({ current: i + 1, total: jsonData.length });
              continue;
            }
            studentId = newId;
            existingStudents.push({ id: newId, name, teacher: "", gender });
            importedCount++;
          } else {
            studentId = student.id;
            if (gender && gender !== student.gender) {
              await saveStudent({ ...student, id: student.id, gender });
              student.gender = gender;
            }
            updatedCount++;
          }

          // بيانات السنة المختارة فقط
          const yearData = await loadYearData(currentYear, studentId);
          let hasData = false;
          const pick = (keys: string[]) => keys.find((k) => row[k] !== undefined && row[k] !== "");
          const kParts = pick([yearCols.parts, "حفظ_جديد", "حفظ_جديد_السنة"]);
          const kAnnual = pick([yearCols.annual, "سنة", "الدرجة_السنوية"]);
          const kRecit = pick([yearCols.recitation, "تلاوة"]);
          const kMem = pick([yearCols.memorization, "حفظ_درجة"]);
          if (kParts) {
            yearData.parts = String(row[kParts]);
            hasData = true;
          }
          if (kAnnual) {
            yearData.annual = String(row[kAnnual]);
            hasData = true;
          }
          if (kRecit) {
            yearData.recitation = String(row[kRecit]);
            hasData = true;
          }
          if (kMem) {
            yearData.memorization = String(row[kMem]);
            hasData = true;
          }
          if (row["المعلم/ة"] !== undefined) {
            yearData.teacher = String(row["المعلم/ة"]);
            hasData = true;
          }
          if (hasData) await saveYearData(currentYear, studentId, yearData);

          setImportProgress({ current: i + 1, total: jsonData.length });
        }

        onDataImported();
        toast({
          title: `تم الاستيراد لعام ${labelYear}هـ`,
          description: `جديدة: ${importedCount} | محدّثة: ${updatedCount}${skippedCount ? ` | مكررة (تم تجاهلها): ${skippedCount}` : ""}`,
        });
      } catch (error) {
        console.error("Error importing file:", error);
        toast({
          title: "خطأ في الاستيراد",
          description: "تأكد من صحة تنسيق ملف Excel",
          variant: "destructive",
        });
      } finally {
        setImportProgress(null);
      }
    };
    reader.readAsBinaryString(file);
    event.target.value = "";
  };

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const templateData = [
      {
        الاسم: "مثال: فاطمة أحمد",
        الجنس: "أنثى",
        "المعلم/ة": "",
        [yearCols.parts]: "5",
        [yearCols.annual]: "18",
        [yearCols.recitation]: "19",
        [yearCols.memorization]: "55",
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `قالب ${labelYear}`);
    worksheet["!cols"] = Array(7).fill({ wch: 20 });
    try {
      await saveWorkbook(workbook, `قالب_استيراد_${labelYear}.xlsx`);
      toast({ title: "تم تنزيل القالب", description: `القالب خاص بعام ${labelYear}هـ` });
    } catch (e) {
      console.error("Template download failed:", e);
      toast({
        title: "تعذّر تنزيل القالب",
        description: "حدث خطأ أثناء حفظ الملف",
        variant: "destructive",
      });
    }
  };

  const handleMergeDuplicates = async () => {
    if (!confirm("سيتم دمج الطلاب المكررة بنفس الاسم في سجل واحد. هل تريد المتابعة؟")) return;
    setMerging(true);
    try {
      const merged = await mergeDuplicateStudents();
      onDataImported();
      toast({
        title: merged > 0 ? "تم الدمج" : "لا توجد مكررات",
        description:
          merged > 0
            ? `تم دمج ${merged} سجل مكرر. لا تنسَ الضغط على حفظ.`
            : "لم يتم العثور على أسماء مكررة",
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Card className="bg-card/50 border border-primary/20 print:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <FileSpreadsheet className="h-4 w-4" />
          <span>استيراد وتصدير بيانات المسابقة</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
            لعام {labelYear}هـ
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={downloadTemplate}
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
            >
              <Download className="h-3 w-3" />
              تنزيل القالب
            </Button>
            <Button
              variant="default"
              size="sm"
              className="gap-1 text-xs relative overflow-hidden"
              disabled={!!importProgress}
            >
              <Upload className="h-3 w-3" />
              <span>
                {importProgress ? `${importProgress.current}/${importProgress.total}` : "استيراد"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </Button>
            <Button onClick={handleExport} variant="secondary" size="sm" className="gap-1 text-xs">
              <Download className="h-3 w-3" />
              تصدير
            </Button>
          </div>
          {importProgress && (
            <div className="space-y-1">
              <Progress
                value={(importProgress.current / Math.max(importProgress.total, 1)) * 100}
                className="h-2"
              />
              <p className="text-xs text-center text-muted-foreground">
                جارٍ الاستيراد: {importProgress.current} من {importProgress.total}
              </p>
            </div>
          )}
          <Button
            onClick={handleMergeDuplicates}
            variant="outline"
            size="sm"
            className="w-full gap-1 text-xs"
            disabled={merging}
          >
            <Users className="h-3 w-3" />
            {merging ? "جارٍ الدمج..." : "دمج الأسماء المكررة"}
          </Button>
          <p className="text-xs text-muted-foreground">
            📝 نزّل القالب، عبّئ البيانات (الاسم إلزامي)، ثم استورده — الطلاب الجديدة تُضاف تلقائياً
            إلى السجل الشامل لكل الأعوام وتُسجَّل بيانات مسابقتهن في عام {labelYear}هـ.
          </p>
        </div>
      )}
    </Card>
  );
};
