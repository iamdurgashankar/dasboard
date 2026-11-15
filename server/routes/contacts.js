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

const router = express.Router();

const listPaths = ['/list', '/list.php'];
const createPaths = ['/create', '/create.php'];
const updatePaths = ['/update', '/update.php'];
const deletePaths = ['/delete', '/delete.php'];
const configPaths = ['/config', '/config.php'];

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
        const updated = db.updateSettings('contacts_config', req.body || {});
        return sendJsonResponse(res, "success", "Inquiry configuration saved.", updated);
    } catch (err) {
        console.error("Contact Config Save Error:", err);
        return sendJsonResponse(res, "error", "Failed to save inquiry configuration.", null, 500);
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
                const existingRes = await db.query('SELECT email, subject, message FROM contacts');
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

                for (const row of extRows) {
                    if (!row || !row.email || !row.message) continue;
                    const subj = row.subject || (row.service ? `Service Request: ${row.service}` : 'Website Inquiry');
                    const key = `${String(row.email).toLowerCase()}|${String(subj).trim()}|${String(row.message)
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
            return {
                ...s,
                id: String(s.id),
                date: dateStr
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
    const { name, email, subject, message, priority, company, phone, service, timeline, notes } = req.body || {};

    if (!name || !email || !message) {
        return sendJsonResponse(res, "error", "Client name, email, and message are required.");
    }

    try {
        const config = db.getSettings('contacts_config');
        const resolvedPriority = priority || config.defaultPriority || 'Medium';
        const resolvedSubject = subject || (service ? `Service Inquiry: ${service}` : 'Client Inquiry');

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
                    status: 'new'
                }
            ]
        );

        const newId = insertRes.rows?.[0]?.id;
        if (newId && (company || phone || service || timeline || notes)) {
            await db
                .query(
                    'UPDATE contacts SET company = $1, phone = $2, service = $3, timeline = $4, notes = $5 WHERE id = $6',
                    [company || '', phone || '', service || '', timeline || '', notes || '', newId]
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

// Update Contact Inquiry API (Status, Priority, Reply, Notes)
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
    const { id, status, priority, reply_message, notes, subject, name, email } = req.body;

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

        if (fields.length === 0) {
            return sendJsonResponse(res, "error", "No parameters provided for update.");
        }

        params.push(id);
        const query = `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${paramCount}`;
        await db.query(query, params);

        return sendJsonResponse(res, "success", "Inquiry state updated.");
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
        const query = 'DELETE FROM contacts WHERE id = $1';
        await db.query(query, [id]);

        return sendJsonResponse(res, "success", "Inquiry purged from ledger.");
    } catch (err) {
        console.error("Contact Delete API Error:", err);
        return sendJsonResponse(res, "error", "Failed to purge inquiry.", null, 500);
    }
});

export default router;
