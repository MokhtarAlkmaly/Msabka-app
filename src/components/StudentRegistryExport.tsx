import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CustomColumnDef, Student } from "@/types/student";
import { exportStudentsRegistry } from "@/lib/student-registry-export";

interface Props {
  /** طلاب السجل الشامل المطلوب تصديرهم */
  students: Student[];
  /** الأعمدة المخصّصة لإضافتها كأعمدة في الملف */
  customColumns?: CustomColumnDef[];
  disabled?: boolean;
}

/**
 * زر تصدير السجل الشامل (كل الأعوام) إلى ملف Excel — يُوضع في صفحة الإعدادات
 * بجانب زر الاستيراد. يُصدّر كل الطلاب بلا تصفية؛ أما تصدير نتائج
 * بحث محددة فيتم من زر «تصدير Excel» داخل الجدول.
 */
export const StudentRegistryExport = ({
  students,
  customColumns = [],
  disabled = false,
}: Props) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (disabled || exporting) return;
    if (students.length === 0) {
      toast({
        title: "السجل فارغ",
        description: "لا يوجد طلاب في السجل الشامل لتصديرهم",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const count = await exportStudentsRegistry(students, customColumns);
      toast({
        title: "تم تصدير السجل الشامل",
        description: `تم تصدير ${count} طالب/ة بكل الأعمدة إلى ملف Excel`,
      });
    } catch (error) {
      console.error("Registry export failed:", error);
      toast({
        title: "تعذّر التصدير",
        description: "حدث خطأ أثناء تجهيز ملف Excel — حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
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
            <h3 className="text-base font-black leading-tight">تصدير السجل الشامل</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">ملف Excel واحد لكل الطلاب</p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 rounded-full text-[10px] font-bold">
          سجل شامل
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        صدّر كل طلاب السجل بكل الأعمدة المعتمدة: البيانات الأساسية، الحفظ، الأعوام المسجّل بها، وأي
        أعمدة مخصّصة أضفتها للجدول.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <Button
          onClick={() => void handleExport()}
          size="sm"
          disabled={disabled || exporting || students.length === 0}
          className="h-10 gap-1.5 rounded-xl px-2 text-[11px] font-bold"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {exporting ? "جارٍ التصدير..." : `تصدير كل الطلاب (${students.length})`}
        </Button>
      </div>

      <p className="mt-auto pt-3 text-[11px] leading-relaxed text-muted-foreground">
        <FileSpreadsheet className="ml-1 inline h-3 w-3" />
        لتصدير نتائج بحث أو تصفية محددة استخدم زر «تصدير Excel» داخل الجدول، وللطباعة زر «طباعة
        السجل».
      </p>
    </Card>
  );
};
