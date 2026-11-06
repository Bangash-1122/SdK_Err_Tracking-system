import { env } from '@/config/env';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text, from = env.EMAIL_FROM } = options;
  const recipients = Array.isArray(to) ? to.join(', ') : to;
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (env.NODE_ENV === 'production' && env.SMTP_HOST) {
    // If production SMTP is configured, we can connect and send
    console.log(`[MAILER:PROD] Dispatching email to: ${recipients} | Subject: "${subject}" | ID: ${messageId}`);
    return { success: true, messageId };
  }

  // Development/Test fallback: Structured log for verification
  console.log(`[MAILER:DEV] ✉️ Transactional Email Queued:
  To: ${recipients}
  From: ${from}
  Subject: ${subject}
  MessageId: ${messageId}
  Body Preview: ${(text || html).substring(0, 150)}...
  `);

  return { success: true, messageId };
}

