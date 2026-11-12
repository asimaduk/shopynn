import { escapeHtml } from "../util/escapeHtml.js";
import {
    button,
    codeBlock,
    detailsTable,
    greeting,
    notice,
    paragraph,
    renderEmail,
    signInUrl,
    signoff,
    steps,
} from "./emailLayout.js";

/** Each builder returns { subject, html, text } for sendEmailService. */

export function buildPasswordResetEmail({ firstName, email, temporaryPassword, expiresInMinutes = 30 }) {
    const name = firstName || "there";
    return {
        subject: "Your Shopynn temporary password",
        html: renderEmail({
            heading: "Reset your password",
            preheader: `Your temporary password expires in ${expiresInMinutes} minutes.`,
            body: [
                greeting(name),
                paragraph("We received a request to reset the password for your Shopynn account. Use this temporary password to sign in:"),
                detailsTable([
                    ["Email", escapeHtml(email)],
                    ["Temporary password", escapeHtml(temporaryPassword), { mono: true }],
                ]),
                paragraph(`This password expires in <strong>${expiresInMinutes} minutes</strong>. You'll be asked to choose a new password as soon as you sign in.`),
                button(signInUrl(), "Sign in to Shopynn"),
                notice(
                    "Didn't ask for this? You can ignore this email. Your current password keeps working until someone signs in with the temporary one.",
                    "warning",
                ),
                signoff(),
            ],
        }),
        text: [
            `Hi ${name},`,
            "",
            "We received a request to reset the password for your Shopynn account. Use this temporary password to sign in:",
            "",
            `Email: ${email}`,
            `Temporary password: ${temporaryPassword}`,
            "",
            `This password expires in ${expiresInMinutes} minutes. You'll be asked to choose a new password as soon as you sign in.`,
            `Sign in: ${signInUrl()}`,
            "",
            "Didn't ask for this? You can ignore this email. Your current password keeps working until someone signs in with the temporary one.",
            "",
            "Regards,",
            "The Shopynn team",
        ].join("\n"),
    };
}

/** Login details for a staff member or field agent whose account someone else created. */
export function buildAccountCredentialsEmail({ firstName, email, temporaryPassword, expiresIn = "30 minutes", accountKind = "account" }) {
    const name = firstName || "there";
    const isAgent = accountKind === "agent";
    const intro = isAgent
        ? "Your Shopynn field agent account has been approved. Here are your sign-in details:"
        : "A Shopynn account has been created for you. Here are your sign-in details:";
    const afterExpiry = isAgent ? ' If it expires, use "Forgot password" on the sign-in screen.' : "";
    return {
        subject: isAgent ? "Your Shopynn agent account is ready" : "Your Shopynn account is ready",
        html: renderEmail({
            heading: isAgent ? "Welcome to the Shopynn agent team" : "Your account is ready",
            preheader: "Your sign-in details are inside.",
            body: [
                greeting(name),
                paragraph(intro),
                detailsTable([
                    ["Email", escapeHtml(email)],
                    ["Temporary password", escapeHtml(temporaryPassword), { mono: true }],
                ]),
                paragraph(`For your security, this temporary password expires in <strong>${expiresIn}</strong> and must be changed when you first sign in.${afterExpiry}`),
                button(signInUrl(), "Sign in to Shopynn"),
                paragraph("You can also sign in from the Shopynn mobile app with the same details.", { muted: true, small: true }),
                notice("Weren't expecting this? Contact Shopynn support right away.", "warning"),
                signoff(),
            ],
        }),
        text: [
            `Hi ${name},`,
            "",
            intro,
            "",
            `Email: ${email}`,
            `Temporary password: ${temporaryPassword}`,
            "",
            `For your security, this temporary password expires in ${expiresIn} and must be changed when you first sign in.${afterExpiry}`,
            `Sign in: ${signInUrl()}`,
            "",
            "Weren't expecting this? Contact Shopynn support right away.",
            "",
            "Regards,",
            "The Shopynn team",
        ].join("\n"),
    };
}

const CODE_PURPOSES = {
    signup: {
        subject: "Verify your email for Shopynn",
        heading: "Verify your email",
        intro: "Enter this code to verify your email and finish setting up your shop:",
        warning: "If you didn't start a Shopynn signup, you can ignore this email.",
    },
    change_email: {
        subject: "Confirm your new Shopynn email",
        heading: "Confirm your new email",
        intro: "Enter this code to confirm this as your new Shopynn email address:",
        warning: "If you didn't ask to change your email, you can ignore this email. Your account email stays the same.",
    },
    step_up: {
        subject: "Your Shopynn security code",
        heading: "Confirm it's you",
        intro: "Enter this code to confirm a withdrawal or a change to your payout details:",
        warning: "If you didn't ask for this code, someone may know your password. Change your password now.",
        tone: "warning",
    },
};

export function buildVerificationCodeEmail({ purpose, code, expiresInMinutes = 10 }) {
    const p = CODE_PURPOSES[purpose];
    if (!p) throw new Error(`Unknown verification email purpose: ${purpose}`);
    return {
        subject: p.subject,
        html: renderEmail({
            heading: p.heading,
            preheader: `Your code is ${code}. It expires in ${expiresInMinutes} minutes.`,
            body: [
                paragraph(p.intro),
                codeBlock(code, `Expires in ${expiresInMinutes} minutes`),
                paragraph("Never share this code with anyone. Shopynn staff will never ask for it.", { muted: true, small: true }),
                notice(p.warning, p.tone),
            ],
        }),
        text: [
            p.intro,
            "",
            code,
            "",
            `This code expires in ${expiresInMinutes} minutes. Never share it with anyone; Shopynn staff will never ask for it.`,
            "",
            p.warning,
        ].join("\n"),
    };
}

export function buildWelcomeEmail({ firstName, email, shopName, planLabel, isActive, endsOn }) {
    const name = firstName || "there";
    const shop = shopName || "Your shop";
    const plan = escapeHtml(planLabel);
    const planHtml = isActive
        ? `Your <strong>${plan}</strong> plan is active${endsOn ? ` until <strong>${escapeHtml(endsOn)}</strong>` : ""}.`
        : `Your <strong>${plan}</strong> plan is reserved. Open <strong>Subscription</strong> in the app to pay and activate it.`;
    const planText = isActive
        ? `Your ${planLabel} plan is active${endsOn ? ` until ${endsOn}` : ""}.`
        : `Your ${planLabel} plan is reserved. Open Subscription in the app to pay and activate it.`;
    const gettingStarted = [
        "Add your products, or import them in bulk from Inventory.",
        "Record the stock you buy under Purchases.",
        "Make your first sale and share the receipt on WhatsApp.",
        "Add your staff and give each person the right role.",
    ];
    return {
        subject: `Welcome to Shopynn, ${name}!`,
        html: renderEmail({
            heading: `Welcome to Shopynn, ${name}!`,
            preheader: `${shop} is set up and ready to go.`,
            body: [
                paragraph(`<strong>${escapeHtml(shop)}</strong> is set up and ready to go.`),
                detailsTable([
                    ["Sign-in email", escapeHtml(email)],
                    ["Plan", planHtml],
                ]),
                paragraph("<strong>Get started in a few minutes:</strong>"),
                steps(gettingStarted),
                button(signInUrl(), "Open Shopynn"),
                paragraph("Sign in with the password you chose at signup. Questions? Just reply to this email and we'll help."),
                signoff(),
            ],
        }),
        text: [
            `Hi ${name}, welcome to Shopynn.`,
            "",
            `${shop} is set up and ready to go. Sign in with ${email} and the password you chose at signup.`,
            planText,
            "",
            "Get started:",
            ...gettingStarted.map((s, i) => `${i + 1}. ${s}`),
            "",
            `Open Shopynn: ${signInUrl()}`,
            "",
            "Questions? Just reply to this email.",
            "The Shopynn team",
        ].join("\n"),
    };
}
