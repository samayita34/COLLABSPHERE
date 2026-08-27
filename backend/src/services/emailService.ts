import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

/**
 * Build and cache a Nodemailer transporter.
 * Priority:
 *   1. Real SMTP — if SMTP_HOST + SMTP_USER + SMTP_PASS are set in env.
 *   2. Ethereal test account — auto-generated for development / demo.
 *      Sent emails are viewable at https://ethereal.email (preview URL is logged).
 */
async function initTransporter(): Promise<nodemailer.Transporter> {
    if (transporter) return transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        // --- Real SMTP (e.g. Gmail, SendGrid, Mailgun, Zoho) ---
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT || "587", 10),
            secure: SMTP_SECURE === "true", // true for port 465
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });
        console.log(`[Email] Real SMTP transporter configured → ${SMTP_HOST}:${SMTP_PORT || 587}`);
    } else {
        // --- Ethereal fallback (dev / demo) ---
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log("[Email] Ethereal test transporter configured (no real emails sent).");
        console.log(`[Email] Ethereal credentials → user: ${testAccount.user}`);
    }

    return transporter;
}

/**
 * Send an email. Falls back gracefully — never throws, only logs errors.
 */
export const sendEmail = async (
    to: string,
    subject: string,
    text: string,
    html: string
): Promise<void> => {
    try {
        const mailer = await initTransporter();
        const from = process.env.SMTP_FROM_NAME
            ? `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL || "noreply@collabsphere.com"}>`
            : '"COLLABSPHERE" <noreply@collabsphere.com>';

        const info = await mailer.sendMail({ from, to, subject, text, html });

        console.log(`[Email] Sent → ${to} | Subject: "${subject}" | id: ${info.messageId}`);

        // Log Ethereal preview link (only available for Ethereal transports)
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`[Email] Preview URL (Ethereal): ${previewUrl}`);
        }
    } catch (error) {
        // Non-blocking: log but don't crash the calling controller
        console.error("[Email] Failed to send email:", error);
    }
};
