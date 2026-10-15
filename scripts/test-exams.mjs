import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Load the TypeScript utilities with the same alias resolution as the app,
// without starting a web server or contacting Supabase.
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});
try {
  const generator = await vite.ssrLoadModule("/src/utils/examPaperGenerator.ts");
  const quran = await vite.ssrLoadModule("/src/utils/quranText.ts");
  const supplemental = await vite.ssrLoadModule("/src/utils/examSupplementQuestions.ts");
  const print = await vite.ssrLoadModule("/src/utils/examPaperPrint.ts");
  const data = JSON.parse(
    await readFile(new URL("../public/quran/uthmani.json", import.meta.url), "utf8"),
  );
  assert.equal(data.surahs.length, 114);
  assert.equal(data.surahs.flat().length, 6236);
  assert.equal(data.pages.length, 6236);
  assert.equal(data.juzStarts.length, 30);
  for (let id = 1; id <= 6236; id++) {
    const { surah, ayah } = quran.fromGlobalId(id);
    assert.equal(quran.toGlobalId(surah, ayah), id);
    assert.ok(quran.ayahText(data, id));
  }
  for (let juz = 1; juz <= 30; juz++) {
    const pool = supplemental.buildSupplementPool(data, { fromJuz: juz, toJuz: juz });
    assert.ok(
      pool.some((q) => q.kind === "meaning"),
      `Missing meanings in juz ${juz}`,
    );
    assert.ok(pool.filter((q) => q.kind === "tajweed").length >= 2);
  }
  let generated = 0;
  for (const category of generator.HIFZ_CATEGORIES) {
    for (const direction of ["start", "end"]) {
      for (const models of [2, 5, 21, 25, 30]) {
        for (const rng of [() => 0, () => 0.5, () => 0.999999]) {
          const range = generator.resolveJuzRange(category, direction);
          const papers = generator.generatePapers(data, { category, direction, models, rng });
          assert.equal(papers.length, models);
          assert.equal(new Set(papers.map((p) => p.label)).size, models);
          const occupied = new Set();
          for (const paper of papers) {
            assert.ok(paper.title && !paper.title.includes("undefined"));
            assert.equal(paper.questions.length, category.questions);
            assert.equal(paper.supplements.filter((q) => q.kind === "meaning").length, 2);
            assert.equal(paper.supplements.filter((q) => q.kind === "tajweed").length, 2);
            for (const q of paper.supplements) {
              const juz = quran.juzOf(data, quran.toGlobalId(q.surah, q.ayah));
              assert.ok(juz >= range.fromJuz && juz <= range.toJuz);
              assert.ok(q.answer && q.reference);
            }
            for (const q of paper.questions) {
              assert.ok(q.ayahCount >= 2 && q.ayahCount <= 10);
              assert.ok(q.juzFrom >= range.fromJuz && q.juzTo <= range.toJuz);
              assert.equal(quran.fromGlobalId(q.toId).surah, q.surah);
              assert.ok(q.firstQuote && q.lastQuote && q.pageFrom > 0);
              for (let id = q.fromId; id <= q.toId; id++) {
                assert.ok(!occupied.has(id), `Overlapping passage: ${category.id}/${models}/${id}`);
                occupied.add(id);
              }
            }
          }
          generated += papers.length;
        }
      }
    }
  }
  const paper = generator.generatePapers(data, {
    category: generator.HIFZ_CATEGORIES[0],
    models: 30,
  })[0];
  const sheet = print.buildPaperHtml(paper, "<script>");
  const key = print.buildAnswerKeyHtml([paper], "1448");
  assert.ok(sheet.includes("&lt;script&gt;") && !sheet.includes("<script>"));
  assert.ok(sheet.includes(`/ ${(paper.questions.length + paper.supplements.length) * 10}`));
  for (const q of paper.supplements) {
    assert.ok(!sheet.includes(q.answer), "Student sheet must not disclose answers");
    assert.ok(key.includes(q.answer), "Answer key must contain supplementary answers");
  }
  assert.equal(
    generator.generatePapers(data, { category: generator.HIFZ_CATEGORIES[0], models: 999 }).length,
    30,
  );
  assert.equal(
    generator.generatePapers(data, { category: generator.HIFZ_CATEGORIES[0], models: NaN }).length,
    2,
  );
  console.log(
    `✅ Verified ${generated} papers: all categories, both directions, 21–30 models, non-overlapping passages, in-range supplementary questions and print answer separation.`,
  );
} finally {
  await vite.close();
}
