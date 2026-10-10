#!/usr/bin/env node
/**
 * Fails when SQL template literals interpolate values instead of using $n placeholders.
 *
 * Flags, inside templates that look like SQL:
 *   - quoted interpolation:      '${x}'  '%${x}%'
 *   - comparison interpolation:  = ${x}   ILIKE ${x}   IN (${x})
 * Allowed: $${n} placeholders, and fragments whose name ends in Expr / Sql / Placeholders / Clause.
 * Escape hatch for a reviewed line: append the comment  sql-safe
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SQL_HINT = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|WHERE|ORDER\s+BY|AND|OR|I?LIKE|SET)\b/;
const TEMPLATE = /`((?:[^`\\]|\\.)*)`/gs;
const QUOTED = /['%]\$\{([^}]*)\}/g;
const COMPARISON = /(?:=|<>|!=|<=|>=|<|>|\bLIKE|\bILIKE|\bIN\s*\()\s*(?<!\$)\$\{([^}]*)\}/gi;
const SAFE_FRAGMENT = /(Expr|Sql|Placeholders|Clause)\s*$/;

function listJsFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out.push(...listJsFiles(full));
        else if (/\.(m?js)$/.test(name) && !name.endsWith(".test.js")) out.push(full);
    }
    return out;
}

function scanText(text, firstLine, lines, found) {
    const report = (m, kind) => {
        const line = firstLine + text.slice(0, m.index).split("\n").length - 1;
        if (/sql-safe/.test(lines[line - 1] || "")) return;
        found.set(`${line}:${m[1].trim()}`, { line, kind, expr: m[1].trim() });
    };
    for (const m of text.matchAll(QUOTED)) report(m, "quoted value");
    for (const m of text.matchAll(COMPARISON)) {
        if (!SAFE_FRAGMENT.test(m[1].trim())) report(m, "compared value");
    }
}

export function findSqlInterpolations(source) {
    const lines = source.split("\n");
    const found = new Map();
    // Whole templates catch multi-line queries; single lines catch nested templates
    // (`${cond ? `AND x ILIKE '%${v}%'` : ""}`) that confuse template matching.
    for (const tpl of source.matchAll(TEMPLATE)) {
        if (SQL_HINT.test(tpl[1])) {
            scanText(tpl[1], source.slice(0, tpl.index).split("\n").length, lines, found);
        }
    }
    lines.forEach((text, i) => {
        if (SQL_HINT.test(text)) scanText(text, i + 1, lines, found);
    });
    return [...found.values()].sort((a, b) => a.line - b.line);
}

export function checkDirectory(root) {
    const results = [];
    for (const file of listJsFiles(root)) {
        for (const p of findSqlInterpolations(readFileSync(file, "utf8"))) {
            results.push({ file: relative(process.cwd(), file), ...p });
        }
    }
    return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src");
    const results = checkDirectory(root);
    if (results.length) {
        for (const r of results) {
            console.error(`${r.file}:${r.line}  ${r.kind} interpolated into SQL: \${${r.expr}} — use a $n placeholder`);
        }
        console.error(`\ncheck-sql-safety: ${results.length} problem(s).`);
        process.exit(1);
    }
    console.log("check-sql-safety: no interpolated SQL values found.");
}
