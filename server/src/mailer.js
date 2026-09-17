import nodemailer from "nodemailer";

const { BREVO_SMTP_LOGIN, BREVO_SMTP_KEY, BREVO_FROM, BREVO_FROM_NAME, RESEND_API_KEY, RESEND_FROM, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

const gmailTransporter =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })
    : null;

const brevoTransporter =
  BREVO_SMTP_LOGIN && BREVO_SMTP_KEY
    ? nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: { user: BREVO_SMTP_LOGIN, pass: BREVO_SMTP_KEY },
      })
    : null;

async function sendViaResend({ to, subject, text }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM || "Barangay Campagao <onboarding@resend.dev>",
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}

export async function sendCredentialsEmail({ to, name, email, password }) {
  const subject = "Your Barangay Campagao account is ready";
  const text = `Hi ${name},\n\nYour Barangay Campagao account has been approved. You can now log in with:\n\nEmail: ${email}\nTemporary Password: ${password}\n\nPlease sign in and change your password from your dashboard's Settings page.\n\n- Barangay Campagao`;

  if (brevoTransporter) {
    const from = BREVO_FROM_NAME ? `"${BREVO_FROM_NAME}" <${BREVO_FROM}>` : BREVO_FROM;
    await brevoTransporter.sendMail({ from, to, subject, text });
    return { sent: true, via: "brevo" };
  }

  if (RESEND_API_KEY) {
    await sendViaResend({ to, subject, text });
    return { sent: true, via: "resend" };
  }

  if (gmailTransporter) {
    await gmailTransporter.sendMail({ from: GMAIL_USER, to, subject, text });
    return { sent: true, via: "gmail" };
  }

  console.log(`[mailer] No email provider configured (BREVO_SMTP_LOGIN/BREVO_SMTP_KEY, RESEND_API_KEY, or GMAIL_USER/GMAIL_APP_PASSWORD) — would have emailed ${to}:\n${text}`);
  return { sent: false };
}

export async function sendPasswordResetEmail({ to, name, email, password }) {
  const subject = "Your Barangay Campagao password has been reset";
  const text = `Hi ${name},\n\nYour Barangay Campagao account password has been reset by the barangay office. You can now log in with:\n\nEmail: ${email}\nTemporary Password: ${password}\n\nPlease sign in and change your password from your dashboard's Settings page.\n\n- Barangay Campagao`;

  if (brevoTransporter) {
    const from = BREVO_FROM_NAME ? `"${BREVO_FROM_NAME}" <${BREVO_FROM}>` : BREVO_FROM;
    await brevoTransporter.sendMail({ from, to, subject, text });
    return { sent: true, via: "brevo" };
  }

  if (RESEND_API_KEY) {
    await sendViaResend({ to, subject, text });
    return { sent: true, via: "resend" };
  }

  if (gmailTransporter) {
    await gmailTransporter.sendMail({ from: GMAIL_USER, to, subject, text });
    return { sent: true, via: "gmail" };
  }

  console.log(`[mailer] No email provider configured — would have emailed ${to}:\n${text}`);
  return { sent: false };
}
