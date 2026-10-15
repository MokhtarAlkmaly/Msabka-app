import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  CalendarDays,
  Gift,
  GraduationCap,
  Package,
  ScrollText,
  Users,
} from "lucide-react";
import logo from "@/assets/logo.png";
import type { Student } from "@/types/student";
import {
  consolidateTeachers,
  getActiveYear,
  loadAwards,
  loadCertificates,
  loadGlobalStudentsWithYears,
  loadTeacherBonuses,
  loadTeachers,
  type AwardRow,
  type CertificateRow,
  type TeacherBonusRow,
  type TeacherRow,
} from "@/utils/storage";
import { TeacherRegistryTab } from "@/components/teachers/TeacherRegistryTab";
import { MonthlyBonusesTab } from "@/components/teachers/MonthlyBonusesTab";
import { AnnualBonusesTab } from "@/components/teachers/AnnualBonusesTab";
import { TeacherCertificatesTab } from "@/components/teachers/TeacherCertificatesTab";
import { InKindAidTab } from "@/components/teachers/InKindAidTab";
import { amount, formatAmount, isTeacherRecipient } from "@/components/teachers/shared";

type TeacherTab = "registry" | "monthly" | "annual" | "certificates" | "in_kind";

/**
 * صفحة المعلمين والمعلمات: سجل عام مستقل تماماً عن الأعوام، وفيها تبويبات
 * الإكراميات الشهرية، الإكراميات السنوية، شهادات التقدير، والمساعدات العينية.
 * ربط الطلاب بالمعلمين والمعلمات نفسه يتم في صفحة «الحلقات» لكل عام.
 */
const Teachers = () => {
  const { viewAs } = useAuth();
  const { toast } = useToast();
  const readOnly = !!viewAs;

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [bonuses, setBonuses] = useState<TeacherBonusRow[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [defaultYear, setDefaultYear] = useState("");
  const [activeTab, setActiveTab] = useState<TeacherTab>("registry");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // توحيد أي بيانات قديمة كانت مربوطة بعام: صف عام واحد لكل اسم.
      await consolidateTeachers();
      const [teacherRows, studentRows, bonusRows, awardRows, certificateRows] = await Promise.all([
        loadTeachers(),
        loadGlobalStudentsWithYears(),
        loadTeacherBonuses(),
        loadAwards(),
        loadCertificates(),
      ]);
      setTeachers(teacherRows);
      setStudents(studentRows);
      setBonuses(bonusRows);
      setAwards(awardRows);
      setCertificates(certificateRows);
    } catch (error) {
      console.error("تعذّر تحميل سجل المعلمين والمعلمات:", error);
      toast({
        title: "تعذر تحميل البيانات",
        description: "تحقق من الاتصال ثم حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void (async () => setDefaultYear(await getActiveYear()))();
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const teacherNames = useMemo(() => new Set(teachers.map((teacher) => teacher.name)), [teachers]);

  const stats = useMemo(() => {
    const linkedStudents = students.filter(
      (student) => (student.teacher || "").trim() && teacherNames.has(student.teacher.trim()),
    ).length;
    const monthly = bonuses.reduce((sum, bonus) => sum + amount(bonus.amount), 0);
    const annual = awards
      .filter((award) => award.award_type === "annual" && isTeacherRecipient(award.recipient_type))
      .reduce((sum, award) => sum + amount(award.amount), 0);
    const certificatesCount = certificates.filter((certificate) =>
      isTeacherRecipient(certificate.recipient_type),
    ).length;
    const inKind = awards.filter(
      (award) => award.award_kind === "in_kind" && isTeacherRecipient(award.recipient_type),
    );
    return {
      teachers: teachers.length,
      linkedStudents,
      monthly,
      annual,
      certificatesCount,
      inKindCount: inKind.length,
      inKindValue: inKind.reduce((sum, award) => sum + amount(award.amount), 0),
    };
  }, [awards, bonuses, certificates, students, teacherNames, teachers.length]);

  const tabProps = {
    teachers,
    students,
    bonuses,
    awards,
    certificates,
    defaultYear,
    readOnly,
    onChanged: loadAll,
  };

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]"
      dir="rtl"
    >
      <header className="relative isolate mx-3 mt-3 px-4 pb-6 pt-4 text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 shadow-2xl shadow-primary/20" />
        <div className="container relative mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-3">
            <Link to="/students">
              <Button variant="ghost" size="sm" className="gap-1 text-primary-foreground">
                <ArrowRight className="h-4 w-4" /> سجل الطلاب
              </Button>
            </Link>
            <img
              src={logo}
              alt="مركز إنماء الأهلي الخيري"
              className="h-14 w-14 rounded-2xl bg-white/95 p-1 object-contain sm:h-16 sm:w-16"
            />
            <div className="w-20" />
          </div>

          <div className="mt-3 text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-black sm:text-3xl">
              <Users className="h-6 w-6" /> المعلمون والمعلمات
            </h1>
            <p className="mt-1 text-sm text-white/85">
              سجل عام مستقل عن الأعوام · الإكراميات الشهرية والسنوية · شهادات التقدير · المساعدات
              العينية
            </p>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge className="gap-1 rounded-full bg-white/15 text-white hover:bg-white/20">
              {stats.teachers} في السجل العام
            </Badge>
            <Badge className="gap-1 rounded-full bg-white/15 text-white hover:bg-white/20">
              <GraduationCap className="h-3.5 w-3.5" /> {stats.linkedStudents} طالب مرتبط
            </Badge>
            <Badge className="gap-1 rounded-full bg-white/15 text-white hover:bg-white/20">
              <CalendarDays className="h-3.5 w-3.5" /> إكراميات شهرية: {formatAmount(stats.monthly)}{" "}
              ريال
            </Badge>
            <Badge className="gap-1 rounded-full bg-white/15 text-white hover:bg-white/20">
              <Gift className="h-3.5 w-3.5" /> إكراميات سنوية: {formatAmount(stats.annual)} ريال
            </Badge>
            <Badge className="gap-1 rounded-full bg-white/15 text-white hover:bg-white/20">
              <ScrollText className="h-3.5 w-3.5" /> {stats.certificatesCount} شهادة تقدير
            </Badge>
            <Badge className="gap-1 rounded-full bg-white/15 text-white hover:bg-white/20">
              <Package className="h-3.5 w-3.5" /> {stats.inKindCount} مساعدة عينية
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-4 px-3 py-5 sm:px-4 sm:py-7">
        {loading ? (
          <div className="rounded-[1.75rem] border border-white/70 bg-card/80 py-16 text-center text-muted-foreground shadow-xl shadow-primary/5">
            جارٍ تحميل سجل المعلمين والمعلمات...
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TeacherTab)}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
              <TabsTrigger value="registry" className="gap-1.5 py-2.5">
                <Users className="h-4 w-4" /> السجل العام
              </TabsTrigger>
              <TabsTrigger value="monthly" className="gap-1.5 py-2.5">
                <CalendarDays className="h-4 w-4" /> الإكراميات الشهرية
              </TabsTrigger>
              <TabsTrigger value="annual" className="gap-1.5 py-2.5">
                <Gift className="h-4 w-4" /> الإكراميات السنوية
              </TabsTrigger>
              <TabsTrigger value="certificates" className="gap-1.5 py-2.5">
                <ScrollText className="h-4 w-4" /> شهادات التقدير
              </TabsTrigger>
              <TabsTrigger value="in_kind" className="gap-1.5 py-2.5">
                <Package className="h-4 w-4" /> المساعدات العينية
              </TabsTrigger>
            </TabsList>

            <TabsContent value="registry" className="mt-4">
              <TeacherRegistryTab {...tabProps} />
            </TabsContent>
            <TabsContent value="monthly" className="mt-4">
              <MonthlyBonusesTab {...tabProps} />
            </TabsContent>
            <TabsContent value="annual" className="mt-4">
              <AnnualBonusesTab {...tabProps} />
            </TabsContent>
            <TabsContent value="certificates" className="mt-4">
              <TeacherCertificatesTab {...tabProps} />
            </TabsContent>
            <TabsContent value="in_kind" className="mt-4">
              <InKindAidTab {...tabProps} />
            </TabsContent>
          </Tabs>
        )}

        <div className="rounded-2xl border border-white/60 bg-card/85 p-3 text-xs leading-relaxed text-muted-foreground shadow-sm">
          السجل العام للمعلمين والمعلمات لا يرتبط بأي عام: الاسم يُضاف مرة واحدة وتُبنى عليه
          الإكراميات والشهادات والمساعدات. أما ربط الطلاب بالمعلمين والمعلمات (الحلقات) فهو لكل عام
          على حدة من صفحة{" "}
          <Link to="/halaqat" className="font-bold text-primary underline">
            الحلقات
          </Link>
          ، وسجل الطلاب من صفحة{" "}
          <Link to="/students" className="font-bold text-primary underline">
            الطلاب
          </Link>
          .
        </div>
      </main>
    </div>
  );
};

export default Teachers;
