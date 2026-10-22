import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
dotenv.config();

import errorhandling from "./middleware/errorhandler.js";
import indexroute from "./routes/index.js";
import { startSubscriptionStatusJob } from "./jobs/subscriptionStatusJob.js";
import { startDailySalesSummaryNotificationJob } from "./jobs/dailySalesSummaryNotificationJob.js";
import { startAgentPayoutJob } from "./jobs/agentPayoutJob.js";
import { ensureBillingCatalogSeededService } from "./models/billingCatalog.js";
import { backfillOrderSalesService } from "./models/orderSale.js";

const app = express();
// Railway terminates TLS in front of us; trust its one proxy hop so req.ip is the client.
app.set("trust proxy", 1);
// Railway injects PORT; fall back to APP_PORT for local/Docker.
const port = Number(process.env.PORT || process.env.APP_PORT || 4000);

//middlewares
// Keep the raw body: Paystack webhook signatures are computed over the exact bytes.
app.use(
    express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    })
);
app.disable("x-powered-by");
// API images are embedded by the web and site origins, so resources must be loadable cross-origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const DEFAULT_CORS_ORIGINS = [
    "https://dashboard.shopynn.app",
    "https://admin-shopynn.vercel.app",
    "https://shopynn.vercel.app",
    "https://shopynn.app",
    "https://www.shopynn.app",
];
const corsOrigins = new Set(
    (process.env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS.join(","))
        .split(",")
        .map((o) => o.trim().replace(/\/$/, ""))
        .filter(Boolean)
);
const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
// Requests without an Origin (mobile app, webhooks, server-to-server) are not CORS requests.
app.use(
    cors({
        origin: (origin, cb) =>
            cb(
                null,
                !origin ||
                    corsOrigins.has(origin) ||
                    (process.env.NODE_ENV !== "production" && isLocalOrigin(origin))
            ),
    })
);

// health (Railway / load balancers)
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

//route
app.use('/api',indexroute)

//error handlers
app.use(errorhandling);

startSubscriptionStatusJob();
startDailySalesSummaryNotificationJob();
startAgentPayoutJob();
// Self-heal empty billing catalog after data restores (migrations already applied).
ensureBillingCatalogSeededService().catch((err) => {
    console.error("startup billing catalog ensure failed:", err?.message || err);
});

backfillOrderSalesService().catch((err) => {
    console.error("startup order sales backfill failed:", err?.message || err);
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port ${port}`);
});
