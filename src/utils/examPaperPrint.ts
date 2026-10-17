import { esc } from "@/utils/report";
import {
  ATTENDANCE_MARKS,
  BEHAVIOR_MARKS,
  HIFZ_TOTAL_MARKS,
  PAPER_TOTAL_MARKS,
  QUESTIONS_TOTAL_MARKS,
  RECITATION_TOTAL_MARKS,
  TEACHER_TOTAL_MARKS,
  hifzQuestionMarks,
  recitationQuestionMarks,
} from "@/lib/exam-marks";
import {
  type ExamPaper,
  type PaperQuestion,
  formatQuestionRef,
  formatQuestionText,
  studentTitle,
} from "@/utils/examPaperGenerator";

/**
 * بناء أوراق الطباعة لنماذج الاختبار: ورقة النموذج + مفتاح التصحيح.
 * دوال نصية بحتة (بدون React) لتسهيل الاختبار وإعادة الاستخدام.
 */

/**
 * بيانات طالب تُطبع في ورقة النموذج بدل الخانات الفارغة.
 * تُمرَّر عند توليد نماذج مخصصة من جدول المسابقة، وتُترك فارغة عند
 * توليد نماذج عامة غير مرتبطة بأسماء.
 */
export interface PaperStudentContext {
  name?: string;
  teacher?: string;
  gender?: string;
  /** إجمالي الحفظ التراكمي للطالب (للعرض في الترويسة) */
  totalHifz?: number;
  /** ترتيب الطالب داخل فئته وعدد طلاب الفئة */
  orderInCategory?: number;
  categoryTotal?: number;
}

/** نقاط الكتابة على السطر: اسم الطالب + المعلم/ة */
const NAME_DOTS = "..............................";
const TEACHER_DOTS = "....................";

export const PAPER_CSS = `
  @page { size: 210mm 148mm; margin: 8mm; }
  
  .paper {
    page-break-after: always;
    position: relative;
    padding: 12px;
    border: 2px solid #0e6b3a;
    border-radius: 8px;
    background: linear-gradient(135deg, #f8fdf9 0%, #ffffff 100%);
  }
  
  .paper:last-child { page-break-after: auto; }
  
  .header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  
  .logo {
    width: 45px;
    height: 45px;
    object-fit: contain;
  }
  
  .center {
    text-align: center;
    font-weight: bold;
    font-size: 13px;
    color: #0e6b3a;
  }
  
  .title {
    text-align: center;
    font-weight: bold;
    font-size: 16px;
    color: #0e6b3a;
    margin: 6px 0;
  }
  
  .meta {
    text-align: center;
    color: #333;
    font-size: 9px;
    margin-bottom: 8px;
  }
  
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 10px;
  }
  
  .info-table td {
    border: 1px solid #0e6b3a;
    padding: 4px 8px;
    text-align: right;
  }
  
  .note {
    font-size: 9px;
    color: #333;
    background: #f4faf6;
    border: 1px solid #cfe3d7;
    border-radius: 4px;
    padding: 5px 8px;
    margin-bottom: 10px;
  }
  
  .qs {
    font-size: 11pt;
    line-height: 1.8;
    padding: 0;
    margin: 0;
    list-style-position: inside;
  }
  
  .qs li {
    margin-bottom: 8px;
  }
  
  .q {
    font-family: 'Traditional Arabic', 'Amiri Quran', 'Amiri', serif;
    font-weight: 600;
  }
  
  .score {
    font-size: 9px;
    color: #555;
    margin-top: 2px;
  }

  .section-title {
    color: #0e6b3a;
    font-size: 11px;
    margin: 8px 0 4px;
    padding-bottom: 2px;
    border-bottom: 1px solid #cfe3d7;
  }

  .section-marks {
    color: #555;
    font-size: 9px;
    font-weight: normal;
  }

  .eval-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin-top: 4px;
  }

  .eval-table th,
  .eval-table td {
    border: 1px solid #0e6b3a;
    padding: 4px 6px;
    text-align: center;
  }

  .eval-table th {
    background: #f4faf6;
    color: #0e6b3a;
  }
  
  .footer-line {
    border-top: 1.5px dashed #0e6b3a;
    margin-top: 10px;
    padding-top: 6px;
  }
  
  .thanks {
    text-align: center;
    font-size: 10px;
    color: #0e6b3a;
    font-weight: 600;
  }
  
  @media print {
    @page { size: 210mm 148mm; margin: 8mm; }
  }
`;

const questionItem = (q: PaperQuestion, mark: number) => `
    <li>
      <div class="q">${esc(formatQuestionText(q))}</div>
      <div class="score">الدرجة: ( ...... ) من ${mark}</div>
    </li>`;

const supplementItem = (q: { question: string; reference: string }, mark: number) => `
    <li>
      <div class="q">${esc(q.question)}</div>
      <div class="score">${esc(q.reference)} — الدرجة: ( ...... ) من ${mark}</div>
      <div>الإجابة: ....................................................................</div>
    </li>`;

/** عنوان قسم داخل النموذج مع مجموع درجاته */
const sectionTitle = (title: string, marks: number) =>
  `<h3 class="section-title">${esc(title)} <span class="section-marks">— ${marks} درجة</span></h3>`;

const LOGO_URL = "/icon-192.png";

/** ورقة ترويسة موحّدة لكل المستندات المطبوعة */
const paperHeader = (title: string): string => `
      <div class="header">
        <img class="logo" src="${LOGO_URL}" alt="شعار المركز" />
        <div>
          <div class="center">مركز إنماء الأهلي الخيري — قسم القرآن الكريم</div>
          <div class="title">${esc(title)}</div>
        </div>
        <img class="logo" src="${LOGO_URL}" alt="شعار المركز" />
      </div>`;

/** خاتمة موحّدة */
const paperFooter = `
      <div class="footer-line">
        <div class="thanks">وفّقكم الله — إدارة مركز إنماء الأهلي الخيري</div>
      </div>`;

/** خانة «اسم الطالب» — تُملأ بالاسم عند التخصيص وتبقى منقّطة للنماذج العامة */
const nameCell = (student?: PaperStudentContext, width = "45%") => {
  const hasName = Boolean(student?.name);
  const label = hasName ? `اسم ${studentTitle(student?.gender)}` : "اسم الطالب/الطالبة";
  const value = hasName ? `<b>${esc(student!.name!)}</b>` : NAME_DOTS;
  return `<td style="width:${width}">${esc(label)}: ${value}</td>`;
};

/** خانة «المعلّم/المعلّمة» — تُملأ بالاسم المسجّل في الجدول إن وُجد */
const teacherCell = (student?: PaperStudentContext, width = "30%") => {
  const value = student?.teacher ? `<b>${esc(student.teacher)}</b>` : TEACHER_DOTS;
  return `<td style="width:${width}">المعلّم/المعلّمة: ${value}</td>`;
};

/** سطر إضافي في الترويسة يربط النموذج بالطالب (يظهر في النماذج المخصصة فقط) */
const studentMeta = (student?: PaperStudentContext): string => {
  if (!student?.name) return "";
  const bits: string[] = [];
  if (typeof student.totalHifz === "number" && student.totalHifz > 0)
    bits.push(`إجمالي الحفظ: ${student.totalHifz} جزءًا`);
  if (student.orderInCategory && student.categoryTotal)
    bits.push(`تسلسله في فئته: ${student.orderInCategory} من ${student.categoryTotal}`);
  return bits.length ? ` — ${bits.join(" — ")}` : "";
};

/** ورقة نموذج كاملة: ترويسة + بيانات الطالب + الأسئلة + تقييم المعلم/ة */
export const buildPaperHtml = (
  paper: ExamPaper,
  year: string,
  student?: PaperStudentContext,
): string => {
  const hifzMarks = hifzQuestionMarks(paper.questions.length);
  const recitationMarks = recitationQuestionMarks(paper.supplements.length);
  return `
    <div class="paper">
      ${paperHeader("اختبار الحفظ والتلاوة")}
      <div class="meta">
        العام ${esc(year)}هـ — فئة الحفظ: ${esc(paper.categoryLabel)} (${esc(paper.rangeLabel)})
        — ${esc(paper.title)} — عدد الأسئلة: ${paper.questions.length + paper.supplements.length}
        — الدرجة: ${QUESTIONS_TOTAL_MARKS} للأسئلة + ${TEACHER_TOTAL_MARKS} لتقييم المعلم/ة${esc(studentMeta(student))}
      </div>
      <table class="info-table">
        <tr>
          ${nameCell(student)}
          ${teacherCell(student)}
          <td style="width:25%">الدرجة النهائية: ......... / ${PAPER_TOTAL_MARKS}</td>
        </tr>
      </table>
      <p class="note">
        التعليمات: يقرأ ${esc(studentTitle(student?.gender))} غيبًا من موضع البداية ﴿…﴾ إلى موضع النهاية ﴿…﴾، ثم يجيب عن أسئلة التلاوة والتجويد والمعاني.
        الدرجات: ${HIFZ_TOTAL_MARKS} للحفظ + ${RECITATION_TOTAL_MARKS} للتلاوة والتجويد والمعاني + ${ATTENDANCE_MARKS} مواظبة + ${BEHAVIOR_MARKS} سلوك (من تقييم المعلم/ة).
      </p>

      ${sectionTitle("أولًا: أسئلة الحفظ", HIFZ_TOTAL_MARKS)}
      <ol class="qs">
        ${paper.questions.map((q, index) => questionItem(q, hifzMarks[index])).join("")}
      </ol>

      ${sectionTitle("ثانيًا: أسئلة التلاوة والتجويد والمعاني", RECITATION_TOTAL_MARKS)}
      ${
        paper.supplements.length > 0
          ? `<ol class="qs" start="${paper.questions.length + 1}">
        ${paper.supplements.map((q, index) => supplementItem(q, recitationMarks[index])).join("")}
      </ol>`
          : `<p class="note">لم تُضَف أسئلة تلاوة لهذا النموذج — يقيّم المعلم/ة التلاوة شفهيًا من ${RECITATION_TOTAL_MARKS} درجة.</p>`
      }

      ${sectionTitle("ثالثًا: تقييم المعلم/ة والمجموع", TEACHER_TOTAL_MARKS)}
      <table class="eval-table">
        <tr>
          <th>المواظبة (${ATTENDANCE_MARKS})</th>
          <th>السلوك (${BEHAVIOR_MARKS})</th>
          <th>مجموع الأسئلة (${QUESTIONS_TOTAL_MARKS})</th>
          <th>الدرجة النهائية (${PAPER_TOTAL_MARKS})</th>
        </tr>
        <tr>
          <td>( ...... )</td>
          <td>( ...... )</td>
          <td>( ...... )</td>
          <td>( ...... )</td>
        </tr>
      </table>
      ${paperFooter}
    </div>`;
};

/** كل النماذج في مستند واحد، كل نموذج في صفحة مستقلة */
export const buildPapersHtml = (
  papers: ExamPaper[],
  year: string,
  students?: (PaperStudentContext | undefined)[],
): string => papers.map((paper, i) => buildPaperHtml(paper, year, students?.[i])).join("");

/** صفوف جدول مواضع أسئلة الحفظ في مفتاح التصحيح، مع درجة كل سؤال. */
const hifzKeyRows = (paper: ExamPaper): string => {
  const marks = hifzQuestionMarks(paper.questions.length);
  return paper.questions
    .map(
      (q, index) => `<tr>
            <td class="num">${esc(paper.label)}</td>
            <td class="num">${q.number}</td>
            <td>${esc(q.surahName)}</td>
            <td class="num">${q.fromAyah}–${q.toAyah}</td>
            <td class="num">${q.juzFrom}${q.juzTo !== q.juzFrom ? "-" + q.juzTo : ""}</td>
            <td class="num">${q.pageFrom === q.pageTo ? q.pageFrom : `${q.pageFrom}–${q.pageTo}`}</td>
            <td class="num">${q.ayahCount} آية (~${q.lines} سطر)</td>
            <td class="num">${marks[index]}</td>
            <td>${esc(formatQuestionRef(q))}</td>
          </tr>`,
    )
    .join("");
};

/** إجابات التلاوة والتجويد والمعاني لنموذج واحد، مع درجة كل سؤال. */
const supplementAnswers = (paper: ExamPaper): string => {
  const marks = recitationQuestionMarks(paper.supplements.length);
  return `<h3 style="color:#0e6b3a;font-size:12px;margin-top:10px">${esc(paper.title)} — إجابات التلاوة والتجويد والمعاني (${RECITATION_TOTAL_MARKS} درجة)</h3><ol class="qs" start="${paper.questions.length + 1}">${paper.supplements.map((q, index) => `<li><b>${esc(q.question)}</b><p>${esc(q.answer)} — ${esc(q.reference)} — الدرجة: ${marks[index]}</p></li>`).join("")}</ol>`;
};

/** مفتاح التصحيح: مرجع كل سؤال (السورة والآيات والجزء والصفحة وطول المقطع) */
export const buildAnswerKeyHtml = (papers: ExamPaper[], year: string): string => `
    <div class="paper">
      ${paperHeader("مفتاح تصحيح أسئلة الحفظ والتلاوة")}
      <div class="meta">
        العام ${esc(year)}هـ — فئة الحفظ: ${esc(papers[0]?.categoryLabel ?? "")} — ${papers.length} نماذج
        — توزيع الدرجات: ${HIFZ_TOTAL_MARKS} حفظ + ${RECITATION_TOTAL_MARKS} تلاوة = ${QUESTIONS_TOTAL_MARKS}، وتقييم المعلم/ة ${TEACHER_TOTAL_MARKS} = ${PAPER_TOTAL_MARKS}
      </div>
      <h3 class="section-title">أولًا: أسئلة الحفظ <span class="section-marks">— ${HIFZ_TOTAL_MARKS} درجة</span></h3>
      <table class="info-table">
        <thead>
          <tr><th>النموذج</th><th>السؤال</th><th>السورة</th><th>الآيات</th><th>الجزء</th><th>الصفحة</th><th>طول المقطع</th><th>الدرجة</th><th>مرجع السؤال</th></tr>
        </thead>
        <tbody>
          ${papers.map(hifzKeyRows).join("")}
        </tbody>
      </table>
      <h3 class="section-title">ثانيًا: إجابات التلاوة والتجويد والمعاني <span class="section-marks">— ${RECITATION_TOTAL_MARKS} درجة</span></h3>
      ${papers.map(supplementAnswers).join("")}
      ${paperFooter}
    </div>`;

/**
 * مفتاح تصحيح النماذج المخصصة للطلاب.
 * يختلف عن مفتاح النماذج العامة بأنه يبدأ بجدول توزيع (من هو الطالب وفي أي
 * نموذج)، ثم يعرض إجابات كل نموذج مستخدم مرة واحدة فقط — لأن عدة طلاب قد
 * يشتركون في نفس النموذج حين يتجاوز عددهم الحد الأعلى للنماذج.
 */
export const buildStudentAnswerKeyHtml = (
  entries: { paper: ExamPaper; student?: PaperStudentContext }[],
  year: string,
): string => {
  const usedPapers: ExamPaper[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.paper.categoryLabel}:${entry.paper.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    usedPapers.push(entry.paper);
  }

  const distribution = entries
    .map(
      (entry, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(entry.student?.name || "—")}</td>
        <td>${esc(entry.student?.teacher || "—")}</td>
        <td class="num">${entry.student?.totalHifz || 0}</td>
        <td>${esc(entry.paper.categoryLabel)}</td>
        <td>${esc(entry.paper.rangeLabel)}</td>
        <td class="num"><b>${esc(entry.paper.label)}</b></td>
      </tr>`,
    )
    .join("");

  return `
    <div class="paper">
      ${paperHeader("مفتاح تصحيح نماذج الطلاب")}
      <div class="meta">
        العام ${esc(year)}هـ — ${entries.length} طالب/ة — ${usedPapers.length} نماذج مستخدمة
        — توزيع الدرجات: ${HIFZ_TOTAL_MARKS} حفظ + ${RECITATION_TOTAL_MARKS} تلاوة = ${QUESTIONS_TOTAL_MARKS}، وتقييم المعلم/ة ${TEACHER_TOTAL_MARKS} = ${PAPER_TOTAL_MARKS}
      </div>
      <h3 style="color:#0e6b3a;font-size:12px;margin:6px 0">توزيع النماذج على الطلاب</h3>
      <table class="info-table">
        <thead>
          <tr><th>م</th><th>اسم الطالب/ة</th><th>المعلّم/ة</th><th>الحفظ</th><th>فئة الاختبار</th><th>نطاق الأجزاء</th><th>النموذج</th></tr>
        </thead>
        <tbody>
          ${distribution}
        </tbody>
      </table>
      <h3 style="color:#0e6b3a;font-size:12px;margin-top:10px">مواضع أسئلة الحفظ لكل نموذج <span class="section-marks">— ${HIFZ_TOTAL_MARKS} درجة</span></h3>
      <table class="info-table">
        <thead>
          <tr><th>النموذج</th><th>السؤال</th><th>السورة</th><th>الآيات</th><th>الجزء</th><th>الصفحة</th><th>طول المقطع</th><th>الدرجة</th></tr>
        </thead>
        <tbody>
          ${usedPapers.map(hifzKeyRows).join("")}
        </tbody>
      </table>
      <h3 style="color:#0e6b3a;font-size:12px;margin-top:10px">إجابات التلاوة والتجويد والمعاني <span class="section-marks">— ${RECITATION_TOTAL_MARKS} درجة</span></h3>
      ${usedPapers.map(supplementAnswers).join("")}
      ${paperFooter}
    </div>`;
};
