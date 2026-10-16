import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Student,
  YearData,
  HifzHistory,
  MonthlyRecord,
  START_YEAR,
  END_YEAR,
  TRACKING_MONTHS,
  InternalCompetition,
  ExternalCompetition,
  CustomColumnDef,
  GENDER_OPTIONS,
} from "@/types/student";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_SCHOOL_GRADES } from "@/utils/schoolGrades";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  loadYearDataForStudent,
  saveYearData,
  loadHifzHistory,
  saveHifzHistory,
  saveStudent,
  loadMonthlyTrackingForStudent,
  saveMonthlyRecord,
  loadAwards,
  saveAward,
  deleteAwardLocal,
  loadCertificates,
  saveCertificate,
  deleteCertificateLocal,
  loadInternalCompetitions,
  saveInternalCompetition,
  deleteInternalCompetitionLocal,
  loadExternalCompetitions,
  saveExternalCompetition,
  deleteExternalCompetitionLocal,
  loadAllStudentsWithData,
  AwardRow,
  CertificateRow,
} from "@/utils/storage";
import { resolveBaseHifz, calculateGrade, calculatePrize } from "@/utils/calculations";
import { getSurahList, calcPagesBetweenAsync } from "@/utils/quranData";
import { esc } from "@/utils/report";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";
import {
  GraduationCap,
  Calendar,
  BookOpen,
  CalendarDays,
  Award,
  ScrollText,
  Gift,
  Medal,
  Globe2,
  TrendingUp,
  Phone,
  MessageCircle,
  Save,
  Plus,
  Trash2,
  Printer,
  Sparkles,
  Trophy,
  Users,
  Pencil,
  Send,
  CheckCircle2,
  Clock,
  ListFilter,
  PencilLine,
} from "lucide-react";

interface Props {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentUpdated?: () => void;
  initialYear?: string;
  customColumns?: CustomColumnDef[];
}

const emptyYearData = (): YearData => ({
  baseHifz: "0",
  totalHifz: "0",
  parts: "",
  annual: "",
  recitation: "",
  memorization: "",
  total: "0",
  grade: "",
  prize: "0",
  statusPrize: "",
  rank: "-",
  teacher: "",
});

export const StudentProfileModal = ({
  student,
  open,
  onOpenChange,
  onStudentUpdated,
  initialYear = "1447",
  customColumns = [],
}: Props) => {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [activeTab, setActiveTab] = useState<string>("monthly");
  const [loading, setLoading] = useState(true);

  // Student details editing
  const [editingInfo, setEditingInfo] = useState(false);
  /** كتابة السنة الدراسية يدويًا بدل اختيارها من القائمة الموحّدة */
  const [manualGradeEntry, setManualGradeEntry] = useState(false);

  /** قائمة السنوات الدراسية الموحّدة — نفس قائمة تصفية جدول الطلاب */
  const gradeChoiceLabels = useMemo(() => DEFAULT_SCHOOL_GRADES, []);

  /** هل القيمة المخزّنة نص حرّ مكتوب يدويًا (خارج القائمة الموحّدة)؟ */
  const isManualGradeValue = (value?: string) => {
    const trimmed = (value || "").trim();
    return !!trimmed && !DEFAULT_SCHOOL_GRADES.includes(trimmed);
  };
  const [studentData, setStudentData] = useState<Student | null>(null);

  // Year-specific data
  const [yearData, setYearData] = useState<YearData>(emptyYearData());
  const [history, setHistory] = useState<HifzHistory>({});
  const [allYearsData, setAllYearsData] = useState<Record<string, YearData>>({});
  const [monthlyRecords, setMonthlyRecords] = useState<Record<number, MonthlyRecord>>({});
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [internalComps, setInternalComps] = useState<InternalCompetition[]>([]);
  const [externalComps, setExternalComps] = useState<ExternalCompetition[]>([]);
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);

  // Dialogs & Forms
  const [addAwardOpen, setAddAwardOpen] = useState(false);
  const [awardForm, setAwardForm] = useState({
    award_type: "annual",
    award_kind: "cash",
    amount: "0",
    item: "",
    notes: "",
    awarded_at: new Date().toISOString().slice(0, 10),
  });

  const [addCertOpen, setAddCertOpen] = useState(false);
  const [certForm, setCertForm] = useState({
    cert_type: "excellence",
    title: "شهادة تميّز وتفوّق",
    notes: "",
    issued_at: new Date().toISOString().slice(0, 10),
  });

  const [addInternalOpen, setAddInternalOpen] = useState(false);
  const [internalForm, setInternalForm] = useState({
    competition_name: "",
    category: "فرع 5 أجزاء",
    score: "95",
    rank: "المركز الأول",
    prize: "شهادة ومكافأة",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const [addExternalOpen, setAddExternalOpen] = useState(false);
  const [externalForm, setExternalForm] = useState({
    competition_name: "",
    organizer: "مكتب الأوقاف والإرشاد",
    category: "فرع القرآن كاملاً",
    score: "90",
    rank: "المركز الأول",
    prize: "",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const yearsList = useMemo(
    () => Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => String(START_YEAR + i)),
    [],
  );

  const loadStudentFullData = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    setStudentData(student);

    try {
      const [hMap, allYMap, mRecs, allAwards, allCerts, allInternal, allExternal, cohortList] =
        await Promise.all([
          loadHifzHistory(student.id),
          loadYearDataForStudent(student.id),
          loadMonthlyTrackingForStudent(selectedYear, student.id),
          loadAwards(selectedYear),
          loadCertificates(selectedYear),
          loadInternalCompetitions(selectedYear, student.id),
          loadExternalCompetitions(selectedYear, student.id),
          loadAllStudentsWithData(selectedYear),
        ]);

      setHistory(hMap || {});
      setYearData(allYMap[selectedYear] || emptyYearData());
      setMonthlyRecords(mRecs || {});

      const sName = (student.name || "").trim();
      setAwards(
        (allAwards || []).filter(
          (a) =>
            (a.recipient_name || "").trim() === sName || (a.student_name || "").trim() === sName,
        ),
      );
      setCertificates((allCerts || []).filter((c) => (c.recipient_name || "").trim() === sName));
      setInternalComps(allInternal || []);
      setExternalComps(allExternal || []);
      setCohortStudents(cohortList || []);

      // كل أعوام الطالب وصلت باستعلام محلي واحد بدلاً من استعلام لكل عام.
      setAllYearsData(allYMap);
    } catch (e) {
      console.error("Error loading student profile data:", e);
    } finally {
      setLoading(false);
    }
  }, [student, selectedYear, yearsList]);

  useEffect(() => {
    if (open && student) {
      loadStudentFullData();
    }
  }, [open, student, loadStudentFullData]);

  if (!student) return null;

  // Calculations for current year
  const selectedYearNum = parseInt(selectedYear);
  const baseHifz = resolveBaseHifz(history, selectedYearNum, yearData.baseHifz);
  const parts = parseFloat(yearData.parts) || 0;
  const totalHifz = Math.min(baseHifz + parts, 30);
  const annual = parseFloat(yearData.annual) || 0;
  const recitation = parseFloat(yearData.recitation) || 0;
  const memorization = parseFloat(yearData.memorization) || 0;
  const totalScore = Math.min(annual + recitation + memorization, 100);
  const { grade, pricePerPart } = calculateGrade(totalScore);
  const prize = calculatePrize(parts, pricePerPart);
  const statusPrize = parseFloat(yearData.statusPrize) || 0;
  const isActive = parts > 0 || totalScore > 0;

  // Monthly stats
  const filledMonths = Object.keys(monthlyRecords).length;
  const totalMonthlyScore = Object.values(monthlyRecords).reduce((acc, r) => {
    const s =
      (parseFloat(r.memoHifzScore) || 0) +
      (parseFloat(r.memoRecitationScore) || 0) +
      (parseFloat(r.reviewHifzScore) || 0) +
      (parseFloat(r.reviewRecitationScore) || 0) +
      (parseFloat(r.attendanceScore) || 0) +
      (parseFloat(r.behaviorScore) || 0);
    return acc + s;
  }, 0);
  const avgMonthlyScore = filledMonths > 0 ? (totalMonthlyScore / filledMonths).toFixed(1) : "0";

  // Multi-year stats
  const multiYearStats = yearsList
    .map((y) => {
      const yData = allYearsData[y] || emptyYearData();
      const yNum = parseInt(y);
      const bH = resolveBaseHifz(history, yNum, yData.baseHifz);
      const p = parseFloat(yData.parts) || 0;
      const totH = Math.min(bH + p, 30);
      const a = parseFloat(yData.annual) || 0;
      const r = parseFloat(yData.recitation) || 0;
      const m = parseFloat(yData.memorization) || 0;
      const ts = Math.min(a + r + m, 100);
      const { grade: g } = calculateGrade(ts);
      const pr = calculatePrize(p, calculateGrade(ts).pricePerPart);
      return {
        year: y,
        baseHifz: bH,
        parts: p,
        totalHifz: totH,
        totalScore: ts,
        grade: g,
        prize: pr,
        hasData: p > 0 || ts > 0 || bH > 0,
      };
    })
    .filter((x) => x.hasData);

  // Peer comparison stats for selected year
  const cohortWithScores = cohortStudents.map((s) => {
    const sBase = resolveBaseHifz(s.hifzHistory || {}, selectedYearNum, s.yearData?.baseHifz);
    const sParts = parseFloat(s.yearData?.parts || "0") || 0;
    const sTotalHifz = Math.min(sBase + sParts, 30);
    const sScore = parseFloat(s.yearData?.total || "0") || 0;
    return {
      id: s.id,
      name: s.name,
      teacher: s.teacher,
      parts: sParts,
      totalHifz: sTotalHifz,
      totalScore: sScore,
    };
  });

  const cohortActive = cohortWithScores.filter((s) => s.parts > 0 || s.totalScore > 0);
  const classStudents = cohortActive.filter(
    (s) => s.teacher && s.teacher === (studentData?.teacher || student.teacher),
  );

  const cohortAvgScore =
    cohortActive.length > 0
      ? (cohortActive.reduce((sum, s) => sum + s.totalScore, 0) / cohortActive.length).toFixed(1)
      : "0";
  const cohortAvgParts =
    cohortActive.length > 0
      ? (cohortActive.reduce((sum, s) => sum + s.parts, 0) / cohortActive.length).toFixed(1)
      : "0";

  const cohortRank =
    cohortActive.sort((a, b) => b.totalScore - a.totalScore).findIndex((s) => s.id === student.id) +
    1;

  const classRank =
    classStudents
      .sort((a, b) => b.totalScore - a.totalScore)
      .findIndex((s) => s.id === student.id) + 1;

  // Handlers
  const handleSaveStudentInfo = async () => {
    if (!studentData) return;
    await saveStudent(studentData);
    toast({ title: "تم التحديث", description: "تم حفظ بيانات الطالب بنجاح" });
    setEditingInfo(false);
    onStudentUpdated?.();
  };

  const handleSaveYearData = async () => {
    await saveYearData(selectedYear, student.id, yearData);
    toast({ title: "تم الحفظ", description: `تم حفظ بيانات المسابقة لعام ${selectedYear}هـ` });
    onStudentUpdated?.();
  };

  const handleAddAward = async () => {
    if (!studentData) return;
    await saveAward({
      year: selectedYear,
      recipient_type: "student",
      recipient_name: studentData.name,
      student_name: studentData.name,
      award_type: awardForm.award_type,
      award_kind: awardForm.award_kind,
      amount: parseFloat(awardForm.amount) || 0,
      item: awardForm.item.trim() || null,
      notes: awardForm.notes.trim() || null,
      awarded_at: awardForm.awarded_at,
    });
    toast({ title: "تمت إضافة الجائزة" });
    setAddAwardOpen(false);
    loadStudentFullData();
  };

  const handleDeleteAward = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الجائزة؟")) return;
    await deleteAwardLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    loadStudentFullData();
  };

  const handleAddCert = async () => {
    if (!studentData) return;
    await saveCertificate({
      year: selectedYear,
      recipient_type: "student",
      recipient_name: studentData.name,
      cert_type: certForm.cert_type,
      title: certForm.title.trim() || "شهادة تقدير",
      notes: certForm.notes.trim() || null,
      issued_at: certForm.issued_at,
    });
    toast({ title: "تم إصدار الشهادة" });
    setAddCertOpen(false);
    loadStudentFullData();
  };

  const handleDeleteCert = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الشهادة؟")) return;
    await deleteCertificateLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    loadStudentFullData();
  };

  const handleAddInternal = async () => {
    if (!studentData) return;
    await saveInternalCompetition({
      student_id: studentData.id,
      student_name: studentData.name,
      year: selectedYear,
      competition_name: internalForm.competition_name.trim() || "مسابقة تحفيظ داخلية",
      category: internalForm.category,
      score: parseFloat(internalForm.score) || 0,
      rank: internalForm.rank,
      prize: internalForm.prize,
      notes: internalForm.notes.trim() || null,
      date: internalForm.date,
    });
    toast({ title: "تم تسجيل المشاركة بالمسابقة الداخلية" });
    setAddInternalOpen(false);
    loadStudentFullData();
  };

  const handleDeleteInternal = async (id: string) => {
    if (!confirm("حذف هذه المسابقة؟")) return;
    await deleteInternalCompetitionLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    loadStudentFullData();
  };

  const handleAddExternal = async () => {
    if (!studentData) return;
    await saveExternalCompetition({
      student_id: studentData.id,
      student_name: studentData.name,
      year: selectedYear,
      competition_name: externalForm.competition_name.trim() || "مسابقة خارجية",
      organizer: externalForm.organizer.trim(),
      category: externalForm.category,
      score: parseFloat(externalForm.score) || 0,
      rank: externalForm.rank,
      prize: externalForm.prize,
      notes: externalForm.notes.trim() || null,
      date: externalForm.date,
    });
    toast({ title: "تم تسجيل المشاركة بالمسابقة الخارجية" });
    setAddExternalOpen(false);
    loadStudentFullData();
  };

  const handleDeleteExternal = async (id: string) => {
    if (!confirm("حذف هذه المسابقة؟")) return;
    await deleteExternalCompetitionLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    loadStudentFullData();
  };

  const handlePrintFullProfile = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    if (!studentData) return;

    const fullHtml = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>الملف الشامل - ${esc(studentData.name)} - ${selectedYear}هـ</title>
      <style>
        body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#1a3a2a;background:#fff}
        .header{text-align:center;border-bottom:3px double #0e6b3a;padding-bottom:12px;margin-bottom:16px}
        .header img{height:70px}
        .header h1{font-size:22px;color:#0e6b3a;margin:6px 0 2px}
        .header h2{font-size:15px;color:#555}
        .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f4faf6;padding:12px;border-radius:10px;margin-bottom:20px;font-size:13px;border:1px solid #cde3d5}
        .info-grid div strong{color:#0e6b3a}
        h3{color:#0e6b3a;border-bottom:2px solid #0e6b3a;padding-bottom:4px;margin-top:20px;font-size:15px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
        th,td{border:1px solid #bbb;padding:6px;text-align:center}
        th{background:#0e6b3a;color:#fff}
        tr:nth-child(even){background:#f9fdfb}
        .footer{text-align:center;margin-top:30px;font-size:11px;color:#777;border-top:1px solid #ddd;padding-top:10px}
        @media print{@page{size:A4;margin:12mm}}
      </style></head><body>
        <div class="header">
          <img src="${logo}" alt="Markz Net — نسخة بلا إنترنت" />
          <h1>${BRAND_PRINT_TITLE}</h1>
          <h2>الملف الأكاديمي الشامل للطالب</h2>
        </div>

        <div class="info-grid">
          <div><strong>اسم الطالب:</strong> ${esc(studentData.name)}</div>
          <div><strong>الجنس:</strong> ${esc(studentData.gender || "-")}</div>
          <div><strong>المعلم/ة:</strong> ${esc(studentData.teacher || "-")}</div>
          <div><strong>الحالة:</strong> ${esc(studentData.status || "طبيعي")}</div>
          <div><strong>تاريخ الالتحاق:</strong> ${esc(studentData.hijri_join_date || "-")}</div>
          <div><strong>السنة الدراسية وقت الالتحاق:</strong> ${esc(studentData.school_grade || "-")}</div>
          <div><strong>الحفظ قبل الالتحاق:</strong> ${esc(studentData.initial_hifz || "0")} جزء</div>
          <div><strong>هاتف ولي الأمر:</strong> ${esc(studentData.guardian_phone || "-")}</div>
          <div><strong>هاتف الطالب:</strong> ${esc(studentData.student_phone || "-")}</div>
          <div><strong>العام المختار:</strong> ${selectedYear}هـ</div>
        </div>

        <h3>1. نتائج المسابقة الرمضانية (عام ${selectedYear}هـ)</h3>
        <table>
          <thead>
            <tr>
              <th>حفظ سابق</th><th>حفظ جديد</th><th>إجمالي الحفظ</th>
              <th>السنوية (20)</th><th>التلاوة (20)</th><th>الحفظ (60)</th>
              <th>المجموع (100)</th><th>التقدير</th><th>المكافأة</th><th>الترتيب</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${baseHifz}</td><td>${parts}</td><td>${totalHifz >= 30 ? "خاتم ✨" : totalHifz}</td>
              <td>${annual}</td><td>${recitation}</td><td>${memorization}</td>
              <td><b>${totalScore}</b></td><td>${grade || "-"}</td><td>${prize.toLocaleString()} ريال</td><td>${yearData.rank || "-"}</td>
            </tr>
          </tbody>
        </table>

        <h3>2. التطور والتقدم عبر جميع الأعوام</h3>
        <table>
          <thead>
            <tr><th>العام</th><th>حفظ سابق</th><th>حفظ جديد</th><th>إجمالي الحفظ</th><th>الدرجة الكلية</th><th>التقدير</th><th>المكافأة</th></tr>
          </thead>
          <tbody>
            ${multiYearStats
              .map(
                (x) => `<tr>
              <td>${x.year}هـ</td><td>${x.baseHifz}</td><td>${x.parts}</td><td>${x.totalHifz >= 30 ? "خاتم ✨" : x.totalHifz}</td>
              <td>${x.totalScore}</td><td>${x.grade || "-"}</td><td>${x.prize.toLocaleString()} ريال</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>

        <h3>3. الجوائز والمسابقات والتكريم (عام ${selectedYear}هـ)</h3>
        <table>
          <thead><tr><th>النوع</th><th>البيان / المسابقة</th><th>المركز / الترتيب</th><th>المكافأة / الجائزة</th></tr></thead>
          <tbody>
            ${
              [
                ...awards.map(
                  (a) =>
                    `<tr><td>جائزة ${a.award_kind === "in_kind" ? "عينية" : "نقدية"}</td><td>${esc(a.item || a.award_type)}</td><td>—</td><td>${a.amount ? `${a.amount.toLocaleString()} ريال` : "—"}</td></tr>`,
                ),
                ...certificates.map(
                  (c) =>
                    `<tr><td>شهادة تقدير</td><td>${esc(c.title || c.cert_type)}</td><td>—</td><td>—</td></tr>`,
                ),
                ...internalComps.map(
                  (ic) =>
                    `<tr><td>مسابقة داخلية</td><td>${esc(ic.competition_name)} (${esc(ic.category)})</td><td>${esc(ic.rank)}</td><td>${esc(ic.prize)}</td></tr>`,
                ),
                ...externalComps.map(
                  (ec) =>
                    `<tr><td>مسابقة خارجية</td><td>${esc(ec.competition_name)} (${esc(ec.organizer)})</td><td>${esc(ec.rank)}</td><td>${esc(ec.prize)}</td></tr>`,
                ),
              ].join("") || '<tr><td colspan="4">لا توجد سجلات لهذا العام</td></tr>'
            }
          </tbody>
        </table>

        <div class="footer">
          Markz Net — نسخة بلا إنترنت · تصميم أ/ مختار الكمالي · طُبع بتاريخ: ${new Date().toLocaleDateString("ar-EG")}
        </div>
      </body></html>`;

    printHtmlDocument(fullHtml, `ملف_طالب_${studentData.name}_${selectedYear}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6" dir="rtl">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary ring-2 ring-primary/20">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                  <span>{studentData?.name || student.name}</span>
                  {totalHifz >= 30 && (
                    <Badge className="bg-amber-500 text-white hover:bg-amber-600 gap-1 text-xs">
                      <Sparkles className="h-3 w-3" /> خاتم القرآن الكريم
                    </Badge>
                  )}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {(studentData?.gender || student.gender) && (
                    <>
                      <span>
                        الجنس:{" "}
                        <strong className="text-foreground">
                          {studentData?.gender || student.gender}
                        </strong>
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span>
                    المعلم/ة:{" "}
                    <strong className="text-foreground">
                      {studentData?.teacher || student.teacher || "غير محدد"}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    الحالة:{" "}
                    <Badge variant="outline" className="text-primary font-bold">
                      {studentData?.status || "طبيعي"}
                    </Badge>
                  </span>
                  <span>•</span>
                  <span>
                    رقم القيد: <strong>#{student.id}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrintFullProfile}
                className="gap-1 rounded-xl text-xs font-bold"
              >
                <Printer className="h-3.5 w-3.5" /> طباعة الملف الكامل
              </Button>
              <Button
                size="sm"
                variant={editingInfo ? "default" : "secondary"}
                onClick={() => setEditingInfo(!editingInfo)}
                className="gap-1 rounded-xl text-xs font-bold"
              >
                <Pencil className="h-3.5 w-3.5" />
                {editingInfo ? "إغلاق التعديل" : "تعديل البيانات الرسمية"}
              </Button>
            </div>
          </div>

          {/* Student Official Data Quick Edit Panel */}
          {editingInfo && studentData && (
            <Card className="mt-3 p-4 bg-secondary/30 border-primary/20 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-bold text-foreground">اسم الطالب الرباعي</label>
                  <Input
                    value={studentData.name}
                    onChange={(e) => setStudentData({ ...studentData, name: e.target.value })}
                    className="h-9 mt-1 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground">الجنس</label>
                  <Select
                    value={studentData.gender || "__none__"}
                    onValueChange={(v) =>
                      setStudentData({ ...studentData, gender: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger className="h-9 mt-1 rounded-lg">
                      <SelectValue placeholder="اختر الجنس" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— بدون —</SelectItem>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-bold text-foreground">تاريخ هجري الالتحاق</label>
                  <Input
                    value={studentData.hijri_join_date || ""}
                    onChange={(e) =>
                      setStudentData({ ...studentData, hijri_join_date: e.target.value })
                    }
                    placeholder="مثال: 1443/05/10هـ"
                    className="h-9 mt-1 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground">مقدار الحفظ قبل الالتحاق</label>
                  <Input
                    type="number"
                    value={studentData.initial_hifz || ""}
                    onChange={(e) =>
                      setStudentData({ ...studentData, initial_hifz: e.target.value })
                    }
                    placeholder="عدد الأجزاء (مثال: 5)"
                    className="h-9 mt-1 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground">السنة الدراسية وقت الالتحاق</label>
                  {manualGradeEntry || isManualGradeValue(studentData.school_grade) ? (
                    <div className="mt-1 flex items-center gap-1">
                      <Input
                        autoFocus
                        value={studentData.school_grade || ""}
                        onChange={(e) =>
                          setStudentData({ ...studentData, school_grade: e.target.value })
                        }
                        placeholder="اكتب السنة الدراسية"
                        className="h-9 rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setManualGradeEntry(false)}
                        className="h-9 w-9 shrink-0 rounded-lg p-0 text-primary hover:bg-primary/10"
                        title="العودة إلى قائمة السنوات الدراسية"
                      >
                        <ListFilter className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={studentData.school_grade || "__none__"}
                      onValueChange={(v) => {
                        if (v === "__manual__") {
                          setManualGradeEntry(true);
                          return;
                        }
                        setStudentData({
                          ...studentData,
                          school_grade: v === "__none__" ? "" : v,
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 mt-1 rounded-lg">
                        <SelectValue placeholder="اختر السنة الدراسية" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[60vh]">
                        <SelectItem value="__none__">— بدون —</SelectItem>
                        {gradeChoiceLabels.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                        <SelectItem value="__manual__" className="font-bold text-primary">
                          <span className="flex items-center gap-1">
                            <PencilLine className="h-3.5 w-3.5" />
                            إدخال يدوي (كتابة حرة)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <label className="font-bold text-foreground">الحالة</label>
                  <Input
                    value={studentData.status || ""}
                    onChange={(e) => setStudentData({ ...studentData, status: e.target.value })}
                    placeholder="يتيم / معوق / مسكين / طبيعي"
                    className="h-9 mt-1 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground">رقم ولي الأمر</label>
                  <Input
                    value={studentData.guardian_phone || ""}
                    onChange={(e) =>
                      setStudentData({ ...studentData, guardian_phone: e.target.value })
                    }
                    placeholder="770000000"
                    className="h-9 mt-1 rounded-lg"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground">رقم الطالب الشخصي</label>
                  <Input
                    value={studentData.student_phone || ""}
                    onChange={(e) =>
                      setStudentData({ ...studentData, student_phone: e.target.value })
                    }
                    placeholder="770000000"
                    className="h-9 mt-1 rounded-lg"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground">المعلم/ة</label>
                  <Input
                    value={studentData.teacher || ""}
                    onChange={(e) => setStudentData({ ...studentData, teacher: e.target.value })}
                    className="h-9 mt-1 rounded-lg"
                  />
                </div>
              </div>

              {/* Dynamic Custom Fields */}
              {customColumns.length > 0 && (
                <div className="border-t border-border/50 pt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {customColumns.map((col) => (
                    <div key={col.id}>
                      <label className="font-bold text-foreground">{col.name}</label>
                      <Input
                        value={studentData.custom_fields?.[col.id] || ""}
                        onChange={(e) =>
                          setStudentData({
                            ...studentData,
                            custom_fields: {
                              ...(studentData.custom_fields || {}),
                              [col.id]: e.target.value,
                            },
                          })
                        }
                        className="h-9 mt-1 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" onClick={handleSaveStudentInfo} className="gap-1 rounded-lg">
                  <Save className="h-3.5 w-3.5" /> حفظ التعديلات
                </Button>
              </div>
            </Card>
          )}

          {/* Quick Contact & Info Ribbon */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/40 p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              {studentData?.guardian_phone && (
                <div className="flex items-center gap-1 text-emerald-700">
                  <Phone className="h-3.5 w-3.5" />
                  <span>
                    ولي الأمر: <strong dir="ltr">{studentData.guardian_phone}</strong>
                  </span>
                  <a
                    href={`https://wa.me/${studentData.guardian_phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ms-1 inline-flex items-center gap-0.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-3 w-3" /> واتساب
                  </a>
                </div>
              )}
              {studentData?.student_phone && (
                <div className="flex items-center gap-1 text-primary">
                  <Phone className="h-3.5 w-3.5" />
                  <span>
                    هاتف الطالب: <strong dir="ltr">{studentData.student_phone}</strong>
                  </span>
                </div>
              )}
              {studentData?.hijri_join_date && (
                <div>
                  تاريخ الالتحاق: <strong>{studentData.hijri_join_date}</strong>
                </div>
              )}
              {studentData?.initial_hifz && (
                <div>
                  الحفظ قبل الالتحاق: <strong>{studentData.initial_hifz} جزء</strong>
                </div>
              )}
              {studentData?.school_grade && (
                <div>
                  السنة الدراسية: <strong>{studentData.school_grade}</strong>
                </div>
              )}
            </div>

            {/* Year Selector Bar */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> سنة العرض:
              </span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-8 w-28 rounded-xl font-bold bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearsList.map((y) => (
                    <SelectItem key={y} value={y} className="text-xs">
                      {y}هـ {allYearsData[y]?.parts ? "★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs Container */}
        <div className="mt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 w-full h-auto p-1 bg-muted/60 rounded-2xl gap-1">
              <TabsTrigger value="monthly" className="gap-1 text-xs py-2 rounded-xl">
                <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
                <span>المتابعات الشهرية</span>
              </TabsTrigger>
              <TabsTrigger value="ramadan" className="gap-1 text-xs py-2 rounded-xl">
                <BookOpen className="h-3.5 w-3.5 text-amber-600" />
                <span>المسابقة الرمضانية</span>
              </TabsTrigger>
              <TabsTrigger value="bonuses" className="gap-1 text-xs py-2 rounded-xl">
                <Gift className="h-3.5 w-3.5 text-rose-600" />
                <span>الإكراميات</span>
              </TabsTrigger>
              <TabsTrigger value="certificates" className="gap-1 text-xs py-2 rounded-xl">
                <ScrollText className="h-3.5 w-3.5 text-emerald-600" />
                <span>الشهائد</span>
              </TabsTrigger>
              <TabsTrigger value="awards" className="gap-1 text-xs py-2 rounded-xl">
                <Award className="h-3.5 w-3.5 text-yellow-600" />
                <span>الجوائز</span>
              </TabsTrigger>
              <TabsTrigger value="internal_comp" className="gap-1 text-xs py-2 rounded-xl">
                <Medal className="h-3.5 w-3.5 text-amber-500" />
                <span>مسابقات داخلية</span>
              </TabsTrigger>
              <TabsTrigger value="external_comp" className="gap-1 text-xs py-2 rounded-xl">
                <Globe2 className="h-3.5 w-3.5 text-sky-600" />
                <span>مسابقات خارجية</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-1 text-xs py-2 rounded-xl">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                <span>الإحصائيات والمقارنة</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: المتابعات الشهرية */}
            <TabsContent value="monthly" className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-3 bg-teal-500/10 border-teal-500/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">أشهر المتابعة المسجلة</div>
                    <div className="text-2xl font-black text-teal-700">{filledMonths} / 9 أشهر</div>
                  </div>
                  <CalendarDays className="h-8 w-8 text-teal-600/40" />
                </Card>
                <Card className="p-3 bg-emerald-500/10 border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">متوسط التقييم الشهري</div>
                    <div className="text-2xl font-black text-emerald-700">
                      {avgMonthlyScore} / 100
                    </div>
                  </div>
                  <Trophy className="h-8 w-8 text-emerald-600/40" />
                </Card>
                <Card className="p-3 bg-amber-500/10 border-amber-500/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">الحفظ التراكمي المحسوب</div>
                    <div className="text-2xl font-black text-amber-700">
                      {yearData.parts || "0"} جزء
                    </div>
                  </div>
                  <Sparkles className="h-8 w-8 text-amber-600/40" />
                </Card>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-xs text-center border-collapse">
                  <thead className="bg-muted/80 text-foreground font-bold">
                    <tr>
                      <th className="p-2 border border-border">الشهر</th>
                      <th className="p-2 border border-border">حفظ جديد (من - إلى)</th>
                      <th className="p-2 border border-border">تسميع (25)</th>
                      <th className="p-2 border border-border">تلاوة (15)</th>
                      <th className="p-2 border border-border">مراجعة (من - إلى)</th>
                      <th className="p-2 border border-border">تسميع (25)</th>
                      <th className="p-2 border border-border">تلاوة (15)</th>
                      <th className="p-2 border border-border">مواظبة (10)</th>
                      <th className="p-2 border border-border">سلوك (10)</th>
                      <th className="p-2 border border-border font-black text-primary">المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TRACKING_MONTHS.map((m) => {
                      const rec = monthlyRecords[m.value];
                      const sList = getSurahList();
                      const surahName = (n: number | null) =>
                        sList.find((s) => s.number === n)?.name || "";
                      const pointStr = (p?: { surah: number | null; ayah: number | null }) =>
                        p?.surah ? `${surahName(p.surah)} (${p.ayah || "1"})` : "—";

                      const mScore =
                        (parseFloat(rec?.memoHifzScore || "0") || 0) +
                        (parseFloat(rec?.memoRecitationScore || "0") || 0) +
                        (parseFloat(rec?.reviewHifzScore || "0") || 0) +
                        (parseFloat(rec?.reviewRecitationScore || "0") || 0) +
                        (parseFloat(rec?.attendanceScore || "0") || 0) +
                        (parseFloat(rec?.behaviorScore || "0") || 0);

                      return (
                        <tr
                          key={m.value}
                          className="hover:bg-muted/30 odd:bg-card even:bg-muted/10"
                        >
                          <td className="p-2 border border-border font-bold text-foreground">
                            {m.label}
                          </td>
                          <td className="p-2 border border-border">
                            {rec ? `${pointStr(rec.memoFrom)} ➔ ${pointStr(rec.memoTo)}` : "—"}
                          </td>
                          <td className="p-2 border border-border">{rec?.memoHifzScore || "—"}</td>
                          <td className="p-2 border border-border">
                            {rec?.memoRecitationScore || "—"}
                          </td>
                          <td className="p-2 border border-border">
                            {rec ? `${pointStr(rec.reviewFrom)} ➔ ${pointStr(rec.reviewTo)}` : "—"}
                          </td>
                          <td className="p-2 border border-border">
                            {rec?.reviewHifzScore || "—"}
                          </td>
                          <td className="p-2 border border-border">
                            {rec?.reviewRecitationScore || "—"}
                          </td>
                          <td className="p-2 border border-border">
                            {rec?.attendanceScore || "—"}
                          </td>
                          <td className="p-2 border border-border">{rec?.behaviorScore || "—"}</td>
                          <td className="p-2 border border-border font-black text-primary">
                            {rec ? `${mScore.toFixed(1)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TAB 2: المسابقة الرمضانية */}
            <TabsContent value="ramadan" className="mt-4 space-y-4">
              <Card className="p-4 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-primary/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-amber-600" />
                    كشف المسابقة لعام {selectedYear}هـ
                  </h3>
                  <Badge variant="outline" className="text-sm font-bold">
                    الترتيب: {yearData.rank || "-"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-center">
                  <div className="rounded-xl bg-card p-2.5 border border-border">
                    <div className="text-xs text-muted-foreground">حفظ سابق</div>
                    <div className="text-lg font-black text-foreground">{baseHifz} جزء</div>
                  </div>
                  <div className="rounded-xl bg-card p-2.5 border border-border">
                    <div className="text-xs text-muted-foreground">حفظ جديد</div>
                    <Input
                      type="number"
                      value={yearData.parts}
                      onChange={(e) => setYearData({ ...yearData, parts: e.target.value })}
                      className="h-8 text-center font-black mt-1"
                    />
                  </div>
                  <div className="rounded-xl bg-card p-2.5 border border-border">
                    <div className="text-xs text-muted-foreground">إجمالي الحفظ</div>
                    <div className="text-lg font-black text-emerald-600">
                      {totalHifz >= 30 ? "خاتم ✨" : `${totalHifz} جزء`}
                    </div>
                  </div>
                  <div className="rounded-xl bg-card p-2.5 border border-border">
                    <div className="text-xs text-muted-foreground">السنوية (20)</div>
                    <Input
                      type="number"
                      value={yearData.annual}
                      onChange={(e) => setYearData({ ...yearData, annual: e.target.value })}
                      className="h-8 text-center font-black mt-1"
                    />
                  </div>
                  <div className="rounded-xl bg-card p-2.5 border border-border">
                    <div className="text-xs text-muted-foreground">التلاوة (20)</div>
                    <Input
                      type="number"
                      value={yearData.recitation}
                      onChange={(e) => setYearData({ ...yearData, recitation: e.target.value })}
                      className="h-8 text-center font-black mt-1"
                    />
                  </div>
                  <div className="rounded-xl bg-card p-2.5 border border-border">
                    <div className="text-xs text-muted-foreground">الحفظ (60)</div>
                    <Input
                      type="number"
                      value={yearData.memorization}
                      onChange={(e) => setYearData({ ...yearData, memorization: e.target.value })}
                      className="h-8 text-center font-black mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
                  <div className="rounded-xl bg-primary/10 p-3 border border-primary/20">
                    <div className="text-xs text-muted-foreground">المجموع الكلي</div>
                    <div className="text-2xl font-black text-primary">{totalScore} / 100</div>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-3 border border-primary/20">
                    <div className="text-xs text-muted-foreground">التقدير</div>
                    <div className="text-2xl font-black text-primary">{grade || "-"}</div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20">
                    <div className="text-xs text-muted-foreground">مكافأة الحفظ</div>
                    <div className="text-2xl font-black text-emerald-600">
                      {prize.toLocaleString()} ريال
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20">
                    <div className="text-xs text-muted-foreground">مكافأة الحالة</div>
                    <Input
                      type="number"
                      value={yearData.statusPrize || ""}
                      onChange={(e) => setYearData({ ...yearData, statusPrize: e.target.value })}
                      placeholder="0"
                      className="h-9 text-center font-black mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveYearData} className="gap-1 rounded-xl">
                    <Save className="h-4 w-4" /> حفظ درجات المسابقة الرمضانية
                  </Button>
                </div>
              </Card>
            </TabsContent>

            {/* TAB 3: الإكراميات */}
            <TabsContent value="bonuses" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  سجل الإكراميات والمكافآت الخاصة ({selectedYear}هـ)
                </h3>
                <Button
                  size="sm"
                  onClick={() => setAddAwardOpen(true)}
                  className="gap-1 rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5" /> إضافة إكرامية
                </Button>
              </div>

              {awards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-2xl">
                  لا توجد إكراميات مسجلة لهذا الطالب في عام {selectedYear}هـ
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {awards.map((a) => (
                    <Card
                      key={a.id}
                      className="p-3 flex items-center justify-between border-border"
                    >
                      <div>
                        <div className="font-bold text-sm text-foreground">
                          {a.item || a.award_type}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.awarded_at} •{" "}
                          {a.award_kind === "cash" ? `${a.amount.toLocaleString()} ريال` : "عينية"}
                        </div>
                        {a.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{a.notes}</div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAward(a.id)}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 4: الشهائد */}
            <TabsContent value="certificates" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  شهادات التقدير والتكريم ({selectedYear}هـ)
                </h3>
                <Button size="sm" onClick={() => setAddCertOpen(true)} className="gap-1 rounded-xl">
                  <Plus className="h-3.5 w-3.5" /> إصدار شهادة جديدة
                </Button>
              </div>

              {certificates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-2xl">
                  لا توجد شهادات مسجلة لهذا الطالب في عام {selectedYear}هـ
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {certificates.map((c) => (
                    <Card
                      key={c.id}
                      className="p-4 border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-base text-emerald-800">
                            {c.title || c.cert_type}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {c.issued_at}
                          </Badge>
                        </div>
                        {c.notes && <p className="text-xs text-muted-foreground mt-2">{c.notes}</p>}
                      </div>
                      <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-border/60">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCert(c.id)}
                          className="text-rose-500 hover:text-rose-600 h-8 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 5: الجوائز */}
            <TabsContent value="awards" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  الجوائز النقدية والعينية ({selectedYear}هـ)
                </h3>
                <Button
                  size="sm"
                  onClick={() => setAddAwardOpen(true)}
                  className="gap-1 rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5" /> إضافة جائزة
                </Button>
              </div>

              {awards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-2xl">
                  لا توجد جوائز مسجلة لهذا الطالب في عام {selectedYear}هـ
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-muted/70">
                      <tr>
                        <th className="p-2.5">الجائزة / البيان</th>
                        <th className="p-2.5 text-center">النوع</th>
                        <th className="p-2.5 text-center">المبلغ</th>
                        <th className="p-2.5 text-center">التاريخ</th>
                        <th className="p-2.5 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awards.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="p-2.5 font-bold">{a.item || a.award_type}</td>
                          <td className="p-2.5 text-center">
                            {a.award_kind === "cash" ? "نقدية" : "عينية"}
                          </td>
                          <td className="p-2.5 text-center font-bold text-primary">
                            {a.amount ? `${a.amount.toLocaleString()} ريال` : "—"}
                          </td>
                          <td className="p-2.5 text-center">{a.awarded_at}</td>
                          <td className="p-2.5 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAward(a.id)}
                              className="h-7 w-7 p-0 text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* TAB 6: المسابقات الداخلية */}
            <TabsContent value="internal_comp" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  المسابقات الداخلية بالمركز ({selectedYear}هـ)
                </h3>
                <Button
                  size="sm"
                  onClick={() => setAddInternalOpen(true)}
                  className="gap-1 rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5" /> تسجيل مشاركة بمسابقة داخلية
                </Button>
              </div>

              {internalComps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-2xl">
                  لا توجد مشاركات في مسابقات داخلية مسجلة لهذا العام
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {internalComps.map((ic) => (
                    <Card
                      key={ic.id}
                      className="p-3.5 border-amber-500/20 bg-amber-500/5 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">
                            {ic.competition_name}
                          </h4>
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {ic.category}
                          </Badge>
                        </div>
                        <Badge className="bg-amber-600 text-white text-xs">{ic.rank}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span>
                          الدرجة: <strong>{ic.score}</strong>
                        </span>
                        <span>
                          الجائزة: <strong>{ic.prize || "—"}</strong>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteInternal(ic.id)}
                          className="h-6 w-6 p-0 text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 7: المسابقات الخارجية */}
            <TabsContent value="external_comp" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  المسابقات الخارجية والتمثيل ({selectedYear}هـ)
                </h3>
                <Button
                  size="sm"
                  onClick={() => setAddExternalOpen(true)}
                  className="gap-1 rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5" /> تسجيل مشاركة بمسابقة خارجية
                </Button>
              </div>

              {externalComps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-2xl">
                  لا توجد مشاركات في مسابقات خارجية مسجلة لهذا العام
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {externalComps.map((ec) => (
                    <Card key={ec.id} className="p-3.5 border-cyan-500/20 bg-cyan-500/5 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">
                            {ec.competition_name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {ec.organizer} • {ec.category}
                          </p>
                        </div>
                        <Badge className="bg-cyan-600 text-white text-xs">{ec.rank}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span>
                          الدرجة: <strong>{ec.score}</strong>
                        </span>
                        <span>
                          الجائزة: <strong>{ec.prize || "—"}</strong>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteExternal(ec.id)}
                          className="h-6 w-6 p-0 text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 8: الإحصائيات والمقارنة */}
            <TabsContent value="stats" className="mt-4 space-y-4">
              {/* Multi-Year Comparison */}
              <Card className="p-4 border-primary/20 space-y-3">
                <h3 className="text-sm font-black text-primary flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  مقارنة مستوى الطالب عبر الأعوام السابقة
                </h3>

                {multiYearStats.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    لا توجد بيانات سابقة كافية للمقارنة
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs text-center">
                      <thead className="bg-muted/80">
                        <tr>
                          <th className="p-2 border border-border">العام</th>
                          <th className="p-2 border border-border">الحفظ التراكمي</th>
                          <th className="p-2 border border-border">الحفظ الجديد</th>
                          <th className="p-2 border border-border">الدرجة الكلية</th>
                          <th className="p-2 border border-border">التقدير</th>
                          <th className="p-2 border border-border">مكافأة الحفظ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {multiYearStats.map((st) => (
                          <tr
                            key={st.year}
                            className={`hover:bg-muted/30 ${
                              st.year === selectedYear ? "bg-primary/10 font-bold" : ""
                            }`}
                          >
                            <td className="p-2 border border-border font-black text-primary">
                              {st.year}هـ
                            </td>
                            <td className="p-2 border border-border">
                              {st.totalHifz >= 30 ? "خاتم ✨" : `${st.totalHifz} جزء`}
                            </td>
                            <td className="p-2 border border-border">{st.parts} جزء</td>
                            <td className="p-2 border border-border font-bold">{st.totalScore}%</td>
                            <td className="p-2 border border-border">{st.grade || "-"}</td>
                            <td className="p-2 border border-border">
                              {st.prize.toLocaleString()} ريال
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Peer Comparison in Selected Year */}
              <Card className="p-4 border-primary/20 space-y-3">
                <h3 className="text-sm font-black text-primary flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  مقارنة أداء الطالب مع زملائه في عام {selectedYear}هـ
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="p-3 bg-secondary/40 text-center">
                    <div className="text-xs text-muted-foreground">ترتيب الطالب بالمركز</div>
                    <div className="text-xl font-black text-primary">
                      {cohortRank > 0 ? `#${cohortRank}` : "—"} / {cohortActive.length}
                    </div>
                  </Card>
                  <Card className="p-3 bg-secondary/40 text-center">
                    <div className="text-xs text-muted-foreground">ترتيبه بحلقة المعلم/ة</div>
                    <div className="text-xl font-black text-teal-700">
                      {classRank > 0 ? `#${classRank}` : "—"} / {classStudents.length}
                    </div>
                  </Card>
                  <Card className="p-3 bg-secondary/40 text-center">
                    <div className="text-xs text-muted-foreground">متوسط درجات الطلاب</div>
                    <div className="text-xl font-black text-foreground">{cohortAvgScore}%</div>
                  </Card>
                  <Card className="p-3 bg-secondary/40 text-center">
                    <div className="text-xs text-muted-foreground">متوسط الأجزاء المحفوظة</div>
                    <div className="text-xl font-black text-foreground">{cohortAvgParts} جزء</div>
                  </Card>
                </div>

                {/* Score vs Cohort Comparison Bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>درجة الطالب: {totalScore}%</span>
                    <span>متوسط المركز: {cohortAvgScore}%</span>
                  </div>
                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all rounded-full"
                      style={{ width: `${Math.min(totalScore, 100)}%` }}
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialog: Add Award */}
        <Dialog open={addAwardOpen} onOpenChange={setAddAwardOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة جائزة / إكرامية جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold">نوع الجائزة</label>
                <Select
                  value={awardForm.award_kind}
                  onValueChange={(v) => setAwardForm({ ...awardForm, award_kind: v })}
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">مكافأة نقدية</SelectItem>
                    <SelectItem value="in_kind">جائزة عينية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-bold">المبلغ (ريال)</label>
                <Input
                  type="number"
                  value={awardForm.amount}
                  onChange={(e) => setAwardForm({ ...awardForm, amount: e.target.value })}
                  disabled={awardForm.award_kind === "in_kind"}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">الوصف / البيان</label>
                <Input
                  value={awardForm.item}
                  onChange={(e) => setAwardForm({ ...awardForm, item: e.target.value })}
                  placeholder="مثال: إكرامية تفوق، مصحف مذهب"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">التاريخ</label>
                <Input
                  type="date"
                  value={awardForm.awarded_at}
                  onChange={(e) => setAwardForm({ ...awardForm, awarded_at: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddAwardOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddAward}>حفظ الجائزة</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Add Certificate */}
        <Dialog open={addCertOpen} onOpenChange={setAddCertOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>إصدار شهادة تقدير</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold">عنوان الشهادة</label>
                <Input
                  value={certForm.title}
                  onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
                  placeholder="مثال: شهادة حفظ وتفوق في القرآن الكريم"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">نوع الشهادة</label>
                <Select
                  value={certForm.cert_type}
                  onValueChange={(v) => setCertForm({ ...certForm, cert_type: v })}
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellence">شهادة تميّز</SelectItem>
                    <SelectItem value="khatm">شهادة ختم القرآن الكريم</SelectItem>
                    <SelectItem value="participation">شهادة مشاركة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-bold">ملاحظات / سطر إضافي</label>
                <Textarea
                  value={certForm.notes}
                  onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })}
                  placeholder="نص التقدير المكتوب في الشهادة"
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddCertOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddCert}>إصدار وحفظ</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Add Internal Competition */}
        <Dialog open={addInternalOpen} onOpenChange={setAddInternalOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>تسجيل مشاركة بمسابقة داخلية</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold">اسم المسابقة</label>
                <Input
                  value={internalForm.competition_name}
                  onChange={(e) =>
                    setInternalForm({ ...internalForm, competition_name: e.target.value })
                  }
                  placeholder="مثال: مسابقة الماهر بالقرآن السنوية"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">الفرع / المستوى</label>
                <Input
                  value={internalForm.category}
                  onChange={(e) => setInternalForm({ ...internalForm, category: e.target.value })}
                  placeholder="فرع 5 أجزاء / 10 أجزاء / التلاوة"
                  className="h-9 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold">الدرجة</label>
                  <Input
                    value={internalForm.score}
                    onChange={(e) => setInternalForm({ ...internalForm, score: e.target.value })}
                    className="h-9 mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold">الترتيب / المركز</label>
                  <Input
                    value={internalForm.rank}
                    onChange={(e) => setInternalForm({ ...internalForm, rank: e.target.value })}
                    placeholder="المركز الأول"
                    className="h-9 mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold">الجائزة المستلمة</label>
                <Input
                  value={internalForm.prize}
                  onChange={(e) => setInternalForm({ ...internalForm, prize: e.target.value })}
                  placeholder="مكافأة نقدية وشهادة"
                  className="h-9 mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddInternalOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddInternal}>حفظ المسابقة</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Add External Competition */}
        <Dialog open={addExternalOpen} onOpenChange={setAddExternalOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>تسجيل مشاركة بمسابقة خارجية</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold">اسم المسابقة الخارجية</label>
                <Input
                  value={externalForm.competition_name}
                  onChange={(e) =>
                    setExternalForm({ ...externalForm, competition_name: e.target.value })
                  }
                  placeholder="مثال: مسابقة الجمهورية للقرآن الكريم"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">الجهة المنظمة</label>
                <Input
                  value={externalForm.organizer}
                  onChange={(e) => setExternalForm({ ...externalForm, organizer: e.target.value })}
                  placeholder="مكتب الأوقاف والإرشاد / وزارة الأوقاف"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">الفرع / المستوى</label>
                <Input
                  value={externalForm.category}
                  onChange={(e) => setExternalForm({ ...externalForm, category: e.target.value })}
                  placeholder="فرع 15 جزء / المصحف كاملاً"
                  className="h-9 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold">الدرجة</label>
                  <Input
                    value={externalForm.score}
                    onChange={(e) => setExternalForm({ ...externalForm, score: e.target.value })}
                    className="h-9 mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold">الترتيب / المركز</label>
                  <Input
                    value={externalForm.rank}
                    onChange={(e) => setExternalForm({ ...externalForm, rank: e.target.value })}
                    placeholder="المركز الثاني على مستوى المحافظة"
                    className="h-9 mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold">الجائزة والتكريم</label>
                <Input
                  value={externalForm.prize}
                  onChange={(e) => setExternalForm({ ...externalForm, prize: e.target.value })}
                  placeholder="درع تفوق ومكافأة مالية"
                  className="h-9 mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddExternalOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddExternal}>حفظ المسابقة</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
