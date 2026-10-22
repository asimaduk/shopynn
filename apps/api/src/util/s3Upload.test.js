import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "stream";
import { safeImageContentType } from "./s3Upload.js";

function detect(bytes, declared) {
    const file = { mimetype: declared, stream: new PassThrough() };
    return new Promise((resolve) => {
        safeImageContentType({}, file, (err, mime) => resolve(err ? { status: err.status } : { mime }));
        file.stream.end(Buffer.from(bytes));
    });
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0];
const GIF = [...Buffer.from("GIF89a"), 1, 0, 1, 0];
const WEBP = [...Buffer.from("RIFF"), 0x24, 0, 0, 0, ...Buffer.from("WEBPVP8 ")];
const HEIC = [0, 0, 0, 0x18, ...Buffer.from("ftypheic"), 0, 0, 0, 0, ...Buffer.from("mif1heic")];

test("real images keep the type detected from their bytes", async () => {
    assert.deepEqual(await detect(PNG, "image/png"), { mime: "image/png" });
    assert.deepEqual(await detect(JPEG, "image/png"), { mime: "image/jpeg" });
    assert.deepEqual(await detect(GIF, "image/gif"), { mime: "image/gif" });
    assert.deepEqual(await detect(WEBP, "image/webp"), { mime: "image/webp" });
});

test("HEIC photos from iPhones are accepted", async () => {
    assert.deepEqual(await detect(HEIC, "image/heic"), { mime: "image/heic" });
});

test("SVG, HTML and PDF are rejected even when declared as images", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
    const svgProlog = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.deepEqual(await detect(svg, "image/png"), { status: 400 });
    assert.deepEqual(await detect(svgProlog, "image/jpeg"), { status: 400 });
    assert.deepEqual(await detect(Buffer.from("<html><script>alert(1)</script></html>"), "image/png"), { status: 400 });
    assert.deepEqual(await detect(Buffer.from("%PDF-1.4\n"), "image/png"), { status: 400 });
    assert.deepEqual(await detect(svg, "image/heic"), { status: 400 });
    assert.deepEqual(await detect([], "image/png"), { status: 400 });
});

test("the stored bytes are passed through unchanged", async () => {
    const file = { mimetype: "image/png", stream: new PassThrough() };
    const body = Buffer.concat([Buffer.from(PNG), Buffer.alloc(100000, 7)]);
    const out = await new Promise((resolve) => {
        safeImageContentType({}, file, (err, mime, stream) => {
            const parts = [];
            stream.on("data", (c) => parts.push(c));
            stream.on("end", () => resolve(Buffer.concat(parts)));
        });
        file.stream.end(body);
    });
    assert.ok(out.equals(body));
});
