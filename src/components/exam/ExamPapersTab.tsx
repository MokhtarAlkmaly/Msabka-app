import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { printHtml } from "@/utils/report";
import { examQuestionErrorMessage, saveExamQuestions } from "@/utils/examStorage";
import { normalizeQuestionText, type ExamQuestionInput } from "@/lib/exam-questions";
import {
  PAPER_CSS,
  buildAnswerKeyHtml,
  buildPaperHtml,
  buildPapersHtml,
} from "@/utils/examPaperPrint";
import { BookOpen, Loader2, Printer, Save, Sparkles, Wand2 } from "lucide-react";
import { loadQuranData, type QuranData } from "@/utils/quranText";
import {
  HIFZ_CATEGORIES,
  MAX_MODELS,
  MIN_MODELS,
  type ExamPaper,
  type RangeDirection,
  describeJuzRange,
  formatQuestionRef,
  formatQuestionText,
  generatePapers,
  getCategory,
  resolveJuzRange,
} from "@/utils/examPaperGenerator";

const SAVE_MODEL_NOTE = "توليد تلقائي من المصحف";

/**
 * تبويب «نماذج الاختبار»: توليد أسئلة الحفظ من المصحف حسب فئة الحفظ،
 * بعدة نماذج (أ، ب، ج…) بمواضع مختلفة، مع الطباعة أو الحفظ في البنك.
 */
const ExamPapersTab = ({ year }: { year: string }) => {
  const { user, viewAs } = useAuth();
  const { toast } = useToast();
  const [categoryId, setCategoryId] = useState(HIFZ_CATEGORIES[0].id);
  const [direction, setDirection] = useState<RangeDirection>("end");
  const [modelsCount, setModelsCount] = useState(25);
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataError, setDataError] = useState("");

  const category = useMemo(() => getCategory(categoryId), [categoryId]);
  const juzRange = useMemo(() => resolveJuzRange(category, direction), [category, direction]);
  const rangeLabel = useMemo(() => describeJuzRange(juzRange), [juzRange]);
  const canChooseDirection = !category.singleJuz && category.juzCount < 30;

  // تحميل نص المصحف مسبقًا حتى يكون التوليد فوريًا
  useEffect(() => {
    let cancelled = false;
    void loadQuranData().catch((err: Error) => {
      if (!cancelled) setDataError(err.message || "تعذّر تحميل نص المصحف");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const data: QuranData = await loadQuranData();
      setDataError("");
      const result = generatePapers(data, { category, models: modelsCount, direction });
      setPapers(result);
    } catch (err) {
      const message = (err as Error).message || "تعذّر التوليد";
      setDataError(message);
      toast({ title: "تعذّر توليد النماذج", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const printPaper = (paper: ExamPaper) => {
    void printHtml(`نموذج_${paper.label}_${year}`, buildPaperHtml(paper, year), PAPER_CSS);
  };

  const printAll = () => {
    void printHtml(`نماذج_الاختبار_${year}`, buildPapersHtml(papers, year), PAPER_CSS);
  };

  const printAnswerKey = () => {
    void printHtml(`مفتاح_التصحيح_${year}`, buildAnswerKeyHtml(papers, year), PAPER_CSS);
  };

  /**
   * حفظ أسئلة النماذج في بنك الأسئلة (مع تجاهل المكرر).
   *
   * محلي أولاً: تُكتب الأسئلة في SQLite فوراً (تعمل بلا إنترنت) ويُرفع كل
   * منها عبر الطابور عند توفر الاتصال. كشف المكرّر يتم محلياً كذلك — بلا أي
   * استعلام سحابي لقراءة الأسئلة الموجودة.
   */
  const saveToBank = async (list: ExamPaper[]) => {
    if (!user || viewAs || list.length === 0) return;
    setSaving(true);
    try {
      const rows: ExamQuestionInput[] = [];
      const seen = new Set<string>();
      let duplicatesInBatch = 0;
      const push = (row: ExamQuestionInput) => {
        const key = normalizeQuestionText(row.question);
        if (!key || seen.has(key)) {
          if (key) duplicatesInBatch++;
          return;
        }
        seen.add(key);
        rows.push(row);
      };

      for (const paper of list) {
        for (const q of paper.questions) {
          push({
            year,
            category: paper.categoryLabel,
            subject: `سورة ${q.surahName}`,
            question_type: "written",
            question: formatQuestionText(q),
            choices: [],
            correct_answer: formatQuestionRef(q),
            difficulty: "متوسط",
            notes: `${paper.title} — ${SAVE_MODEL_NOTE} — الجزء ${q.juzFrom} — نحو ${q.ayahCount} آيات`,
          });
        }
        for (const q of paper.supplements) {
          push({
            year,
            category: paper.categoryLabel,
            subject: q.kind === "tajweed" ? "التجويد" : "معاني الآيات",
            question_type: "written",
            question: q.question,
            choices: [],
            correct_answer: q.answer,
            difficulty: "متوسط",
            notes: `${paper.title} — ${q.reference} — ${SAVE_MODEL_NOTE}`,
          });
        }
      }

      if (rows.length === 0) {
        const total = list.reduce((acc, p) => acc + p.questions.length + p.supplements.length, 0);
        toast({
          title: "كل الأسئلة موجودة في البنك مسبقًا",
          description: `${total} سؤالًا مكررًا`,
        });
        return;
      }

      const { saved, skipped } = await saveExamQuestions(rows);
      const skippedTotal = skipped + duplicatesInBatch;
      toast({
        title: `تم حفظ ${saved.length} سؤالًا في البنك`,
        description: skippedTotal
          ? `تم تخطي ${skippedTotal} سؤالًا مكررًا`
          : "تجدها في تبويب «بنك إضافي»",
      });
    } catch (err) {
      toast({
        title: "تعذّر الحفظ في البنك",
        description: examQuestionErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/70 bg-card/90 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">فئة الحفظ</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIFZ_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canChooseDirection && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">نطاق الأجزاء</label>
              <Select value={direction} onValueChange={(v) => setDirection(v as RangeDirection)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="end">من آخر المصحف</SelectItem>
                  <SelectItem value="start">من أول المصحف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">عدد النماذج</label>
            <Select value={String(modelsCount)} onValueChange={(v) => setModelsCount(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_MODELS - MIN_MODELS + 1 }, (_, i) => MIN_MODELS + i).map(
                  (n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} نماذج
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <Button className="gap-1" onClick={() => void generate()} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            توليد النماذج
          </Button>

          {papers.length > 0 && (
            <>
              <Button variant="outline" className="gap-1" onClick={printAll}>
                <Printer className="h-4 w-4" /> طباعة الكل
              </Button>
              <Button variant="outline" className="gap-1" onClick={printAnswerKey}>
                <BookOpen className="h-4 w-4" /> مفتاح التصحيح
              </Button>
              <Button
                variant="secondary"
                className="gap-1"
                disabled={saving || !user || !!viewAs}
                onClick={() => void saveToBank(papers)}
              >
                <Save className="h-4 w-4" /> حفظ الكل في البنك
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            {category.questions} أسئلة حفظ + سؤالان في التجويد + سؤالان في المعاني موزَّعة على{" "}
            {rangeLabel} — صيغة السؤال: «اقرأ من قوله تعالى ﴿…﴾ إلى قوله تعالى ﴿…﴾» بطول نحو 10 آيات
            أو ما يقارب 5 أسطر.
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          التجويد: تطبيق الغنة والقلقلة من آيات الفئة. المعاني: معانٍ مختصرة مستندة إلى التفسير
          الميسر وتفسير السعدي. قد تتكرر بعض الأسئلة الإضافية بين النماذج عند ضيق نطاق الفئة؛ مقاطع
          الحفظ لا تتداخل.
        </p>
        {viewAs && (
          <p className="text-sm text-amber-700">
            الحفظ والتعديل معطّلان أثناء وضع الاطلاع. بنك الأسئلة خاص بحسابك.
          </p>
        )}
        {dataError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            تعذّر تحميل نص المصحف: {dataError}
            <span className="block text-xs mt-1">
              تأكد من وجود ملف <code>public/quran/uthmani.json</code> المضمَّن في المشروع.
            </span>
          </div>
        )}
      </div>

      {papers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          اختر فئة الحفظ وعدد النماذج ثم اضغط «توليد النماذج» — يحصل كل نموذج على مواضع مختلفة من
          المصحف.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{papers.length} نماذج</Badge>
            <span>
              النتائج المولَّدة: {papers[0]?.categoryLabel} — {papers[0]?.rangeLabel} — لتوليد مواضع
              أخرى بنفس الإعدادات اضغط «توليد النماذج» مرة أخرى.
            </span>
          </div>
          {papers.map((paper) => (
            <div
              key={paper.index}
              className="rounded-2xl border border-white/70 bg-card/90 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1">
                  {paper.title}
                </Badge>
                <Badge variant="secondary">{paper.categoryLabel}</Badge>
                <Badge variant="outline">{paper.rangeLabel}</Badge>
                <Badge variant="outline">
                  {paper.questions.length + paper.supplements.length} أسئلة
                </Badge>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => printPaper(paper)}
                >
                  <Printer className="h-3 w-3" /> طباعة النموذج
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  disabled={saving || !user || !!viewAs}
                  onClick={() => void saveToBank([paper])}
                >
                  <Save className="h-3 w-3" /> حفظ في البنك
                </Button>
              </div>

              <ol className="space-y-3">
                {paper.questions.map((q) => (
                  <li key={q.number} className="rounded-xl bg-secondary/40 p-3">
                    <div className="flex gap-2">
                      <span className="font-bold text-primary">{q.number}.</span>
                      <p className="font-semibold leading-8" dir="rtl">
                        {formatQuestionText(q)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatQuestionRef(q)} — الجزء {q.juzFrom}
                      {q.juzTo !== q.juzFrom ? `–${q.juzTo}` : ""} — {q.ayahCount} آيات (~{q.lines}{" "}
                      سطر)
                    </p>
                  </li>
                ))}
              </ol>
              <h3 className="mt-4 mb-2 font-bold">التجويد ومعاني الآيات</h3>
              <ol className="space-y-3" start={paper.questions.length + 1}>
                {paper.supplements.map((q, i) => (
                  <li key={i} className="rounded-xl bg-secondary/40 p-3">
                    <Badge variant="outline">
                      {q.kind === "tajweed" ? "التجويد" : "معاني الآيات"}
                    </Badge>
                    <p className="mt-2 font-semibold leading-8">
                      {paper.questions.length + i + 1}. {q.question}
                    </p>
                    <p className="text-xs text-muted-foreground">{q.reference}</p>
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-primary">
                        الإجابة الإرشادية للمصحّح
                      </summary>
                      <p className="mt-2">{q.answer}</p>
                    </details>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExamPapersTab;
