import { TRACKING_MONTHS, type MonthlyRecord, type Student } from "@/types/student";
import { arabicIncludes } from "@/utils/arabicSearch";

/**
 * منطق «المتأخرات والتنبيهات الذكية» في وحدة نقية بلا أي اعتماد على قاعدة
 * البيانات أو على React، حتى تُختبَر مباشرة، ويُعاد استعمالها في الواجهة
 * والطباعة معاً.
 *
 * الفكرة: النظام يعرف ما يجب أن يكون موجوداً (طالب مسجّل في عام، معلم/ة في
 * السجل العام، داعم بتعهّد، مصروف…) فتُقارَن هذه التوقّعات مع ما هو محفوظ
 * فعلاً، ويخرج بند واحد لكل نقص مع درجة أهميته ورابط الصفحة التي يُعالَج منها.
 */

/** أنواع المتأخرات التي يرصدها النظام. */
export type AlertKind =
  | "missing-monthly"
  | "incomplete-monthly"
  | "weak-attendance"
  | "missing-teacher"
  | "not-registered-in-year"
  | "missing-monthly-bonus"
  | "outstanding-pledge"
  | "incomplete-donor"
  | "incomplete-expense";

/** درجة الأهمية: عالية (مالية/متابعة فائتة)، متوسطة، منخفضة (اكتمال بيانات). */
export type AlertSeverity = "high" | "medium" | "low";

/** قسم التنبيه: يُستعمل للتجميع في العرض والطباعة. */
export type AlertGroup = "students" | "teachers" | "finance";

export interface OverdueAlert {
  /** مفتاح ثابت وفريد لكل بند (يُستخدم في React key وفي كشف الطباعة). */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  group: AlertGroup;
  /** اسم الطالب/ة أو المعلم/ة أو الداعم… (العنصر صاحب المتأخر). */
  title: string;
  /** شرح المتأخر بالتفصيل. */
  detail: string;
  /** معلم/ة الحلقة عند وجوده. */
  teacher?: string;
  studentId?: number;
  /** المبلغ المتأخر (للتنبيهات المالية فقط). */
  amount?: number;
  /** الصفحة التي يُعالَج منها التنبيه. */
  link: string;
  /** نص رابط المعالجة. */
  linkLabel: string;
}

export interface AlertKindMeta {
  label: string;
  severity: AlertSeverity;
  group: AlertGroup;
  /** جملة قصيرة تشرح متى يظهر هذا التنبيه. */
  hint: string;
}

/**
 * تعريف كل نوع تنبيه: اسمه للعرض، أهميته الافتراضية، قسمه، وشرح مختصر يظهر
 * في الواجهة وفي كشف الطباعة.
 */
export const ALERT_KIND_META: Record<AlertKind, AlertKindMeta> = {
  "missing-monthly": {
    label: "متابعة شهرية غير مسجّلة",
    severity: "high",
    group: "students",
    hint: "طالب/ة مسجّل/ة في العام ولم تُسجَّل متابعته للشهر المختار",
  },
  "incomplete-monthly": {
    label: "متابعة بلا تقييم",
    severity: "medium",
    group: "students",
    hint: "المتابعة محفوظة لكن درجات المواظبة والسلوك فارغة",
  },
  "weak-attendance": {
    label: "مواظبة منخفضة",
    severity: "medium",
    group: "students",
    hint: "درجة المواظبة 5 من 10 أو أقل",
  },
  "missing-teacher": {
    label: "طالب/ة بلا معلم/ة",
    severity: "medium",
    group: "students",
    hint: "مسجّل/ة في العام وغير مرتبط/ة بأي حلقة",
  },
  "not-registered-in-year": {
    label: "غير مسجّل/ة في العام",
    severity: "low",
    group: "students",
    hint: "من طلاب السجل العام ولا يوجد له/لها صف في العام المختار",
  },
  "missing-monthly-bonus": {
    label: "إكرامية شهرية غير محفوظة",
    severity: "medium",
    group: "teachers",
    hint: "المعلم/ة في السجل العام ولم تُحفظ إكرامية الشهر المختار",
  },
  "outstanding-pledge": {
    label: "تعهّد داعم غير مكتمل",
    severity: "high",
    group: "finance",
    hint: "المبلغ المعلن أكبر من المدفوع — يوجد متبقٍّ على الداعم",
  },
  "incomplete-donor": {
    label: "داعم بلا مبالغ",
    severity: "low",
    group: "finance",
    hint: "صف الداعم بلا مبلغ معلن ولا مدفوع",
  },
  "incomplete-expense": {
    label: "مصروف ناقص البيانات",
    severity: "low",
    group: "finance",
    hint: "المصروف بلا مبلغ أو بلا وصف",
  },
};

/** كل الأنواع بترتيب العرض الثابت (طلاب ← معلمون ← مالية). */
export const ALERT_KINDS = Object.keys(ALERT_KIND_META) as AlertKind[];

/** أقسام العرض بترتيبها. */
export const ALERT_GROUPS: { id: AlertGroup; label: string; hint: string }[] = [
  { id: "students", label: "الطلاب", hint: "متابعة الحلقات والتقييم" },
  { id: "teachers", label: "المعلمون والمعلمات", hint: "الإكراميات الشهرية" },
  { id: "finance", label: "الداعمون والمصروفات", hint: "الالتزامات المالية" },
];

const SEVERITY_ORDER: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  high: "أهمية عالية",
  medium: "أهمية متوسطة",
  low: "أهمية منخفضة",
};

/** أسماء الأشهر الهجرية (١-١٢) كما تُعرض في بقية الصفحات. */
export const HIJRI_MONTH_NAMES = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

/** أعلى شهر تُسجَّل فيه المتابعة الشهرية للطلاب (من محرم إلى رمضان). */
export const LAST_TRACKING_MONTH = TRACKING_MONTHS[TRACKING_MONTHS.length - 1].value;

/** اسم شهر هجري بالرقم، مع قيمة افتراضية آمنة. */
export const hijriMonthName = (month: number) =>
  HIJRI_MONTH_NAMES[Math.min(Math.max(Math.round(month) || 1, 1), 12) - 1];

/** هل الشهر داخل موسم المتابعة الشهرية للطلاب؟ */
export const isTrackingMonth = (month: number) =>
  TRACKING_MONTHS.some((m) => m.value === Math.round(month));

// ===== أشكال البيانات المُدخَلة (متوافقة مع صفوف التخزين دون استيرادها) =====

export interface AlertStudentLike {
  id: number;
  name: string;
  teacher?: string | null;
  registered_years?: string[] | null;
}

export interface AlertMonthlyRecordLike {
  attendanceScore?: string | number | null;
  behaviorScore?: string | number | null;
}

export interface AlertBonusLike {
  teacher_name: string;
  year: string;
  month: number | string;
}

export interface AlertDonorLike {
  id?: string;
  name: string;
  year: string;
  pledged_amount?: number | string | null;
  paid_amount?: number | string | null;
}

export interface AlertExpenseLike {
  id?: string;
  year: string;
  category?: string | null;
  description?: string | null;
  amount?: number | string | null;
}

export interface OverdueAlertsInput {
  /** العام المختار (مثل "1447" أو "1447D"). */
  year: string;
  /** الشهر الهجري المختار (1-12). */
  month: number;
  /** الطلاب المسجّلون في العام المختار (بصيغة السجل الشامل للعام). */
  studentsInYear: Student[] | AlertStudentLike[];
  /** طلاب السجل العام (كل الأعوام) لرصد غير المسجّلين في العام. */
  globalStudents?: AlertStudentLike[];
  /**
   * متابعات الشهر المختار مفهرسة بمعرّف الطالب، أو `null` إذا تعذّر جلبها
   * (بلا اتصال) — عندها تُتجاوَز كل تنبيهات المتابعة الشهرية بدلاً من أن
   * تظهر خطأً لكل طالب.
   */
  monthlyRecords?: Record<number, AlertMonthlyRecordLike | MonthlyRecord> | null;
  /** أسماء المعلمين والمعلمات في السجل العام (مُوحَّدة بلا تكرار). */
  teacherNames?: string[];
  /** كل الإكراميات الشهرية المحفوظة (تُصفّى بالعام والشهر داخل الدالة). */
  bonuses?: AlertBonusLike[];
  /** كل صفوف الداعمين. */
  donors?: AlertDonorLike[];
  /** كل صفوف المصروفات. */
  expenses?: AlertExpenseLike[];
}

const text = (value: string | null | undefined) => (value || "").trim();

const num = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
};

/** تنسيق مبلغ بالريال بنفس صيغة بقية الصفحات (بلا فقدان الكسور). */
export const formatRiyal = (value: number) =>
  `${(Number(value) || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ريال`;

/** العام الأساسي لمفتاح العام (ذو الحجة "1447D" تُحسب لعام 1447). */
const baseYear = (year: string) => (year || "").replace(/D$/, "");

/**
 * يبني كل بنود المتأخرات من البيانات المتاحة، مرتبة بالأهمية ثم بالاسم.
 * الدالة نقية تماماً: لا تقرأ ولا تكتب شيئاً خارج مدخلاتها.
 */
export function buildOverdueAlerts(input: OverdueAlertsInput): OverdueAlert[] {
  const {
    year,
    month,
    studentsInYear = [],
    globalStudents = [],
    monthlyRecords = null,
    teacherNames = [],
    bonuses = [],
    donors = [],
    expenses = [],
  } = input;

  const alerts: OverdueAlert[] = [];
  const monthLabel = hijriMonthName(month);
  const trackingMonth = isTrackingMonth(month);
  const yearBase = baseYear(year);

  // ===== 1) الطلاب: المتابعة الشهرية =====
  if (trackingMonth && monthlyRecords) {
    (studentsInYear as AlertStudentLike[]).forEach((student) => {
      const record = monthlyRecords[student.id];
      const name = text(student.name) || `طالب رقم ${student.id}`;
      if (!record) {
        alerts.push({
          id: `missing-monthly-${student.id}`,
          kind: "missing-monthly",
          severity: ALERT_KIND_META["missing-monthly"].severity,
          group: "students",
          title: name,
          detail: `لم تُسجَّل متابعة شهر ${monthLabel} لهذا الطالب/ة في عام ${yearBase}هـ`,
          teacher: text(student.teacher) || undefined,
          studentId: student.id,
          link: "/monthly",
          linkLabel: "تسجيل المتابعة",
        });
        return;
      }

      const attendance = num(record.attendanceScore);
      const behavior = num(record.behaviorScore);
      if (attendance <= 0 && behavior <= 0) {
        alerts.push({
          id: `incomplete-monthly-${student.id}`,
          kind: "incomplete-monthly",
          severity: ALERT_KIND_META["incomplete-monthly"].severity,
          group: "students",
          title: name,
          detail: `متابعة شهر ${monthLabel} محفوظة لكن بلا درجات مواظبة ولا سلوك (لم يتم التقييم)`,
          teacher: text(student.teacher) || undefined,
          studentId: student.id,
          link: "/monthly",
          linkLabel: "إكمال التقييم",
        });
      } else if (attendance <= 5) {
        alerts.push({
          id: `weak-attendance-${student.id}`,
          kind: "weak-attendance",
          severity: ALERT_KIND_META["weak-attendance"].severity,
          group: "students",
          title: name,
          detail:
            `مواظبة منخفضة في شهر ${monthLabel}: ${attendance} من 10` +
            (behavior > 0 ? ` · السلوك ${behavior} من 10` : ""),
          teacher: text(student.teacher) || undefined,
          studentId: student.id,
          link: "/monthly-search",
          linkLabel: "عرض السجل الشهري",
        });
      }
    });
  }

  // ===== 2) الطلاب: ربط الحلقة =====
  (studentsInYear as AlertStudentLike[]).forEach((student) => {
    if (text(student.teacher)) return;
    alerts.push({
      id: `missing-teacher-${student.id}`,
      kind: "missing-teacher",
      severity: ALERT_KIND_META["missing-teacher"].severity,
      group: "students",
      title: text(student.name) || `طالب رقم ${student.id}`,
      detail: `مسجّل/ة في عام ${yearBase}هـ وغير مرتبط/ة بأي معلم/ة`,
      studentId: student.id,
      link: "/halaqat",
      linkLabel: "ربط الحلقة",
    });
  });

  // ===== 3) الطلاب: غير المسجّلين في العام المختار =====
  const registeredInYear = new Set(
    (studentsInYear as AlertStudentLike[]).map((student) => student.id),
  );
  (globalStudents as AlertStudentLike[]).forEach((student) => {
    if (registeredInYear.has(student.id)) return;
    const years = (student.registered_years || []).map(baseYear);
    if (years.includes(yearBase)) return;
    const lastYear = [...years].sort().pop();
    alerts.push({
      id: `not-registered-in-year-${student.id}`,
      kind: "not-registered-in-year",
      severity: ALERT_KIND_META["not-registered-in-year"].severity,
      group: "students",
      title: text(student.name) || `طالب رقم ${student.id}`,
      detail: lastYear
        ? `من طلاب السجل العام ولا يوجد له/لها صف في عام ${yearBase}هـ (آخر عام مسجّل: ${lastYear}هـ)`
        : `من طلاب السجل العام ولم يُسجَّل/تُسجَّل في أي عام حتى الآن`,
      teacher: text(student.teacher) || undefined,
      studentId: student.id,
      link: "/students",
      linkLabel: "فتح السجل",
    });
  });

  // ===== 4) المعلمون والمعلمات: الإكراميات الشهرية =====
  //
  // لا ننبّه على الإكراميات إلا إذا كان المركز يسجّلها فعلاً (يوجد صف واحد
  // على الأقل في هذا العام)، حتى لا تمتلئ الصفحة بمعلمين لا تُصرف لهم إكراميات.
  const yearBonuses = bonuses.filter((bonus) => baseYear(String(bonus.year)) === yearBase);
  if (yearBonuses.length > 0) {
    const paidThisMonth = new Set(
      yearBonuses
        .filter((bonus) => Math.round(num(bonus.month)) === Math.round(month))
        .map((bonus) => text(bonus.teacher_name)),
    );
    teacherNames
      .map(text)
      .filter(Boolean)
      .forEach((name) => {
        if (paidThisMonth.has(name)) return;
        alerts.push({
          id: `missing-monthly-bonus-${name}`,
          kind: "missing-monthly-bonus",
          severity: ALERT_KIND_META["missing-monthly-bonus"].severity,
          group: "teachers",
          title: name,
          detail: `لم تُحفظ إكرامية شهر ${monthLabel} لعام ${yearBase}هـ`,
          link: "/teachers",
          linkLabel: "فتح الإكراميات",
        });
      });
  }

  // ===== 5) الداعمون: التعهّدات غير المكتملة =====
  donors
    .filter((donor) => baseYear(String(donor.year)) === yearBase)
    .forEach((donor, index) => {
      const name = text(donor.name) || `داعم رقم ${index + 1}`;
      const pledged = num(donor.pledged_amount);
      const paid = num(donor.paid_amount);
      const remaining = pledged - paid;
      const key = donor.id || `${name}-${index}`;

      if (pledged > 0 && remaining > 0) {
        alerts.push({
          id: `outstanding-pledge-${key}`,
          kind: "outstanding-pledge",
          severity: ALERT_KIND_META["outstanding-pledge"].severity,
          group: "finance",
          title: name,
          detail: `تعهّد ${formatRiyal(pledged)} ومدفوع ${formatRiyal(paid)} — المتبقي ${formatRiyal(remaining)}`,
          amount: remaining,
          link: "/donors",
          linkLabel: "فتح الداعمين",
        });
        return;
      }

      if (pledged <= 0 && paid <= 0) {
        alerts.push({
          id: `incomplete-donor-${key}`,
          kind: "incomplete-donor",
          severity: ALERT_KIND_META["incomplete-donor"].severity,
          group: "finance",
          title: name,
          detail: `صف الداعم في عام ${yearBase}هـ بلا مبلغ معلن ولا مدفوع`,
          link: "/donors",
          linkLabel: "فتح الداعمين",
        });
      }
    });

  // ===== 6) المصروفات: الصفوف الناقصة =====
  expenses
    .filter((expense) => baseYear(String(expense.year)) === yearBase)
    .forEach((expense, index) => {
      const amount = num(expense.amount);
      const description = text(expense.description);
      if (amount > 0 && description) return;
      const category = text(expense.category) || "مصروف";
      const missing = [amount <= 0 ? "بلا مبلغ" : "", description ? "" : "بلا وصف"].filter(Boolean);
      alerts.push({
        id: `incomplete-expense-${expense.id || `${index}`}`,
        kind: "incomplete-expense",
        severity: ALERT_KIND_META["incomplete-expense"].severity,
        group: "finance",
        title: description ? `${category} — ${description}` : `${category} (${missing.join(" و")})`,
        detail: `مصروف في عام ${yearBase}هـ ${missing.join(" و")} — يحتاج استكمال البيانات`,
        amount: amount > 0 ? amount : undefined,
        link: "/expenses",
        linkLabel: "فتح المصروفات",
      });
    });

  return sortAlerts(alerts);
}

/** ترتيب موحّد: الأهمية أولاً، ثم القسم، ثم الاسم أبجدياً عربياً. */
export function sortAlerts(alerts: OverdueAlert[]): OverdueAlert[] {
  const groupOrder = new Map(ALERT_GROUPS.map((group, index) => [group.id, index]));
  return [...alerts].sort((a, b) => {
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severity !== 0) return severity;
    const group = (groupOrder.get(a.group) ?? 9) - (groupOrder.get(b.group) ?? 9);
    if (group !== 0) return group;
    return a.title.localeCompare(b.title, "ar");
  });
}

export interface AlertsSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  byKind: Record<AlertKind, number>;
  byGroup: Record<AlertGroup, number>;
  /** إجمالي المبالغ المتأخرة (التعهّدات غير المكتملة). */
  outstandingTotal: number;
}

/** ملخّص الأعداد المستخدم في البطاقات العلوية وفي كشف الطباعة. */
export function summarizeAlerts(alerts: OverdueAlert[]): AlertsSummary {
  const byKind = {} as Record<AlertKind, number>;
  ALERT_KINDS.forEach((kind) => (byKind[kind] = 0));
  const byGroup: Record<AlertGroup, number> = { students: 0, teachers: 0, finance: 0 };

  let high = 0;
  let medium = 0;
  let low = 0;
  let outstandingTotal = 0;

  alerts.forEach((alert) => {
    byKind[alert.kind] = (byKind[alert.kind] || 0) + 1;
    byGroup[alert.group] = (byGroup[alert.group] || 0) + 1;
    if (alert.severity === "high") high++;
    else if (alert.severity === "medium") medium++;
    else low++;
    if (alert.kind === "outstanding-pledge") outstandingTotal += alert.amount || 0;
  });

  return { total: alerts.length, high, medium, low, byKind, byGroup, outstandingTotal };
}

export interface AlertFilters {
  kinds?: AlertKind[];
  severity?: AlertSeverity | "all";
  query?: string;
}

/** تصفية البنود بالأنواع ودرجة الأهمية والبحث العربي في العنوان والتفصيل. */
export function filterAlerts(alerts: OverdueAlert[], filters: AlertFilters = {}): OverdueAlert[] {
  const { kinds, severity = "all", query = "" } = filters;
  const kindSet = kinds && kinds.length > 0 ? new Set(kinds) : null;
  return alerts.filter((alert) => {
    if (kindSet && !kindSet.has(alert.kind)) return false;
    if (severity !== "all" && alert.severity !== severity) return false;
    if (!query.trim()) return true;
    return (
      arabicIncludes(alert.title, query) ||
      arabicIncludes(alert.detail, query) ||
      arabicIncludes(alert.teacher, query)
    );
  });
}

/** يجمّع البنود حسب القسم بترتيب الأقسام الثابت (للعرض والطباعة). */
export function groupAlerts(
  alerts: OverdueAlert[],
): { id: AlertGroup; label: string; hint: string; alerts: OverdueAlert[] }[] {
  return ALERT_GROUPS.map((group) => ({
    ...group,
    alerts: alerts.filter((alert) => alert.group === group.id),
  })).filter((group) => group.alerts.length > 0);
}

export interface AlertsPrintOptions {
  year: string;
  month: number;
  logoSrc?: string;
  centerName?: string;
  /** تاريخ الكشف كما يُعرض في الترويسة. */
  generatedAt?: string;
}

/**
 * يبني جسم كشف الطباعة كاملاً (HTML) من البنود المعروضة — نفس تنسيق بقية
 * كشوف النظام، ويُمرَّر إلى printHtml. الدالة نقية وتُختبَر مباشرة.
 */
export function buildAlertsPrintBody(alerts: OverdueAlert[], options: AlertsPrintOptions): string {
  const {
    year,
    month,
    logoSrc,
    centerName = "مركز إنماء الأهلي الخيري",
    generatedAt = "",
  } = options;
  const summary = summarizeAlerts(alerts);
  const monthLabel = hijriMonthName(month);
  const escape = (value: string) =>
    (value || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c] as string,
    );

  const cards = [
    { label: "إجمالي البنود", value: String(summary.total) },
    { label: "أهمية عالية", value: String(summary.high) },
    { label: "متوسطة", value: String(summary.medium) },
    { label: "منخفضة", value: String(summary.low) },
    { label: "المبالغ المتأخرة", value: formatRiyal(summary.outstandingTotal) },
  ]
    .map(
      (card) =>
        `<div class="card"><b>${escape(card.value)}</b><span>${escape(card.label)}</span></div>`,
    )
    .join("");

  const sections = groupAlerts(alerts)
    .map((group) => {
      const rows = group.alerts
        .map(
          (alert, index) => `<tr>
            <td class="num">${index + 1}</td>
            <td>${escape(alert.title)}</td>
            <td>${escape(alert.teacher || "—")}</td>
            <td>${escape(ALERT_KIND_META[alert.kind].label)}</td>
            <td>${escape(alert.detail)}</td>
            <td class="num">${alert.amount ? escape(formatRiyal(alert.amount)) : "—"}</td>
          </tr>`,
        )
        .join("");
      return `<h2>${escape(group.label)} <span style="font-size:12px;font-weight:400;color:#666">(${group.alerts.length})</span></h2>
        <table>
          <thead><tr><th>م</th><th>الاسم</th><th>المعلم/ة</th><th>نوع المتأخر</th><th>التفصيل</th><th>المبلغ</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("");

  return `
    <div class="head">
      ${logoSrc ? `<img src="${logoSrc}" class="logo" />` : ""}
      <div>
        <h1>${escape(centerName)}</h1>
        <div class="sub">كشف المتأخرات والتنبيهات — شهر ${escape(monthLabel)} لعام ${escape(baseYear(year))}هـ</div>
        ${generatedAt ? `<div class="sub" style="margin-bottom:6px">${escape(generatedAt)}</div>` : ""}
      </div>
    </div>
    <div class="cards">${cards}</div>
    ${sections || '<div class="empty">لا توجد متأخرات — الحمد لله، كل شيء مكتمل.</div>'}
    <div class="thanks">بارك الله في جهودكم، ونفع بما يُستكمل من أعمال</div>
  `;
}
