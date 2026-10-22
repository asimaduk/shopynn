import cron from "node-cron";
import { prepareAgentPayoutsService } from "../models/agentPayout.js";

const AGENT_PAYOUT_CRON = "0 6 * * 1"; // Mondays 6:00 AM (server time; Ghana is UTC)

/** Prepares the weekly agent payouts; an admin still approves each one before money moves. */
export const startAgentPayoutJob = () => {
    cron.schedule(AGENT_PAYOUT_CRON, async () => {
        try {
            const result = await prepareAgentPayoutsService();
            console.log(
                `[agent-payout-job] Prepared ${result.created.length} payout(s); ${result.skipped_no_profile.length} agent(s) skipped without MoMo details.`
            );
        } catch (error) {
            console.error("[agent-payout-job] Failed:", error);
        }
    });
    console.log("[agent-payout-job] Scheduled weekly payout preparation on Mondays at 6:00 AM.");
};
