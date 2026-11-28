/**
 * Transactional Account & Admin Notification Mailer
 * - Notifies admin@devinquire.com whenever a new user signs up for workspace access
 * - Sends approval / rejection confirmation emails directly to the requested person
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ADMIN_EMAIL = 'admin@devinquire.com';
const DEFAULT_WEB3FORMS_KEY = '803e30e6-5c54-4cae-9406-8d13bcf3d8e9';
const ACCESS_MAIL_SETTING_KEY = 'access_email_config';
const ACCESS_MAIL_LOGS_KEY = 'access_email_dispatch_logs';

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function readDashboardEnvFallback() {
    const candidates = [
        path.join(__dirname, '.env'),
        path.join(__dirname, '../.env')
    ];
    const merged = {};
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                Object.assign(merged, dotenv.parse(fs.readFileSync(p, 'utf8')));
            }
        } catch {
            // ignore unreadable env files
        }
    }
    return merged;
}

export async function loadAccountMailConfig() {
    let sqlAccessCfg = {};
    try {
        const res = await db.query(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'access_email_config' LIMIT 1"
        );
        const raw = res.rows?.[0]?.setting_value;
        if (raw) {
            sqlAccessCfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
    } catch {
        // ignore if table not initialized yet
    }

    const memCfg = db.getSettings(ACCESS_MAIL_SETTING_KEY) || {};
    const envFallback = readDashboardEnvFallback();
    const combined = { ...memCfg, ...sqlAccessCfg };

    const pick = (...vals) => {
        for (const v of vals) {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                const s = String(v).trim();
                if (
                    s !== 'your_email_password' &&
                    s !== 'your_app_password' &&
                    !s.startsWith('REPLACE_WITH')
                ) {
                    return s;
                }
            }
        }
        return '';
    };

    const smtpHost =
        pick(
            combined.smtpHost,
            process.env.ACCESS_SMTP_HOST,
            envFallback.ACCESS_SMTP_HOST
        ) || 'smtp.hostinger.com';
    const smtpPort = Number(
        pick(
            combined.smtpPort,
            process.env.ACCESS_SMTP_PORT,
            envFallback.ACCESS_SMTP_PORT
        ) || (smtpHost.includes('hostinger') ? 465 : 587)
    );
    const smtpUser = pick(
        combined.smtpUser,
        process.env.ACCESS_SMTP_USER,
        envFallback.ACCESS_SMTP_USER
    ) || DEFAULT_ADMIN_EMAIL;
    const smtpPass = pick(
        combined.smtpPass,
        process.env.ACCESS_SMTP_PASS,
        envFallback.ACCESS_SMTP_PASS
    );

    const adminEmail = (
        pick(
            combined.adminEmail,
            combined.adminAlertEmail,
            process.env.ADMIN_ALERT_EMAIL,
            process.env.ADMIN_EMAIL,
            envFallback.ADMIN_ALERT_EMAIL,
            envFallback.ADMIN_EMAIL
        ) || DEFAULT_ADMIN_EMAIL
    ).toLowerCase();

    const fromName =
        pick(
            combined.fromName,
            process.env.ACCESS_MAIL_FROM_NAME,
            envFallback.ACCESS_MAIL_FROM_NAME
        ) || 'DevInquire Access Control';

    const configuredFrom = pick(
        combined.fromEmail,
        process.env.ACCESS_MAIL_FROM_ADDRESS,
        envFallback.ACCESS_MAIL_FROM_ADDRESS
    );
    const fromEmail =
        smtpUser && (!configuredFrom || configuredFrom === 'noreply@devinquire.com')
            ? smtpUser
            : configuredFrom || smtpUser || DEFAULT_ADMIN_EMAIL;

    const web3FormsEnabled =
        combined.web3FormsEnabled !== undefined ? Boolean(combined.web3FormsEnabled) : true;
    const web3FormsKey =
        pick(
            combined.web3FormsKey,
            process.env.ACCESS_WEB3FORMS_KEY,
            envFallback.ACCESS_WEB3FORMS_KEY,
            process.env.WEB3FORMS_ACCESS_KEY,
            envFallback.WEB3FORMS_ACCESS_KEY
        ) || DEFAULT_WEB3FORMS_KEY;

    const bccAdminOnDecision =
        combined.bccAdminOnDecision !== undefined ? Boolean(combined.bccAdminOnDecision) : true;

    const dashboardUrl = String(
        combined.dashboardUrl ||
            process.env.DASHBOARD_PUBLIC_URL ||
            'https://dashboard.devinquire.com'
    ).replace(/\/$/, '');

    return {
        adminEmail: adminEmail || DEFAULT_ADMIN_EMAIL,
        fromName,
        fromEmail,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpConfigured: Boolean(smtpUser && smtpPass),
        web3FormsEnabled,
        web3FormsKey,
        bccAdminOnDecision,
        dashboardUrl
    };
}

export async function saveAccountMailConfig(patch = {}) {
    const current = db.getSettings(ACCESS_MAIL_SETTING_KEY) || {};
    const hasExplicitClearPass = patch.clearSmtpPass === true;
    const preservePass = hasExplicitClearPass
        ? ''
        : patch.smtpPass !== undefined && String(patch.smtpPass).trim() !== ''
        ? String(patch.smtpPass).trim()
        : current.smtpPass || '';

    const nextPatch = {
        ...current,
        ...(patch.adminEmail !== undefined ? { adminEmail: String(patch.adminEmail).trim() } : {}),
        ...(patch.fromName !== undefined ? { fromName: String(patch.fromName).trim() } : {}),
        ...(patch.fromEmail !== undefined ? { fromEmail: String(patch.fromEmail).trim() } : {}),
        ...(patch.smtpHost !== undefined ? { smtpHost: String(patch.smtpHost).trim() } : {}),
        ...(patch.smtpPort !== undefined ? { smtpPort: Number(patch.smtpPort) || 465 } : {}),
        ...(patch.smtpUser !== undefined ? { smtpUser: String(patch.smtpUser).trim() } : {}),
        smtpPass: preservePass,
        ...(patch.web3FormsEnabled !== undefined
            ? { web3FormsEnabled: Boolean(patch.web3FormsEnabled) }
            : {}),
        ...(patch.bccAdminOnDecision !== undefined
            ? { bccAdminOnDecision: Boolean(patch.bccAdminOnDecision) }
            : {})
    };

    await db.updateSettingsAsync(ACCESS_MAIL_SETTING_KEY, nextPatch);
    if (hasExplicitClearPass) {
        // Ensure empty password persists when explicitly cleared
        const storeCfg = db.getSettings(ACCESS_MAIL_SETTING_KEY);
        if (storeCfg && storeCfg.smtpPass) {
            storeCfg.smtpPass = '';
            try {
                await db.query(
                    'INSERT INTO system_settings (setting_key, setting_value) VALUES ($1, $2) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
                    [ACCESS_MAIL_SETTING_KEY, JSON.stringify({ ...storeCfg, smtpPass: '' })]
                );
            } catch {
                // ignore
            }
        }
    }

    return loadAccountMailConfig();
}

function createSmtpTransporter(cfg) {
    const port = Number(cfg.smtpPort) || 465;
    const secure = port === 465;
    return nodemailer.createTransport({
        host: cfg.smtpHost,
        port,
        secure,
        auth: {
            user: cfg.smtpUser,
            pass: cfg.smtpPass
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });
}

async function recordEmailLog(entry) {
    try {
        const current = db.getSettings(ACCESS_MAIL_LOGS_KEY) || { items: [] };
        const items = Array.isArray(current.items) ? current.items : [];
        const nextItems = [
            {
                id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                timestamp: new Date().toISOString(),
                ...entry
            },
            ...items
        ].slice(0, 25);
        db.updateSettings(ACCESS_MAIL_LOGS_KEY, { items: nextItems });
    } catch {
        // non-fatal
    }
}

export function getRecentEmailLogs() {
    const current = db.getSettings(ACCESS_MAIL_LOGS_KEY) || { items: [] };
    return Array.isArray(current.items) ? current.items : [];
}

function resolveDashboardBaseUrl(cfg, requestOrigin = '') {
    if (requestOrigin && /^https?:\/\//i.test(requestOrigin)) {
        return requestOrigin.replace(/\/$/, '');
    }
    return cfg.dashboardUrl || 'https://dashboard.devinquire.com';
}

/**
 * 1. Notify admin@devinquire.com when someone signs up for a new account
 *    (Also sends a "Request Received" acknowledgement to the applicant if SMTP is configured)
 */
export async function sendAdminNewSignupAlert({
    name,
    email,
    role = 'Developer',
    requestedAt = new Date().toISOString(),
    requestOrigin = ''
}) {
    const cfg = await loadAccountMailConfig();
    const baseUrl = resolveDashboardBaseUrl(cfg, requestOrigin);
    const reviewUrl = `${baseUrl}/#/users?tab=pending`;

    // Always include admin@devinquire.com, plus custom adminEmail if different
    const recipients = Array.from(
        new Set([DEFAULT_ADMIN_EMAIL, cfg.adminEmail].filter(Boolean).map((e) => e.toLowerCase()))
    );
    const subject = `New Account Signup Request: ${name} (${email})`;
    const formattedDate = new Date(requestedAt).toUTCString();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>New Account Signup Request</title>
</head>
<body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e5ea;box-shadow:0 8px 28px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#4e45e1,#6B63F2);padding:26px 28px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.85;">DevInquire Command Hub</div>
      <h1 style="margin:6px 0 0;font-size:21px;font-weight:700;">New Account Signup Request</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3a3a3c;">
        A new user has signed up for workspace access on DevInquire and is awaiting your approval or rejection.
      </p>
      <div style="background:#f8f8fc;border:1px solid #ececf4;border-radius:14px;padding:16px 18px;margin-bottom:22px;">
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#8e8e93;">Applicant Name</div>
          <div style="font-size:15px;font-weight:600;color:#1d1d1f;margin-top:2px;">${escapeHtml(name)}</div>
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#8e8e93;">Email Address</div>
          <div style="font-size:14px;font-weight:600;color:#4e45e1;margin-top:2px;">${escapeHtml(email)}</div>
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#8e8e93;">Default Requested Role</div>
          <div style="font-size:13px;font-weight:600;color:#1d1d1f;margin-top:2px;">${escapeHtml(role)} (Pending Approval)</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#8e8e93;">Requested At</div>
          <div style="font-size:12px;color:#636366;margin-top:2px;">${escapeHtml(formattedDate)}</div>
        </div>
      </div>
      <div style="text-align:center;margin:24px 0 12px;">
        <a href="${reviewUrl}" style="display:inline-block;background:#4e45e1;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 26px;border-radius:12px;">
          Review &amp; Approve / Reject Access →
        </a>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#8e8e93;text-align:center;">
        Direct link: <a href="${reviewUrl}" style="color:#4e45e1;">${reviewUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const textBody = [
        'DevInquire — New Account Signup Request',
        '----------------------------------------',
        `Name: ${name}`,
        `Email: ${email}`,
        `Requested Role: ${role} (Pending Approval)`,
        `Submitted At: ${formattedDate}`,
        '',
        `Review & Approve or Reject this request:`,
        reviewUrl
    ].join('\n');

    // 1. Primary: Direct Nodemailer SMTP
    if (cfg.smtpConfigured) {
        try {
            const transporter = createSmtpTransporter(cfg);
            await transporter.sendMail({
                from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
                to: recipients.join(', '),
                replyTo: email,
                subject,
                html: htmlBody,
                text: textBody
            });

            // Also send polite receipt acknowledgement to the person who signed up
            await transporter
                .sendMail({
                    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
                    to: email,
                    replyTo: DEFAULT_ADMIN_EMAIL,
                    subject: 'We Received Your DevInquire Workspace Access Request',
                    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e5e5ea;">
    <h2 style="margin:0 0 12px;font-size:19px;color:#1d1d1f;">Access Request Received</h2>
    <p style="font-size:14px;line-height:1.6;color:#3a3a3c;">Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p style="font-size:14px;line-height:1.6;color:#3a3a3c;">
      Your request for a <strong>DevInquire</strong> account (<strong>${escapeHtml(email)}</strong>) has been sent to our administrator for review.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#3a3a3c;">
      You will receive an email confirmation as soon as your account access is approved or updated.
    </p>
    <p style="margin-top:22px;font-size:13px;color:#8e8e93;">— DevInquire Team (${DEFAULT_ADMIN_EMAIL})</p>
  </div>
</body>
</html>`,
                    text: `Hello ${name},\n\nYour request for a DevInquire account (${email}) has been sent to ${DEFAULT_ADMIN_EMAIL} for review.\nYou will receive an email confirmation as soon as your access request is approved or updated.\n\n— DevInquire Team`
                })
                .catch((ackErr) => {
                    console.warn('[Mailer] Applicant signup ack warning:', ackErr.message);
                });

            await recordEmailLog({
                event: 'signup_admin_alert',
                to: recipients.join(', '),
                applicant: email,
                channel: 'smtp',
                status: 'sent'
            });

            return {
                sent: true,
                channel: 'smtp',
                recipient: recipients.join(', ')
            };
        } catch (smtpErr) {
            console.warn('[Mailer] Admin signup SMTP warning:', smtpErr.message);
            await recordEmailLog({
                event: 'signup_admin_alert',
                to: recipients.join(', '),
                applicant: email,
                channel: 'smtp',
                status: 'error',
                error: smtpErr.message
            });
        }
    }

    // 2. Fallback: Web3Forms Relay to Admin Inbox
    if (cfg.web3FormsEnabled && cfg.web3FormsKey) {
        try {
            const w3Res = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Origin: 'https://devinquire.com',
                    Referer: 'https://devinquire.com/contact',
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    access_key: cfg.web3FormsKey,
                    from_name: 'DevInquire Access Control',
                    subject,
                    name,
                    email,
                    replyto: email,
                    to_email: DEFAULT_ADMIN_EMAIL,
                    message: textBody
                }),
                signal: AbortSignal.timeout(8000)
            });
            const w3Json = await w3Res.json().catch(() => ({}));
            if (w3Res.ok && w3Json.success !== false) {
                await recordEmailLog({
                    event: 'signup_admin_alert',
                    to: DEFAULT_ADMIN_EMAIL,
                    applicant: email,
                    channel: 'web3forms',
                    status: 'sent'
                });
                return {
                    sent: true,
                    channel: 'web3forms',
                    recipient: DEFAULT_ADMIN_EMAIL
                };
            }
        } catch (w3Err) {
            console.warn('[Mailer] Admin signup Web3Forms warning:', w3Err.message);
        }
    }

    await recordEmailLog({
        event: 'signup_admin_alert',
        to: DEFAULT_ADMIN_EMAIL,
        applicant: email,
        channel: 'in_app_notification',
        status: 'queued'
    });

    return {
        sent: false,
        channel: 'in_app_only',
        recipient: DEFAULT_ADMIN_EMAIL
    };
}

/**
 * 2. Send Approval or Rejection Email Confirmation directly to the requested person
 */
export async function sendApplicantDecisionEmail({
    name,
    email,
    decision,
    role = 'Developer',
    reason = '',
    decidedBy = 'DevInquire Administrator',
    requestOrigin = ''
}) {
    const cfg = await loadAccountMailConfig();
    const baseUrl = resolveDashboardBaseUrl(cfg, requestOrigin);
    const loginUrl = `${baseUrl}/#/`;
    const isApproved = String(decision).toLowerCase() === 'approved';

    const subject = isApproved
        ? 'Your DevInquire Account Has Been Approved!'
        : 'Update on Your DevInquire Workspace Access Request';

    const htmlBody = isApproved
        ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Account Approved</title>
</head>
<body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e5ea;box-shadow:0 8px 28px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#1E8E3E,#28CD41);padding:26px 28px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">Access Confirmed</div>
      <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;">Welcome to DevInquire!</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1d1d1f;">
        Hello <strong>${escapeHtml(name)}</strong>,
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3a3a3c;">
        Your workspace access request has been <strong>approved</strong> by ${escapeHtml(decidedBy)}. You can now sign in to the DevInquire Enterprise Command Hub using the email and password you registered with.
      </p>
      <div style="background:#f4fbf6;border:1px solid #ccebd4;border-radius:14px;padding:16px 18px;margin-bottom:24px;">
        <div style="margin-bottom:8px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1E8E3E;">Account Email:</span>
          <div style="font-size:14px;font-weight:600;color:#1d1d1f;margin-top:2px;">${escapeHtml(email)}</div>
        </div>
        <div style="margin-bottom:8px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1E8E3E;">Assigned Role:</span>
          <div style="font-size:14px;font-weight:600;color:#1d1d1f;margin-top:2px;">${escapeHtml(role)}</div>
        </div>
        <div>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1E8E3E;">Status:</span>
          <div style="font-size:13px;font-weight:600;color:#1E8E3E;margin-top:2px;">Active &amp; Verified</div>
        </div>
      </div>
      <div style="text-align:center;margin:24px 0 14px;">
        <a href="${loginUrl}" style="display:inline-block;background:#4e45e1;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;">
          Sign In to DevInquire Dashboard →
        </a>
      </div>
      <p style="margin:18px 0 0;font-size:12px;color:#8e8e93;text-align:center;">
        Questions? Contact <a href="mailto:${DEFAULT_ADMIN_EMAIL}" style="color:#4e45e1;">${DEFAULT_ADMIN_EMAIL}</a>
      </p>
    </div>
  </div>
</body>
</html>`
        : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Access Request Update</title>
</head>
<body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e5ea;box-shadow:0 8px 28px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#3a3a3c,#1c1c1e);padding:26px 28px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.8;">DevInquire Access Control</div>
      <h1 style="margin:6px 0 0;font-size:21px;font-weight:700;">Workspace Access Request Update</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1d1d1f;">
        Hello <strong>${escapeHtml(name)}</strong>,
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3a3a3c;">
        Thank you for requesting access to the DevInquire workspace (<strong>${escapeHtml(email)}</strong>). After administrative review, your request was <strong>not approved</strong> at this time.
      </p>
      ${
          reason && String(reason).trim()
              ? `<div style="background:#fff8f6;border-left:3px solid #FF3B30;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#FF3B30;margin-bottom:4px;">Administrator Note</div>
        <div style="font-size:13.5px;color:#1d1d1f;line-height:1.5;">${escapeHtml(reason)}</div>
      </div>`
              : ''
      }
      <p style="margin:0;font-size:13.5px;line-height:1.6;color:#636366;">
        If you believe this was in error or would like to share additional context with our team, please reply directly to this email or contact <a href="mailto:${DEFAULT_ADMIN_EMAIL}" style="color:#4e45e1;font-weight:600;">${DEFAULT_ADMIN_EMAIL}</a>.
      </p>
    </div>
  </div>
</body>
</html>`;

    const textBody = isApproved
        ? [
              `Hello ${name},`,
              '',
              `Great news — your DevInquire workspace access request has been APPROVED!`,
              '',
              `Account Email: ${email}`,
              `Assigned Role: ${role}`,
              `Status: Active`,
              '',
              `Sign in here: ${loginUrl}`,
              '',
              `Best regards,`,
              `DevInquire Team (${DEFAULT_ADMIN_EMAIL})`
          ].join('\n')
        : [
              `Hello ${name},`,
              '',
              `Thank you for requesting access to the DevInquire workspace (${email}).`,
              `After administrative review, your access request was not approved at this time.`,
              reason && String(reason).trim() ? `\nAdministrator Note: ${reason}\n` : '',
              `If you have questions, please contact ${DEFAULT_ADMIN_EMAIL}.`,
              '',
              `Best regards,`,
              `DevInquire Team`
          ]
              .filter(Boolean)
              .join('\n');

    if (!cfg.smtpConfigured) {
        await recordEmailLog({
            event: isApproved ? 'user_approved' : 'user_rejected',
            to: email,
            channel: 'smtp_unconfigured',
            status: 'skipped',
            error: 'SMTP credentials (smtpUser / smtpPass) not configured yet.'
        });
        return {
            sent: false,
            channel: 'smtp_unconfigured',
            recipient: email,
            error: 'SMTP credentials are not configured yet. Open Email Notifications in Access & Users to enter your admin@devinquire.com SMTP password.'
        };
    }

    try {
        const transporter = createSmtpTransporter(cfg);
        const bccList =
            cfg.bccAdminOnDecision && email.toLowerCase() !== DEFAULT_ADMIN_EMAIL
                ? DEFAULT_ADMIN_EMAIL
                : undefined;

        const info = await transporter.sendMail({
            from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
            to: email,
            bcc: bccList,
            replyTo: DEFAULT_ADMIN_EMAIL,
            subject,
            html: htmlBody,
            text: textBody
        });

        await recordEmailLog({
            event: isApproved ? 'user_approved' : 'user_rejected',
            to: email,
            channel: 'smtp',
            status: 'sent',
            messageId: info.messageId
        });

        return {
            sent: true,
            channel: 'smtp',
            recipient: email,
            messageId: info.messageId
        };
    } catch (err) {
        console.error(`[Mailer] Decision (${decision}) email failed for ${email}:`, err.message);
        await recordEmailLog({
            event: isApproved ? 'user_approved' : 'user_rejected',
            to: email,
            channel: 'smtp',
            status: 'error',
            error: err.message
        });
        return {
            sent: false,
            channel: 'smtp_error',
            recipient: email,
            error: err.message
        };
    }
}

/**
 * 3. Verify SMTP Connection & Send Test Email
 */
export async function sendTestAccountEmail(targetEmail = DEFAULT_ADMIN_EMAIL) {
    const cfg = await loadAccountMailConfig();
    if (!cfg.smtpConfigured) {
        throw new Error(
            'Please enter both SMTP Email/Username and SMTP Password before sending a test email.'
        );
    }

    const transporter = createSmtpTransporter(cfg);
    await transporter.verify();

    const recipient = String(targetEmail || cfg.adminEmail || DEFAULT_ADMIN_EMAIL).trim();
    const info = await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: recipient,
        replyTo: DEFAULT_ADMIN_EMAIL,
        subject: 'DevInquire Access & Notification Mailer — Test Successful',
        html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;padding:26px;border:1px solid #e5e5ea;">
    <h2 style="margin:0 0 10px;color:#1E8E3E;">✓ SMTP Email Delivery Verified</h2>
    <p style="font-size:14px;line-height:1.6;color:#3a3a3c;">
      Your DevInquire Dashboard SMTP configuration (<strong>${escapeHtml(cfg.smtpHost)}:${cfg.smtpPort}</strong> as <strong>${escapeHtml(cfg.smtpUser)}</strong>) is active and ready.
    </p>
    <ul style="font-size:13px;line-height:1.7;color:#3a3a3c;padding-left:18px;">
      <li>New account signups will notify <strong>${DEFAULT_ADMIN_EMAIL}</strong></li>
      <li>Approving or rejecting an access request will automatically email the applicant</li>
    </ul>
  </div>
</body>
</html>`,
        text: `DevInquire SMTP Email Delivery Verified!\nHost: ${cfg.smtpHost}:${cfg.smtpPort}\nSender: ${cfg.smtpUser}\n\nNew signups will alert ${DEFAULT_ADMIN_EMAIL}, and approvals/rejections will email applicants automatically.`
    });

    await recordEmailLog({
        event: 'smtp_test',
        to: recipient,
        channel: 'smtp',
        status: 'sent',
        messageId: info.messageId
    });

    return {
        sent: true,
        recipient,
        messageId: info.messageId
    };
}
