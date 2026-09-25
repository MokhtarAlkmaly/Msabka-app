import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Eye, LogOut, Loader2 } from "lucide-react";

/**
 * شريط ثابت يظهر أعلى الصفحة أثناء الاطلاع على بيانات مستخدم آخر،
 * ليكون واضحاً أن ما يُعرض ليس بيانات المستخدم نفسه وأنه للقراءة فقط.
 */
export const ViewAsBanner = () => {
  const { viewAs, setViewAs } = useAuth();
  const [leaving, setLeaving] = useState(false);

  if (!viewAs) return null;

  const exit = () => {
    setLeaving(true);
    setViewAs(null);
    // إعادة تحميل كاملة لضمان تفريغ كل البيانات المعروضة من الذاكرة.
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <div className="sticky top-0 z-50 print:hidden" dir="rtl">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-lg">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-4 w-4" />
          تطالع بيانات: {viewAs.name}
        </span>
        <span className="rounded-full bg-amber-950/15 px-2 py-0.5 text-[11px] font-bold">
          قراءة فقط
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={exit}
          disabled={leaving}
          className="h-7 gap-1 rounded-full bg-amber-950/10 px-3 text-amber-950 hover:bg-amber-950/20"
        >
          {leaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          العودة لبياناتي
        </Button>
      </div>
    </div>
  );
};
