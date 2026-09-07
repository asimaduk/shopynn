import test from "node:test";
import assert from "node:assert/strict";
import { amountsMatchOrderTotal } from "./payment.js";

test("amountsMatchOrderTotal allows tiny rounding differences", () => {
    assert.equal(amountsMatchOrderTotal(100, 100.01), true);
    assert.equal(amountsMatchOrderTotal(99.999, 100), true);
});

test("amountsMatchOrderTotal rejects significant mismatch", () => {
    assert.equal(amountsMatchOrderTotal(100, 101), false);
    assert.equal(amountsMatchOrderTotal("abc", 100), false);
});
