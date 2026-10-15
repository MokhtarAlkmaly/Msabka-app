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
  .paper{page-break-after:always}
  .paper:last-child{page-break-after:auto}
  .center{text-align:center;font-weight:bold;font-size:15px;color:#0e6b3a}
  .meta{text-align:center;color:#444;font-size:12px;margin-bottom:10px}
  .note{font-size:12px;color:#555;background:#f4faf6;border:1px solid #cfe3d7;border-radius:6px;padding:6px 8px}
  .qs{font-size:15pt;line-height:2}
  .qs li{margin-bottom:10px}
  .q{font-family:'Traditional Arabic','Amiri Quran','Amiri',serif}
  .score{font-size:11px;color:#666}
`;

const questionItem = (q: PaperQuestion) => `
    <li>
      <div class="q">${esc(formatQuestionText(q))}</div>
      <div class="score">الدرجة: ( ...... ) من 10</div>
    </li>`;

/** ورقة نموذج كاملة: ترويسة + بيانات الطالب + الأسئلة */
export const buildPaperHtml = (paper: ExamPaper, year: string): string => `
    <div class="paper">
      <div class="center">مركز إنماء الأهلي الخيري — قسم القرآن الكريم</div>
      <h2 style="border:0;text-align:center;margin:4px 0">اختبار حفظ القرآن الكريم</h2>
      <div class="meta">
        العام ${esc(year)}هـ — فئة الحفظ: ${esc(paper.categoryLabel)} (${esc(paper.rangeLabel)})
        — ${esc(paper.title)} — عدد الأسئلة: ${paper.questions.length + paper.supplements.length}
      </div>
      <table>
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
      <h3>التجويد ومعاني الآيات</h3>
      <ol class="qs" start="${paper.questions.length + 1}">
        ${paper.supplements.map((q) => `<li><div>${esc(q.question)}</div><div class="score">${esc(q.reference)} — الدرجة: ( ...... ) من 10</div><div>الإجابة: ....................................................................</div></li>`).join("")}
      </ol>
      <div class="thanks">وفّقكم الله — إدارة مركز إنماء الأهلي الخيري</div>
    </div>`;

/** كل النماذج في مستند واحد، كل نموذج في صفحة مستقلة */
export const buildPapersHtml = (papers: ExamPaper[], year: string): string =>
  papers.map((paper) => buildPaperHtml(paper, year)).join("");

/** مفتاح التصحيح: مرجع كل سؤال (السورة والآيات والجزء والصفحة وطول المقطع) */
export const buildAnswerKeyHtml = (papers: ExamPaper[], year: string): string => `
    <div class="paper">
      <div class="center">مركز إنماء الأهلي الخيري — قسم القرآن الكريم</div>
      <h2 style="border:0;text-align:center;margin:4px 0">مفتاح تصحيح أسئلة الحفظ</h2>
      <div class="meta">العام ${esc(year)}هـ — فئة الحفظ: ${esc(papers[0]?.categoryLabel ?? "")} — ${papers.length} نماذج</div>
      <table>
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
      ${papers.map((paper) => `<h3>${esc(paper.title)} — إجابات التجويد والمعاني</h3><ol start="${paper.questions.length + 1}">${paper.supplements.map((q) => `<li><b>${esc(q.question)}</b><p>${esc(q.answer)} — ${esc(q.reference)}</p></li>`).join("")}</ol>`).join("")}
    </div>`;
