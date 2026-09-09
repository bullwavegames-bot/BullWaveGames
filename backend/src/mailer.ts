import { config } from "./config.js";
import { logger } from "./logger.js";

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!config.smtpUrl) {
    logger.info({ to, subject, text }, "mail.log");
    return;
  }
  const { default: nodemailer } = await import("nodemailer");
  const transporter = nodemailer.createTransport(config.smtpUrl);
  await transporter.sendMail({ from: config.mailFrom, to, subject, text });
}
