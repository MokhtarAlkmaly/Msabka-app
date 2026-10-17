import { esc } from "@/utils/report";
import {
  type ExamPaper,
  type PaperQuestion,
  formatQuestionRef,
  formatQuestionText,
} from "@/utils/examPaperGenerator";

/**
 * بناء أوراق الطباعة لنماذج الاختبار: ورقة النموذج + مفتاح التصحيح.
 * دوال نصية بحتة (بدون React) لتسهيل الاختبار وإعادة الاستخدام.
 */

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

/** ورقة نموذج كاملة: ترويسة + بيانات الطالب + الأسئلة */
export const buildPaperHtml = (paper: ExamPaper, year: string): string => `
    <div class="paper">
      <div class="header">
        <img class="logo" src="${LOGO_URL}" alt="شعار المركز" />
        <div>
          <div class="center">مركز إنماء الأهلي الخيري — قسم القرآن الكريم</div>
          <div class="title">اختبار حفظ القرآن الكريم</div>
        </div>
        <img class="logo" src="${LOGO_URL}" alt="شعار المركز" />
      </div>
      <div class="meta">
        العام ${esc(year)}هـ — فئة الحفظ: ${esc(paper.categoryLabel)} (${esc(paper.rangeLabel)})
        — ${esc(paper.title)} — عدد الأسئلة: ${paper.questions.length + paper.supplements.length}
      </div>
      <table class="info-table">
        <tr>
          <td style="width:45%">اسم الطالب/الطالبة: ............................................</td>
          <td style="width:30%">المعلّم/المعلّمة: ..........................</td>
          <td>الدرجة: ......... / ${(paper.questions.length + paper.supplements.length) * 10}</td>
        </tr>
      </table>
      <p class="note">التعليمات: يقرأ الطالب/الطالبة غيبًا من موضع البداية ﴿…﴾ إلى موضع النهاية ﴿…﴾، ثم يجيب عن أسئلة التجويد ومعاني الآيات. ويُقيَّم كل سؤال من 10 درجات.</p>
      <ol class="qs">
        ${paper.questions.map(questionItem).join("")}
      </ol>
      ${paper.supplements.length > 0 ? `
      <h3 style="color:#0e6b3a;font-size:12px;margin-top:10px">التجويد ومعاني الآيات</h3>
      <ol class="qs" start="${paper.questions.length + 1}">
        ${paper.supplements.map((q) => `<li><div class="q">${esc(q.question)}</div><div class="score">${esc(q.reference)} — الدرجة: ( ...... ) من 10</div><div>الإجابة: ....................................................................</div></li>`).join("")}
      </ol>
      ` : ""}
      <div class="footer-line">
        <div class="thanks">وفّقكم الله — إدارة مركز إنماء الأهلي الخيري</div>
      </div>
    </div>`;

/** كل النماذج في مستند واحد، كل نموذج في صفحة مستقلة */
export const buildPapersHtml = (papers: ExamPaper[], year: string): string =>
  papers.map((paper) => buildPaperHtml(paper, year)).join("");

/** مفتاح التصحيح: مرجع كل سؤال (السورة والآيات والجزء والصفحة وطول المقطع) */
export const buildAnswerKeyHtml = (papers: ExamPaper[], year: string): string => `
    <div class="paper">
      <div class="header">
        <img class="logo" src="${LOGO_URL}" alt="شعار المركز" />
        <div>
          <div class="center">مركز إنماء الأهلي الخيري — قسم القرآن الكريم</div>
          <div class="title">مفتاح تصحيح أسئلة الحفظ</div>
        </div>
        <img class="logo" src="${LOGO_URL}" alt="شعار المركز" />
      </div>
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
      <div class="footer-line">
        <div class="thanks">وفّقكم الله — إدارة مركز إنماء الأهلي الخيري</div>
      </div>
    </div>`;
