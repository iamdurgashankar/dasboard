/**
 * Public Router (Used by devinquire.com main site)
 * Exposes public endpoints that do not require admin authentication.
 */
import express from 'express';
import nodemailer from 'nodemailer';
import db from '../db.js';
import { sendJsonResponse, createNotification } from '../utils.js';

const router = express.Router();

async function dispatchInquiryEmail(config, inquiry) {
    const smtpHost = config.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(config.smtpPort || process.env.SMTP_PORT || 587);
    const smtpUser = config.smtpUser || process.env.SMTP_USERNAME || '';
    const smtpPass = config.smtpPass || process.env.SMTP_PASSWORD || '';
    const recipient = config.recipientEmail || process.env.CONTACT_EMAIL || 'contact@devinquire.com';
    const fromEmail = config.fromEmail || process.env.SMTP_FROM || process.env.MAIL_FROM_ADDRESS || smtpUser || 'noreply@devinquire.com';
    const fromName = config.fromName || process.env.MAIL_FROM_NAME || 'DevInquire';

    if (!smtpUser || !smtpPass) {
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465 || process.env.SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false }
    });

    const lines = [
        `Name: ${inquiry.name}`,
        `Email: ${inquiry.email}`,
        inquiry.phone ? `Phone: ${inquiry.phone}` : null,
        inquiry.company ? `Company: ${inquiry.company}` : null,
        inquiry.service ? `Service: ${inquiry.service}` : null,
        inquiry.timeline ? `Timeline: ${inquiry.timeline}` : null,
        `Subject: ${inquiry.subject}`,
        '',
        'Message:',
        inquiry.message
    ].filter(Boolean);

    await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: recipient,
        replyTo: inquiry.email,
        subject: `New Inquiry: ${inquiry.subject}`,
        text: lines.join('\n')
    });

    if (config.autoReplyEnabled !== false && inquiry.email) {
        const replyBody = (config.autoReplyTemplate || 'Hello {{name}}, thank you for reaching out to DevInquire. We have received your inquiry regarding "{{subject}}" and will respond within 24 hours.')
            .replace(/\{\{name\}\}/g, inquiry.name || 'Client')
            .replace(/\{\{subject\}\}/g, inquiry.subject || 'your inquiry');

        await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: inquiry.email,
            subject: config.autoReplySubject || 'Thank you for contacting DevInquire',
            text: replyBody
        }).catch(() => {});
    }

    return true;
}

const blogListPaths = ['/blog_list', '/blog_list.php'];
const blogDetailPaths = ['/blog_detail', '/blog_detail.php'];
const contactIntakePaths = ['/contact_intake', '/contact_intake.php'];

// Public Contact Intake API (Receives submissions from devinquire.com main site)
router.post(contactIntakePaths, async (req, res) => {
    const config = db.getSettings('contacts_config');
    if (config.webhookIntakeEnabled === false) {
        return sendJsonResponse(res, "error", "Public contact intake is currently paused by Administrator.", null, 503);
    }

    const { name, email, subject, message, priority, company, phone, service, timeline } = req.body || {};
    if (!name || !email || !message) {
        return sendJsonResponse(res, "error", "Name, email, and message are required.", null, 400);
    }

    try {
        const resolvedPriority = priority || config.defaultPriority || 'Medium';
        const resolvedSubject = subject || (service ? `Service Request: ${service}` : 'Website Contact Submission');
        const cleanEmail = String(email).trim().toLowerCase();
        const cleanSubject = String(resolvedSubject).trim();
        const cleanMessage = String(message).trim();

        // Deduplicate against recent identical submission within the last 30 seconds
        const existingCheck = await db.query('SELECT id, email, subject, message FROM contacts ORDER BY created_at DESC');
        const duplicateRow = (existingCheck.rows || []).slice(0, 5).find(
            (r) =>
                String(r.email || '').toLowerCase() === cleanEmail &&
                String(r.subject || '').trim() === cleanSubject &&
                String(r.message || '').trim() === cleanMessage
        );
        if (duplicateRow) {
            return sendJsonResponse(res, "success", "Inquiry already recorded in dashboard ledger.", {
                id: duplicateRow.id
            });
        }

        const insertRes = await db.query(
            'INSERT INTO contacts (name, email, subject, message, priority) VALUES ($1, $2, $3, $4, $5::contact_priority) RETURNING id',
            [
                String(name).trim(),
                cleanEmail,
                cleanSubject,
                cleanMessage,
                resolvedPriority,
                {
                    company: company || '',
                    phone: phone || '',
                    service: service || '',
                    timeline: timeline || '',
                    status: 'new'
                }
            ]
        );

        const newId = insertRes.rows?.[0]?.id;
        if (newId && (company || phone || service || timeline)) {
            await db
                .query(
                    'UPDATE contacts SET company = $1, phone = $2, service = $3, timeline = $4 WHERE id = $5',
                    [company || '', phone || '', service || '', timeline || '', newId]
                )
                .catch(() => {});
        }

        await createNotification(
            null,
            'info',
            'Website Inquiry Received',
            `${name} (${email}) — ${resolvedSubject}`,
            '/contacts'
        ).catch(() => {});

        const emailSent = await dispatchInquiryEmail(config, {
            name: String(name).trim(),
            email: cleanEmail,
            phone: phone || '',
            company: company || '',
            service: service || '',
            timeline: timeline || '',
            subject: cleanSubject,
            message: cleanMessage
        }).catch((mailErr) => {
            console.warn("Inquiry email dispatch warning:", mailErr.message);
            return false;
        });

        return sendJsonResponse(res, "success", "Inquiry recorded in dashboard ledger.", {
            id: newId,
            emailSent
        });
    } catch (err) {
        console.error("Public Contact Intake Error:", err);
        return sendJsonResponse(res, "error", "Failed to record inquiry.", null, 500);
    }
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

export default router;
