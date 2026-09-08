// تاريخ الحفظ ديناميكي - يمكن إضافة أي سنة
export interface HifzHistory {
  [key: string]: string; // h1441, h1442, h1443, etc.
}

export interface YearData {
  baseHifz: string;
  totalHifz: string;
  parts: string;
  annual: string;
  recitation: string;
  memorization: string;
  total: string;
  grade: string;
  prize: string;
  statusPrize: string;
  rank: string;
  teacher: string;
}

export interface Student {
  id: number;
  name: string;
  teacher: string;
  hifzHistory?: HifzHistory;
  yearData?: YearData;
}

export const START_YEAR = 1441;
export const END_YEAR = 1450;

// أشهر المتابعة الشهرية: من محرم إلى رمضان (موسم المسابقة الرمضانية)
export const TRACKING_MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "محرم" },
  { value: 2, label: "صفر" },
  { value: 3, label: "ربيع الأول" },
  { value: 4, label: "ربيع الآخر" },
  { value: 5, label: "جمادى الأولى" },
  { value: 6, label: "جمادى الآخرة" },
  { value: 7, label: "رجب" },
  { value: 8, label: "شعبان" },
  { value: 9, label: "رمضان" },
];

export interface QuranPoint {
  surah: number | null;
  ayah: number | null;
}

export interface MonthlyRecord {
  // قسم الحفظ الجديد
  memoFrom: QuranPoint;
  memoTo: QuranPoint;
  memoHifzScore: string;       // تسميع الحفظ الجديد، من 25
  memoRecitationScore: string; // تلاوة الحفظ الجديد، من 15
  // قسم المراجعة
  reviewFrom: QuranPoint;
  reviewTo: QuranPoint;
  reviewHifzScore: string;       // تسميع المراجعة، من 25
  reviewRecitationScore: string; // تلاوة المراجعة، من 15
  // المواظبة والسلوك (كما كانت)
  attendanceScore: string; // من 10
  behaviorScore: string;   // من 10
}
