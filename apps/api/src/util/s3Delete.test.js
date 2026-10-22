import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteS3Objects, keyHasPrefix, tenantImagePrefix, userImagePrefix } from "./s3Delete.js";

test("only keys in the caller's own folder are deletable", () => {
    const own = [tenantImagePrefix("t1")];
    assert.equal(keyHasPrefix("tenants/t1/images/a.jpg", own), true);
    assert.equal(keyHasPrefix("tenants/t2/images/a.jpg", own), false);
    assert.equal(keyHasPrefix("tenants/t10/images/a.jpg", own), false);
    assert.equal(keyHasPrefix("tenants/t1/../t2/images/a.jpg", own), false);
    assert.equal(keyHasPrefix("users/u1/profile/a.jpg", own), false);
    assert.equal(keyHasPrefix("", own), false);
    assert.equal(keyHasPrefix("users/u1/profile/a.jpg", [userImagePrefix("u1")]), true);
});

test("deleteS3Objects refuses to run without an allowed folder", async () => {
    await assert.rejects(() => deleteS3Objects(["tenants/t1/images/a.jpg"]), /allowedPrefixes/);
});
