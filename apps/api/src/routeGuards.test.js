import { test } from "node:test";
import assert from "node:assert/strict";
import { collectRoutes, findUnguardedRoutes, isGuarded, routeKey } from "../scripts/check-route-guards.mjs";
import { ROUTE_GUARD_ALLOWLIST } from "./routeGuards.allowlist.js";

test("every API route requires a permission check or is on the reviewed allowlist", async () => {
    const { unguarded, staleAllowlist, routes } = await findUnguardedRoutes();
    assert.deepEqual(unguarded.map((r) => `${routeKey(r)} [${r.chain.join(", ")}]`), []);
    assert.deepEqual(staleAllowlist, []);

    const missingAuth = routes
        .filter((r) => ROUTE_GUARD_ALLOWLIST[routeKey(r)]?.auth && !r.chain.includes("auth"))
        .map(routeKey);
    assert.deepEqual(missingAuth, []);
});

test("checker sees mount-level and route-level guards", async () => {
    const express = (await import("express")).default;
    const { requirePermission } = await import("./middleware/requirePermission.js");
    const auth = function auth(req, res, next) { next(); };
    const handler = (req, res) => res.end();

    const sub = express.Router();
    sub.get("/open", handler);
    sub.get("/guarded", requirePermission("x.view"), handler);
    const root = express.Router();
    root.use("/things", auth, sub);

    const byPath = Object.fromEntries(collectRoutes(root, "", [], ["/things"]).map((r) => [r.path, r]));
    assert.equal(isGuarded(byPath["/things/open"]), false);
    assert.equal(isGuarded(byPath["/things/guarded"]), true);
    assert.deepEqual(byPath["/things/guarded"].chain, ["auth", "requirePermissionGuard"]);
});
