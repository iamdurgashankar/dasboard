/**
 * Contacts Router
 * Handles listing, updating, and deleting contact submissions (inquiries).
 */
import express from 'express';
import db from '../db.js';
import { 
    sendJsonResponse, 
    requireAuth, 
    requireMutatingAuth 
} from '../utils.js';

const router = express.Router();

const listPaths = ['/list', '/list.php'];
const updatePaths = ['/update', '/update.php'];
const deletePaths = ['/delete', '/delete.php'];

// List Contact Inquiries API
router.get(listPaths, requireAuth, async (req, res) => {
    try {
        const query = 'SELECT * FROM contacts ORDER BY created_at DESC';
        const result = await db.query(query);
        const submissions = result.rows;

        // Map date format (YYYY-MM-DD) to match PHP explode(' ', created_at)[0]
        const formatted = submissions.map(s => {
            let dateStr = '';
            if (s.created_at) {
                if (s.created_at instanceof Date) {
                    dateStr = s.created_at.toISOString().split('T')[0];
                } else {
                    dateStr = String(s.created_at).split(' ')[0];
                }
            }
            return {
                ...s,
                date: dateStr
            };
        });

        return sendJsonResponse(res, "success", "Inquiry ledger retrieved.", formatted);
    } catch (err) {
        console.error("Contact List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve inquiry ledger.", null, 500);
    }
});

// Update Contact Inquiry API
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
    const { id, status, priority } = req.body;

    if (!id) {
        return sendJsonResponse(res, "error", "Inquiry ID required for update.");
    }

    try {
        const fields = [];
        const params = [];
        let paramCount = 1;

        if (status !== undefined && status !== '') {
            fields.push(`status = $${paramCount++}::contact_status`);
            params.push(status);
        }
        if (priority !== undefined && priority !== '') {
            fields.push(`priority = $${paramCount++}::contact_priority`);
            params.push(priority);
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
