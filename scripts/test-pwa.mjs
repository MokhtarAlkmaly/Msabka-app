// Run after npm run build. Install Chromium separately or set CHROMIUM_EXECUTABLE_PATH.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname } from "node:path";
import { chromium } from "playwright-core";
const root = resolve(process.env.PWA_OUTPUT_DIR || ".output/public");
assert.ok(existsSync(resolve(root, "sw.js")), "Build the PWA first");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".png": "image/png",
};
const server = createServer((req, res) => {
  const relative = new URL(req.url, "http://localhost").pathname.replace(/^\/+/, "");
  let file = resolve(root, relative);
  if (!file.startsWith(root + "/") || !existsSync(file) || statSync(file).isDirectory())
    file = resolve(root, "_shell.html");
  res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin);
  await page.waitForFunction(() => navigator.serviceWorker.controller, undefined, {
    timeout: 30000,
  });
  await context.setOffline(true);
  await page.goto(`${origin}/media`);
  await page.getByRole("button", { name: "المتابعة بدون حساب (وضع الجهاز)" }).click();
  await page.waitForURL(`${origin}/`);
  await page.goto(`${origin}/media`);
  await page.locator("input[type=file]").setInputFiles({
    name: "offline-test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const image = page.locator('img[alt="offline-test.png"]');
  await image.waitFor();
  // Reload immediately: the API must already have persisted binary, metadata, queue.
  await page.reload();
  await image.waitFor();
  await page.waitForFunction(
    () => document.querySelector('img[alt="offline-test.png"]')?.naturalWidth > 0,
  );
  const cacheUrls = await page.evaluate(async () => {
    const entries = await Promise.all(
      (await caches.keys()).map(async (key) =>
        (await (await caches.open(key)).keys()).map((r) => r.url),
      ),
    );
    return entries.flat();
  });
  assert.ok(cacheUrls.some((url) => url.includes("sql-wasm.wasm")));
  assert.ok(cacheUrls.some((url) => url.includes("_shell.html")));
  assert.ok(
    cacheUrls.every(
      (url) => url.startsWith(origin) && !url.includes("supabase") && !url.includes("/api/"),
    ),
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "حذف offline-test.png" }).click({ force: true });
  await image.waitFor({ state: "detached" });
  await page.reload();
  await page.locator("input[type=file]").waitFor({ state: "attached" });
  assert.equal(await image.count(), 0);
  await page.goto(`${origin}/auth`);
  await page.locator("body").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "✓ Browser PWA: first install, offline deep links/auth, first device login, image save/immediate reload/render/delete, private cache boundaries",
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
