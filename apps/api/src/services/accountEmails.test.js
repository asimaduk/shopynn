import { test } from "node:test";
import assert from "node:assert/strict";
import {
    buildAccountCredentialsEmail,
    buildPasswordResetEmail,
    buildVerificationCodeEmail,
    buildWelcomeEmail,
} from "./accountEmails.js";
import { renderEmail, textBlock } from "./emailLayout.js";

test("renderEmail escapes the heading and preheader and includes the footer", () => {
    const html = renderEmail({ heading: "<b>Hi</b>", preheader: "<i>pre</i>", body: "<p>ok</p>", footerNote: "Note here" });
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /&lt;b&gt;Hi&lt;\/b&gt;/);
    assert.match(html, /&lt;i&gt;pre&lt;\/i&gt;/);
    assert.match(html, /<p>ok<\/p>/);
    assert.match(html, /Note here/);
    assert.match(html, /shopynn-icon\.png/);
});

test("renderEmail hides the Shopynn logo for shop-branded emails", () => {
    const html = renderEmail({ heading: "Invoice", body: "", brandName: "Ama's Shop", showLogo: false });
    assert.doesNotMatch(html, /shopynn-icon\.png/);
    assert.match(html, /Ama&#39;s Shop|Ama&#x27;s Shop/);
});

test("textBlock escapes text and keeps line breaks", () => {
    assert.match(textBlock("a <script>\nb"), /a &lt;script&gt;<br\/>b/);
});

test("password reset email shows the temporary password and escapes user input", () => {
    const e = buildPasswordResetEmail({ firstName: "<Kofi>", email: "k@x.com", temporaryPassword: "Ab#12345" });
    assert.equal(e.subject, "Your Shopynn temporary password");
    assert.match(e.html, /Ab#12345/);
    assert.match(e.html, /&lt;Kofi&gt;/);
    assert.doesNotMatch(e.html, /<Kofi>/);
    assert.match(e.html, /30 minutes/);
    assert.match(e.html, /\/sign-in/);
    assert.match(e.text, /Temporary password: Ab#12345/);
});

test("credentials email differs for agents", () => {
    const staff = buildAccountCredentialsEmail({ firstName: "Ama", email: "a@x.com", temporaryPassword: "pw" });
    const agent = buildAccountCredentialsEmail({ firstName: "Ama", email: "a@x.com", temporaryPassword: "pw", accountKind: "agent" });
    assert.equal(staff.subject, "Your Shopynn account is ready");
    assert.equal(agent.subject, "Your Shopynn agent account is ready");
    assert.match(agent.text, /Forgot password/);
    assert.doesNotMatch(staff.text, /Forgot password/);
});

test("verification code email covers each purpose and rejects unknown ones", () => {
    for (const purpose of ["signup", "change_email", "step_up"]) {
        const e = buildVerificationCodeEmail({ purpose, code: "123456" });
        assert.match(e.html, /123456/);
        assert.match(e.text, /123456/);
        assert.match(e.text, /10 minutes/);
    }
    assert.throws(() => buildVerificationCodeEmail({ purpose: "nope", code: "1" }));
});

test("welcome email reflects plan status", () => {
    const active = buildWelcomeEmail({ firstName: "Ama", email: "a@x.com", shopName: "Ama Store", planLabel: "Pro", isActive: true, endsOn: "1 Jan 2027" });
    assert.equal(active.subject, "Welcome to Shopynn, Ama!");
    assert.match(active.text, /Pro plan is active until 1 Jan 2027/);
    const pending = buildWelcomeEmail({ firstName: "Ama", email: "a@x.com", shopName: "Ama Store", planLabel: "Pro", isActive: false });
    assert.match(pending.text, /reserved/);
});
