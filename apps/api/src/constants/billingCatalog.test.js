import { test } from "node:test";
import assert from "node:assert/strict";
import { PILOT_ENDS_AT, PILOT_PRICE_GHS, isPilotPricingActive } from "./billingCatalog.js";

test("pilot pricing defaults to GHS 1 until 1 Jan 2027 UTC", () => {
    assert.equal(PILOT_PRICE_GHS, 1);
    assert.equal(PILOT_ENDS_AT.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("pilot pricing is on through 31 Dec 2026 and off from 1 Jan 2027", () => {
    assert.equal(isPilotPricingActive(new Date("2026-11-11T12:00:00Z")), true);
    assert.equal(isPilotPricingActive(new Date("2026-12-31T23:59:59Z")), true);
    assert.equal(isPilotPricingActive(new Date("2027-01-01T00:00:00Z")), false);
    assert.equal(isPilotPricingActive(new Date("2027-03-01T00:00:00Z")), false);
});
