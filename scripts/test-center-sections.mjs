import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});
try {
  const { centerSections, getCenterSection } = await vite.ssrLoadModule(
    "/src/lib/center-sections.ts",
  );
  assert.equal(centerSections.length, 3);
  assert.equal(new Set(centerSections.map((section) => section.to)).size, 3);
  for (const section of centerSections) {
    assert.equal(getCenterSection(section.to).id, section.id);
  }
  for (const path of ["/", "/monthly", "/competition", "/settings", "/users", "/teachers"]) {
    assert.equal(getCenterSection(path).id, "quran");
  }
  assert.equal(getCenterSection("/training/").id, "training");
  assert.equal(getCenterSection("/training/courses").id, "training");
  assert.equal(getCenterSection("/care/orphans").id, "care");
  // Similar prefixes must not accidentally select another department.
  assert.equal(getCenterSection("/training-other").id, "quran");
  assert.equal(getCenterSection("/careful").id, "quran");
  const { departmentDetails } = await vite.ssrLoadModule("/src/lib/center-programs.ts");
  const expectedPrograms = {
    training: {
      "early-education": ["kindergarten", "preschool"],
      "vocational-training": ["sewing", "embroidery", "naqsh", "design"],
      "health-training": ["first-aid"],
    },
    care: {
      "food-assistance": ["food-baskets"],
      "financial-assistance": ["cash-assistance"],
      "orphan-care": ["orphan-education", "orphan-sponsorship"],
    },
  };
  const programIds = [];
  for (const [department, expectedAreas] of Object.entries(expectedPrograms)) {
    const details = departmentDetails[department];
    assert.match(details.beneficiaries, /من المجتمع/);
    assert.match(details.beneficiaries, /لا يشترط التسجيل في قسم القرآن الكريم/);
    assert.deepEqual(
      details.areas.map((area) => area.id),
      Object.keys(expectedAreas),
    );
    for (const area of details.areas) {
      assert.deepEqual(
        area.programs.map((program) => program.id),
        expectedAreas[area.id],
      );
      for (const program of area.programs) {
        assert.ok(program.name && program.description);
        programIds.push(program.id);
      }
    }
  }
  assert.equal(programIds.length, 11);
  assert.equal(new Set(programIds).size, programIds.length);
  console.log("Center section navigation and community program classification checks passed.");
} finally {
  await vite.close();
}
