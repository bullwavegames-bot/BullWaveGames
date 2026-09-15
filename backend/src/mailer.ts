import { config } from "./config.js";
import { logger } from "./logger.js";
import { sql } from './db.js';

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!config.smtpUrl) {
    if (config.isProd) throw new Error('SMTP is required to deliver application email.');
    logger.info({ subject }, "Email delivery skipped: SMTP is not configured");
    return;
  }
  await sql`INSERT INTO email_outbox (recipient, subject, body) VALUES (${to}, ${subject}, ${text})`;
}

type MailDelivery = (message: { from: string; to: string; subject: string; text: string; messageId: string }) => Promise<unknown>;

export async function processEmailJobs(deliverOverride?: MailDelivery): Promise<void> {
  // Expired and terminal mail must not retain authentication links or addresses.
  await sql`UPDATE email_outbox SET status = 'dead_letter', body = '', recipient = ''
    WHERE expires_at <= now() AND status IN ('pending', 'failed')`;
  await sql`DELETE FROM email_outbox WHERE created_at < now() - interval '7 days' AND status IN ('completed', 'dead_letter')`;
  if (!config.smtpUrl && !deliverOverride) return;
  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({ url: config.smtpUrl,
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
  });
  try {
    // One lock at a time keeps the transaction and shutdown delay bounded.
    for (let i = 0; i < 10; i++) {
      const found = await sql.begin(async tx => {
        const [job] = await tx`SELECT * FROM email_outbox
          WHERE status IN ('pending', 'failed') AND next_attempt_at <= now() AND expires_at > now()
          ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`;
        if (!job) return false;
        try {
          await (deliverOverride ?? ((message) => transporter.sendMail(message)))({ from: config.mailFrom, to: job.recipient,
            subject: job.subject, text: job.body, messageId: `<${job.id}@bullwavegames.com>` });
          await tx`UPDATE email_outbox SET status = 'completed', completed_at = now(), body = '', recipient = '' WHERE id = ${job.id}`;
        } catch {
          const attempts = Number(job.attempt_count) + 1;
          const dead = attempts >= 5;
          await tx`UPDATE email_outbox SET attempt_count = ${attempts}, status = ${dead ? 'dead_letter' : 'failed'},
            next_attempt_at = now() + ${Math.min(900, 30 * 2 ** (attempts - 1))} * interval '1 second',
            body = CASE WHEN ${dead} THEN '' ELSE body END,
            recipient = CASE WHEN ${dead} THEN '' ELSE recipient END WHERE id = ${job.id}`;
          logger.warn({ emailJobId: job.id, attempts }, 'Email delivery failed; retry state recorded');
        }
        return true;
      });
      if (!found) break;
    }
  } finally {
    transporter.close();
  }
}
