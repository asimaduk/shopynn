import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import errorhandling from "./middleware/errorhandler.js";
import indexroute from "./routes/index.js";
import { startSubscriptionStatusJob } from "./jobs/subscriptionStatusJob.js";
import { startDailySalesSummaryNotificationJob } from "./jobs/dailySalesSummaryNotificationJob.js";

const app = express();
// Railway injects PORT; fall back to APP_PORT for local/Docker.
const port = Number(process.env.PORT || process.env.APP_PORT || 4000);

//middlewares
app.use(express.json());
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

app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port ${port}`);
});
