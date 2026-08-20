import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"FourDee ERP" <${user || "noreply@fourdeemotionpicture.com"}>`;

  const logMessage = `
========================================
EMAIL LOG: ${new Date().toISOString()}
To: ${to}
Subject: ${subject}
----------------------------------------
${html}
========================================
`;

  // Fallback: Always log to a local file in the project for debugging
  try {
    const logDir = path.join(process.cwd(), "biometric_bridge");
    if (fs.existsSync(logDir)) {
      fs.appendFileSync(path.join(logDir, "email_logs.txt"), logMessage);
    }
  } catch (err) {
    console.error("Failed to write local email log:", err);
  }

  // If credentials are not set, just print to console
  if (!host || !user || !pass) {
    console.log("[EMAIL SENDER FALLBACK] SMTP not configured. Logged email to biometric_bridge/email_logs.txt");
    return { success: true, logged: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    console.log("Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Nodemailer sendMail error:", error);
    return { success: false, error };
  }
}
