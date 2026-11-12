import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ||= "test-secret";
const { isValidUnsubscribeToken, unsubscribeHeaders, unsubscribePageUrl, unsubscribeToken } = await import(
    "./newsletterUnsubscribe.js"
);

test("token is stable and ignores email case and spacing", () => {
    assert.equal(unsubscribeToken("Ama@Example.com "), unsubscribeToken("ama@example.com"));
    assert.ok(isValidUnsubscribeToken("AMA@example.com", unsubscribeToken("ama@example.com")));
});

test("token for one address does not work for another", () => {
    assert.equal(isValidUnsubscribeToken("kofi@example.com", unsubscribeToken("ama@example.com")), false);
    assert.equal(isValidUnsubscribeToken("ama@example.com", ""), false);
    assert.equal(isValidUnsubscribeToken("ama@example.com", "short"), false);
    assert.equal(isValidUnsubscribeToken("ama@example.com", undefined), false);
});

test("page link and one-click headers carry the email and token", () => {
    const url = new URL(unsubscribePageUrl("ama@example.com"));
    assert.equal(url.pathname, "/unsubscribe");
    assert.equal(url.searchParams.get("e"), "ama@example.com");
    assert.ok(isValidUnsubscribeToken("ama@example.com", url.searchParams.get("t")));

    const h = unsubscribeHeaders("ama@example.com");
    assert.equal(h["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.match(h["List-Unsubscribe"], /^<https:\/\/.+\/api\/public\/newsletter\/unsubscribe\/one-click\?e=.+&t=.+>$/);
});
