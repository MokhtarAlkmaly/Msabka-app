// يعيد توجيه Build Output API الذي يفترض أن يكتبه preset "vercel" في Nitro.
//
// عند تفعيل وضع SPA يغلّف @lovable.dev/vite-tanstack-config خطاف compiled
// ويستبدل خطاف الـ preset، فيُبنى .vercel/output (functions + static/_shell.html)
// بلا config.json ولا .vc-config.json. مع "framework": null يعامل Vercel النشر
// كموقع Other ويخدم public/ (بلا index.html) فيظهر 404 من المنصة قبل أن تصل
// الطلبات إلى دالة الخادم. هذا السكربت يكتب التوجيه الناقص فقط، بنفس شكل مخرجات
// Nitro نفسها: ملفات ثابتة ثم التقاط كل المسارات — بما فيها / ووظائف الخادم —
// إلى /__server. لا يغيّر مجلد الإخراج إلى dist أو public أو .output/public.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OUTPUT_DIR = resolve(".vercel/output");
const SERVER_FUNC = resolve(OUTPUT_DIR, "functions/__server.func");
const CONFIG_PATH = resolve(OUTPUT_DIR, "config.json");
const VC_CONFIG_PATH = resolve(SERVER_FUNC, ".vc-config.json");
const SERVER_ENTRY = resolve(SERVER_FUNC, "index.mjs");
const SHELL_PATH = resolve(OUTPUT_DIR, "static/_shell.html");

const SUPPORTED_NODE = [20, 22, 24];

function srcMatches(src, pathname) {
  if (typeof src !== "string" || src.length === 0) return false;
  try {
    return new RegExp(src).test(pathname);
  } catch {
    return false;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

export function routingCoversApp(config) {
  if (!config || config.version !== 3 || !Array.isArray(config.routes)) return false;
  const filesystemAt = config.routes.findIndex((route) => route?.handle === "filesystem");
  const serverAt = config.routes.findIndex(
    (route) =>
      route?.dest === "/__server" &&
      srcMatches(route.src, "/") &&
      srcMatches(route.src, "/_serverFn/x"),
  );
  if (filesystemAt === -1 || serverAt <= filesystemAt) return false;
  // مسار 404.html المحقون قبل filesystem يبتلع كل الطلبات بـ NOT_FOUND من المنصة.
  return !config.routes.some(
    (route, index) =>
      index < filesystemAt &&
      route?.status === 404 &&
      (route.dest === "/404.html" || route.dest === "/404") &&
      srcMatches(route.src, "/"),
  );
}

export function nodeRuntime(nitroInfo) {
  const configured = nitroInfo?.config?.vercel?.functions?.runtime;
  if (typeof configured === "string" && configured.length > 0) return configured;
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  const picked = SUPPORTED_NODE.find((version) => version >= major) ?? SUPPORTED_NODE.at(-1);
  return `nodejs${picked}.x`;
}

function nitroBuildInfo() {
  return readJson(resolve(OUTPUT_DIR, "nitro.json"));
}

function writeMissingFunctionConfig(nitroInfo) {
  if (existsSync(VC_CONFIG_PATH)) return false;
  const config = {
    handler: "index.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    supportsResponseStreaming: true,
    runtime: nodeRuntime(nitroInfo),
  };
  writeFileSync(VC_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  return true;
}

function desiredBuildConfig(nitroInfo) {
  const version = nitroInfo?.versions?.nitro ?? nitroInfo?.framework?.version ?? "0.0.0";
  return {
    version: 3,
    framework: {
      name: "nitro",
      version,
    },
    overrides: {},
    routes: [
      {
        headers: { "cache-control": "public, max-age=31536000, immutable" },
        src: "/assets/(.*)",
      },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/__server" },
    ],
  };
}

export function ensureVercelOutputRouting({ env = process.env, log = console.log } = {}) {
  if (!env.VERCEL) {
    log("[vercel-output] ليس بناء Vercel — لا حاجة لملف التوجيه.");
    return { skipped: true };
  }
  if (!existsSync(SERVER_ENTRY)) {
    throw new Error(
      "[vercel-output] دالة الخادم غير موجودة في .vercel/output/functions/__server.func. تأكد أن vite.config.ts يضبط nitro preset على vercel عند VERCEL=1.",
    );
  }
  if (!existsSync(SHELL_PATH)) {
    throw new Error(
      "[vercel-output] static/_shell.html غير موجود. بدون القشرة لن يفتح المسار / ولن يعمل وضع عدم الاتصال.",
    );
  }

  const nitroInfo = nitroBuildInfo();
  const wroteFunctionConfig = writeMissingFunctionConfig(nitroInfo);
  const existing = readJson(CONFIG_PATH);
  let wroteRoutes = false;
  if (!routingCoversApp(existing)) {
    writeFileSync(CONFIG_PATH, `${JSON.stringify(desiredBuildConfig(nitroInfo), null, 2)}\n`);
    wroteRoutes = true;
  }

  const config = readJson(CONFIG_PATH);
  const vcConfig = readJson(VC_CONFIG_PATH);
  if (!routingCoversApp(config)) {
    throw new Error(
      "[vercel-output] config.json ما زال بلا توجيه يفتح / ويحوّل وظائف الخادم إلى /__server.",
    );
  }
  if (
    vcConfig?.handler !== "index.mjs" ||
    vcConfig?.launcherType !== "Nodejs" ||
    !vcConfig?.runtime
  ) {
    throw new Error("[vercel-output] .vc-config.json لا يعرّف دالة Node.js صالحة لـ Vercel.");
  }

  log(
    `[vercel-output] التوجيه جاهز (${wroteRoutes ? "كُتب config.json" : "config.json موجود"}، ${
      wroteFunctionConfig ? "كُتب .vc-config.json" : ".vc-config.json موجود"
    }). / و/_serverFn/* → /__server بعد filesystem.`,
  );
  return { skipped: false, wroteRoutes, wroteFunctionConfig, config };
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  ensureVercelOutputRouting();
}
