/**
 * Contacts Router
 * Handles listing, creating, updating, replying, deleting, and configuring client inquiries.
 */
import express from 'express';
import db from '../db.js';
import { 
    sendJsonResponse, 
    requireAuth, 
    requireMutatingAuth,
    createNotification
} from '../utils.js';
import { createSmtpTransporter, resolveSmtpSettings } from './public.js';

const router = express.Router();

const listPaths = ['/list', '/list.php'];
const createPaths = ['/create', '/create.php'];
const updatePaths = ['/update', '/update.php'];
const deletePaths = ['/delete', '/delete.php'];
const configPaths = ['/config', '/config.php'];
const testSmtpPaths = ['/test-smtp', '/test_smtp', '/test-smtp.php'];

// Get Client Inquiry Configuration
router.get(configPaths, requireAuth, async (req, res) => {
    try {
        const config = db.getSettings('contacts_config');
        return sendJsonResponse(res, "success", "Inquiry configuration retrieved.", config);
    } catch (err) {
        console.error("Contact Config Get Error:", err);
        return sendJsonResponse(res, "error", "Failed to load inquiry configuration.", null, 500);
    }
});

// Update Client Inquiry Configuration (Admin)
router.post(configPaths, requireMutatingAuth, async (req, res) => {
    try {
        const updated = await db.updateSettingsAsync('contacts_config', req.body || {});
        return sendJsonResponse(res, "success", "Inquiry configuration saved.", updated);
    } catch (err) {
        console.error("Contact Config Save Error:", err);
        return sendJsonResponse(res, "error", "Failed to save inquiry configuration.", null, 500);
    }
});

// Verify & Send Live Test Email via Configured SMTP (Admin)
router.post(testSmtpPaths, requireMutatingAuth, async (req, res) => {
    try {
        const existingConfig = db.getSettings('contacts_config');
        const mergedConfig = {
            ...existingConfig,
            ...(req.body || {})
        };
        if (
            (mergedConfig.smtpPass === undefined || mergedConfig.smtpPass === '' || mergedConfig.smtpPass === '********') &&
            existingConfig.smtpPass
        ) {
            mergedConfig.smtpPass = existingConfig.smtpPass;
        }

        const { transporter, settings } = createSmtpTransporter(mergedConfig);
        if (!transporter) {
            return sendJsonResponse(
                res,
                "error",
                "Please enter your Hostinger mailbox password (for contact@devinquire.com) before testing.",
                null,
                400
            );
        }

        await transporter.verify();
        await transporter.sendMail({
            from: `"${settings.fromName}" <${settings.fromEmail}>`,
            to: settings.recipient,
            replyTo: settings.fromEmail,
            subject: `[DevInquire Live SMTP Verified] Hostinger Mailbox Connected`,
            text: [
                'Your live DevInquire Hostinger SMTP configuration is active and verified!',
                '',
                `SMTP Host: ${settings.smtpHost}:${settings.smtpPort} (${settings.secure ? 'SSL/TLS' : 'STARTTLS'})`,
                `Authenticated Mailbox: ${settings.smtpUser}`,
                `From Address: ${settings.fromEmail}`,
                `Recipient Mailbox: ${settings.recipient}`,
                `Timestamp: ${new Date().toISOString()}`,
                '',
                'All live form submissions from https://devinquire.com (Contact, Services, Product Demo, Newsletter, and Stripe Pre-Bookings) now deliver directly to this mailbox.'
            ].join('\n')
        });

        const saved = await db.updateSettingsAsync('contacts_config', mergedConfig);
        return sendJsonResponse(
            res,
            "success",
            `Live Hostinger SMTP verified! Test email delivered to ${settings.recipient}.`,
            saved
        );
    } catch (err) {
        console.error("Live SMTP Test Error:", err);
        const rawMsg = err?.message || "SMTP connection failed.";
        const hint = /535|auth/i.test(rawMsg)
            ? "Authentication failed (535). Double-check the mailbox password for contact@devinquire.com in Hostinger hPanel → Emails."
            : /553|sender/i.test(rawMsg)
            ? "Sender rejected (553). Ensure From Email matches your Hostinger mailbox (contact@devinquire.com)."
            : rawMsg;
        return sendJsonResponse(res, "error", `SMTP Error: ${hint}`, null, 400);
    }
});

// List Contact Inquiries API (Auto-syncs any inquiries from contact_submissions table into contacts)
router.get(listPaths, requireAuth, async (req, res) => {
    try {
        // Auto-sync any main-site `contact_submissions` rows that aren't yet in `contacts`
        try {
            const extRes = await db.query('SELECT * FROM contact_submissions ORDER BY created_at DESC');
            const extRows = extRes.rows || [];
            if (extRows.length > 0) {
                const existingRes = await db.query('SELECT email, subject, message, payment_status FROM contacts');
                const existingSet = new Set(
                    (existingRes.rows || []).map(
                        (r) =>
                            `${String(r.email || '').toLowerCase()}|${String(r.subject || '').trim()}|${String(
                                r.message || ''
                            )
                                .trim()
                                .slice(0, 80)}`
                    )
                );

                const paidEmailsInContacts = new Set(
                    (existingRes.rows || [])
                        .filter((r) => String(r.payment_status || '').toLowerCase() === 'paid' || /^\[PAID/i.test(String(r.subject || '')))
                        .map((r) => String(r.email || '').toLowerCase())
                );

                for (const row of extRows) {
                    if (!row || !row.email || !row.message) continue;
                    const rowEmailLower = String(row.email).toLowerCase();
                    const subj = row.subject || (row.service ? `Service Request: ${row.service}` : 'Website Inquiry');
                    // Skip legacy [PAID ...] log row in contact_submissions when contacts already holds the reconciled paid inquiry
                    if (/^\[PAID/i.test(String(subj)) && paidEmailsInContacts.has(rowEmailLower)) {
                        continue;
                    }
                    const key = `${rowEmailLower}|${String(subj).trim()}|${String(row.message)
                        .trim()
                        .slice(0, 80)}`;
                    if (!existingSet.has(key)) {
                        existingSet.add(key);
                        const prioRaw = String(row.priority || 'Medium').toLowerCase();
                        const prio =
                            prioRaw === 'high' || prioRaw === 'urgent'
                                ? 'High'
                                : prioRaw === 'low'
                                ? 'Low'
                                : 'Medium';
                        const ins = await db.query(
                            'INSERT INTO contacts (name, email, subject, message, priority) VALUES ($1, $2, $3, $4, $5::contact_priority) RETURNING id',
                            [
                                String(row.name || 'Website Visitor').trim(),
                                String(row.email).trim().toLowerCase(),
                                String(subj).trim(),
                                String(row.message).trim(),
                                prio,
                                {
                                    company: row.company || '',
                                    phone: row.phone || '',
                                    service: row.service || '',
                                    timeline: row.timeline || '',
                                    status: row.status || 'new'
                                }
                            ]
                        );
                        const insertedId = ins.rows?.[0]?.id;
                        if (insertedId && (row.company || row.phone || row.service || row.timeline)) {
                            await db
                                .query(
                                    'UPDATE contacts SET company = $1, phone = $2, service = $3, timeline = $4 WHERE id = $5',
                                    [row.company || '', row.phone || '', row.service || '', row.timeline || '', insertedId]
                                )
                                .catch(() => {});
                        }
                    }
                }
            }
        } catch {
            // contact_submissions table may not exist in embedded-only mode; ignore safely
        }

        // Auto-sync any main-site `payments` rows into `contacts` so payment confirmations always appear in Inquiries
        try {
            const payRes = await db.query('SELECT * FROM payments ORDER BY created_at DESC');
            const payRows = payRes.rows || [];
            if (payRows.length > 0) {
                const contactsRes = await db.query('SELECT * FROM contacts ORDER BY created_at DESC');
                const currentContacts = contactsRes.rows || [];

                for (const pRow of payRows) {
                    if (!pRow || !pRow.customer_email) continue;
                    const ref = pRow.stripe_payment_intent_id || pRow.stripe_session_id || '';
                    const amtRupees = Math.round((Number(pRow.amount) || 0) / 100);
                    const pStatus = String(pRow.payment_status || 'pending').toLowerCase();
                    const pEmail = String(pRow.customer_email).trim().toLowerCase();

                    const existingMatch = currentContacts.find(
                        (c) =>
                            (ref && String(c.payment_reference || '') === String(ref)) ||
                            (String(c.email || '').toLowerCase() === pEmail &&
                                (c.payment_status === 'pending' || c.payment_status === 'none'))
                    );

                    if (existingMatch) {
                        if (
                            (pStatus === 'paid' && existingMatch.payment_status !== 'paid') ||
                            (!existingMatch.payment_reference && ref)
                        ) {
                            await db
                                .query(
                                    `UPDATE contacts
                                     SET payment_status = $1, payment_plan = $2, payment_amount = $3,
                                         payment_currency = $4, payment_reference = $5, paid_at = $6,
                                         priority = $7::contact_priority
                                     WHERE id = $8`,
                                    [
                                        pStatus,
                                        pRow.plan_type || existingMatch.payment_plan || 'consultation',
                                        amtRupees || Number(existingMatch.payment_amount) || 0,
                                        String(pRow.currency || 'INR').toUpperCase(),
                                        ref || existingMatch.payment_reference || '',
                                        pRow.paid_at
                                            ? new Date(pRow.paid_at).toISOString()
                                            : existingMatch.paid_at || null,
                                        pStatus === 'paid' ? 'High' : existingMatch.priority || 'Medium',
                                        existingMatch.id
                                    ]
                                )
                                .catch(() => {});
                        }
                    } else if (pStatus === 'paid' || pStatus === 'pending') {
                        const planLabel =
                            pRow.plan_type === 'service_confirmation'
                                ? `Service Confirmation (₹${amtRupees || 99}/-)`
                                : `1:1 Technical Consultation (₹${amtRupees || 399}/-)`;
                        const subj =
                            pStatus === 'paid'
                                ? `[PAID ₹${amtRupees}/-] ${planLabel}`
                                : `[Checkout Pending] ${planLabel}`;
                        const msg = pRow.notes || `${planLabel}${pRow.service_name ? ` — ${pRow.service_name}` : ''}`;
                        const ins = await db.query(
                            'INSERT INTO contacts (name, email, subject, message, priority) VALUES ($1, $2, $3, $4, $5::contact_priority) RETURNING id',
                            [
                                String(pRow.customer_name || 'Client').trim(),
                                pEmail,
                                subj,
                                msg,
                                pStatus === 'paid' ? 'High' : 'Medium',
                                {
                                    company: pRow.company || '',
                                    phone: pRow.customer_phone || '',
                                    service: pRow.service_name || planLabel,
                                    form_source: 'Stripe Pre-Booking',
                                    payment_status: pStatus,
                                    payment_plan: pRow.plan_type || 'consultation',
                                    payment_amount: amtRupees,
                                    payment_currency: String(pRow.currency || 'INR').toUpperCase(),
                                    payment_reference: ref,
                                    paid_at: pRow.paid_at ? new Date(pRow.paid_at).toISOString() : null,
                                    status: 'new'
                                }
                            ]
                        );
                        const insertedId = ins.rows?.[0]?.id;
                        if (insertedId) {
                            await db
                                .query(
                                    `UPDATE contacts
                                     SET company = $1, phone = $2, service = $3, form_source = $4,
                                         payment_status = $5, payment_plan = $6, payment_amount = $7,
                                         payment_currency = $8, payment_reference = $9, paid_at = $10
                                     WHERE id = $11`,
                                    [
                                        pRow.company || '',
                                        pRow.customer_phone || '',
                                        pRow.service_name || planLabel,
                                        'Stripe Pre-Booking',
                                        pStatus,
                                        pRow.plan_type || 'consultation',
                                        amtRupees,
                                        String(pRow.currency || 'INR').toUpperCase(),
                                        ref,
                                        pRow.paid_at ? new Date(pRow.paid_at).toISOString() : null,
                                        insertedId
                                    ]
                                )
                                .catch(() => {});
                        }
                    }
                }
            }
        } catch {
            // payments table may not exist in embedded-only mode; ignore safely
        }

        const query = 'SELECT * FROM contacts ORDER BY created_at DESC';
        const result = await db.query(query);
        const submissions = result.rows || [];

        const formatted = submissions.map(s => {
            let dateStr = '';
            if (s.created_at) {
                if (s.created_at instanceof Date) {
                    dateStr = s.created_at.toISOString().split('T')[0];
                } else {
                    dateStr = String(s.created_at).split('T')[0].split(' ')[0];
                }
            }
            let parsedFormData = null;
            if (s.form_payload) {
                try {
                    parsedFormData =
                        typeof s.form_payload === 'string' ? JSON.parse(s.form_payload) : s.form_payload;
                } catch {
                    parsedFormData = null;
                }
            }
            // Infer payment confirmation from legacy `[PAID ₹399/-]` subject lines if columns were unset
            let paymentStatus = s.payment_status || 'none';
            let paymentAmount = Number(s.payment_amount) || 0;
            let paymentPlan = s.payment_plan || '';
            if (paymentStatus === 'none' && /^\[PAID/i.test(String(s.subject || ''))) {
                paymentStatus = 'paid';
                const amtMatch = String(s.subject).match(/₹\s*(\d+)/);
                if (amtMatch) paymentAmount = Number(amtMatch[1]) || 0;
                paymentPlan = paymentAmount === 99 ? 'service_confirmation' : 'consultation';
            }

            return {
                ...s,
                id: String(s.id),
                date: dateStr,
                payment_status: paymentStatus,
                payment_amount: paymentAmount,
                payment_plan: paymentPlan,
                payment_currency: s.payment_currency || 'INR',
                form_source:
                    s.form_source ||
                    parsedFormData?.form_source ||
                    (s.service === 'Newsletter'
                        ? 'Newsletter'
                        : s.service
                        ? 'Services Inquiry'
                        : 'Contact Form'),
                formData: parsedFormData
            };
        });

        return sendJsonResponse(res, "success", "Inquiry ledger retrieved.", formatted);
    } catch (err) {
        console.error("Contact List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve inquiry ledger.", null, 500);
    }
});

// Create / Log Client Inquiry API
router.post(createPaths, requireMutatingAuth, async (req, res) => {
    const {
        name,
        email,
        subject,
        message,
        priority,
        company,
        phone,
        service,
        timeline,
        notes,
        form_source,
        payment_status,
        payment_plan,
        payment_amount,
        payment_currency,
        payment_reference,
        paid_at
    } = req.body || {};

    if (!name || !email || !message) {
        return sendJsonResponse(res, "error", "Client name, email, and message are required.");
    }

    try {
        const config = db.getSettings('contacts_config');
        const resolvedPaymentStatus = payment_status || 'none';
        const resolvedPriority =
            resolvedPaymentStatus === 'paid'
                ? 'High'
                : priority || config.defaultPriority || 'Medium';
        const resolvedSubject = subject || (service ? `Service Inquiry: ${service}` : 'Client Inquiry');
        const resolvedPaidAt =
            resolvedPaymentStatus === 'paid' ? paid_at || new Date().toISOString() : null;

        const insertRes = await db.query(
            'INSERT INTO contacts (name, email, subject, message, priority) VALUES ($1, $2, $3, $4, $5::contact_priority) RETURNING id',
            [
                name.trim(),
                email.trim().toLowerCase(),
                resolvedSubject.trim(),
                message.trim(),
                resolvedPriority,
                {
                    company: company || '',
                    phone: phone || '',
                    service: service || '',
                    timeline: timeline || '',
                    notes: notes || '',
                    form_source: form_source || 'Manual Entry',
                    payment_status: resolvedPaymentStatus,
                    payment_plan: payment_plan || '',
                    payment_amount: Number(payment_amount) || 0,
                    payment_currency: payment_currency || 'INR',
                    payment_reference: payment_reference || '',
                    paid_at: resolvedPaidAt,
                    status: 'new'
                }
            ]
        );

        const newId = insertRes.rows?.[0]?.id;
        if (newId) {
            await db
                .query(
                    `UPDATE contacts
                     SET company = $1, phone = $2, service = $3, timeline = $4, notes = $5,
                         form_source = $6, payment_status = $7, payment_plan = $8,
                         payment_amount = $9, payment_currency = $10, payment_reference = $11, paid_at = $12
                     WHERE id = $13`,
                    [
                        company || '',
                        phone || '',
                        service || '',
                        timeline || '',
                        notes || '',
                        form_source || 'Manual Entry',
                        resolvedPaymentStatus,
                        payment_plan || '',
                        Number(payment_amount) || 0,
                        payment_currency || 'INR',
                        payment_reference || '',
                        resolvedPaidAt,
                        newId
                    ]
                )
                .catch(() => {});
        }

        await createNotification(
            null,
            'info',
            'New Client Inquiry Logged',
            `${name} (${email}) — ${resolvedSubject}`,
            '/contacts'
        ).catch(() => {});

        return sendJsonResponse(res, "success", "Client inquiry logged in ledger.", {
            id: newId ? String(newId) : String(Date.now())
        });
    } catch (err) {
        console.error("Contact Create API Error:", err);
        return sendJsonResponse(res, "error", "Failed to create client inquiry.", null, 500);
    }
});

// Update Contact Inquiry API (Status, Priority, Reply, Notes, Payment Confirmation)
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
    const {
        id,
        status,
        priority,
        reply_message,
        notes,
        subject,
        name,
        email,
        company,
        phone,
        service,
        timeline,
        payment_status,
        payment_plan,
        payment_amount,
        payment_currency,
        payment_reference,
        paid_at
    } = req.body;

    if (!id) {
        return sendJsonResponse(res, "error", "Inquiry ID required for update.");
    }

    try {
        const fields = [];
        const params = [];
        let paramCount = 1;

        const effectiveStatus =
            reply_message !== undefined && String(reply_message).trim() !== '' && !status
                ? 'replied'
                : status;

        if (effectiveStatus !== undefined && effectiveStatus !== '') {
            fields.push(`status = $${paramCount++}::contact_status`);
            params.push(effectiveStatus);
        }
        if (priority !== undefined && priority !== '') {
            fields.push(`priority = $${paramCount++}::contact_priority`);
            params.push(priority);
        }
        if (reply_message !== undefined) {
            fields.push(`reply_message = $${paramCount++}`);
            params.push(reply_message);
            fields.push(`replied_at = $${paramCount++}`);
            params.push(new Date().toISOString());
        }
        if (notes !== undefined) {
            fields.push(`notes = $${paramCount++}`);
            params.push(notes);
        }
        if (subject !== undefined && subject !== '') {
            fields.push(`subject = $${paramCount++}`);
            params.push(subject);
        }
        if (name !== undefined && name !== '') {
            fields.push(`name = $${paramCount++}`);
            params.push(name);
        }
        if (email !== undefined && email !== '') {
            fields.push(`email = $${paramCount++}`);
            params.push(email);
        }
        if (company !== undefined) {
            fields.push(`company = $${paramCount++}`);
            params.push(company);
        }
        if (phone !== undefined) {
            fields.push(`phone = $${paramCount++}`);
            params.push(phone);
        }
        if (service !== undefined) {
            fields.push(`service = $${paramCount++}`);
            params.push(service);
        }
        if (timeline !== undefined) {
            fields.push(`timeline = $${paramCount++}`);
            params.push(timeline);
        }
        if (payment_status !== undefined) {
            fields.push(`payment_status = $${paramCount++}`);
            params.push(payment_status);
            if (payment_status === 'paid' && paid_at === undefined) {
                fields.push(`paid_at = $${paramCount++}`);
                params.push(new Date().toISOString());
            }
        }
        if (payment_plan !== undefined) {
            fields.push(`payment_plan = $${paramCount++}`);
            params.push(payment_plan);
        }
        if (payment_amount !== undefined) {
            fields.push(`payment_amount = $${paramCount++}`);
            params.push(Number(payment_amount) || 0);
        }
        if (payment_currency !== undefined) {
            fields.push(`payment_currency = $${paramCount++}`);
            params.push(payment_currency);
        }
        if (payment_reference !== undefined) {
            fields.push(`payment_reference = $${paramCount++}`);
            params.push(payment_reference);
        }
        if (paid_at !== undefined) {
            fields.push(`paid_at = $${paramCount++}`);
            params.push(paid_at);
        }

        if (fields.length === 0) {
            return sendJsonResponse(res, "error", "No parameters provided for update.");
        }

        params.push(id);
        const query = `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${paramCount}`;
        await db.query(query, params);

        let replyEmailSent = false;
        if (reply_message !== undefined && String(reply_message).trim() !== '') {
            try {
                const rowRes = await db.query('SELECT name, email, subject FROM contacts WHERE id = $1 LIMIT 1', [id]);
                const row = rowRes.rows?.[0];
                const recipientTo = (email || row?.email || '').trim();
                const config = db.getSettings('contacts_config');
                const { transporter, settings } = createSmtpTransporter(config);
                if (transporter && recipientTo) {
                    const subjBase = subject || row?.subject || 'Your Inquiry with DevInquire';
                    await transporter.sendMail({
                        from: `"${settings.fromName}" <${settings.fromEmail}>`,
                        to: recipientTo,
                        replyTo: settings.recipient,
                        subject: /^re:/i.test(subjBase) ? subjBase : `Re: ${subjBase}`,
                        text: String(reply_message).trim()
                    });
                    replyEmailSent = true;
                }
            } catch (replyMailErr) {
                console.warn("Admin reply SMTP dispatch warning:", replyMailErr.message);
            }
        }

        return sendJsonResponse(res, "success", "Inquiry state updated.", { replyEmailSent });
    } catch (err) {
        console.error("Contact Update API Error:", err);
        return sendJsonResponse(res, "error", "Failed to update inquiry state.", null, 500);
    }
});

// Delete Contact Inquiry API
router.post(deletePaths, requireMutatingAuth, async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return sendJsonResponse(res, "error", "Inquiry ID required for purge.");
    }

    try {
        const existingRes = await db
            .query('SELECT email, subject, payment_reference FROM contacts WHERE id = $1 LIMIT 1', [id])
            .catch(() => ({ rows: [] }));
        const target = existingRes.rows?.[0] || null;

        const query = 'DELETE FROM contacts WHERE id = $1';
        await db.query(query, [id]);

        if (target?.email) {
            await db
                .query(
                    'DELETE FROM contact_submissions WHERE LOWER(email) = LOWER($1) AND (subject = $2 OR subject LIKE $3)',
                    [target.email, target.subject || '', '[PAID%']
                )
                .catch(() => {});
            if (target.payment_reference) {
                await db
                    .query(
                        'DELETE FROM payments WHERE stripe_session_id = $1 OR stripe_payment_intent_id = $2',
                        [target.payment_reference, target.payment_reference]
                    )
                    .catch(() => {});
            }
        }

        return sendJsonResponse(res, "success", "Inquiry purged from ledger.");
    } catch (err) {
        console.error("Contact Delete API Error:", err);
        return sendJsonResponse(res, "error", "Failed to purge inquiry.", null, 500);
    }
});

export default router;
