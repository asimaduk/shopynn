import test from "node:test";
import assert from "node:assert/strict";
import {
    computePlatformCollectionCharge,
    normalizeFeePayer,
    settlementCreditAmount,
} from "./platformMomoCharge.js";

const settings = { enabled: true, percent: 2 };

test("normalizeFeePayer defaults to customer", () => {
    assert.equal(normalizeFeePayer(undefined), "customer");
    assert.equal(normalizeFeePayer("SHOP"), "shop");
});

test("customer pays face plus the collection percent", () => {
    const c = computePlatformCollectionCharge(100, settings, "customer");
    assert.equal(c.charge_amount, 102);
    assert.equal(c.settlement_amount, 100);
    assert.equal(c.fee_amount, 2);
    assert.equal(c.fee_payer, "customer");
});

test("shop pays: customer is charged face, settlement is face minus fee", () => {
    const c = computePlatformCollectionCharge(100, settings, "shop");
    assert.equal(c.charge_amount, 100);
    assert.equal(c.settlement_amount, 98);
    assert.equal(c.fee_amount, 2);
    assert.equal(c.fee_payer, "shop");
});

test("settlementCreditAmount uses fee_payer on the payment row", () => {
    assert.equal(settlementCreditAmount({ face_amount: 100, fee_amount: 2 }), 100);
    assert.equal(
        settlementCreditAmount({ face_amount: 100, fee_amount: 2, fee_payer: "shop" }),
        98
    );
});
