#!/usr/bin/env node
/**
 * Lists every API route with the middleware that runs before its handler, and flags
 * routes that are neither signed-in-and-permission-checked nor on the reviewed allowlist
 * in src/routeGuards.allowlist.js.
 *
 * Usage: node scripts/check-route-guards.mjs   (prints unguarded, non-allowlisted routes)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const AUTH = new Set(["auth"]);
const GUARDS = new Set(["requirePermissionGuard", "requireAnyPermissionGuard", "requireMerchant", "requireAdminDb"]);

const indexPath = fileURLToPath(new URL("../src/routes/index.js", import.meta.url));

/** Mount paths declared in routes/index.js, longest first so /payments/webhook wins over /payments. */
const mountPaths = () =>
    [...readFileSync(indexPath, "utf8").matchAll(/router\.(?:use|get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)]
        .map((m) => m[1])
        .sort((a, b) => b.length - a.length);

const layerMatches = (layer, path) => {
    try {
        return layer.match(path);
    } catch {
        return false;
    }
};

const mountPathFor = (layer, candidates) =>
    candidates.find((p) => layerMatches(layer, p) && layerMatches(layer, `${p}/x`)) ??
    candidates.find((p) => layerMatches(layer, p)) ??
    "";

const middlewareNames = (layers) => layers.map((l) => l.name || l.handle?.name || "<anonymous>");

/** Walks the router: returns [{ method, path, chain: [middleware names before the handler] }]. */
export function collectRoutes(router, prefix = "", inherited = [], candidates = mountPaths()) {
    const routes = [];
    const before = [];
    const appliesTo = (path) => before.filter((b) => layerMatches(b.layer, path)).map((b) => b.name);
    for (const layer of router.stack) {
        if (layer.route) {
            const handlerless = middlewareNames(layer.route.stack).slice(0, -1);
            for (const method of Object.keys(layer.route.methods)) {
                routes.push({
                    method: method.toUpperCase(),
                    path: `${prefix}${layer.route.path}`,
                    chain: [...inherited, ...appliesTo(layer.route.path), ...handlerless],
                });
            }
        } else if (layer.handle?.stack) {
            const mount = mountPathFor(layer, candidates);
            routes.push(...collectRoutes(layer.handle, `${prefix}${mount}`, [...inherited, ...appliesTo(mount || "/")], []));
        } else {
            before.push({ layer, name: layer.name || layer.handle?.name || "<anonymous>" });
        }
    }
    return routes;
}

export const isGuarded = (route) => route.chain.some((n) => AUTH.has(n)) && route.chain.some((n) => GUARDS.has(n));

export const routeKey = (route) => `${route.method} ${route.path}`;

export async function findUnguardedRoutes() {
    const { default: router } = await import("../src/routes/index.js");
    const { ROUTE_GUARD_ALLOWLIST } = await import("../src/routeGuards.allowlist.js");
    const routes = collectRoutes(router);
    return {
        unguarded: routes.filter((r) => !isGuarded(r) && !ROUTE_GUARD_ALLOWLIST[routeKey(r)]),
        staleAllowlist: Object.keys(ROUTE_GUARD_ALLOWLIST).filter((k) => !routes.some((r) => routeKey(r) === k)),
        routes,
    };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const { unguarded, staleAllowlist } = await findUnguardedRoutes();
    for (const r of unguarded) console.log(`${routeKey(r)}    [${r.chain.join(", ")}]`);
    for (const k of staleAllowlist) console.log(`stale allowlist entry: ${k}`);
    process.exit(unguarded.length || staleAllowlist.length ? 1 : 0);
}
