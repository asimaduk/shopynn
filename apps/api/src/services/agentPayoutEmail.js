import { escapeHtml } from "../util/escapeHtml.js";

const NETWORK_LABEL = { mtn: "MTN", vodafone: "Telecel", airteltigo: "AirtelTigo" };

const money = (v) => `GH₵ ${Number(v || 0).toFixed(2)}`;

function maskedMomo(snapshot) {
    const number = String(snapshot?.momo_number || "");
    if (!number) return "your mobile money number";
    const network = NETWORK_LABEL[snapshot?.momo_network] || snapshot?.momo_network || "MoMo";
    return `${network} ${"•".repeat(Math.max(0, number.length - 4))}${number.slice(-4)}`;
}

function layout(heading, paragraphs) {
    return `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
            <h2 style="color:#0A74DA;margin-bottom:12px">${heading}</h2>
            ${paragraphs.map((p) => `<p style="line-height:1.6">${p}</p>`).join("\n")}
            <p style="color:#64748b">— The Shopynn team</p>
        </div>`;
}

/**
 * Email telling an agent what happened to a commission payout. Returns null for statuses that
 * do not notify (pending_approval, processing).
 * `payout`: merchant_payouts row; `agent`: { first_name }.
 */
export function buildAgentPayoutEmail(payout, agent = {}) {
    const name = agent.first_name || "there";
    const amount = money(payout.amount);
    const to = maskedMomo(payout.payout_snapshot);
    const count = Number(payout.commission_count || 0);
    const commissions = `${count} commission${count === 1 ? "" : "s"}`;

    if (payout.status === "paid") {
        return {
            subject: `Your ${amount} Shopynn commission has been paid`,
            text: `Hi ${name}, we sent ${amount} to ${to} for ${commissions}. It can take a few minutes to show on your phone. You can see all your payouts under Merchants > My earnings in the Shopynn app.`,
            html: layout("Your commission has been paid", [
                `Hi ${escapeHtml(name)},`,
                `We sent <strong>${amount}</strong> to <strong>${escapeHtml(to)}</strong> for ${commissions}. It can take a few minutes to show on your phone.`,
                "You can see all your payouts under <strong>Merchants › My earnings</strong> in the Shopynn app.",
            ]),
        };
    }
    if (payout.status === "failed") {
        return {
            subject: `Your ${amount} Shopynn payout did not go through`,
            text: `Hi ${name}, we tried to send ${amount} to ${to} but the transfer did not go through. Your commission is safe and we will try again. Please check your mobile money details under Merchants > My earnings in the Shopynn app.`,
            html: layout("Your payout did not go through", [
                `Hi ${escapeHtml(name)},`,
                `We tried to send <strong>${amount}</strong> to <strong>${escapeHtml(to)}</strong> but the transfer did not go through. Your commission is safe and we will try again.`,
                "Please check your mobile money number, network and account name under <strong>Merchants › My earnings</strong> in the Shopynn app. If they look right, just reply to this email.",
            ]),
        };
    }
    if (payout.status === "rejected") {
        const reason = String(payout.failure_reason || "").trim();
        return {
            subject: `Your ${amount} Shopynn payout was held back`,
            text: `Hi ${name}, your ${amount} payout was held back this week${reason ? `: ${reason}` : "."} The commission stays on your balance and is normally included in the next weekly payout. Reply to this email if you have questions.`,
            html: layout("Your payout was held back", [
                `Hi ${escapeHtml(name)},`,
                `Your <strong>${amount}</strong> payout was held back this week${reason ? `: ${escapeHtml(reason)}` : "."}`,
                "The commission stays on your balance and is normally included in the next weekly payout. Reply to this email if you have questions.",
            ]),
        };
    }
    return null;
}
