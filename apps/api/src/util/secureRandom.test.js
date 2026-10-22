import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOtp, generatePassword } from "./secureRandom.js";

test("OTPs are six digits and vary", () => {
    const codes = new Set();
    for (let i = 0; i < 500; i++) {
        const code = generateOtp();
        assert.match(code, /^[1-9]\d{5}$/);
        codes.add(code);
    }
    assert.ok(codes.size > 450);
});

test("generated passwords use the expected length and alphabet", () => {
    assert.match(generatePassword(), /^[A-Za-z0-9$_]{12}$/);
    assert.match(generatePassword(20), /^[A-Za-z0-9$_]{20}$/);
    assert.notEqual(generatePassword(), generatePassword());
});
