/**
 * مولّد هوية «Markz Net — نسخة بلا إنترنت»
 * ينتج: أيقونات PWA، أيقونات أندرويد (legacy + adaptive)، شاشات البداية، شعار الواجهة.
 *
 * التشغيل:  node scripts/generate-brand-assets.mjs [مجلد-الإخراج]
 * (يتطلب حزمة التطوير الاختيارية @napi-rs/canvas وخطوط Cairo في scripts/brand-fonts/)
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.argv[2] || resolve(HERE, ".."));
const FONT_DIR = process.env.BRAND_FONT_DIR || resolve(HERE, "brand-fonts");

GlobalFonts.registerFromPath(resolve(FONT_DIR, "cairo-bold.ttf"), "CairoAr");
GlobalFonts.registerFromPath(resolve(FONT_DIR, "cairo-black.ttf"), "CairoArBlack");
GlobalFonts.registerFromPath(resolve(FONT_DIR, "cairo-latin-bold.ttf"), "CairoLat");
GlobalFonts.registerFromPath(resolve(FONT_DIR, "cairo-latin-black.ttf"), "CairoLatBlack");

const C = {
  deep: "#04372C",
  green: "#075E45",
  mid: "#0A7355",
  bright: "#0E9A6B",
  amber: "#F59E0B",
  amberDeep: "#D97706",
  ink: "#0B3B2C",
  white: "#FFFFFF",
};

const ar = (weight, size) => `${weight} ${size}px ${weight >= 900 ? "CairoArBlack" : "CairoAr"}`;
const lat = (weight, size) => `${weight} ${size}px ${weight >= 900 ? "CairoLatBlack" : "CairoLat"}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function squircle(ctx, cx, cy, r, n = 4.2) {
  ctx.beginPath();
  for (let i = 0; i <= 360; i += 2) {
    const t = (i * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = cx + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = cy + r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * الشعار: مصحف مفتوح + سهم صاعد (رمز النمو) + شارة «بلا إنترنت».
 * النظام الإحداثي الأصلي 512×512 ومركزه الرأسي عند 268.
 */
const EM_CY = 268;
function emblem(ctx, cx, cy, size, opts = {}) {
  const { badge = true, shade = false } = opts;
  const s = size / 512;
  const X = (v) => cx + (v - 256) * s;
  const Y = (v) => cy + (v - EM_CY) * s;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // ظل خفيف تحت المصحف
  if (shade) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#00140D";
    ctx.beginPath();
    ctx.ellipse(X(256), Y(378), 140 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // السهم الصاعد
  ctx.fillStyle = C.amber;
  ctx.beginPath();
  ctx.moveTo(X(256), Y(58));
  ctx.lineTo(X(324), Y(146));
  ctx.lineTo(X(288), Y(146));
  ctx.lineTo(X(288), Y(240));
  ctx.lineTo(X(224), Y(240));
  ctx.lineTo(X(224), Y(146));
  ctx.lineTo(X(188), Y(146));
  ctx.closePath();
  ctx.fill();

  // غلاف المصحف (طبقة عمق)
  ctx.fillStyle = "rgba(3,42,33,0.34)";
  roundRect(ctx, X(106), Y(296), 300 * s, 68 * s, 24 * s);
  ctx.fill();

  // الوجهان
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.moveTo(X(252), Y(206));
  ctx.bezierCurveTo(X(196), Y(190), X(142), Y(202), X(114), Y(238));
  ctx.lineTo(X(114), Y(316));
  ctx.bezierCurveTo(X(160), Y(292), X(214), Y(292), X(252), Y(318));
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(X(260), Y(206));
  ctx.bezierCurveTo(X(316), Y(190), X(370), Y(202), X(398), Y(238));
  ctx.lineTo(X(398), Y(316));
  ctx.bezierCurveTo(X(352), Y(292), X(298), Y(292), X(260), Y(318));
  ctx.closePath();
  ctx.fill();

  // سطور الصفحتين
  ctx.strokeStyle = C.mid;
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = 7 * s;
  for (let i = 0; i < 3; i++) {
    const y = 236 + i * 24;
    ctx.beginPath();
    ctx.moveTo(X(144), Y(y + 8));
    ctx.bezierCurveTo(X(176), Y(y - 2), X(210), Y(y), X(236), Y(y + 14));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(368), Y(y + 8));
    ctx.bezierCurveTo(X(336), Y(y - 2), X(302), Y(y), X(276), Y(y + 14));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ظهر المصحف الوسطي
  ctx.strokeStyle = C.mid;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 9 * s;
  ctx.beginPath();
  ctx.moveTo(X(256), Y(216));
  ctx.lineTo(X(256), Y(322));
  ctx.stroke();
  ctx.globalAlpha = 1;

  // شارة «بلا إنترنت»
  if (badge) {
    const bx = X(256);
    const by = Y(420);
    const br = 54 * s;
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = C.white;
    ctx.lineWidth = 10 * s;
    for (const [rad, span] of [
      [33, 0.52],
      [20, 0.58],
    ]) {
      ctx.beginPath();
      ctx.arc(bx, by + 16 * s, rad * s, -Math.PI / 2 - span, -Math.PI / 2 + span);
      ctx.stroke();
    }
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(bx, by + 18 * s, 7.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // القطر المائل بغلاف أبيض يقطعه بوضوح
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 22 * s;
    ctx.beginPath();
    ctx.moveTo(bx - 40 * s, by + 41 * s);
    ctx.lineTo(bx + 40 * s, by - 41 * s);
    ctx.stroke();
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 13 * s;
    ctx.beginPath();
    ctx.moveTo(bx - 40 * s, by + 41 * s);
    ctx.lineTo(bx + 40 * s, by - 41 * s);
    ctx.stroke();
  }

  ctx.restore();
}

function bgTexture(ctx, size) {
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, C.bright);
  g.addColorStop(0.5, C.green);
  g.addColorStop(1, C.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const rg = ctx.createRadialGradient(
    size * 0.76,
    size * 0.18,
    0,
    size * 0.76,
    size * 0.18,
    size * 0.85,
  );
  rg.addColorStop(0, "rgba(255,255,255,0.2)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(2, size * 0.05);
  for (let i = -size; i < size * 2; i += size * 0.11) {
    ctx.beginPath();
    ctx.moveTo(i, -size * 0.1);
    ctx.lineTo(i + size * 0.6, size * 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

function makeIcon(size, { shape = "squircle", pad = 0.075 } = {}) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  if (shape === "circle") {
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.475, 0, Math.PI * 2);
    ctx.clip();
    bgTexture(ctx, size);
    ctx.restore();
  } else {
    ctx.save();
    squircle(ctx, size / 2, size / 2, size / 2);
    ctx.clip();
    bgTexture(ctx, size);
    ctx.restore();
  }

  ctx.save();
  squircle(ctx, size / 2, size / 2, size * 0.49);
  ctx.clip();
  emblem(ctx, size / 2, size / 2, size * (1 - pad * 2) * 1.16, { shade: true });
  ctx.restore();
  return canvas;
}

function makeAdaptiveForeground(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  emblem(ctx, size / 2, size / 2, size * 0.66, { shade: true });
  return canvas;
}

/** شعار الواجهة: لوح أخضر + الشعار + الاسم + وسم «نسخة بلا إنترنت» */
function makeLogo() {
  const W = 720;
  const H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const panelW = 500;
  const panelH = 452;
  const px = (W - panelW) / 2;

  ctx.save();
  roundRect(ctx, px, 16, panelW, panelH, 108);
  ctx.clip();
  ctx.translate(px, 16);
  bgTexture(ctx, Math.max(panelW, panelH));
  ctx.restore();
  emblem(ctx, W / 2, 16 + panelH / 2, panelH * 1.06, { shade: true });

  ctx.textAlign = "center";
  ctx.fillStyle = C.ink;
  ctx.font = lat(900, 92);
  ctx.fillText("Markz Net", W / 2, 604);

  ctx.fillStyle = C.amberDeep;
  ctx.font = ar(700, 29);
  ctx.direction = "rtl";
  ctx.fillText("نظام إدارة حلقات ومسابقات القرآن الكريم", W / 2, 652);

  const label = "نسخة بلا إنترنت · البيانات على جهازك";
  ctx.font = ar(700, 28);
  const tw = ctx.measureText(label).width;
  const pw = tw + 66;
  const py = 690;
  roundRect(ctx, W / 2 - pw / 2, py, pw, 62, 31);
  const g = ctx.createLinearGradient(0, py, 0, py + 62);
  g.addColorStop(0, C.amber);
  g.addColorStop(1, C.amberDeep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = "#3B2300";
  ctx.fillText(label, W / 2, py + 42);
  return canvas;
}

function makeSplash(w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, C.bright);
  g.addColorStop(0.5, C.green);
  g.addColorStop(1, C.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const rg = ctx.createRadialGradient(
    w * 0.7,
    h * 0.18,
    0,
    w * 0.7,
    h * 0.18,
    Math.max(w, h) * 0.8,
  );
  rg.addColorStop(0, "rgba(255,255,255,0.18)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  const short = Math.min(w, h);
  const k = short / 900;
  const emblemSize = short * 0.46;
  const centerY = h / 2 - emblemSize * 0.22;
  emblem(ctx, w / 2, centerY, emblemSize, { shade: true });

  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillStyle = C.white;
  ctx.font = lat(900, Math.round(74 * k + 16));
  ctx.fillText("Markz Net", w / 2, centerY + emblemSize * 0.62);

  ctx.direction = "rtl";
  ctx.fillStyle = "rgba(255,255,255,0.93)";
  ctx.font = ar(700, Math.round(42 * k + 12));
  ctx.fillText(
    "قسم القرآن الكريم — نظام الإدارة",
    w / 2,
    centerY + emblemSize * 0.62 + Math.round(50 * k + 18),
  );

  const label = "نسخة بلا إنترنت · البيانات على هذا الجهاز";
  ctx.font = ar(700, Math.round(34 * k + 11));
  const tw = ctx.measureText(label).width;
  const ph = Math.round(66 * k + 22);
  const pw = tw + 84 * k + 44;
  const py = centerY + emblemSize * 0.62 + Math.round(50 * k + 18) + Math.round(34 * k + 16);
  roundRect(ctx, w / 2 - pw / 2, py, pw, ph, ph / 2);
  const ag = ctx.createLinearGradient(0, py, 0, py + ph);
  ag.addColorStop(0, C.amber);
  ag.addColorStop(1, C.amberDeep);
  ctx.fillStyle = ag;
  ctx.fill();
  ctx.fillStyle = "#3B2300";
  ctx.fillText(label, w / 2, py + ph / 2 + Math.round(12 * k + 8));
  return canvas;
}

/** يبني ملف favicon.ico بصيغة PNG-in-ICO (16/32/48) */
function icoBuffer(entries) {
  const images = entries.map(({ size, canvas }) => ({ size, data: canvas.toBuffer("image/png") }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

function saveRaw(buffer, relPath) {
  const full = `${ROOT}/${relPath}`;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, buffer);
  console.log("✓", relPath);
}

function save(canvas, relPath) {
  const full = `${ROOT}/${relPath}`;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, canvas.toBuffer("image/png"));
  console.log("✓", relPath);
}

// ===== المخرجات =====
save(makeIcon(512), "public/icon-512.png");
save(makeIcon(192), "public/icon-192.png");
save(makeIcon(180, { shape: "circle" }), "public/apple-touch-icon.png");
save(makeIcon(64), "public/favicon.png");
save(makeLogo(), "src/assets/logo.png");
saveRaw(
  icoBuffer([16, 32, 48].map((size) => ({ size, canvas: makeIcon(size) }))),
  "public/favicon.ico",
);
const launcherBackgroundColor = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- لون خلفية الأيقونة التكيفية (adaptive icon) — أخضر الهوية -->
    <color name="ic_launcher_background">${C.green}</color>
</resources>
`;
writeFileSync(
  resolve(ROOT, "android/app/src/main/res/values/ic_launcher_background.xml"),
  launcherBackgroundColor,
);
console.log("✓ android/app/src/main/res/values/ic_launcher_background.xml");

const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const foreground = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [d, size] of Object.entries(legacy)) {
  save(makeIcon(size), `android/app/src/main/res/mipmap-${d}/ic_launcher.png`);
  save(
    makeIcon(size, { shape: "circle" }),
    `android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`,
  );
  save(
    makeAdaptiveForeground(foreground[d]),
    `android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`,
  );
}

const splashes = {
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
};
for (const [dir, [w, h]] of Object.entries(splashes)) {
  save(makeSplash(w, h), `android/app/src/main/res/${dir}/splash.png`);
}
save(makeSplash(480, 320), "android/app/src/main/res/drawable/splash.png");
