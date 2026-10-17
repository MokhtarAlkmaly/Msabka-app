import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Download, FileSpreadsheet, Upload, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  STUDENT_IMPORT_HEADERS,
  STUDENT_IMPORT_INSTRUCTIONS,
  buildStudentRowReader,
  readStudentImportRow,
} from "@/lib/student-registry-import";
import { loadXLSX, saveWorkbook } from "@/utils/excel";
import {
  loadGlobalStudents,
  loadStudentsForYear,
  registerStudentInYear,
  saveStudent,
  syncToCloud,
} from "@/utils/storage";
import { normalizeStudentName } from "@/utils/studentNames";
import { formatYearKey, Student } from "@/types/student";

interface Props {
  /** يُستدعى بعد اكتمال الاستيراد لإعادة تحميل كشف المسابقة */
  onImported: () => void | Promise<void>;
  /** مفتاح عام المسابقة المفتوحة (1447 أو 1447D لمسابقة عشر ذي الحجة) */
  targetYear?: string;
  /** نص العام للعرض (افتراضياً يُنسَّق من targetYear) */
  yearLabel?: string;
}

export const StudentRegistryImport = ({ onImported, targetYear, yearLabel }: Props) => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [registerInYear, setRegisterInYear] = useState(true);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);

  const labelYear = yearLabel || (targetYear ? formatYearKey(targetYear) : "");

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    try {
      const workbook = XLSX.utils.book_new();

      const dataSheet = XLSX.utils.aoa_to_sheet([STUDENT_IMPORT_HEADERS]);
      dataSheet["!cols"] = STUDENT_IMPORT_HEADERS.map((header) => ({
        wch: Math.max(header.length + 6, 16),
      }));
      XLSX.utils.book_append_sheet(workbook, dataSheet, "سجل الطلاب");

      const instructionsSheet = XLSX.utils.aoa_to_sheet(STUDENT_IMPORT_INSTRUCTIONS);
      instructionsSheet["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 90 }];
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, "تعليمات");

      await saveWorkbook(workbook, "قالب_استيراد_سجل_الطلاب.xlsx");
      toast({
        title: "تم تنزيل القالب",
        description: "قالب سجل الطلاب جاهز للتعبئة — الاسم فقط هو الحقل الإلزامي",
      });
    } catch (e) {
      console.error("Students template download failed:", e);
      toast({
        title: "تعذّر تنزيل القالب",
        description: "حدث خطأ أثناء حفظ الملف",
        variant: "destructive",
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await loadXLSX();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName =
        workbook.SheetNames.find((name) => /سجل|طلاب|students/i.test(name)) ??
        workbook.SheetNames[0];
      const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!worksheet) {
        toast({
          title: "الملف غير صالح",
          description: "لم يُعثر على ورقة بيانات داخل الملف",
          variant: "destructive",
        });
        return;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        raw: false,
        defval: "",
      });

      if (rows.length === 0) {
        toast({
          title: "الملف فارغ",
          description: "لا يحتوي الملف على أي صفوف بيانات",
          variant: "destructive",
        });
        return;
      }

      const reader = buildStudentRowReader(Object.keys(rows[0] ?? {}));
      if (!reader.hasNameColumn) {
        toast({
          title: "عمود الاسم مفقود",
          description: "أضف عموداً باسم «الاسم» أو استخدم القالب الجاهز",
          variant: "destructive",
        });
        return;
      }

      const existingStudents = await loadGlobalStudents();
      const existingByName = new Map(
        existingStudents.map((student) => [normalizeStudentName(student.name), student]),
      );

      const registeredIds = new Set<number>();
      if (targetYear) {
        const registered = await loadStudentsForYear(targetYear);
        registered.forEach((student) => registeredIds.add(student.id));
      }

      let added = 0;
      let updated = 0;
      let unchanged = 0;
      let skipped = 0;
      const seenNames = new Set<string>();
      const pendingRegistration: Array<{ id: number; teacher: string }> = [];

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        setProgress({
          current: index + 1,
          total: rows.length,
          label: "قراءة صفوف الملف",
        });

        const values = readStudentImportRow(reader, row);
        if (!values.name) {
          skipped++;
          continue;
        }

        const nameKey = normalizeStudentName(values.name);
        if (seenNames.has(nameKey)) {
          skipped++;
          continue;
        }
        seenNames.add(nameKey);

        const {
          name,
          teacher,
          gender,
          schoolGrade,
          status,
          hijriJoinDate,
          initialHifz,
          firstCompetitionYear,
          guardianPhone,
          studentPhone,
          notes,
        } = values;

        const existing = existingByName.get(nameKey);
        let studentId: number;

        if (!existing) {
          const createdId = await saveStudent({
            name,
            teacher,
            gender,
            school_grade: schoolGrade || undefined,
            status: status || undefined,
            hijri_join_date: hijriJoinDate || undefined,
            initial_hifz: initialHifz || undefined,
            first_competition_year: firstCompetitionYear || undefined,
            guardian_phone: guardianPhone || undefined,
            student_phone: studentPhone || undefined,
            notes: notes || undefined,
          });
          if (!createdId) {
            skipped++;
            continue;
          }
          studentId = createdId;
          existingByName.set(nameKey, {
            id: createdId,
            name,
            teacher,
            gender,
            school_grade: schoolGrade || undefined,
            status: status || "طبيعي",
            hijri_join_date: hijriJoinDate || undefined,
            initial_hifz: initialHifz || undefined,
            first_competition_year: firstCompetitionYear || undefined,
            guardian_phone: guardianPhone || undefined,
            student_phone: studentPhone || undefined,
            notes: notes || undefined,
          });
          added++;
        } else {
          studentId = existing.id;
          const changes: Partial<Student> = {};
          if (teacher && teacher !== existing.teacher) changes.teacher = teacher;
          if (gender && gender !== existing.gender) changes.gender = gender;
          if (schoolGrade && schoolGrade !== existing.school_grade) {
            changes.school_grade = schoolGrade;
          }
          if (status && status !== existing.status) changes.status = status;
          if (hijriJoinDate && hijriJoinDate !== existing.hijri_join_date) {
            changes.hijri_join_date = hijriJoinDate;
          }
          if (initialHifz && initialHifz !== existing.initial_hifz) {
            changes.initial_hifz = initialHifz;
          }
          if (firstCompetitionYear && firstCompetitionYear !== existing.first_competition_year) {
            changes.first_competition_year = firstCompetitionYear;
          }
          if (guardianPhone && guardianPhone !== existing.guardian_phone) {
            changes.guardian_phone = guardianPhone;
          }
          if (studentPhone && studentPhone !== existing.student_phone) {
            changes.student_phone = studentPhone;
          }
          if (notes && notes !== existing.notes) changes.notes = notes;

          if (Object.keys(changes).length > 0) {
            await saveStudent({ ...existing, ...changes });
            Object.assign(existing, changes);
            updated++;
          } else {
            unchanged++;
          }
        }

        if (targetYear && registerInYear && !registeredIds.has(studentId)) {
          pendingRegistration.push({ id: studentId, teacher });
          registeredIds.add(studentId);
        }
      }

      if (targetYear && pendingRegistration.length > 0) {
        for (let index = 0; index < pendingRegistration.length; index++) {
          setProgress({
            current: index + 1,
            total: pendingRegistration.length,
            label: "تسجيل الطلاب في كشف المسابقة",
          });
          await registerStudentInYear(
            targetYear,
            pendingRegistration[index].id,
            pendingRegistration[index].teacher,
          );
        }
      }

      setProgress(null);
      await onImported();

      try {
        if (navigator.onLine) await syncToCloud();
      } catch (e) {
        console.error("Cloud sync after students import failed:", e);
      }

      if (added + updated + unchanged === 0) {
        toast({
          title: "لم يتم استيراد طلاب",
          description: "لا يحتوي الملف على أسماء صالحة للاستيراد",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "تم استيراد سجل الطلاب",
        description: [
          `جديدة: ${added}`,
          `محدَّثة: ${updated}`,
          unchanged ? `موجودة مسبقاً: ${unchanged}` : "",
          skipped ? `مُتجاهلة: ${skipped}` : "",
          pendingRegistration.length ? `سُجّلت في المسابقة: ${pendingRegistration.length}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      });
    } catch (error) {
      console.error("Students import failed:", error);
      toast({
        title: "تعذّر استيراد سجل الطلاب",
        description:
          error instanceof Error && error.name === "ReadOnlyViewError"
            ? error.message
            : "تأكد من أن الملف بصيغة Excel (xlsx) وأنه يحتوي على عمود «الاسم»",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  return (
    <Card className="flex h-full flex-col rounded-[1.5rem] border border-white/70 bg-card/88 p-4 shadow-xl shadow-primary/5 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black leading-tight">استيراد سجل الطلاب</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">مع قالب Excel جاهز للاستيراد</p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 rounded-full text-[10px] font-bold">
          سجل شامل
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        أضف دفعة طلاب إلى السجل الشامل أو حدّث بيانات الموجودين. نزّل القالب، عبّئ الأعمدة، ثم
        استورد الملف.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={downloadTemplate}
          variant="outline"
          size="sm"
          className="h-10 gap-1.5 rounded-xl px-2 text-[11px] font-bold"
        >
          <Download className="h-3.5 w-3.5" />
          تنزيل القالب
        </Button>
        <Button
          size="sm"
          className="relative h-10 gap-1.5 overflow-hidden rounded-xl px-2 text-[11px] font-bold"
          disabled={importing}
        >
          <Upload className="h-3.5 w-3.5" />
          <span>{importing ? "جارٍ الاستيراد..." : "استيراد الملف"}</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            disabled={importing}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </Button>
      </div>

      {targetYear && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl bg-secondary/50 p-2.5">
          <Checkbox
            checked={registerInYear}
            onCheckedChange={(value) => setRegisterInYear(value === true)}
            className="mt-0.5"
            disabled={importing}
          />
          <span className="text-xs leading-relaxed">
            <span className="font-bold">تسجيل المستوردين في مسابقة {labelYear}</span>
            <span className="block text-[11px] text-muted-foreground">
              يُضاف كل طالب غير مسجّل إلى الكشف مع ترحيل حفظه السابق، دون المساس بدرجات المسجلين.
            </span>
          </span>
        </label>
      )}

      {progress && (
        <div className="mt-3 space-y-1 rounded-xl bg-secondary/40 p-2.5">
          <Progress
            value={(progress.current / Math.max(progress.total, 1)) * 100}
            className="h-2"
          />
          <p className="text-center text-[11px] text-muted-foreground">
            {progress.label}: {progress.current} من {progress.total}
          </p>
        </div>
      )}

      <p className="mt-auto pt-3 text-[11px] leading-relaxed text-muted-foreground">
        <FileSpreadsheet className="ml-1 inline h-3 w-3" />
        الاسم هو الحقل الإلزامي الوحيد. الأعمدة مقبولة بأسمائها في القالب، ويمكن حذف ما لا تحتاجه.
      </p>
    </Card>
  );
};
