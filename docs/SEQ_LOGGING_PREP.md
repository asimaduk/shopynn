# Seq logging — preparation outline (IMS)

Use this document to plan and implement **structured server logging** with [Seq](https://datalust.co/seq) for `apps/api` (`@shopynn/api`) (and related clients). Work through the sections in order before changing production.

**Status:** Planned (not implemented)  
**Primary service:** `apps/api` (`@shopynn/api`) (Express / Node)  
**Related:** [PRODUCTION_TEST_CHECKLIST.md](./PRODUCTION_TEST_CHECKLIST.md) · [ANDROID_RELEASE_SECURITY.md](./ANDROID_RELEASE_SECURITY.md)

---

## 1. Goals

| Goal | Success looks like |
|------|-------------------|
| Troubleshoot API failures | Find all errors for a tenant/route/time window in seconds |
| Trace one request | Same `RequestId` from HTTP → DB error → response |
| Audit sensitive flows | Signup, payments, subscription changes searchable (without secrets) |
| Alert on spikes | Notification when error rate jumps (Seq Signals or external) |
| Safe production | No passwords, tokens, or card data in logs |

**Out of scope (for v1):** Full APM traces, mobile crash analytics (consider Sentry later), log shipping from React Native directly to Seq.

---

## 2. How Seq fits IMS today

**Current state**

- `apps/api` (`@shopynn/api`) uses `console.log` / `console.error` in places; global handler in `src/middleware/errorhandler.js` returns 500 JSON without centralized logging.
- No request ID, no log levels, no retention policy.

**Target state**

```text
Cheqstock / ims-web / webhooks
        │
        ▼
   ims-services (Express)
        │  pino (JSON) + reqId + tenant/user context
        ▼
   Seq (self-hosted Docker or Seq Cloud)
        │
        └── Search, dashboards, Signals (alerts)
```

---

## 3. Decisions to make before implementation

Check each when you “come back” to this work.

### 3.1 Hosting

| Option | Pros | Cons |
|--------|------|------|
| **Seq on Docker** (same VPS or small VM) | Data in your infra; predictable cost | You manage disk, HTTPS, backups, updates |
| **Seq Cloud** | No server ops | Subscription; data leaves your VPC |

**Prepare:** Pick host region, domain (e.g. `logs.yourdomain.com`), TLS cert (Let’s Encrypt), who has admin access.

### 3.2 Retention and disk

- Default retention (e.g. **14 or 30 days** for Info, longer for Error if needed).
- Estimate volume: `(requests/day) × (avg event size) × retention`.
- Plan disk growth and backup (Seq data directory or Cloud retention settings).

### 3.3 Environments

| Environment | Seq instance | Notes |
|-------------|--------------|--------|
| Local dev | Optional local Seq (`docker run`) or stdout only | `SEQ_ENABLED=false` default |
| Staging | Dedicated or shared with prod (separate signals) | Mirror prod config |
| Production | Production Seq | API keys restricted |

**Prepare:** Naming convention for properties: `Environment` = `development` | `staging` | `production`.

### 3.4 Licensing

- Review [Datalust pricing](https://datalust.co/seq) for team size and self-hosted vs Cloud.
- Single-user self-hosted may suffice early; confirm before multi-admin.

### 3.5 Complement tools (optional, later)

| Tool | Role |
|------|------|
| **Seq** | Log search, structured troubleshooting |
| **Sentry** (optional) | Error grouping, mobile crashes |
| **CloudWatch** (optional) | If API stays on AWS and you want infra metrics only |

---

## 4. Structured logging standard (agree before coding)

### 4.1 Library

- **Pino** for Node (`pino` + `pino-http` for Express).
- Transport: **`@datalust/pino-seq-transport`** (or HTTP ingest) when `SEQ_SERVER_URL` is set.
- Always log JSON to **stdout** in dev even if Seq is off (pipe-friendly).

### 4.2 Standard fields (every HTTP event)

| Property | Source | Example |
|----------|--------|---------|
| `@t` | Auto (ISO timestamp) | Seq ingestion |
| `level` | Pino | `30` = info, `50` = error |
| `msg` | Human-readable | `request completed` |
| `RequestId` | Header `X-Request-Id` or UUID | `a1b2c3d4-...` |
| `Method` | `req.method` | `POST` |
| `Path` | `req.path` or route template | `/api/products` |
| `StatusCode` | `res.statusCode` | `403` |
| `DurationMs` | Timer | `142` |
| `Environment` | `NODE_ENV` / `APP_ENV` | `production` |
| `Service` | Constant | `apps/api` (`@shopynn/api`) |

### 4.3 Context fields (when available)

| Property | When |
|----------|------|
| `TenantId` | After auth middleware |
| `UserId` | After auth |
| `WarehouseId` | If scoped request |
| `Feature` | Feature-gate denials (`orders.create`, etc.) |
| `Code` | App error codes (`FEATURE_NOT_AVAILABLE`, `INSUFFICIENT_PERMISSIONS`) |

### 4.4 Error fields

| Property | When |
|----------|------|
| `err.message` | All handled/unhandled errors |
| `err.stack` | Server-side only (Seq), not client response |
| `PgCode` | PostgreSQL errors if applicable |

### 4.5 Never log

- Passwords, OTPs, refresh/access tokens, API keys.
- Full Paystack/webhook bodies (log `event` type + reference id only).
- Full `Authorization` header.
- Generated temporary passwords (remove existing `console.log` of plain passwords in `user.js` and similar).

**Prepare:** Quick grep before rollout: `password`, `token`, `secret`, `authorization`, `console.log` in `apps/api/src`.

---

## 5. Code changes outline (`apps/api` (`@shopynn/api`))

Work in this order when implementing.

### Phase A — Foundation (no Seq required)

1. Add dependencies: `pino`, `pino-http`.
2. Create `src/util/logger.js` — child loggers, redaction helpers.
3. Add **request ID** middleware (read `X-Request-Id` or generate; set on `req` and response header).
4. Replace `app.listen` bootstrap log with logger.
5. Update `errorhandler.js`:
   - Log `err` with `RequestId`, `Path`, stack.
   - Return generic message to client; optional `requestId` in JSON for support tickets.

### Phase B — Request logging

1. `pino-http` on `/api` routes (after body parser).
2. Log level: `info` for 2xx/3xx, `warn` for 4xx, `error` for 5xx.
3. Attach `TenantId` / `UserId` in a small middleware **after** auth (child logger on `req.log`).

### Phase C — Domain events (high value)

Add explicit `info` / `warn` events (not only HTTP):

| Area | Example `msg` | Properties |
|------|----------------|------------|
| Auth | `login failed` | `Email` (hashed or domain-only if policy requires) |
| Customer signup | `signup reference invalid` | `ReferenceCode` prefix only |
| Subscriptions | `feature not available` | `Feature`, `TenantId` |
| Payments | `paystack webhook received` | `Event`, `Reference` |
| Jobs | `subscription status job completed` | `Processed`, `Errors` |

Start with **errors + 403 feature gates + payment webhooks**; expand later.

### Phase D — Seq transport

1. Env vars (see §6).
2. Wire `@datalust/pino-seq-transport` when `SEQ_SERVER_URL` set.
3. Verify events in Seq UI from staging.

### Phase E — Cleanup

1. Remove or gate debug `console.log` in models/controllers.
2. Document support workflow: “get `RequestId` from user / response → search Seq”.

---

## 6. Environment variables (prepare values)

| Variable | Required | Example | Notes |
|----------|----------|---------|--------|
| `LOG_LEVEL` | No | `info` | `debug` only in dev |
| `SEQ_ENABLED` | No | `true` | Feature flag |
| `SEQ_SERVER_URL` | If enabled | `https://logs.example.com` | Seq base URL |
| `SEQ_API_KEY` | If enabled | *(ingestion key)* | From Seq → Settings → API keys |
| `APP_ENV` | Yes | `production` | Distinct from `NODE_ENV` if needed |

**Prepare:** Store keys in deployment secrets (not `.env` in git).

---

## 7. Seq server setup checklist (self-hosted Docker)

Use when you deploy Seq (can be done in parallel with Phase A).

- [ ] Provision VM or use existing server with HTTPS.
- [ ] Run official Seq Docker image; persist `/data` volume.
- [ ] Create **ingestion API key** (minimum permissions).
- [ ] Create **admin** accounts; enable auth on UI.
- [ ] Configure **retention** policy.
- [ ] Restrict firewall: UI admin IPs or VPN; ingestion from API server IP only if possible.
- [ ] Smoke test: send one manual event via `curl` or Seq CLI.
- [ ] Optional: **Signals** — e.g. `@Level = 'Error' and Environment = 'production'` count > threshold.

**Docker reference (adjust version pin):**

```bash
docker run -d --name seq -e ACCEPT_EULA=Y \
  -v seq-data:/data -p 5341:80 \
  datalust/seq
```

Production: put behind reverse proxy (Caddy/nginx) with TLS; do not expose plain HTTP publicly.

---

## 8. Client correlation (Cheqstock / ims-web)

Optional but valuable for support.

1. Generate UUID per API call (or per screen session).
2. Send header: `X-Request-Id: <uuid>` on axios requests (`apps/mobile/src/interceptors.js`).
3. Return same id in error JSON from API.
4. In Seq: `RequestId = '<uuid>'` shows full server story.

**Prepare:** Decide if mobile shows “Reference ID” on error alerts for users to report.

---

## 9. Useful Seq queries (save as favorites)

```sql
-- Errors last hour (production)
@Level in ['Error', 'Fatal'] and Environment = 'production'

-- One request
RequestId = 'paste-uuid-here'

-- Tenant issues
TenantId = 'tenant-uuid' and @Level = 'Error'

-- Feature gate denials
Code = 'FEATURE_NOT_AVAILABLE'

-- Slow requests (> 2s)
DurationMs > 2000 and Path like '/api/%'

-- 5xx by route
StatusCode >= 500
| select Path, count(*) as Count
| group by Path
| order by Count desc
```

---

## 10. Rollout plan

| Step | Environment | Action |
|------|-------------|--------|
| 1 | Local | Pino + stdout; optional local Seq container |
| 2 | Staging | `SEQ_ENABLED=true`; verify volume and queries |
| 3 | Staging | Load test light; check disk and retention |
| 4 | Production | Enable with `LOG_LEVEL=info`; monitor Signals |
| 5 | Production | Train support: RequestId workflow |

**Rollback:** Set `SEQ_ENABLED=false` — API falls back to stdout only; no code deploy required if transport is conditional.

---

## 11. Security and compliance

- [ ] Redaction list in logger for known sensitive keys (`password`, `token`, `authorization`, …).
- [ ] Seq UI behind HTTPS + strong passwords; 2FA if available.
- [ ] Ingestion key rotated periodically; separate keys per environment.
- [ ] Access policy: who may view production logs (PII in paths/query rare but possible).
- [ ] Align with customer data policy (Ghana / tenant data): retention and deletion expectations.

---

## 12. Pre-implementation grep (repo hygiene)

Run before enabling production Seq:

```bash
cd ims-services
rg -n "console\.(log|debug|info)" src --glob '!**/*.test.js'
rg -n "password|plainPassword|refresh_token|access_token" src -i
```

Fix or redact findings so they are not shipped to Seq.

---

## 13. Documentation to add after go-live

- [ ] Short “Support troubleshooting” section in internal wiki: RequestId → Seq query.
- [ ] Link from [PRODUCTION_TEST_CHECKLIST.md](./PRODUCTION_TEST_CHECKLIST.md): “verify Seq receives staging errors”.
- [ ] Runbook: Seq disk full, ingestion stopped, key rotation.

---

## 14. Implementation ticket breakdown (when ready)

| # | Task | Estimate |
|---|------|----------|
| 1 | Pino + logger util + request ID | Small |
| 2 | errorhandler + pino-http | Small |
| 3 | Auth context on `req.log` | Small |
| 4 | Seq Docker / Cloud + env vars | Medium |
| 5 | pino-seq-transport + staging verify | Small |
| 6 | High-value domain events (payments, signup, features) | Medium |
| 7 | Mobile `X-Request-Id` | Small |
| 8 | Console.log cleanup + docs | Medium |

---

## 15. References

- [Seq documentation](https://docs.datalust.co/docs)
- [Pino](https://getpino.io/)
- [@datalust/pino-seq-transport](https://www.npmjs.com/package/@datalust/pino-seq-transport)
- [Seq on Docker](https://docs.datalust.co/docs/install-docker)

---

*Last updated: planning outline for IMS modules monorepo. Revisit §3 decisions before starting Phase A.*
