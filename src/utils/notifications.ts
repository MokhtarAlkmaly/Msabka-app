import { Student } from "@/types/student";

export interface StudentAlert {
  studentId: number;
  studentName: string;
  teacher: string;
  type: "excellent" | "good" | "needs-attention" | "inactive";
  message: string;
  score?: number;
  rank?: number;
}

export const analyzeStudents = (students: Student[]): StudentAlert[] => {
  const alerts: StudentAlert[] = [];
  
  // تصفية الطالبات النشطات فقط
  const activeStudents = students.filter(s => {
    const total = parseFloat(s.yearData?.total || '0');
    return total > 0;
  });

  // الطالبات المتميزات (درجة 90 فأكثر)
  activeStudents.forEach(student => {
    const total = parseFloat(student.yearData?.total || '0');
    const rank = parseInt(student.yearData?.rank || '0');
    const grade = student.yearData?.grade || '';

    if (total >= 90) {
      alerts.push({
        studentId: student.id,
        studentName: student.name,
        teacher: student.teacher,
        type: "excellent",
        message: `حصلت على درجة ${total.toFixed(2)} - تقدير ${grade}`,
        score: total,
        rank: rank
      });
    } else if (total >= 80) {
      alerts.push({
        studentId: student.id,
        studentName: student.name,
        teacher: student.teacher,
        type: "good",
        message: `حصلت على درجة ${total.toFixed(2)} - تقدير ${grade}`,
        score: total,
        rank: rank
      });
    } else if (total < 60 && total > 0) {
      alerts.push({
        studentId: student.id,
        studentName: student.name,
        teacher: student.teacher,
        type: "needs-attention",
        message: `تحتاج للمتابعة - درجة ${total.toFixed(2)} - تقدير ${grade}`,
        score: total,
        rank: rank
      });
    }
  });

  // الطالبات غير النشطات
  const inactiveStudents = students.filter(s => {
    const total = parseFloat(s.yearData?.total || '0');
    return total === 0 && s.name; // لها اسم لكن لا توجد درجات
  });

  inactiveStudents.forEach(student => {
    alerts.push({
      studentId: student.id,
      studentName: student.name,
      teacher: student.teacher,
      type: "inactive",
      message: "لم تشارك في المسابقة هذا العام"
    });
  });

  return alerts;
};

export const getAlertStats = (alerts: StudentAlert[]) => {
  return {
    excellent: alerts.filter(a => a.type === "excellent").length,
    good: alerts.filter(a => a.type === "good").length,
    needsAttention: alerts.filter(a => a.type === "needs-attention").length,
    inactive: alerts.filter(a => a.type === "inactive").length,
    total: alerts.length
  };
};