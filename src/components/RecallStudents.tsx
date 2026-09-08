import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { History, Loader2, Users } from "lucide-react";
import { listRecallCandidates, recallStudentsToYear, RecallCandidate } from "@/utils/storage";
import { useToast } from "@/hooks/use-toast";

interface Props {
  currentYear: string;
  onRecalled: () => void | Promise<void>;
}

export const RecallStudents = ({ currentYear, onRecalled }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<RecallCandidate[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected([]);
    setQuery("");
    listRecallCandidates(currentYear)
      .then(setCandidates)
      .finally(() => setLoading(false));
  }, [open, currentYear]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return candidates;
    return candidates.filter((c) => (c.name || "").includes(q) || (c.teacher || "").includes(q));
  }, [candidates, query]);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    const ids = filtered.map((c) => c.id);
    const allSelected = ids.every((id) => selected.includes(id));
    setSelected(allSelected ? selected.filter((id) => !ids.includes(id)) : Array.from(new Set([...selected, ...ids])));
  };

  const handleRecall = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const added = await recallStudentsToYear(currentYear, selected);
      toast({
        title: "تم الاستدعاء",
        description: `تم استدعاء ${added} طالبة إلى عام ${currentYear}هـ مع ترحيل الحفظ السابق`,
      });
      setOpen(false);
      await onRecalled();
    } catch (e) {
      toast({ title: "خطأ", description: "تعذّر استدعاء الطالبات", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="h-12 gap-2 rounded-2xl lg:col-span-2">
          <History className="h-4 w-4" />
          استدعاء طالبة من الأعوام السابقة
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>استدعاء طالبات إلى عام {currentYear}هـ</DialogTitle>
          <DialogDescription>
            اختر الطالبات من الأعوام السابقة، وسيتم تسجيلهن في العام المختار مع نقل الإجمالي التراكمي كـ«حفظ سابق».
          </DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث بالاسم أو المعلمة..."
          className="h-10 rounded-xl"
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            لا توجد طالبات في أعوام سابقة غير مسجّلات في هذا العام
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={toggleAll} className="font-semibold text-primary hover:underline">
                تحديد / إلغاء الكل ({filtered.length})
              </button>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> محدد: {selected.length}
              </span>
            </div>
            <div className="max-h-[45vh] space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {filtered.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm hover:bg-secondary/50"
                >
                  <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <span className="flex-1 font-semibold">{c.name || "بدون اسم"}</span>
                  <span className="text-xs text-muted-foreground">{c.teacher || "—"}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">آخر عام: {c.lastYear}هـ</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    حفظ سابق: {c.baseHifz}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button onClick={handleRecall} disabled={selected.length === 0 || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
            استدعاء المحدد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
