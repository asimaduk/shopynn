import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { checkDirectory, findSqlInterpolations } from "../scripts/check-sql-safety.mjs";

test("API source has no values interpolated into SQL", () => {
    const problems = checkDirectory(fileURLToPath(new URL(".", import.meta.url)));
    assert.deepEqual(problems, []);
});

test("checker flags quoted and compared interpolation, allows placeholders", () => {
    const bad = [
        "pool.query(`SELECT * FROM t WHERE tenant_id = '${user.tenant_id}'`)",
        "q += ` AND (p.name ILIKE '%${search}%')`;",
        "pool.query(`SELECT * FROM t WHERE id = ${id}`)",
    ];
    for (const src of bad) assert.equal(findSqlInterpolations(src).length, 1, src);

    const ok = [
        "pool.query(`SELECT * FROM t WHERE id = $${i++}`, [id])",
        "where += ` AND s.created_at >= ${fromExpr}`;",
        "pool.query(`SELECT * FROM t WHERE ${where} ORDER BY ${sortBy}`, params)",
    ];
    for (const src of ok) assert.deepEqual(findSqlInterpolations(src), [], src);
});
