import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedFiles = [
  ["../../SQL/03_SeedData_PMT.sql", 15],
  ["../../SQL/03_SeedData_LMS.sql", 2],
  ["../../SQL/03_SeedData_HLS.sql", 2]
];

for (const [relativePath, expectedCount] of seedFiles) {
  test(`${relativePath} explicitly creates public Documentation`, async () => {
    const sql = await readFile(new URL(relativePath, import.meta.url), "utf8");
    const start = sql.indexOf("INSERT INTO [pmt].[Blogs]");
    const end = sql.indexOf("INSERT INTO [pmt].[BlogHistory]", start);
    const documentationInsert = sql.slice(start, end);

    assert.ok(start >= 0 && end > start, "Documentation seed insert was not found");
    assert.match(documentationInsert, /\[IsPrivate\]/);
    assert.equal(
      documentationInsert.match(/^\s*0,\s*$/gm)?.length || 0,
      expectedCount
    );
  });
}

test("normal Documentation remains private by default", async () => {
  const sql = await readFile(
    new URL("../../SQL/01_CreateDatabase.sql", import.meta.url),
    "utf8"
  );

  assert.match(sql, /DF_pmt_Blogs_IsPrivate\] DEFAULT \(1\)/);
});
