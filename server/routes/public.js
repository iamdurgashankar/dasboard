/**
 * Public Router (Used by devinquire.com main site)
 * Exposes public endpoints that do not require admin authentication.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import db from '../db.js';
import { sendJsonResponse, createNotification } from '../utils.js';
import { generateBlogReelVideo, REELS_DIR } from '../reelGenerator.js';

const router = express.Router();

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function resolveSmtpSettings(config = {}) {
    const smtpHost = String(config.smtpHost || process.env.SMTP_HOST || 'smtp.hostinger.com').trim();
    const smtpPort = Number(config.smtpPort || process.env.SMTP_PORT || 465);
    const smtpUser = String(config.smtpUser || process.env.SMTP_USERNAME || 'contact@devinquire.com').trim();
    const smtpPass = String(config.smtpPass || process.env.SMTP_PASSWORD || '').trim();
    const recipient = String(
        config.recipientEmail || process.env.CONTACT_EMAIL || 'contact@devinquire.com'
    ).trim();
    const rawFromEmail = String(
        config.fromEmail || process.env.SMTP_FROM || process.env.MAIL_FROM_ADDRESS || smtpUser || 'contact@devinquire.com'
    ).trim();
    // Hostinger SMTP requires the From address to match an owned mailbox/alias (never unowned noreply@)
    const fromEmail =
        smtpHost.toLowerCase().includes('hostinger') &&
        (!rawFromEmail || rawFromEmail.toLowerCase().startsWith('noreply@')) &&
        smtpUser
            ? smtpUser
            : rawFromEmail || smtpUser || 'contact@devinquire.com';
    const fromName = String(config.fromName || process.env.MAIL_FROM_NAME || 'DevInquire').trim();
    const secure =
        smtpPort === 465 ||
        (smtpPort !== 587 && process.env.SMTP_SECURE === 'true');

    return {
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        recipient,
        fromEmail,
        fromName,
        secure
    };
}

export function createSmtpTransporter(config = {}) {
    const settings = resolveSmtpSettings(config);
    if (!settings.smtpUser || !settings.smtpPass) {
        return { transporter: null, settings };
    }
    const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.secure,
        auth: { user: settings.smtpUser, pass: settings.smtpPass },
        connectionTimeout: 12000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: { rejectUnauthorized: false }
    });
    return { transporter, settings };
}

export async function dispatchInquiryEmail(config, inquiry) {
    const { transporter, settings } = createSmtpTransporter(config);
    if (!transporter) {
        return false;
    }

    const { recipient, fromEmail, fromName } = settings;
    const preBookingDisplay =
        inquiry.payment_status && inquiry.payment_status !== 'none'
            ? `${String(inquiry.payment_status).toUpperCase()}${
                  inquiry.payment_plan ? ` (${inquiry.payment_plan})` : ''
              }${inquiry.payment_amount ? ` — ₹${inquiry.payment_amount}/-` : ''}`
            : null;

    const rows = [
        ['Full Name', inquiry.name || 'Website Visitor'],
        ['Email Address', inquiry.email || ''],
        inquiry.phone ? ['Phone / WhatsApp', inquiry.phone] : null,
        inquiry.company ? ['Company / Organization', inquiry.company] : null,
        inquiry.service ? ['Service / Product', inquiry.service] : null,
        inquiry.product && inquiry.product !== inquiry.service ? ['Product', inquiry.product] : null,
        inquiry.timeline ? ['Target Timeline', inquiry.timeline] : null,
        inquiry.categories ? ['Categories', Array.isArray(inquiry.categories) ? inquiry.categories.join(', ') : String(inquiry.categories)] : null,
        inquiry.form_source ? ['Form Source', inquiry.form_source] : null,
        preBookingDisplay ? ['Pre-Booking / Payment', preBookingDisplay] : null,
        inquiry.payment_reference ? ['Payment Reference', inquiry.payment_reference] : null,
        inquiry.page_url ? ['Submitted From URL', inquiry.page_url] : null,
        ['Subject', inquiry.subject || 'Website Form Submission']
    ].filter(Boolean);

    const lines = [
        '=== DevInquire Website Form Submission ===',
        '',
        ...rows.map(([label, val]) => `${label}: ${val}`),
        '',
        '--- Message / Details ---',
        inquiry.message || ''
    ];

    const htmlRows = rows
        .map(
            ([label, val]) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:190px;vertical-align:top;">${escapeHtml(label)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;">${escapeHtml(val)}</td>
            </tr>`
        )
        .join('');

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;">
        <div style="background:#111827;color:#ffffff;padding:18px 24px;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#a5b4fc;font-weight:600;">DevInquire Live Website Intake</div>
          <h2 style="margin:6px 0 0;font-size:18px;font-weight:600;">${escapeHtml(inquiry.subject || 'New Website Form Submission')}</h2>
        </div>
        <div style="padding:20px 24px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            ${htmlRows}
          </table>
          <div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
            <div style="font-size:12px;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Message / Project Details</div>
            <div style="font-size:14px;color:#111827;white-space:pre-wrap;line-height:1.55;">${escapeHtml(inquiry.message || '')}</div>
          </div>
        </div>
      </div>
    `;

    const mailSubject = String(inquiry.subject || 'Website Form Submission');
    await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: recipient,
        replyTo: inquiry.email || fromEmail,
        subject: mailSubject.startsWith('[') ? mailSubject : `[DevInquire] ${mailSubject}`,
        text: lines.join('\n'),
        html: htmlBody
    });

    if (
        config.autoReplyEnabled !== false &&
        inquiry.email &&
        inquiry.email.toLowerCase() !== recipient.toLowerCase() &&
        inquiry.service !== 'Newsletter'
    ) {
        const replyBody = (
            config.autoReplyTemplate ||
            'Hello {{name}}, thank you for reaching out to DevInquire. We have received your inquiry regarding "{{subject}}" and will respond within 24 hours.'
        )
            .replace(/\{\{name\}\}/g, inquiry.name || 'Client')
            .replace(/\{\{subject\}\}/g, inquiry.subject || 'your inquiry');

        await transporter
            .sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: inquiry.email,
                replyTo: recipient,
                subject: config.autoReplySubject || 'Thank you for contacting DevInquire',
                text: replyBody
            })
            .catch(() => {});
    }

    return true;
}

const blogListPaths = ['/blog_list', '/blog_list.php'];
const blogDetailPaths = ['/blog_detail', '/blog_detail.php'];
const contactIntakePaths = ['/contact_intake', '/contact_intake.php'];
const paymentConfirmPaths = ['/payment_confirm', '/payment_confirm.php'];

function normalizePlanLabel(planType, serviceName = '') {
    if (planType === 'consultation') {
        return '1:1 Technical Consultation (₹399/-)';
    }
    if (planType === 'service_confirmation') {
        return serviceName
            ? `Service Confirmation (₹99/-) — ${serviceName}`
            : 'Service Confirmation (₹99/-)';
    }
    return planType || '';
}

function buildFormPayloadJson(body = {}, existingPayloadStr = null) {
    let base = {};
    if (existingPayloadStr) {
        try {
            base = typeof existingPayloadStr === 'string' ? JSON.parse(existingPayloadStr) : existingPayloadStr;
        } catch {
            base = {};
        }
    }
    let incomingExtra = {};
    if (body.form_payload) {
        try {
            incomingExtra =
                typeof body.form_payload === 'string' ? JSON.parse(body.form_payload) : body.form_payload;
        } catch {
            incomingExtra = {};
        }
    }
    const merged = {
        ...base,
        ...incomingExtra,
        name: body.name || base.name || '',
        email: body.email || base.email || '',
        phone: body.phone ?? base.phone ?? '',
        company: body.company ?? base.company ?? '',
        service: body.service ?? base.service ?? '',
        product: body.product ?? incomingExtra.product ?? base.product ?? '',
        timeline: body.timeline ?? base.timeline ?? '',
        subject: body.subject ?? base.subject ?? '',
        message: body.message ?? base.message ?? '',
        categories: body.categories ?? incomingExtra.categories ?? base.categories ?? undefined,
        form_source: body.form_source || incomingExtra.form_source || base.form_source || 'Website Form',
        page_url: body.pageUrl || body.page_url || incomingExtra.page_url || base.page_url || '',
        submitted_at: base.submitted_at || new Date().toISOString()
    };
    return JSON.stringify(merged);
}

// Public Contact Intake API (Receives form submissions & pre-booking checkouts from devinquire.com)
router.post(contactIntakePaths, async (req, res) => {
    const config = db.getSettings('contacts_config');
    if (config.webhookIntakeEnabled === false) {
        return sendJsonResponse(res, "error", "Public contact intake is currently paused by Administrator.", null, 503);
    }

    const body = req.body || {};
    const {
        inquiry_id,
        name,
        email,
        subject,
        message,
        priority,
        company,
        phone,
        service,
        timeline,
        form_source,
        payment_status,
        payment_plan,
        payment_amount,
        payment_currency,
        payment_reference,
        paid_at
    } = body;

    if (!name || !email || !message) {
        return sendJsonResponse(res, "error", "Name, email, and message are required.", null, 400);
    }

    try {
        const cleanEmail = String(email).trim().toLowerCase();
        const cleanName = String(name).trim();
        const cleanMessage = String(message).trim();
        const resolvedSource = String(
            form_source ||
                (service === 'Newsletter'
                    ? 'Newsletter'
                    : service
                    ? 'Services Inquiry'
                    : 'Contact Form')
        ).trim();
        const resolvedPaymentStatus = String(payment_status || 'none').toLowerCase().trim();
        const resolvedAmount = Number(payment_amount) || (payment_plan === 'consultation' ? 399 : payment_plan === 'service_confirmation' ? 99 : 0);
        const resolvedCurrency = String(payment_currency || 'INR').toUpperCase();
        const resolvedPaidAt =
            resolvedPaymentStatus === 'paid' ? paid_at || new Date().toISOString() : paid_at || null;
        const resolvedPriority =
            resolvedPaymentStatus === 'paid'
                ? 'High'
                : priority || config.defaultPriority || 'Medium';
        const resolvedSubject =
            subject ||
            (resolvedPaymentStatus === 'paid'
                ? `[PAID ₹${resolvedAmount}/-] ${normalizePlanLabel(payment_plan, service)}`
                : service
                ? `Service Request: ${service}`
                : 'Website Contact Submission');
        const cleanSubject = String(resolvedSubject).trim();

        const existingCheck = await db.query('SELECT * FROM contacts ORDER BY created_at DESC');
        const allContacts = existingCheck.rows || [];

        // 1. Check if updating an existing inquiry (by inquiry_id, payment_reference, or recent pending inquiry from same email)
        let targetExisting = null;
        if (inquiry_id) {
            targetExisting = allContacts.find((r) => String(r.id) === String(inquiry_id)) || null;
        }
        if (!targetExisting && payment_reference) {
            targetExisting =
                allContacts.find(
                    (r) =>
                        r.payment_reference &&
                        String(r.payment_reference).trim() === String(payment_reference).trim()
                ) || null;
        }
        if (
            !targetExisting &&
            (resolvedPaymentStatus === 'paid' ||
                resolvedPaymentStatus === 'opt_out' ||
                resolvedPaymentStatus === 'cancelled')
        ) {
            targetExisting =
                allContacts.slice(0, 25).find(
                    (r) =>
                        String(r.email || '').toLowerCase() === cleanEmail &&
                        (r.payment_status === 'pending' || r.payment_status === 'cancelled')
                ) || null;
        }

        if (targetExisting) {
            const nextPaymentStatus =
                targetExisting.payment_status === 'paid' ? 'paid' : resolvedPaymentStatus;
            const mergedPayload = buildFormPayloadJson(body, targetExisting.form_payload);
            const updatedSubject =
                nextPaymentStatus === 'paid' && !String(targetExisting.subject || '').startsWith('[PAID')
                    ? `[PAID ₹${resolvedAmount || targetExisting.payment_amount || 399}/-] ${targetExisting.subject || cleanSubject}`
                    : targetExisting.subject || cleanSubject;

            await db.query(
                `UPDATE contacts
                 SET name = $1, company = $2, phone = $3, service = $4, timeline = $5,
                     subject = $6, message = $7, priority = $8::contact_priority,
                     form_source = $9, payment_status = $10, payment_plan = $11,
                     payment_amount = $12, payment_currency = $13, payment_reference = $14,
                     paid_at = $15, form_payload = $16
                 WHERE id = $17`,
                [
                    cleanName || targetExisting.name,
                    company || targetExisting.company || '',
                    phone || targetExisting.phone || '',
                    service || targetExisting.service || '',
                    timeline || targetExisting.timeline || '',
                    updatedSubject,
                    targetExisting.message || cleanMessage,
                    nextPaymentStatus === 'paid' ? 'High' : targetExisting.priority || resolvedPriority,
                    resolvedSource || targetExisting.form_source || 'Website Form',
                    nextPaymentStatus,
                    payment_plan || targetExisting.payment_plan || '',
                    resolvedAmount || Number(targetExisting.payment_amount) || 0,
                    resolvedCurrency,
                    payment_reference || targetExisting.payment_reference || '',
                    nextPaymentStatus === 'paid'
                        ? resolvedPaidAt || targetExisting.paid_at || new Date().toISOString()
                        : targetExisting.paid_at || null,
                    mergedPayload,
                    targetExisting.id
                ]
            );

            let updatedEmailSent = false;
            if (nextPaymentStatus === 'paid' && targetExisting.payment_status !== 'paid') {
                await createNotification(
                    null,
                    'success',
                    `Payment Confirmed (₹${resolvedAmount}/-)`,
                    `${cleanName} (${cleanEmail}) completed ${normalizePlanLabel(payment_plan, service)}.`,
                    '/contacts'
                ).catch(() => {});

                updatedEmailSent = await dispatchInquiryEmail(config, {
                    name: cleanName || targetExisting.name,
                    email: cleanEmail,
                    phone: phone || targetExisting.phone || '',
                    company: company || targetExisting.company || '',
                    service: service || targetExisting.service || '',
                    product: body.product || '',
                    timeline: timeline || targetExisting.timeline || '',
                    categories: body.categories,
                    page_url: body.page_url || body.pageUrl || '',
                    form_source: resolvedSource || targetExisting.form_source || 'Website Form',
                    payment_status: 'paid',
                    payment_plan: normalizePlanLabel(payment_plan || targetExisting.payment_plan, service || targetExisting.service),
                    payment_amount: resolvedAmount || Number(targetExisting.payment_amount) || 0,
                    payment_reference: payment_reference || targetExisting.payment_reference || '',
                    subject: updatedSubject,
                    message: targetExisting.message || cleanMessage
                }).catch(() => false);
            }

            return sendJsonResponse(res, "success", "Inquiry & payment status updated in dashboard ledger.", {
                id: String(targetExisting.id),
                updated: true,
                emailSent: updatedEmailSent,
                payment_status: nextPaymentStatus
            });
        }

        // 2. Deduplicate identical submission within recent rows
        const duplicateRow = allContacts.slice(0, 8).find(
            (r) =>
                String(r.email || '').toLowerCase() === cleanEmail &&
                String(r.subject || '').trim() === cleanSubject &&
                String(r.message || '').trim() === cleanMessage &&
                String(r.payment_status || 'none') === resolvedPaymentStatus
        );
        if (duplicateRow) {
            return sendJsonResponse(res, "success", "Inquiry already recorded in dashboard ledger.", {
                id: String(duplicateRow.id)
            });
        }

        const formPayloadStr = buildFormPayloadJson(body, null);

        const insertRes = await db.query(
            'INSERT INTO contacts (name, email, subject, message, priority) VALUES ($1, $2, $3, $4, $5::contact_priority) RETURNING id',
            [
                cleanName,
                cleanEmail,
                cleanSubject,
                cleanMessage,
                resolvedPriority,
                {
                    company: company || '',
                    phone: phone || '',
                    service: service || '',
                    timeline: timeline || '',
                    form_source: resolvedSource,
                    payment_status: resolvedPaymentStatus,
                    payment_plan: payment_plan || '',
                    payment_amount: resolvedAmount,
                    payment_currency: resolvedCurrency,
                    payment_reference: payment_reference || '',
                    paid_at: resolvedPaidAt,
                    form_payload: formPayloadStr,
                    status: 'new'
                }
            ]
        );

        const newId = insertRes.rows?.[0]?.id;
        if (newId) {
            await db
                .query(
                    `UPDATE contacts
                     SET company = $1, phone = $2, service = $3, timeline = $4,
                         form_source = $5, payment_status = $6, payment_plan = $7,
                         payment_amount = $8, payment_currency = $9, payment_reference = $10,
                         paid_at = $11, form_payload = $12
                     WHERE id = $13`,
                    [
                        company || '',
                        phone || '',
                        service || '',
                        timeline || '',
                        resolvedSource,
                        resolvedPaymentStatus,
                        payment_plan || '',
                        resolvedAmount,
                        resolvedCurrency,
                        payment_reference || '',
                        resolvedPaidAt,
                        formPayloadStr,
                        newId
                    ]
                )
                .catch(() => {});
        }

        await createNotification(
            null,
            resolvedPaymentStatus === 'paid' ? 'success' : 'info',
            resolvedPaymentStatus === 'paid'
                ? `Payment Confirmed (₹${resolvedAmount}/-)`
                : resolvedPaymentStatus === 'pending'
                ? `Pre-Booking Checkout Started (₹${resolvedAmount}/-)`
                : `Website Inquiry (${resolvedSource})`,
            `${cleanName} (${cleanEmail}) — ${cleanSubject}`,
            '/contacts'
        ).catch(() => {});

        const emailSent = await dispatchInquiryEmail(config, {
            name: cleanName,
            email: cleanEmail,
            phone: phone || '',
            company: company || '',
            service: service || '',
            product: body.product || '',
            timeline: timeline || '',
            categories: body.categories,
            page_url: body.page_url || body.pageUrl || '',
            form_source: resolvedSource,
            payment_status: resolvedPaymentStatus,
            payment_plan: payment_plan || '',
            payment_amount: resolvedAmount,
            payment_reference: payment_reference || '',
            subject:
                resolvedPaymentStatus === 'pending' && !cleanSubject.startsWith('[Pre-Booking')
                    ? `[Pre-Booking Started — ₹${resolvedAmount}/-] ${cleanSubject}`
                    : cleanSubject,
            message: cleanMessage
        }).catch((mailErr) => {
            console.warn("Inquiry email dispatch warning:", mailErr.message);
            return false;
        });

        return sendJsonResponse(res, "success", "Inquiry recorded in dashboard ledger.", {
            id: newId ? String(newId) : null,
            emailSent,
            payment_status: resolvedPaymentStatus
        });
    } catch (err) {
        console.error("Public Contact Intake Error:", err);
        return sendJsonResponse(res, "error", "Failed to record inquiry.", null, 500);
    }
});

// Public Payment Confirmation / Status Reconciliation API (Called by devinquire.com PaymentStatus & Stripe Webhook)
router.post(paymentConfirmPaths, async (req, res) => {
    const body = req.body || {};
    const {
        inquiry_id,
        name,
        email,
        phone,
        company,
        service,
        timeline,
        subject,
        message,
        form_source,
        payment_status = 'paid',
        payment_plan = 'consultation',
        payment_amount,
        payment_currency = 'INR',
        payment_reference,
        paid_at
    } = body;

    try {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const resolvedStatus = String(payment_status || 'paid').toLowerCase().trim();
        const resolvedAmount =
            Number(payment_amount) ||
            (payment_plan === 'service_confirmation' ? 99 : 399);
        const resolvedCurrency = String(payment_currency || 'INR').toUpperCase();
        const resolvedPaidAt =
            resolvedStatus === 'paid' ? paid_at || new Date().toISOString() : null;

        const existingRes = await db.query('SELECT * FROM contacts ORDER BY created_at DESC');
        const allContacts = existingRes.rows || [];

        let match = null;
        if (inquiry_id) {
            match = allContacts.find((r) => String(r.id) === String(inquiry_id)) || null;
        }
        if (!match && payment_reference) {
            match =
                allContacts.find(
                    (r) =>
                        r.payment_reference &&
                        String(r.payment_reference).trim() === String(payment_reference).trim()
                ) || null;
        }
        if (!match && cleanEmail) {
            match =
                allContacts.slice(0, 30).find(
                    (r) =>
                        String(r.email || '').toLowerCase() === cleanEmail &&
                        (r.payment_status === 'pending' ||
                            r.payment_status === 'cancelled' ||
                            r.payment_status === 'none')
                ) || null;
        }

        if (match) {
            const finalStatus = match.payment_status === 'paid' ? 'paid' : resolvedStatus;
            const mergedPayload = buildFormPayloadJson(body, match.form_payload);
            const baseSubj = String(match.subject || subject || normalizePlanLabel(payment_plan, service || match.service))
                .replace(/^\[PAID[^\]]*\]\s*/i, '')
                .trim();
            const nextSubject =
                finalStatus === 'paid'
                    ? `[PAID ₹${resolvedAmount}/-] ${baseSubj}`
                    : match.subject || baseSubj;

            await db.query(
                `UPDATE contacts
                 SET payment_status = $1, payment_plan = $2, payment_amount = $3,
                     payment_currency = $4, payment_reference = $5, paid_at = $6,
                     priority = $7::contact_priority, subject = $8, form_payload = $9,
                     phone = $10, company = $11, service = $12, timeline = $13
                 WHERE id = $14`,
                [
                    finalStatus,
                    payment_plan || match.payment_plan || 'consultation',
                    resolvedAmount,
                    resolvedCurrency,
                    payment_reference || match.payment_reference || '',
                    finalStatus === 'paid' ? resolvedPaidAt || match.paid_at || new Date().toISOString() : match.paid_at || null,
                    finalStatus === 'paid' ? 'High' : match.priority || 'Medium',
                    nextSubject,
                    mergedPayload,
                    phone || match.phone || '',
                    company || match.company || '',
                    service || match.service || '',
                    timeline || match.timeline || '',
                    match.id
                ]
            );

            let paidEmailSent = false;
            if (finalStatus === 'paid' && match.payment_status !== 'paid') {
                await createNotification(
                    null,
                    'success',
                    `Payment Confirmed (₹${resolvedAmount}/-)`,
                    `${match.name || name || 'Client'} (${match.email || cleanEmail}) — ${normalizePlanLabel(payment_plan, service || match.service)}`,
                    '/contacts'
                ).catch(() => {});

                const config = db.getSettings('contacts_config');
                paidEmailSent = await dispatchInquiryEmail(config, {
                    name: match.name || name || 'Client',
                    email: match.email || cleanEmail,
                    phone: phone || match.phone || '',
                    company: company || match.company || '',
                    service: service || match.service || '',
                    timeline: timeline || match.timeline || '',
                    form_source: form_source || match.form_source || 'Stripe Pre-Booking',
                    payment_status: 'paid',
                    payment_plan: normalizePlanLabel(payment_plan, service || match.service),
                    payment_amount: resolvedAmount,
                    payment_reference: payment_reference || match.payment_reference || '',
                    subject: nextSubject,
                    message: match.message || message || ''
                }).catch(() => false);
            }

            return sendJsonResponse(res, "success", "Payment confirmation synced to client inquiry.", {
                id: String(match.id),
                emailSent: paidEmailSent,
                payment_status: finalStatus,
                payment_amount: resolvedAmount,
                payment_reference: payment_reference || match.payment_reference || ''
            });
        }

        // If no matching inquiry existed yet (e.g. direct Stripe Payment Link), create a new confirmed inquiry
        if (!cleanEmail && !payment_reference) {
            return sendJsonResponse(res, "error", "Email, inquiry_id, or payment_reference is required.", null, 400);
        }

        const fallbackName = String(name || 'Stripe Client').trim();
        const fallbackEmail = cleanEmail || 'stripe-client@devinquire.com';
        const planTitle = normalizePlanLabel(payment_plan, service);
        const createdSubject =
            resolvedStatus === 'paid'
                ? `[PAID ₹${resolvedAmount}/-] ${subject || planTitle}`
                : subject || planTitle;
        const createdMsg =
            message ||
            `Payment ${resolvedStatus.toUpperCase()} (${resolvedCurrency} ₹${resolvedAmount}/-) for ${planTitle}.${
                payment_reference ? `\nReference ID: ${payment_reference}` : ''
            }`;
        const payloadStr = buildFormPayloadJson(
            {
                ...body,
                name: fallbackName,
                email: fallbackEmail,
                subject: createdSubject,
                message: createdMsg,
                form_source: form_source || 'Stripe Pre-Booking'
            },
            null
        );

        const ins = await db.query(
            'INSERT INTO contacts (name, email, subject, message, priority) VALUES ($1, $2, $3, $4, $5::contact_priority) RETURNING id',
            [
                fallbackName,
                fallbackEmail,
                createdSubject,
                createdMsg,
                resolvedStatus === 'paid' ? 'High' : 'Medium',
                {
                    company: company || '',
                    phone: phone || '',
                    service: service || planTitle,
                    timeline: timeline || '',
                    form_source: form_source || 'Stripe Pre-Booking',
                    payment_status: resolvedStatus,
                    payment_plan: payment_plan || 'consultation',
                    payment_amount: resolvedAmount,
                    payment_currency: resolvedCurrency,
                    payment_reference: payment_reference || '',
                    paid_at: resolvedPaidAt,
                    form_payload: payloadStr,
                    status: 'new'
                }
            ]
        );
        const newId = ins.rows?.[0]?.id;
        if (newId) {
            await db
                .query(
                    `UPDATE contacts
                     SET company = $1, phone = $2, service = $3, timeline = $4,
                         form_source = $5, payment_status = $6, payment_plan = $7,
                         payment_amount = $8, payment_currency = $9, payment_reference = $10,
                         paid_at = $11, form_payload = $12
                     WHERE id = $13`,
                    [
                        company || '',
                        phone || '',
                        service || planTitle,
                        timeline || '',
                        form_source || 'Stripe Pre-Booking',
                        resolvedStatus,
                        payment_plan || 'consultation',
                        resolvedAmount,
                        resolvedCurrency,
                        payment_reference || '',
                        resolvedPaidAt,
                        payloadStr,
                        newId
                    ]
                )
                .catch(() => {});
        }

        let newPaidEmailSent = false;
        if (resolvedStatus === 'paid') {
            await createNotification(
                null,
                'success',
                `Payment Confirmed (₹${resolvedAmount}/-)`,
                `${fallbackName} (${fallbackEmail}) — ${planTitle}`,
                '/contacts'
            ).catch(() => {});

            const config = db.getSettings('contacts_config');
            newPaidEmailSent = await dispatchInquiryEmail(config, {
                name: fallbackName,
                email: fallbackEmail,
                phone: phone || '',
                company: company || '',
                service: service || planTitle,
                timeline: timeline || '',
                form_source: form_source || 'Stripe Pre-Booking',
                payment_status: 'paid',
                payment_plan: planTitle,
                payment_amount: resolvedAmount,
                payment_reference: payment_reference || '',
                subject: createdSubject,
                message: createdMsg
            }).catch(() => false);
        }

        return sendJsonResponse(res, "success", "Payment inquiry recorded in dashboard ledger.", {
            id: newId ? String(newId) : null,
            emailSent: newPaidEmailSent,
            payment_status: resolvedStatus
        });
    } catch (err) {
        console.error("Public Payment Confirm Error:", err);
        return sendJsonResponse(res, "error", "Failed to confirm payment on inquiry.", null, 500);
    }
});

// Public Read-Only Mail Status Check (Never exposes passwords)
router.get(['/mail_status', '/mail_status.php'], (req, res) => {
    const config = db.getSettings('contacts_config');
    const settings = resolveSmtpSettings(config);
    return sendJsonResponse(res, "success", "Mail transport status retrieved.", {
        smtpConfigured: Boolean(settings.smtpUser && settings.smtpPass),
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        secure: settings.secure,
        fromEmail: settings.fromEmail,
        recipientEmail: settings.recipient,
        autoReplyEnabled: config.autoReplyEnabled !== false,
        web3FormsFallbackEnabled: config.web3FormsEnabled !== false
    });
});

// Public List Blog Posts API
router.get(blogListPaths, async (req, res) => {
    const { category } = req.query;

    try {
        let query = `
            SELECT b.id, b.slug, b.title, b.excerpt, b.content, b.category, b.tags, b.featured_image, b.read_time, b.is_featured, b.created_at, COALESCE(b.author_name, u.name, 'DevInquire Editorial') as author_name 
            FROM blog_posts b 
            LEFT JOIN users u ON b.author_id = u.id 
            WHERE b.status = 'published'
        `;
        const params = [];
        let paramCount = 1;

        if (category) {
            query += ` AND b.category = $${paramCount++}`;
            params.push(category);
        }

        query += ' ORDER BY b.created_at DESC';

        const result = await db.query(query, params);
        const posts = result.rows;

        // Ensure tags are returned as arrays
        for (let post of posts) {
            if (typeof post.tags === 'string') {
                try {
                    post.tags = JSON.parse(post.tags);
                } catch {
                    post.tags = [];
                }
            } else if (!post.tags) {
                post.tags = [];
            }
        }

        return sendJsonResponse(res, "success", "Public blog posts retrieved.", posts);
    } catch (err) {
        console.error("Public Blog List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve blog posts.", null, 500);
    }
});

// Public Blog Detail API
router.get(blogDetailPaths, async (req, res) => {
    const { id, slug } = req.query;

    if (!id && !slug) {
        return sendJsonResponse(res, "error", "Blog ID or slug is required.", null, 400);
    }

    try {
        let query = `
            SELECT b.*, COALESCE(b.author_name, u.name, 'DevInquire Editorial') as author_name 
            FROM blog_posts b 
            LEFT JOIN users u ON b.author_id = u.id 
            WHERE b.status = 'published'
        `;
        const params = [];

        if (id) {
            query += ' AND b.id = $1';
            params.push(id);
        } else if (slug) {
            // Note: If slug column doesn't exist, this might fail, 
            // but we support it to match PHP behavior exactly.
            query += ' AND b.slug = $1';
            params.push(slug);
        }

        const result = await db.query(query, params);
        const post = result.rows[0];

        if (!post) {
            return sendJsonResponse(res, "error", "Blog post not found.", null, 404);
        }

        // Ensure tags are returned as arrays
        if (typeof post.tags === 'string') {
            try {
                post.tags = JSON.parse(post.tags);
            } catch {
                post.tags = [];
            }
        } else if (!post.tags) {
            post.tags = [];
        }

        return sendJsonResponse(res, "success", "Blog post retrieved.", post);
    } catch (err) {
        console.error("Public Blog Detail API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve blog post.", null, 500);
    }
});

import { ensureQuotationsTable, slugifyClient } from './quotations.js';

// Public Quotation Detail API (Used by devinquire.com/quotation/:slug)
router.get(['/quotation', '/quotation.php'], async (req, res) => {
    const slugParam = req.query.slug || '';
    const cleanSlug = slugifyClient(slugParam);

    if (!slugParam || !cleanSlug) {
        return sendJsonResponse(res, "error", "Quotation slug is required.", null, 400);
    }

    try {
        await ensureQuotationsTable();
        const result = await db.query(
            'SELECT id, slug, quotation_no, client_name, payload, created_at, updated_at FROM quotations WHERE slug = $1 LIMIT 1',
            [cleanSlug]
        );
        const row = result.rows?.[0];
        if (!row) {
            return sendJsonResponse(res, "error", "Quotation not found.", null, 404);
        }
        let parsed = {};
        try {
            parsed = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
        } catch {
            parsed = {};
        }

        if (parsed.clientDecision === 'agreed' || parsed.clientDecision === 'rejected') {
            return sendJsonResponse(
                res,
                "error",
                "This quotation response is already finalized and cannot be changed. Please request a new quotation.",
                null,
                409
            );
        }
        return sendJsonResponse(res, "success", "Quotation retrieved.", {
            ...parsed,
            id: String(row.id),
            slug: row.slug,
            quotationNo: parsed.quotationNo || row.quotation_no,
            clientName: parsed.clientName || row.client_name,
            updatedAt: row.updated_at || parsed.updatedAt || row.created_at,
        });
    } catch (err) {
        console.error("Public Quotation API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve quotation.", null, 500);
    }
});

// Public Quotation Client Response API (Agreed / Rejected)
router.post(['/quotation/respond', '/quotation/respond.php'], async (req, res) => {
    const { slug: slugParam, decision } = req.body || {};
    const cleanSlug = slugifyClient(slugParam || '');
    const normalizedDecision = String(decision || '').toLowerCase().trim();

    if (!slugParam || !cleanSlug) {
        return sendJsonResponse(res, "error", "Quotation slug is required.", null, 400);
    }
    if (normalizedDecision !== 'agreed' && normalizedDecision !== 'rejected') {
        return sendJsonResponse(res, "error", "Decision must be 'agreed' or 'rejected'.", null, 400);
    }

    try {
        await ensureQuotationsTable();
        const result = await db.query(
            'SELECT id, slug, quotation_no, client_name, payload, created_at, updated_at FROM quotations WHERE slug = $1 LIMIT 1',
            [cleanSlug]
        );
        const row = result.rows?.[0];
        if (!row) {
            return sendJsonResponse(res, "error", "Quotation not found.", null, 404);
        }

        let parsed = {};
        try {
            parsed = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
        } catch {
            parsed = {};
        }

        if (parsed.clientDecision === 'agreed' || parsed.clientDecision === 'rejected') {
            return sendJsonResponse(
                res,
                "error",
                "This quotation response is already finalized and cannot be changed. Please request a new quotation.",
                null,
                409
            );
        }

        const nowIso = new Date().toISOString();
        const updatedPayload = {
            ...parsed,
            slug: row.slug,
            quotationNo: parsed.quotationNo || row.quotation_no,
            clientName: parsed.clientName || row.client_name,
            clientDecision: normalizedDecision,
            clientDecisionAt: nowIso,
            updatedAt: nowIso,
        };

        await db.query(
            'UPDATE quotations SET quotation_no = $1, client_name = $2, payload = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
            [updatedPayload.quotationNo, updatedPayload.clientName, JSON.stringify(updatedPayload), row.id]
        );

        await createNotification(
            null,
            normalizedDecision === 'agreed' ? 'success' : 'warning',
            `Quotation ${normalizedDecision === 'agreed' ? 'Agreed' : 'Rejected'}`,
            `${updatedPayload.clientName} (${updatedPayload.quotationNo}) marked as ${normalizedDecision}.`,
            '/quotations'
        ).catch(() => {});

        return sendJsonResponse(res, "success", `Quotation marked as ${normalizedDecision}.`, {
            ...updatedPayload,
            id: String(row.id),
        });
    } catch (err) {
        console.error("Public Quotation Response Error:", err);
        return sendJsonResponse(res, "error", "Failed to save quotation response.", null, 500);
    }
});

// Public Short Video (Instagram Reels & Facebook Reels) Stream Endpoint with HTTP Range + Auto-Regeneration
router.get('/reels/:filename', async (req, res) => {
    const rawName = path.basename(String(req.params.filename || '').trim());
    if (!/^blog-[a-z0-9-_]+\.(mp4|jpg)$/i.test(rawName)) {
        return res.status(400).json({ status: 'error', message: 'Invalid reel asset filename.' });
    }

    const isMp4 = rawName.toLowerCase().endsWith('.mp4');
    let filePath = path.join(REELS_DIR, rawName);

    try {
        // Self-heal on demand if MP4/poster was cleared by a container redeploy
        if (!fs.existsSync(filePath)) {
            const key = rawName.replace(/^blog-/i, '').replace(/\.(mp4|jpg)$/i, '');
            let blogRow = null;
            if (/^\d+$/.test(key)) {
                const byId = await db.query('SELECT * FROM blog_posts WHERE id = $1 LIMIT 1', [Number(key)]);
                blogRow = byId.rows?.[0] || null;
            }
            if (!blogRow) {
                const bySlug = await db.query('SELECT * FROM blog_posts WHERE LOWER(slug) = LOWER($1) LIMIT 1', [key]);
                blogRow = bySlug.rows?.[0] || null;
            }
            if (!blogRow) {
                // Also check social_posts in case of standalone Reel
                const socRes = await db.query(
                    'SELECT title, caption, payload, blog_id FROM social_posts ORDER BY id DESC LIMIT 100'
                );
                const matchedSoc = (socRes.rows || []).find((r) => {
                    try {
                        const p = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload || {};
                        return String(p.videoUrl || '').includes(rawName) || String(p.posterUrl || '').includes(rawName);
                    } catch {
                        return false;
                    }
                });
                if (matchedSoc) {
                    const p = typeof matchedSoc.payload === 'string' ? JSON.parse(matchedSoc.payload) : matchedSoc.payload || {};
                    blogRow = {
                        id: key,
                        title: matchedSoc.title || p.title || 'DevInquire Tech Insight',
                        excerpt: p.excerpt || matchedSoc.caption || '',
                        content: matchedSoc.caption || '',
                        category: p.category || 'Engineering',
                        tags: p.hashtags || [],
                        featured_image: p.imageUrl || ''
                    };
                }
            }

            if (blogRow) {
                const rendered = await generateBlogReelVideo({ ...blogRow, id: key });
                filePath = isMp4 ? rendered.mp4Path : rendered.posterPath;
            }
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ status: 'error', message: 'Reel video not found.' });
        }

        const stat = fs.statSync(filePath);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        if (req.query.download === '1') {
            res.setHeader('Content-Disposition', `attachment; filename="${rawName}"`);
        }

        if (!isMp4) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Length', stat.size);
            return fs.createReadStream(filePath).pipe(res);
        }

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');

        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10) || 0;
            const end = parts[1] ? Math.min(stat.size - 1, parseInt(parts[1], 10)) : stat.size - 1;
            if (start >= stat.size || start > end) {
                res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
                return res.end();
            }
            const chunkSize = end - start + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Content-Length', chunkSize);
            return fs.createReadStream(filePath, { start, end }).pipe(res);
        }

        res.setHeader('Content-Length', stat.size);
        return fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        console.error('Reel Stream Error:', err);
        return res.status(500).json({ status: 'error', message: 'Failed to stream reel video.' });
    }
});

export default router;
