import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@/lib/router-compat";
import { BookOpenCheck, Layers, Wand2 } from "lucide-react";

import { START_YEAR, END_YEAR } from "@/types/student";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import ExtraBankTab from "@/components/exam/ExtraBankTab";
import ExamPapersTab from "@/components/exam/ExamPapersTab";

/**
 * صفحة أسئلة الاختبارات:
 *  - «نماذج الاختبار»: توليد أسئلة الحفظ من المصحف حسب فئة الحفظ بعدة نماذج.
 *  - «بنك إضافي»: بنك الأسئلة اليدوي (اختيار من متعدد / صح وخطأ / مقالي).
 */
const ExamQuestions = () => {
  const { user } = useAuth();
  const [currentYear, setCurrentYear] = useState("");

  useEffect(() => {
    void (async () => setCurrentYear(await getActiveYear()))();
  }, []);

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]"
      dir="rtl"
    >
      <header className="bg-gradient-to-l from-emerald-900 to-teal-800 p-6 pt-16 text-white md:pt-6">
        <Link to="/" className="text-sm text-emerald-100">
          ← رجوع لسجل الطلاب
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold">
          <BookOpenCheck /> الأسئلة والاختبارات
        </h1>
        <p className="mt-2 text-sm text-emerald-100">
          حتى ٣٠ نموذجًا للحفظ والتجويد ومعاني الآيات حسب فئة الحفظ — وبنك أسئلة إضافي
        </p>
      </header>

      <div className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-7 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">العام</span>
          <Select
            value={currentYear}
            onValueChange={(v) => {
              setCurrentYear(v);
              void setActiveYear(v);
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map(
                (y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}هـ
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        {!currentYear || !user ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : (
          <Tabs defaultValue="papers" dir="rtl" className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="papers" className="gap-1">
                <Wand2 className="h-4 w-4" /> نماذج الاختبار
              </TabsTrigger>
              <TabsTrigger value="bank" className="gap-1">
                <Layers className="h-4 w-4" /> بنك إضافي
              </TabsTrigger>
            </TabsList>
            <TabsContent value="papers">
              <ExamPapersTab key={currentYear} year={currentYear} />
            </TabsContent>
            <TabsContent value="bank">
              <ExtraBankTab key={currentYear} year={currentYear} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default ExamQuestions;
