import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { Resend } from 'resend';
import { buildAdminEmailHtml, buildVisitorEmailHtml } from './api/contact';

function resendApiPlugin(): Plugin {
  return {
    name: 'resend-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/contact', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Method ${req.method} Not Allowed` }));
          return;
        }

        const env = loadEnv('development', process.cwd(), '');
        const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;

        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'Server email configuration error: RESEND_API_KEY is missing from environment.',
            })
          );
          return;
        }

        let bodyRaw = '';
        req.on('data', (chunk) => {
          bodyRaw += chunk;
        });

        req.on('end', async () => {
          try {
            const body = bodyRaw ? JSON.parse(bodyRaw) : {};
            const { name, email, subject, message } = body;

            if (!name || typeof name !== 'string' || !name.trim()) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Please provide your name.' }));
              return;
            }

            if (!email || typeof email !== 'string' || !email.trim()) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Please provide your email address.' }));
              return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Please provide a valid email address.' }));
              return;
            }

            if (!message || typeof message !== 'string' || !message.trim()) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Please provide a message.' }));
              return;
            }

            const cleanName = name.trim();
            const cleanEmail = email.trim();
            const cleanSubject =
              typeof subject === 'string' && subject.trim() ? subject.trim() : 'General Inquiry';
            const cleanMessage = message.trim();

            const adminRecipient =
              env.RESEND_TO_EMAIL || process.env.RESEND_TO_EMAIL || 'saipraveenamujuri@gmail.com';

            const resend = new Resend(apiKey);
            const timestamp =
              new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'UTC',
              }) + ' UTC';

            // Build HTML emails
            const adminHtml = buildAdminEmailHtml({
              name: cleanName,
              email: cleanEmail,
              subject: cleanSubject,
              message: cleanMessage,
              timestamp,
            });

            const visitorHtml = buildVisitorEmailHtml({
              name: cleanName,
              subject: cleanSubject,
              timestamp,
            });

            // 1. Send Admin Notification
            const adminResult = await resend.emails.send({
              from: '0Touch Inquiries <onboarding@resend.dev>',
              to: [adminRecipient],
              replyTo: cleanEmail,
              subject: `[0Touch Contact] ${cleanSubject} - ${cleanName}`,
              text: `New 0Touch Contact Submission:\n\nName: ${cleanName}\nEmail: ${cleanEmail}\nSubject: ${cleanSubject}\nDate: ${timestamp}\n\nMessage:\n${cleanMessage}\n`,
              html: adminHtml,
            });

            if (adminResult.error) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: `Admin notification failed: ${adminResult.error.message}`,
                })
              );
              return;
            }

            // 2. Send Visitor Confirmation
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
              visitorEmailNote = `Admin notification delivered. Visitor confirmation not delivered due to Resend testing-mode restriction: ${visitorResult.error.message}`;
            } else {
              visitorEmailSent = true;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                adminEmailId: adminResult.data?.id,
                visitorEmailSent,
                visitorEmailId: visitorResult.data?.id || null,
                note: visitorEmailNote || undefined,
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), resendApiPlugin()],
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader'],
  },
});
