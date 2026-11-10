import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const { isValidStepUpToken } = await import("./stepUp.js");

const stepUpKey = () => `${process.env.JWT_SECRET}:step-up`;
const sign = (payload, key = stepUpKey(), expiresIn = 600) => jwt.sign(payload, key, { expiresIn });

test("accepts a step-up token for the same user and session", () => {
    const token = sign({ id: "u1", sid: "s1", purpose: "step_up" });
    assert.equal(isValidStepUpToken(token, { id: "u1", sid: "s1" }), true);
});

test("rejects another user's or another session's token", () => {
    const token = sign({ id: "u1", sid: "s1", purpose: "step_up" });
    assert.equal(isValidStepUpToken(token, { id: "u2", sid: "s1" }), false);
    assert.equal(isValidStepUpToken(token, { id: "u1", sid: "s2" }), false);
    assert.equal(isValidStepUpToken(token, { id: "u1" }), false);
});

test("rejects sign-in tokens, wrong purpose and expired tokens", () => {
    const signIn = jwt.sign({ id: "u1", tv: 0 }, process.env.JWT_SECRET, { expiresIn: 600 });
    assert.equal(isValidStepUpToken(signIn, { id: "u1" }), false);
    assert.equal(isValidStepUpToken(sign({ id: "u1", purpose: "other" }), { id: "u1" }), false);
    assert.equal(isValidStepUpToken(sign({ id: "u1", purpose: "step_up" }, stepUpKey(), -10), { id: "u1" }), false);
    assert.equal(isValidStepUpToken("", { id: "u1" }), false);
});
