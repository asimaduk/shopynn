import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import errorhandling from "./middleware/errorhandler.js";
import indexroute from "./routes/index.js";
import { startSubscriptionStatusJob } from "./jobs/subscriptionStatusJob.js";
import { startDailySalesSummaryNotificationJob } from "./jobs/dailySalesSummaryNotificationJob.js";
import { ensureBillingCatalogSeededService } from "./models/billingCatalog.js";

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
app.use(cors());

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
// Self-heal empty billing catalog after data restores (migrations already applied).
ensureBillingCatalogSeededService().catch((err) => {
    console.error("startup billing catalog ensure failed:", err?.message || err);
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port ${port}`);
});
