import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAgentPayoutEmail } from "./agentPayoutEmail.js";

const base = {
    amount: "57.40",
    commission_count: 3,
    payout_snapshot: { momo_network: "mtn", momo_number: "0241234567", account_holder_name: "Ama Mensah" },
};

test("paid email states the amount and a masked MoMo number", () => {
    const e = buildAgentPayoutEmail({ ...base, status: "paid" }, { first_name: "Ama" });
    assert.equal(e.subject, "Your GH₵ 57.40 Shopynn commission has been paid");
    assert.match(e.text, /MTN ••••••4567/);
    assert.match(e.text, /3 commissions/);
    assert.doesNotMatch(e.text + e.html, /0241234567/);
});

test("failed email asks the agent to check their MoMo details", () => {
    const e = buildAgentPayoutEmail({ ...base, status: "failed", failure_reason: "Paystack internal code 500" }, { first_name: "Ama" });
    assert.match(e.subject, /did not go through/);
    assert.match(e.text, /check your mobile money details/);
    assert.doesNotMatch(e.text + e.html, /internal code/);
});

test("rejected email includes the admin reason, escaped in HTML", () => {
    const e = buildAgentPayoutEmail({ ...base, status: "rejected", failure_reason: "Shop <refunded>" }, {});
    assert.match(e.text, /Hi there, .*: Shop <refunded>/);
    assert.match(e.html, /Shop &lt;refunded&gt;/);
});

test("no email for in-flight statuses", () => {
    assert.equal(buildAgentPayoutEmail({ ...base, status: "pending_approval" }), null);
    assert.equal(buildAgentPayoutEmail({ ...base, status: "processing" }), null);
});
