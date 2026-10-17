import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, FileSpreadsheet, Upload, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadXLSX, saveWorkbook } from "@/utils/excel";
import {
  loadGlobalStudents,
  saveStudent,
  loadYearData,
  saveYearData,
  mergeDuplicateStudents,
  syncToCloud,
} from "@/utils/storage";
import { formatYearKey } from "@/types/student";

interface Props {
  onDataImported: () => void;
  /** مفتاح بيانات العام (1447 أو 1447D لمسابقة عشر ذي الحجة) */
  currentYear: string;
  /** نص العام للعرض فقط، افتراضياً يُنسَّق من مفتاح العام */
  displayYear?: string;
  /** اسم المسابقة المفتوحة لعرضه في العنوان */
  competitionLabel?: string;
}

export const ImportExport = ({
  onDataImported,
  currentYear,
  displayYear,
  competitionLabel,
}: Props) => {
  const { toast } = useToast();
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [merging, setMerging] = useState(false);

  const labelYear = displayYear || formatYearKey(currentYear);
  const yearShortLabel = currentYear.endsWith("D")
    ? `${currentYear.slice(0, -1)}هـ`
    : `${currentYear}هـ`;
  // أسماء الأعمدة مرتبطة بمفتاح بيانات العام نفسه حتى يعمل التصدير والاستيراد
  // في الاتجاهين، بينما يظهر للمستخدم النص المنسَّق (1447هـ · عشر ذي الحجة).
  const fileYear = currentYear.endsWith("D")
    ? `${currentYear.slice(0, -1)}هـ-عشر-ذي-الحجة`
    : `${currentYear}هـ`;
  const yearCols = {
    parts: `حفظ_جديد_${currentYear}`,
    annual: `سنة_${currentYear}`,
    recitation: `تلاوة_${currentYear}`,
    memorization: `حفظ_درجة_${currentYear}`,
    total: `مجموع_${currentYear}`,
    grade: `تقدير_${currentYear}`,
    prize: `مكافأة_${currentYear}`,
  };

  const handleExport = async () => {
    const XLSX = await loadXLSX();
    const { loadAllStudentsWithData } = await import("@/utils/storage");
    const students = await loadAllStudentsWithData(currentYear);

    if (students.length === 0) {
      toast({
        title: "لا توجد بيانات",
        description: `لا يوجد طلاب مسجّلون بعام ${labelYear} لتصديرها`,
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
    XLSX.utils.book_append_sheet(workbook, worksheet, `بيانات ${fileYear}`);
    const cols = Object.keys(exportData[0] || {}).map(() => ({ wch: 20 }));
    worksheet["!cols"] = cols;
    try {
      await saveWorkbook(workbook, `بيانات_المسابقة_${fileYear}.xlsx`);
      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير بيانات ${students.length} طالب/ة لعام ${labelYear}`,
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
    event.target.value = "";
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
        try {
          if (navigator.onLine) {
            setImportProgress({ current: jsonData.length, total: jsonData.length });
            await syncToCloud();
          }
        } catch (e) {
          console.error("Cloud sync after import failed:", e);
        }
        toast({
          title: `تم الاستيراد لعام ${labelYear}`,
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
    XLSX.utils.book_append_sheet(workbook, worksheet, `قالب ${fileYear}`);
    worksheet["!cols"] = Array(7).fill({ wch: 20 });
    try {
      await saveWorkbook(workbook, `قالب_استيراد_${fileYear}.xlsx`);
      toast({ title: "تم تنزيل القالب", description: `القالب خاص بعام ${labelYear}` });
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
    <Card className="flex h-full flex-col rounded-[1.5rem] border border-white/70 bg-card/88 p-4 shadow-xl shadow-primary/5 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black leading-tight">استيراد وتصدير بيانات المسابقة</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {competitionLabel ? `${competitionLabel} · ` : ""}
              {yearShortLabel}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 rounded-full text-[10px] font-bold">
          Excel
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        نزّل قالب المسابقة لتعبئة الدرجات والحفظ الجديد، أو صدّر الكشف الحالي كاملاً. الطلاب الجدد
        يُضافون تلقائياً إلى السجل الشامل.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Button
          onClick={downloadTemplate}
          variant="outline"
          size="sm"
          className="h-10 gap-1 rounded-xl px-2 text-[11px] font-bold"
        >
          <Download className="h-3.5 w-3.5" />
          تنزيل القالب
        </Button>
        <Button
          variant="default"
          size="sm"
          className="relative h-10 gap-1 overflow-hidden rounded-xl px-2 text-[11px] font-bold"
          disabled={!!importProgress}
        >
          <Upload className="h-3.5 w-3.5" />
          <span>
            {importProgress ? `${importProgress.current}/${importProgress.total}` : "استيراد"}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            disabled={!!importProgress}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </Button>
        <Button
          onClick={handleExport}
          variant="secondary"
          size="sm"
          className="h-10 gap-1 rounded-xl px-2 text-[11px] font-bold"
        >
          <Download className="h-3.5 w-3.5" />
          تصدير
        </Button>
      </div>

      {importProgress && (
        <div className="mt-2 space-y-1">
          <Progress
            value={(importProgress.current / Math.max(importProgress.total, 1)) * 100}
            className="h-2"
          />
          <p className="text-center text-[11px] text-muted-foreground">
            جارٍ الاستيراد: {importProgress.current} من {importProgress.total}
          </p>
        </div>
      )}

      <div className="mt-auto pt-3">
        <Button
          onClick={handleMergeDuplicates}
          variant="outline"
          size="sm"
          className="w-full gap-1 rounded-xl text-[11px] font-bold"
          disabled={merging}
        >
          <Users className="h-3.5 w-3.5" />
          {merging ? "جارٍ الدمج..." : "دمج الأسماء المكررة"}
        </Button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          الاسم إلزامي في القالب. الطلاب الجدد يُضافون إلى السجل الشامل وتُسجَّل بياناتهم في هذا
          العام عند توفرها، والموجودون تُحدَّث بياناتهم دون تكرار.
        </p>
      </div>
    </Card>
  );
};
