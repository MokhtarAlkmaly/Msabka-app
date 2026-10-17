import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  FileSpreadsheet,
  Trophy,
  Trash2,
  UsersRound,
} from "lucide-react";
import { ImportExport } from "@/components/ImportExport";
import { StudentRegistryImport } from "@/components/StudentRegistryImport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  COMPETITION_DELETE_MODES,
  competitionBaseYear,
  competitionDeletePhrase,
  competitionLabelFor,
  competitionYearKey,
  competitionYearLabel,
  competitionYears,
  readStoredCompetitionType,
  storeCompetitionType,
  type CompetitionDeleteMode,
  type CompetitionType,
} from "@/lib/competition-year";
import { Student } from "@/types/student";
import {
  deleteStudentsFromYear,
  deleteYearData,
  getActiveYear,
  loadAllStudentsWithData,
} from "@/utils/storage";

interface Props {
  readOnly?: boolean;
  /** العام النشط من الإعدادات، ويُقرأ من التخزين إن لم يُمرَّر */
  activeYear?: string;
}

/**
 * أدوات المسابقة (استيراد/تصدير/حذف) بعد نقلها من صفحة المسابقة إلى الإعدادات.
 * تختار المسابقة والعام هنا، وتعمل على نفس مفتاح العام الذي تقرأه صفحة
 * المسابقة (1447 أو 1447D) فلا يختلف المصدران.
 */
export const CompetitionToolsPanel = ({ readOnly = false, activeYear }: Props) => {
  const { toast } = useToast();
  const [competitionType, setCompetitionType] = useState<CompetitionType>(() =>
    readStoredCompetitionType(),
  );
  const [year, setYear] = useState(activeYear || "");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<CompetitionDeleteMode>("year");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const dataYearKey = year ? competitionYearKey(year, competitionType) : "";
  const competitionLabel = competitionLabelFor(competitionType);
  const baseYear = year ? competitionBaseYear(year) : "";
  const requiredPhrase = competitionDeletePhrase(deleteMode);

  const loadStudents = useCallback(async () => {
    if (!dataYearKey) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      setStudents(await loadAllStudentsWithData(dataYearKey));
    } catch (error) {
      console.error("تعذّر تحميل طلاب المسابقة:", error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [dataYearKey]);

  useEffect(() => {
    if (activeYear) {
      setYear(activeYear);
      return;
    }
    void getActiveYear().then((storedYear) => setYear(storedYear));
  }, [activeYear]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const handleTypeChange = (type: CompetitionType) => {
    setCompetitionType(type);
    storeCompetitionType(type);
  };

  const openDelete = (mode: CompetitionDeleteMode) => {
    if (readOnly) return;
    setDeleteMode(mode);
    setConfirmation("");
    setSelectedIds(new Set());
    setDeleteOpen(true);
  };

  const toggleStudent = (studentId: number) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    if (readOnly || !dataYearKey || confirmation.trim() !== requiredPhrase) return;
    if (deleteMode === "selected" && selectedIds.size === 0) return;

    const selectedCount = selectedIds.size;
    setDeleting(true);
    try {
      if (deleteMode === "year") {
        await deleteYearData(dataYearKey);
        toast({
          title: "تم حذف بيانات المسابقة",
          description: `تم حذف بيانات ${competitionLabel} لعام ${baseYear}هـ مع إبقاء الطلاب في السجل العام.`,
          variant: "destructive",
        });
      } else {
        await deleteStudentsFromYear(dataYearKey, Array.from(selectedIds));
        toast({
          title: "تم فصل الطلاب من المسابقة",
          description: `تم فصل ${selectedCount} طالباً عن ${competitionLabel} لعام ${baseYear}هـ دون حذف سجلاتهم العامة.`,
          variant: "destructive",
        });
      }
      setDeleteOpen(false);
      setConfirmation("");
      setSelectedIds(new Set());
      await loadStudents();
    } catch (error: unknown) {
      const message = (error as { message?: unknown } | null)?.message;
      toast({
        title: "تعذّر تنفيذ الحذف",
        description:
          typeof message === "string" && message ? message : "حاول مرة أخرى بعد التحقق من الاتصال.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const deleteDisabled =
    readOnly ||
    !dataYearKey ||
    deleting ||
    confirmation.trim() !== requiredPhrase ||
    (deleteMode === "selected" && selectedIds.size === 0);

  const summary = useMemo(
    () => ({
      competitionLabel,
      yearLabel: year ? competitionYearLabel(year, competitionType) : "",
      studentsCount: students.length,
    }),
    [competitionLabel, competitionType, students.length, year],
  );

  return (
    <section className="space-y-3 print:hidden" aria-labelledby="competition-tools-title">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="rounded-xl bg-primary/10 p-1.5 text-primary">
          <Trophy className="h-4 w-4" />
        </span>
        <h2 id="competition-tools-title" className="text-base font-black text-foreground">
          أدوات المسابقة
        </h2>
        <span className="text-xs text-muted-foreground">
          استيراد وتصدير وحذف بيانات المسابقة الرمضانية ومسابقة عشر ذي الحجة
        </span>
      </div>

      {readOnly && (
        <p role="note" className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
          وضع الاطلاع يمنع استيراد بيانات المسابقة أو حذفها. يمكنك تصدير كشف المسابقة للاطلاع فقط.
        </p>
      )}

      <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" /> المسابقة والعام المستهدف
          </CardTitle>
          <CardDescription>
            اختر المسابقة والعام قبل الاستيراد أو التصدير أو الحذف — الأدوات تعمل على هذا الاختيار
            فقط.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl bg-secondary p-1 ring-1 ring-primary/10">
              {(["ramadan", "dhul_hijjah"] as CompetitionType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  onClick={() => handleTypeChange(type)}
                  className={`h-9 rounded-xl px-3 text-xs font-bold ${
                    competitionType === type
                      ? "bg-primary text-primary-foreground shadow"
                      : "bg-transparent text-muted-foreground hover:bg-white/60"
                  }`}
                >
                  {competitionLabelFor(type)}
                </Button>
              ))}
            </div>
            <Select value={year} onValueChange={setYear} disabled={!year}>
              <SelectTrigger className="h-10 w-32 rounded-2xl" aria-label="عام المسابقة">
                <SelectValue placeholder="اختر العام" />
              </SelectTrigger>
              <SelectContent>
                {competitionYears().map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}هـ
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="rounded-full text-[11px] font-bold">
              {loadingStudents ? "جارٍ التحميل..." : `${summary.studentsCount} طالب/ة`}
            </Badge>
            {summary.yearLabel && (
              <span className="text-xs text-muted-foreground">{summary.yearLabel}</span>
            )}
          </div>

          <div className="grid items-stretch gap-3 lg:grid-cols-2">
            <StudentRegistryImport
              onImported={loadStudents}
              targetYear={dataYearKey || undefined}
              disabled={readOnly || !dataYearKey}
            />
            <ImportExport
              onDataImported={loadStudents}
              currentYear={dataYearKey}
              competitionLabel={competitionLabel}
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-destructive/25 bg-destructive/[0.03] shadow-xl shadow-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="h-5 w-5" /> حذف بيانات المسابقة
          </CardTitle>
          <CardDescription>
            الحذف هنا يخص {competitionLabel}
            {baseYear ? ` لعام ${baseYear}هـ` : ""} فقط ولا يمسّ السجل العام للطلاب. لحذف قاعدة
            البيانات كاملة استخدم «الحذف المتقدم» في الأسفل.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Button
            variant="outline"
            disabled={readOnly || !dataYearKey}
            onClick={() => openDelete("year")}
            className="h-auto min-h-24 flex-col items-start gap-2 rounded-2xl border-destructive/30 p-4 text-right hover:bg-destructive/5"
          >
            <CalendarDays className="h-5 w-5 text-destructive" />
            <span className="font-bold">{COMPETITION_DELETE_MODES.year.title}</span>
            <span className="text-xs font-normal leading-5 text-muted-foreground">
              {COMPETITION_DELETE_MODES.year.description}
            </span>
          </Button>
          <Button
            variant="outline"
            disabled={readOnly || !dataYearKey}
            onClick={() => openDelete("selected")}
            className="h-auto min-h-24 flex-col items-start gap-2 rounded-2xl border-destructive/30 p-4 text-right hover:bg-destructive/5"
          >
            <UsersRound className="h-5 w-5 text-destructive" />
            <span className="font-bold">{COMPETITION_DELETE_MODES.selected.title}</span>
            <span className="text-xs font-normal leading-5 text-muted-foreground">
              {COMPETITION_DELETE_MODES.selected.description}
            </span>
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open);
          if (!open) {
            setConfirmation("");
            setSelectedIds(new Set());
          }
        }}
      >
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <FileSpreadsheet className="h-5 w-5" /> {COMPETITION_DELETE_MODES[deleteMode].title}
            </DialogTitle>
            <DialogDescription className="leading-6">
              {COMPETITION_DELETE_MODES[deleteMode].description} هذا الإجراء لا يمكن التراجع عنه —
              اكتب عبارة التأكيد قبل التنفيذ.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6">
            الهدف: <strong>{competitionLabel}</strong>
            {baseYear ? ` — عام ${baseYear}هـ` : ""}
            {deleteMode === "year" && students.length > 0 && (
              <>
                {" "}
                · عدد الطلاب المتأثرين: <strong>{students.length}</strong>
              </>
            )}
          </div>

          {deleteMode === "selected" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>طلاب {competitionLabel}</Label>
                <span className="text-xs text-muted-foreground">المحدد: {selectedIds.size}</span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border bg-muted/30 p-2">
                {students.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    لا يوجد طلاب مسجلون في هذه المسابقة.
                  </p>
                ) : (
                  students.map((student) => (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-center gap-2 rounded-xl p-2 hover:bg-background"
                    >
                      <Checkbox
                        checked={selectedIds.has(student.id)}
                        onCheckedChange={() => toggleStudent(student.id)}
                      />
                      <span className="text-sm">{student.name || "بدون اسم"}</span>
                      {student.teacher && (
                        <span className="text-xs text-muted-foreground">— {student.teacher}</span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="competition-delete-confirmation">
              اكتب: <strong className="text-destructive">{requiredPhrase}</strong>
            </Label>
            <Input
              id="competition-delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={requiredPhrase}
              autoComplete="off"
              className="h-11 rounded-2xl"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={deleteDisabled}
              onClick={() => void handleConfirmDelete()}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "جارٍ الحذف..." : "تنفيذ الحذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
