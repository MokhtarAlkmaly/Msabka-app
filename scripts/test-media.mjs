import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTestVite } from "./test-doubles/vite-plugin.mjs";
const vite = await createTestVite({
  "/utils/sqliteClient.ts": "mediaEnvironment.mjs",
  "/utils/localDB.ts": "mediaEnvironment.mjs",
  "/integrations/supabase/client.ts": "mediaEnvironment.mjs",
});
const oldReader = globalThis.FileReader;
const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
globalThis.FileReader = class {
  readAsDataURL(blob) {
    blob
      .arrayBuffer()
      .then((bytes) => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
        this.onload();
      })
      .catch((error) => {
        this.error = error;
        this.onerror();
      });
  }
};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
try {
  const media = await vite.ssrLoadModule("/src/utils/mediaFiles.ts");
  const env = await vite.ssrLoadModule("/scripts/test-doubles/mediaEnvironment.mjs");
  const file = new Blob(["اختبار صورة محلية"], { type: "image/png" });
  assert.throws(() => media.validateMediaFile(new Blob(["bad"], { type: "text/html" })));
  assert.throws(() =>
    media.validateMediaFile(
      new Blob([new Uint8Array(media.MAX_MEDIA_BYTES + 1)], { type: "video/mp4" }),
    ),
  );
  await media.saveMediaFile("one", file);
  assert.equal(env.state.persisted, 1);
  env.reopen();
  assert.equal(await (await media.readMediaFile("one")).text(), await file.text());
  assert.equal((await media.readMediaFile("one")).type, "image/png");
  const url = await media.mediaObjectUrl("one", "device/year/one.png");
  assert.ok(url.startsWith("blob:"));
  URL.revokeObjectURL(url);
  assert.equal(env.state.downloads, 0, "offline reads never touch cloud");
  assert.equal(await media.mediaObjectUrl("missing", "device/year/missing.png"), null);
  env.state.rows.set("one", { id: "one", file_path: "device/year/one.png" });
  env.state.error = new Error("upload unavailable");
  await assert.rejects(media.uploadMediaFile("one", "account"), /upload unavailable/);
  assert.equal(env.state.rows.get("one").file_path, "device/year/one.png");
  assert.ok(await media.readMediaFile("one"), "binary survives failed upload");
  env.state.error = null;
  await media.uploadMediaFile("one", "account");
  await media.uploadMediaFile("one", "account");
  assert.equal(env.state.rows.get("one").file_path, "account/year/one.png");
  assert.equal(env.state.uploads.at(-1).path, "account/year/one.png");
  assert.equal(env.state.uploads.at(-1).options.upsert, true, "retries are idempotent");
  assert.equal(await env.state.uploads.at(-1).blob.text(), await file.text());
  navigator.onLine = true;
  env.state.download = file;
  const downloaded = await media.mediaObjectUrl("two", "account/year/two.png");
  URL.revokeObjectURL(downloaded);
  assert.equal(env.state.downloads, 1);
  navigator.onLine = false;
  assert.equal(await (await media.readMediaFile("two")).text(), await file.text());
  await media.removeMediaFile("one");
  env.reopen();
  assert.equal(await media.readMediaFile("one"), null);
  const local = readFileSync(new URL("../src/utils/localDB.ts", import.meta.url), "utf8");
  assert.match(local, /SNAPSHOT_INTERNAL_TABLES[^;]*"media_files"/);
  await vite.close();
  const queueVite = await createTestVite({ "/utils/sqliteClient.ts": "mediaEnvironment.mjs" });
  try {
    const queue = await queueVite.ssrLoadModule("/src/utils/localDB.ts");
    const sql = await queueVite.ssrLoadModule("/scripts/test-doubles/mediaEnvironment.mjs");
    const original = {
      key: "media:one",
      entity: "media",
      op: "upsert",
      ref: { id: "one" },
      ts: 10,
    };
    await sql.runRawSql("INSERT INTO pending_changes VALUES (?, ?, ?, ?, ?)", [
      original.key,
      original.entity,
      "delete",
      JSON.stringify(original.ref),
      10,
    ]);
    await queue.clearPending(original.key, original);
    assert.equal(
      (await sql.queryRaw("SELECT * FROM pending_changes", [])).length,
      1,
      "concurrent delete survives upload acknowledgement even within same millisecond",
    );
    await queue.clearPending(original.key, { ...original, op: "delete" });
    assert.equal((await sql.queryRaw("SELECT * FROM pending_changes", [])).length, 0);
  } finally {
    await queueVite.close();
  }
  console.log(
    "✓ Media: validation, real SQLite persistence/reopen, offline reads, failed upload retention, account linking, idempotent retries, download caching, deletion, backup inclusion",
  );
} finally {
  globalThis.FileReader = oldReader;
  if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator);
  else delete globalThis.navigator;
  await vite.close();
}
