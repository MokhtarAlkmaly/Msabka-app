import { HardDrive, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_LOCAL_NOTE, BRAND_NAME_TAGGED } from "@/lib/brand";

/**
 * علامات الهوية المميّزة للنسخة المستقلة (Markz Net — نسخة بلا إنترنت).
 *
 * تُستخدم في كل الصفحات حتى يفرّق المستخدم بسهولة بين هذا النظام وبين نسخة
 * «مركز إنماء الأهلي الخيري» المتصلة بالسحابة — ولو كانا مثبّتين على الجهاز نفسه.
 */

export type OfflineBadgeTone = "glass" | "solid" | "outline" | "amber";

const toneClasses: Record<OfflineBadgeTone, string> = {
  // على الترويسات الداكنة (زجاجي فاتح)
  glass: "bg-emerald-300/20 text-emerald-50 ring-emerald-200/30",
  // على الخلفيات الفاتحة
  solid: "bg-emerald-600/10 text-emerald-800 ring-emerald-600/30 dark:text-emerald-200",
  outline: "bg-transparent text-muted-foreground ring-border",
  amber: "bg-amber-400/15 text-amber-900 ring-amber-400/40 dark:text-amber-200",
};

interface OfflineBadgeProps {
  tone?: OfflineBadgeTone;
  className?: string;
  label?: string;
  title?: string;
}

/** شارة صغيرة: «نسخة بلا إنترنت · البيانات على هذا الجهاز». */
export const OfflineBadge = ({
  tone = "solid",
  className,
  label = BRAND_LOCAL_NOTE,
  title = "هذه نسخة مستقلة تعمل بلا إنترنت — كل البيانات مخزّنة على هذا الجهاز ولا تُرسَل لأي خادم",
}: OfflineBadgeProps) => (
  <span
    title={title}
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1",
      toneClasses[tone],
      className,
    )}
  >
    <WifiOff className="h-3 w-3 shrink-0" />
    <span>{label}</span>
  </span>
);

/** بطاقة تعريف موسّعة تُعرض في صفحات الدخول والتثبيت والإعدادات. */
export const OfflineNotice = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex items-start gap-2 rounded-2xl border border-emerald-300/50 bg-emerald-400/10 p-3 text-xs leading-6 text-emerald-900 dark:text-emerald-200",
      className,
    )}
  >
    <HardDrive className="mt-0.5 h-4 w-4 shrink-0" />
    <span>
      <strong>{BRAND_NAME_TAGGED}</strong> — نظام إدارة حلقات ومسابقات القرآن الكريم، يعمل بالكامل
      على هذا الجهاز: الحسابات والطلاب والمتابعة الشهرية والمسابقات والوسائط تُخزَّن في قاعدة بيانات
      محلية، ولا تُرسَل أي بيانات إلى أي خادم أو خدمة سحابية.
    </span>
  </div>
);

/** شريط هوية رقيق أعلى الصفحات (اختياري). */
export const OfflineRibbon = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex flex-wrap items-center justify-center gap-2 bg-emerald-950 px-3 py-1.5 text-center text-[11px] font-semibold text-emerald-100 print:hidden",
      className,
    )}
  >
    <WifiOff className="h-3 w-3 text-amber-300" />
    <span>{BRAND_NAME_TAGGED}</span>
    <span className="text-emerald-300/70">·</span>
    <span className="text-emerald-200/90">لا يحتاج إنترنت ولا يحذف بيانات النسخة السابقة</span>
  </div>
);
