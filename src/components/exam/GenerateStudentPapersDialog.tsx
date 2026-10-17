import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildPrintDocument, printHtml } from "@/utils/report";
import { exportHtmlAsPdf } from "@/utils/nativePrint";
import { loadQuranData } from "@/utils/quranText";
import {
  HIFZ_CATEGORIES,
  MAX_MODELS,
  MIN_MODELS,
  type RangeDirection,
} from "@/utils/examPaperGenerator";
import {
  PAPER_CSS,
  buildPaperHtml,
  buildStudentAnswerKeyHtml,
  type PaperStudentContext,
} from "@/utils/examPaperPrint";
import {
  distinctPaperCount,
  generateStudentPapers,
  resolveStudentCategory,
  summarizeByCategory,
  toStudentPaperInput,
  type StudentPaper,
  type StudentPapersResult,
} from "@/utils/studentExamPapers";
import type { Student } from "@/types/student";
import { FileDown, Loader2, Printer, Users, Wand2 } from "lucide-react";

/** حجم الورق المطبوع: A5 أفقي (مطابق لنماذج تبويب الاختبارات) */
const PAPER_PDF_FORMAT = "a5";
const PAPER_PDF_ORIENTATION = "landscape";

/** فئة موحّدة لكل الطلاب بدل الاشتقاق من حفظ كل طالب */
const AUTO_CATEGORY = "auto";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** الطلاب المشمولون بالتوليد: كل المفلترين أو طالب واحد من الصف */
  students: Student[];
  currentYear: string;
  competitionLabel?: string;
}

/** بيانات الطالب كما تُطبع في ورقة النموذج */
const toContext = (entry: StudentPaper): PaperStudentContext => ({
  name: entry.student.name,
  teacher: entry.student.teacher,
  gender: entry.student.gender,
  totalHifz: entry.student.totalHifz,
  orderInCategory: entry.orderInCategory,
  categoryTotal: entry.categoryTotal,
});

/**
 * حوار «توليد نماذج الاختبار» في جدول المسابقة.
 *
 * يبني لكل طالب ورقة اختبار باسمه ومعلّمه، من فئة حفظه (تلقائيًا أو موحّدة)،
 * وبمواضع مختلفة عن زملائه في نفس الفئة حتى لا تتطابق النماذج.
 * النتيجة مستند طباعة واحد (A5 أفقي) بصفحة لكل طالب + مفتاح تصحيح اختياري.
 */
export const GenerateStudentPapersDialog = ({
  open,
  onOpenChange,
  students,
  currentYear,
  competitionLabel = "المسابقة الرمضانية",
}: Props) => {
  const { toast } = useToast();
  const [categoryId, setCategoryId] = useState<string>(AUTO_CATEGORY);
  const [direction, setDirection] = useState<RangeDirection>("end");
  const [models, setModels] = useState<number>(MAX_MODELS);
  const [withAnswerKey, setWithAnswerKey] = useState(true);
  const [preloading, setPreloading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [busy, setBusy] = useState<"" | "print" | "pdf">("");

  const isSingle = students.length === 1;

  // تحميل نص المصحف مسبقًا حتى تكون الطباعة فورية عند الضغط
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreloading(true);
    void loadQuranData()
      .then(() => {
        if (!cancelled) setDataError("");
      })
      .catch((err: Error) => {
        if (!cancelled) setDataError(err.message || "تعذّر تحميل نص المصحف");
      })
      .finally(() => {
        if (!cancelled) setPreloading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const inputs = useMemo(() => students.map(toStudentPaperInput), [students]);

  /** معاينة التوزيع حسب الفئة قبل التوليد الفعلي (بلا حاجة لنص المصحف) */
  const preview = useMemo(() => {
    const counts = new Map<string, number>();
    let withoutHifz = 0;
    for (const input of inputs) {
      const category = resolveStudentCategory(input.totalHifz, categoryId);
      if (!category) {
        withoutHifz += 1;
        continue;
      }
      counts.set(category.id, (counts.get(category.id) ?? 0) + 1);
    }
    const rows = HIFZ_CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({
      category: c,
      count: counts.get(c.id)!,
    }));
    return { rows, withoutHifz, total: rows.reduce((sum, r) => sum + r.count, 0) };
  }, [inputs, categoryId]);

  /** توليد النماذج فعليًا — يحتاج نص المصحف */
  const build = async () => {
    const data = await loadQuranData();
    const result = generateStudentPapers(data, inputs, {
      categoryId,
      direction,
      models,
      includeSupplements: true,
    });
    if (result.papers.length === 0) {
      throw new Error(result.skipped[0]?.reason || "لا يوجد طلاب يمكن توليد نماذج لهم");
    }
    return result;
  };

  const bodyOf = (papers: StudentPaper[], answerKey: boolean): string => {
    const sheets = papers.map((entry) =>
      buildPaperHtml(entry.paper, currentYear, toContext(entry)),
    );
    if (!answerKey) return sheets.join("");
    const key = buildStudentAnswerKeyHtml(
      papers.map((entry) => ({ paper: entry.paper, student: toContext(entry) })),
      currentYear,
    );
    return sheets.join("") + key;
  };

  const fileNameOf = (papers: StudentPaper[]): string =>
    isSingle
      ? `نموذج_${papers[0].student.name || "الطالب"}_${currentYear}`
      : `نماذج_طلاب_${competitionLabel}_${currentYear}`;

  /** طباعة مباشرة — نفس مسار بقية التقارير في التطبيق */
  const handlePrint = async () => {
    setBusy("print");
    try {
      const result = await build();
      const fileName = fileNameOf(result.papers);
      await printHtml(
        fileName,
        bodyOf(result.papers, withAnswerKey),
        PAPER_CSS,
        PAPER_PDF_FORMAT,
        PAPER_PDF_ORIENTATION,
      );
      reportResult(result);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "تعذّر توليد النماذج",
        description: (err as Error).message || "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setBusy("");
    }
  };

  /** تنزيل PDF — مسار بديل لا يعتمد على نافذة الطباعة */
  const handleDownloadPdf = async () => {
    setBusy("pdf");
    try {
      const result = await build();
      const fileName = fileNameOf(result.papers);
      await exportHtmlAsPdf(
        buildPrintDocument(fileName, bodyOf(result.papers, withAnswerKey), PAPER_CSS),
        fileName,
        PAPER_PDF_FORMAT,
        PAPER_PDF_ORIENTATION,
      );
      reportResult(result);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "تعذّر تجهيز ملف PDF",
        description: (err as Error).message || "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setBusy("");
    }
  };

  const reportResult = (result: StudentPapersResult) => {
    const skipped = result.skipped.length;
    toast({
      title: `تم تجهيز ${result.papers.length} نموذجًا`,
      description: skipped
        ? `تم تخطي ${skipped} طالب/ة: ${result.skipped[0]?.reason ?? "لا يوجد حفظ كافٍ"}`
        : `${distinctPaperCount(result.papers)} مواضع مختلفة داخل الفئات`,
    });
  };

  const nothingToGenerate = preview.total === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Wand2 className="h-5 w-5" />
            {isSingle
              ? `توليد نموذج اختبار — ${students[0]?.name || ""}`
              : "توليد نماذج اختبار للطلاب"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isSingle
              ? "ورقة اختبار واحدة باسم هذا الطالب/ة، تُطبع بمقاس A5 أفقي مع شعار المركز."
              : `ورقة اختبار باسم كل طالب/ة من الطلاب المفلترين (${students.length})، بمواضع مختلفة داخل فئة حفظ كل منهم.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">فئة الحفظ</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-11 rounded-2xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_CATEGORY}>تلقائي — حسب حفظ كل طالب/ة</SelectItem>
                {HIFZ_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">عدد النماذج داخل الفئة</Label>
            <Select value={String(models)} onValueChange={(v) => setModels(Number(v))}>
              <SelectTrigger className="h-11 rounded-2xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_MODELS - MIN_MODELS + 1 }, (_, i) => MIN_MODELS + i).map(
                  (n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} نموذجًا
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">نطاق الأجزاء</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as RangeDirection)}>
              <SelectTrigger className="h-11 rounded-2xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="end">من آخر المصحف</SelectItem>
                <SelectItem value="start">من أول المصحف</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={withAnswerKey}
                onCheckedChange={(v) => setWithAnswerKey(v === true)}
              />
              <span>إرفاق مفتاح التصحيح</span>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/25 p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-bold text-primary">
            <Users className="h-4 w-4" />
            توزيع الفئات المتوقع
          </div>
          {preview.rows.length === 0 ? (
            <p className="text-muted-foreground">
              لا يوجد حفظ مسجّل لهؤلاء الطلاب — سجّل «الحفظ السابق» أو «حفظ جديد» أولًا، أو اختر فئة
              موحّدة من القائمة.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {preview.rows.map((row) => (
                <Badge key={row.category.id} variant="outline" className="gap-1">
                  {row.category.label}
                  <span className="font-black text-primary">{row.count}</span>
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            سيُطبع {preview.total} نموذجًا — صفحة A5 أفقي لكل طالب/ة
            {preview.withoutHifz > 0 && (
              <span className="text-amber-700">
                {" "}
                · سيتم تخطي {preview.withoutHifz} طالب/ة بلا حفظ مسجّل
              </span>
            )}
          </p>
        </div>

        {preloading && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            جارٍ تحميل نص المصحف للتوليد...
          </p>
        )}
        {dataError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            تعذّر تحميل نص المصحف: {dataError}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            className="gap-1"
            onClick={() => void handlePrint()}
            disabled={busy !== "" || preloading || nothingToGenerate || !!dataError}
          >
            {busy === "print" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {isSingle ? "طباعة النموذج" : "طباعة نماذج الجميع"}
          </Button>
          <Button
            variant="outline"
            className="gap-1"
            onClick={() => void handleDownloadPdf()}
            disabled={busy !== "" || preloading || nothingToGenerate || !!dataError}
          >
            {busy === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            تنزيل PDF
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </DialogFooter>

        <p className="text-xs text-muted-foreground">
          ملاحظة: يتجاوز عدد الطلاب أحيانًا الحد الأعلى للنماذج ({MAX_MODELS})، وحينها تُعاد المواضع
          من البداية داخل نفس الفئة. لزيادة التميّز قلّل عدد طلاب الدفعة باستخدام التصفية (حسب
          المعلم/ة مثلًا).
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateStudentPapersDialog;
