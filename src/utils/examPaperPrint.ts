import { esc } from "@/utils/report";
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

const questionItem = (q: PaperQuestion) => `
    <li>
      <div class="q">${esc(formatQuestionText(q))}</div>
      <div class="score">الدرجة: ( ...... ) من 10</div>
    </li>`;

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

/** ورقة نموذج كاملة: ترويسة + بيانات الطالب + الأسئلة */
export const buildPaperHtml = (
  paper: ExamPaper,
  year: string,
  student?: PaperStudentContext,
): string => `
    <div class="paper">
      ${paperHeader("اختبار حفظ القرآن الكريم")}
      <div class="meta">
        العام ${esc(year)}هـ — فئة الحفظ: ${esc(paper.categoryLabel)} (${esc(paper.rangeLabel)})
        — ${esc(paper.title)} — عدد الأسئلة: ${paper.questions.length + paper.supplements.length}${esc(studentMeta(student))}
      </div>
      <table class="info-table">
        <tr>
          ${nameCell(student)}
          ${teacherCell(student)}
          <td>الدرجة: ......... / ${(paper.questions.length + paper.supplements.length) * 10}</td>
        </tr>
      </table>
      <p class="note">التعليمات: يقرأ ${esc(studentTitle(student?.gender))} غيبًا من موضع البداية ﴿…﴾ إلى موضع النهاية ﴿…﴾، ثم يجيب عن أسئلة التجويد ومعاني الآيات. ويُقيَّم كل سؤال من 10 درجات.</p>
      <ol class="qs">
        ${paper.questions.map(questionItem).join("")}
      </ol>
      ${
        paper.supplements.length > 0
          ? `
      <h3 style="color:#0e6b3a;font-size:12px;margin-top:10px">التجويد ومعاني الآيات</h3>
      <ol class="qs" start="${paper.questions.length + 1}">
        ${paper.supplements.map((q) => `<li><div class="q">${esc(q.question)}</div><div class="score">${esc(q.reference)} — الدرجة: ( ...... ) من 10</div><div>الإجابة: ....................................................................</div></li>`).join("")}
      </ol>
      `
          : ""
      }
      ${paperFooter}
    </div>`;

/** كل النماذج في مستند واحد، كل نموذج في صفحة مستقلة */
export const buildPapersHtml = (
  papers: ExamPaper[],
  year: string,
  students?: (PaperStudentContext | undefined)[],
): string => papers.map((paper, i) => buildPaperHtml(paper, year, students?.[i])).join("");

/** مفتاح التصحيح: مرجع كل سؤال (السورة والآيات والجزء والصفحة وطول المقطع) */
export const buildAnswerKeyHtml = (papers: ExamPaper[], year: string): string => `
    <div class="paper">
      ${paperHeader("مفتاح تصحيح أسئلة الحفظ")}
      <div class="meta">العام ${esc(year)}هـ — فئة الحفظ: ${esc(papers[0]?.categoryLabel ?? "")} — ${papers.length} نماذج</div>
      <table class="info-table">
        <thead>
          <tr><th>النموذج</th><th>السؤال</th><th>السورة</th><th>الآيات</th><th>الجزء</th><th>الصفحة</th><th>طول المقطع</th><th>مرجع السؤال</th></tr>
        </thead>
        <tbody>
          ${papers
            .flatMap((paper) =>
              paper.questions.map(
                (q) => `<tr>
            <td class="num">${esc(paper.label)}</td>
            <td class="num">${q.number}</td>
            <td>${esc(q.surahName)}</td>
            <td class="num">${q.fromAyah}–${q.toAyah}</td>
            <td class="num">${q.juzFrom}${q.juzTo !== q.juzFrom ? "-" + q.juzTo : ""}</td>
            <td class="num">${q.pageFrom === q.pageTo ? q.pageFrom : `${q.pageFrom}–${q.pageTo}`}</td>
            <td class="num">${q.ayahCount} آية (~${q.lines} سطر)</td>
            <td>${esc(formatQuestionRef(q))}</td>
          </tr>`,
              ),
            )
            .join("")}
        </tbody>
      </table>
      ${papers.map((paper) => `<h3 style="color:#0e6b3a;font-size:12px;margin-top:10px">${esc(paper.title)} — إجابات التجويد والمعاني</h3><ol class="qs" start="${paper.questions.length + 1}">${paper.supplements.map((q) => `<li><b>${esc(q.question)}</b><p>${esc(q.answer)} — ${esc(q.reference)}</p></li>`).join("")}</ol>`).join("")}
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
      <div class="meta">العام ${esc(year)}هـ — ${entries.length} طالب/ة — ${usedPapers.length} نماذج مستخدمة</div>
      <h3 style="color:#0e6b3a;font-size:12px;margin:6px 0">توزيع النماذج على الطلاب</h3>
      <table class="info-table">
        <thead>
          <tr><th>م</th><th>اسم الطالب/ة</th><th>المعلّم/ة</th><th>الحفظ</th><th>فئة الاختبار</th><th>نطاق الأجزاء</th><th>النموذج</th></tr>
        </thead>
        <tbody>
          ${distribution}
        </tbody>
      </table>
      <h3 style="color:#0e6b3a;font-size:12px;margin-top:10px">مواضع أسئلة الحفظ لكل نموذج</h3>
      <table class="info-table">
        <thead>
          <tr><th>النموذج</th><th>السؤال</th><th>السورة</th><th>الآيات</th><th>الجزء</th><th>الصفحة</th><th>طول المقطع</th></tr>
        </thead>
        <tbody>
          ${usedPapers
            .flatMap((paper) =>
              paper.questions.map(
                (q) => `<tr>
            <td class="num">${esc(paper.label)}</td>
            <td class="num">${q.number}</td>
            <td>${esc(q.surahName)}</td>
            <td class="num">${q.fromAyah}–${q.toAyah}</td>
            <td class="num">${q.juzFrom}${q.juzTo !== q.juzFrom ? "-" + q.juzTo : ""}</td>
            <td class="num">${q.pageFrom === q.pageTo ? q.pageFrom : `${q.pageFrom}–${q.pageTo}`}</td>
            <td class="num">${q.ayahCount} آية (~${q.lines} سطر)</td>
          </tr>`,
              ),
            )
            .join("")}
        </tbody>
      </table>
      ${usedPapers
        .map(
          (paper) =>
            `<h3 style="color:#0e6b3a;font-size:12px;margin-top:10px">${esc(paper.title)} — إجابات التجويد والمعاني</h3><ol class="qs" start="${paper.questions.length + 1}">${paper.supplements.map((q) => `<li><b>${esc(q.question)}</b><p>${esc(q.answer)} — ${esc(q.reference)}</p></li>`).join("")}</ol>`,
        )
        .join("")}
      ${paperFooter}
    </div>`;
};
