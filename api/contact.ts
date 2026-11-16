import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

// Helper to escape HTML characters in user input to prevent injection in emails
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates the branded HTML email for the Admin Notification.
 * Styled in 0Touch's signature neo-brutalist aesthetic (lavender header, coral badge, solid black borders & shadows).
 */
export function buildAdminEmailHtml(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
}): string {
  const safeName = escapeHtml(params.name);
  const safeEmail = escapeHtml(params.email);
  const safeSubject = escapeHtml(params.subject);
  const safeMessage = escapeHtml(params.message).replace(/\n/g, '<br/>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New 0Touch Contact Submission</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #27272a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4fb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 3px solid #27272a; box-shadow: 6px 6px 0px #27272a;">
          
          <!-- Header Banner (0Touch Lavender) -->
          <tr>
            <td style="background-color: #6f7bd4; padding: 24px; border-bottom: 3px solid #27272a;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <!-- Pill Tag -->
                    <span style="display: inline-block; background-color: #ff8066; color: #27272a; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border: 2px solid #27272a; box-shadow: 2px 2px 0px #27272a; margin-bottom: 12px;">
                      ADMIN NOTIFICATION
                    </span>
                    <h1 style="margin: 8px 0 0 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1;">
                      New Contact Inquiry
                    </h1>
                    <p style="margin: 6px 0 0 0; color: #ebedf9; font-size: 13px; font-weight: 500;">
                      Submitted via 0Touch Web Application &bull; ${params.timestamp}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px;">
              <!-- Metadata Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f7f7f9; border: 2px solid #27272a; box-shadow: 3px 3px 0px #27272a; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; width: 90px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #71717a; letter-spacing: 0.05em;">From:</td>
                        <td style="padding: 6px 0; font-size: 14px; font-weight: 700; color: #18181b;">${safeName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; width: 90px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #71717a; letter-spacing: 0.05em;">Email:</td>
                        <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #27272a;">
                          <a href="mailto:${safeEmail}" style="color: #6f7bd4; text-decoration: underline;">${safeEmail}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; width: 90px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #71717a; letter-spacing: 0.05em;">Subject:</td>
                        <td style="padding: 6px 0; font-size: 14px; font-weight: 700; color: #18181b;">
                          <span style="display: inline-block; background-color: #ffffff; padding: 2px 8px; border: 1.5px solid #27272a;">
                            ${safeSubject}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Message Section -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #27272a; margin-bottom: 8px;">
                  VISITOR MESSAGE
                </div>
                <div style="background-color: #ffffff; border: 2px solid #27272a; padding: 20px; box-shadow: 3px 3px 0px #27272a; font-size: 15px; line-height: 1.6; color: #18181b;">
                  ${safeMessage}
                </div>
              </div>

              <!-- Action Button (0Touch Pill Button Style) -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px;">
                <tr>
                  <td>
                    <a href="mailto:${safeEmail}?subject=Re: ${encodeURIComponent(params.subject)}"
                       style="display: inline-block; background-color: #ffa694; color: #27272a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 24px; border: 2px solid #27272a; text-decoration: none; border-radius: 9999px; box-shadow: 2px 2px 0px #27272a;">
                      Reply Directly &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Tip note -->
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #d4d4d8; font-size: 12px; color: #71717a;">
                Replying directly to this email will route your reply to <strong>${safeName}</strong> (&lt;${safeEmail}&gt;) via the <code>reply-to</code> header.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #18181b; padding: 20px 28px; border-top: 3px solid #27272a; color: #a1a1aa; font-size: 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-weight: 800; color: #ffffff; font-size: 14px;">
                    0TOUCH
                  </td>
                  <td align="right" style="color: #a1a1aa;">
                    Touchless Medical Imaging Interface
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates the branded HTML email for the Visitor Confirmation receipt.
 * Styled in 0Touch's signature neo-brutalist aesthetic (lavender header, coral accents, solid black borders & shadows).
 */
export function buildVisitorEmailHtml(params: {
  name: string;
  subject: string;
  timestamp: string;
}): string {
  const safeName = escapeHtml(params.name);
  const safeSubject = escapeHtml(params.subject);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We received your message — 0Touch</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #27272a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4fb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 3px solid #27272a; box-shadow: 6px 6px 0px #27272a;">
          
          <!-- Header Banner (0Touch Lavender) -->
          <tr>
            <td style="background-color: #6f7bd4; padding: 28px; border-bottom: 3px solid #27272a;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <!-- Pill Tag -->
                    <span style="display: inline-block; background-color: #ff8066; color: #27272a; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border: 2px solid #27272a; box-shadow: 2px 2px 0px #27272a; margin-bottom: 12px;">
                      MESSAGE RECEIVED
                    </span>
                    <h1 style="margin: 8px 0 0 0; color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1;">
                      Thank You for Reaching Out
                    </h1>
                    <p style="margin: 6px 0 0 0; color: #ebedf9; font-size: 13px; font-weight: 500;">
                      0Touch &bull; Contact Confirmation
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #18181b;">
                Hi <strong>${safeName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #3f3f46;">
                Thank you for your interest in <strong>0Touch</strong>. We have received your inquiry regarding <strong>${safeSubject}</strong> and our team is reviewing it.
              </p>

              <!-- Confirmation Details Box -->
              <div style="background-color: #f7f7f9; border: 2px solid #27272a; padding: 20px; box-shadow: 3px 3px 0px #27272a; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; margin-bottom: 12px;">
                  INQUIRY SUMMARY
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding: 4px 0; width: 110px; font-size: 13px; font-weight: 700; color: #52525b;">Topic:</td>
                    <td style="padding: 4px 0; font-size: 14px; font-weight: 800; color: #18181b;">${safeSubject}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; width: 110px; font-size: 13px; font-weight: 700; color: #52525b;">Received At:</td>
                    <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #27272a;">${params.timestamp}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; width: 110px; font-size: 13px; font-weight: 700; color: #52525b;">Status:</td>
                    <td style="padding: 4px 0; font-size: 13px; font-weight: 700; color: #059669;">&check; Received &amp; Queued</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #52525b;">
                We typically respond within 1&ndash;2 business days. If your inquiry is urgent or technical, feel free to reply directly to this email with additional context.
              </p>

              <!-- Explore Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0 12px 0;">
                <tr>
                  <td>
                    <a href="https://zerotouch.vercel.app"
                       style="display: inline-block; background-color: #ffa694; color: #27272a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 24px; border: 2px solid #27272a; text-decoration: none; border-radius: 9999px; box-shadow: 2px 2px 0px #27272a;">
                      Explore 0Touch &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #18181b; padding: 20px 28px; border-top: 3px solid #27272a; color: #a1a1aa; font-size: 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-weight: 800; color: #ffffff; font-size: 14px;">
                    0TOUCH
                  </td>
                  <td align="right" style="color: #a1a1aa;">
                    Touchless Medical Imaging Interface
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured in environment variables.');
    return res.status(500).json({
      error: 'Server email configuration error: RESEND_API_KEY is missing.',
    });
  }

  const { name, email, subject, message } = req.body || {};

  // Input validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Please provide your name.' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Please provide your email address.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Please provide a message.' });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : 'General Inquiry';
  const cleanMessage = message.trim();

  // Admin recipient: configured via RESEND_TO_EMAIL or fallback to verified account email
  const adminRecipient = process.env.RESEND_TO_EMAIL || 'saipraveenamujuri@gmail.com';

  const resend = new Resend(apiKey);
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }) + ' UTC';

  // 1. Prepare Email 1: Admin Notification
  const adminHtml = buildAdminEmailHtml({
    name: cleanName,
    email: cleanEmail,
    subject: cleanSubject,
    message: cleanMessage,
    timestamp,
  });

  // 2. Prepare Email 2: Visitor Confirmation
  const visitorHtml = buildVisitorEmailHtml({
    name: cleanName,
    subject: cleanSubject,
    timestamp,
  });

  try {
    // Dispatch Email 1: Admin Notification
    const adminResult = await resend.emails.send({
      from: '0Touch Inquiries <onboarding@resend.dev>',
      to: [adminRecipient],
      replyTo: cleanEmail,
      subject: `[0Touch Contact] ${cleanSubject} - ${cleanName}`,
      text: `New 0Touch Contact Submission:\n\nName: ${cleanName}\nEmail: ${cleanEmail}\nSubject: ${cleanSubject}\nDate: ${timestamp}\n\nMessage:\n${cleanMessage}\n`,
      html: adminHtml,
    });

    if (adminResult.error) {
      console.error('Failed to send admin notification:', adminResult.error);
      return res.status(400).json({
        error: `Admin notification failed: ${adminResult.error.message}`,
      });
    }

    // Dispatch Email 2: Visitor Confirmation
    // Note on Resend testing mode:
    // If the visitor's email matches the verified account email, Resend delivers it immediately.
    // If the visitor's email is an unverified external address in testing mode, Resend rejects sending
    // with a specific recipient restriction error. We catch and report this accurately without falsely
    // claiming the external confirmation was delivered.
    let visitorEmailSent = false;
    let visitorEmailNote = '';

    const visitorResult = await resend.emails.send({
      from: '0Touch Team <onboarding@resend.dev>',
      to: [cleanEmail],
      subject: 'We received your message — 0Touch',
      text: `Hi ${cleanName},\n\nThank you for reaching out to 0Touch! We have received your inquiry regarding "${cleanSubject}".\n\nOur team is reviewing your message and will get back to you shortly.\n\nBest regards,\nThe 0Touch Team`,
      html: visitorHtml,
    });

    if (visitorResult.error) {
      console.warn('Visitor confirmation email could not be delivered:', visitorResult.error.message);
      // In testing mode without a custom domain, Resend prevents sending to non-account emails
      visitorEmailNote = `Admin notification delivered. Visitor confirmation not delivered due to Resend testing-mode restriction: ${visitorResult.error.message}`;
    } else {
      visitorEmailSent = true;
    }

    return res.status(200).json({
      success: true,
      adminEmailId: adminResult.data?.id,
      visitorEmailSent,
      visitorEmailId: visitorResult.data?.id || null,
      note: visitorEmailNote || undefined,
    });
  } catch (error: any) {
    console.error('Unexpected error during Resend email dispatch:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to send emails. Please try again later.',
    });
  }
}
