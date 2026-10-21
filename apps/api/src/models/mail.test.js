import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildResendPayload, resolveSender, sendEmailService } from "./mail.js";

const ENV_KEYS = ["MAIL_DOMAIN", "MAIL_FROM_SUPPORT", "RESEND_API_KEY"];
let savedEnv;
let savedFetch;

beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    savedFetch = globalThis.fetch;
    for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    globalThis.fetch = savedFetch;
});

test("defaults to no-reply on the mail domain with replies to support", () => {
    process.env.MAIL_DOMAIN = "shopynn.app";
    const s = resolveSender({});
    assert.equal(s.from, "Shopynn <no-reply@shopynn.app>");
    assert.deepEqual(s.replyTo, ["support@shopynn.app"]);
});

test("picks the sender by purpose and keeps the display name", () => {
    const s = resolveSender({ from: "support", sender_name: "Ama from Shopynn" });
    assert.equal(s.from, "Ama from Shopynn <support@shopynn.app>");
    assert.deepEqual(s.replyTo, []);
});

test("unknown sender keys and raw addresses fall back to no-reply", () => {
    assert.match(resolveSender({ from: "ceo@gmail.com" }).from, /<no-reply@shopynn\.app>$/);
});

test("MAIL_FROM_<NAME> overrides one mailbox", () => {
    process.env.MAIL_FROM_SUPPORT = "help@shopynn.app";
    assert.equal(resolveSender({ from: "support" }).from, "Shopynn Support <help@shopynn.app>");
    assert.deepEqual(resolveSender({}).replyTo, ["help@shopynn.app"]);
});

test("explicit reply_to wins and display names can't inject headers", () => {
    const s = resolveSender({ sender_name: 'Evil "Shop" <x@y.z>\r\nBcc: a@b.c', reply_to: "shop@example.com" });
    assert.equal(s.from, "Evil Shop x@y.zBcc: a@b.c <no-reply@shopynn.app>");
    assert.deepEqual(s.replyTo, ["shop@example.com"]);
});

test("builds recipients, bcc and attachments in Resend's format", async () => {
    const p = await buildResendPayload({
        receipient: "a@example.com",
        bcc: "b@example.com, c@example.com",
        subject: "Invoice",
        html: "<p>hi</p>",
        attachments: [
            { filename: "inv.pdf", content: Buffer.from("PDF"), contentType: "application/pdf" },
            { filename: "logo.png", content: "iVBOR", encoding: "base64", cid: "logo" },
        ],
    });
    assert.deepEqual(p.to, ["a@example.com"]);
    assert.deepEqual(p.bcc, ["b@example.com", "c@example.com"]);
    assert.deepEqual(p.attachments, [
        { filename: "inv.pdf", content: Buffer.from("PDF").toString("base64"), content_type: "application/pdf" },
        { filename: "logo.png", content: "iVBOR", content_id: "logo" },
    ]);
});

test("sends through the Resend API and surfaces its errors", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const calls = [];
    globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    };
    const r = await sendEmailService({ from: "support", receipient: "a@example.com", subject: "Hi", title: "T", message: "M" });
    assert.equal(r.messageId, "email_123");
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    assert.equal(calls[0].init.headers.Authorization, "Bearer re_test");
    assert.equal(JSON.parse(calls[0].init.body).from, "Shopynn Support <support@shopynn.app>");

    globalThis.fetch = async () => new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 });
    await assert.rejects(sendEmailService({ receipient: "a@example.com", subject: "Hi" }), /Resend 403: domain not verified/);
});

test("fails clearly when no API key is set", async () => {
    await assert.rejects(sendEmailService({ receipient: "a@example.com", subject: "Hi" }), /RESEND_API_KEY/);
});
