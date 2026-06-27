/**
 * Notifications Router
 * Handles listing, marking read, and marking all read for user notifications.
 */
import express from 'express';
import db from '../db.js';
import { sendJsonResponse, requireAuth } from '../utils.js';

const router = express.Router();

const listPaths = ['/list', '/list.php'];
const markReadPaths = ['/mark_read', '/mark_read.php'];
const markAllReadPaths = ['/mark_all_read', '/mark_all_read.php'];

// List Notifications API
router.get(listPaths, requireAuth, async (req, res) => {
    const userId = req.session.user_id;

    try {
        const query = 'SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC LIMIT 50';
        const result = await db.query(query, [userId]);
        const notifications = result.rows;

        // Map to match PHP format exactly (isRead and timestamp, omit is_read and created_at)
        const formatted = notifications.map(n => {
            const copy = { ...n };
            copy.isRead = Boolean(copy.is_read);
            copy.timestamp = copy.created_at;
            delete copy.is_read;
            delete copy.created_at;
            return copy;
        });

        return sendJsonResponse(res, "success", "Notification ledger retrieved.", formatted);
    } catch (err) {
        console.error("Notifications List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve notification ledger.", null, 500);
    }
});

// Mark Notification as Read API
router.post(markReadPaths, requireAuth, async (req, res) => {
    const { id } = req.body;
    const userId = req.session.user_id;

    if (!id) {
        return sendJsonResponse(res, "error", "Target signal missing.", null, 400);
    }

    try {
        const query = 'UPDATE notifications SET is_read = true WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)';
        await db.query(query, [id, userId]);
        
        return sendJsonResponse(res, "success", "Signal synchronized.", null);
    } catch (err) {
        console.error("Mark Read API Error:", err);
        return sendJsonResponse(res, "error", "Internal orchestration fault.", null, 500);
    }
});

// Mark All Notifications as Read API
router.post(markAllReadPaths, requireAuth, async (req, res) => {
    const userId = req.session.user_id;

    try {
        const query = 'UPDATE notifications SET is_read = true WHERE user_id = $1 OR user_id IS NULL';
        await db.query(query, [userId]);

        return sendJsonResponse(res, "success", "All signals synchronized.", null);
    } catch (err) {
        console.error("Mark All Read API Error:", err);
        return sendJsonResponse(res, "error", "Internal orchestration fault.", null, 500);
    }
});

export default router;
