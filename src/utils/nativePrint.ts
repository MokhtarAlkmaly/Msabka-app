import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// يطبع مستند HTML كامل (نفس ما كان يُمرَّر سابقاً لنافذة window.open + print):
// - بالمتصفح العادي (Chrome): نفس الطريقة القديمة تماماً (فتح نافذة وطباعتها)
// - داخل تطبيق Capacitor المثبت: يولّد صورة من المحتوى ثم يحوّلها PDF فعلي
//   ويفتح قائمة مشاركة Android (حفظ / واتساب / طباعة عبر تطبيقات الطابعة المثبتة)
export const printHtmlDocument = async (fullHtml: string, fileName: string) => {
  if (!Capacitor.isNativePlatform()) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
    return;
  }

  const html2canvasPkg = "html2canvas";
  const jspdfPkg = "jspdf";
  const html2canvas = (await import(/* @vite-ignore */ html2canvasPkg)).default;
  const jsPDF = (await import(/* @vite-ignore */ jspdfPkg)).default;

  // إنشاء إطار مخفي لعرض المحتوى وتصويره
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-99999px";
  iframe.style.left = "-99999px";
  iframe.style.width = "900px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = fullHtml;
    });
    // مهلة بسيطة لضمان اكتمال رسم الخطوط والتنسيق قبل التصوير
    await new Promise((r) => setTimeout(r, 400));

    const doc = iframe.contentDocument;
    if (!doc || !doc.body) throw new Error("تعذّر تحميل محتوى الطباعة");

    doc.body.style.width = "900px";
    iframe.style.height = `${doc.body.scrollHeight}px`;
    await new Promise((r) => setTimeout(r, 150));

    const canvas = await html2canvas(doc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 900,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "pt",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
    const base64 = pdf.output("datauristring").split(",")[1];

    const pdfFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    const result = await Filesystem.writeFile({
      path: pdfFileName,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: pdfFileName, url: result.uri });
  } finally {
    document.body.removeChild(iframe);
  }
};

// يشارك نصاً (مثل رسالة واتساب) — يفتح قائمة مشاركة Android الأصلية
// داخل التطبيق المثبت، أو رابط wa.me بالمتصفح العادي كما كان سابقاً
export const shareText = async (text: string, waFallbackUrl?: string) => {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ text });
  } else {
    window.open(waFallbackUrl || `https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
};

// يطبع الصفحة الحالية المعروضة على الشاشة (تستخدم عناصر بصنف print:hidden
// لإخفاء أزرار التحكم كما بمنطق CSS الطباعة العادي بالمتصفح)
export const printCurrentPage = async (fileName = "طباعة") => {
  if (!Capacitor.isNativePlatform()) {
    window.print();
    return;
  }

  const html2canvasPkg = "html2canvas";
  const jspdfPkg = "jspdf";
  const html2canvas = (await import(/* @vite-ignore */ html2canvasPkg)).default;
  const jsPDF = (await import(/* @vite-ignore */ jspdfPkg)).default;

  const styleEl = document.createElement("style");
  styleEl.id = "native-print-style";
  styleEl.textContent = `.native-printing-hide { display: none !important; }`;
  document.head.appendChild(styleEl);

  const hiddenEls = Array.from(document.querySelectorAll(".print\\:hidden"));
  hiddenEls.forEach((el) => el.classList.add("native-printing-hide"));

  try {
    await new Promise((r) => setTimeout(r, 150));
    const canvas = await html2canvas(document.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "pt",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
    const base64 = pdf.output("datauristring").split(",")[1];
    const pdfFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    const result = await Filesystem.writeFile({
      path: pdfFileName,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: pdfFileName, url: result.uri });
  } finally {
    hiddenEls.forEach((el) => el.classList.remove("native-printing-hide"));
    styleEl.remove();
  }
};
