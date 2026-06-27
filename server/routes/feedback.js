/**
 * Feedback Router
 * Handles user contact form submissions.
 */
import express from 'express';
import db from '../db.js';
import { sendJsonResponse } from '../utils.js';

const router = express.Router();

const submitPaths = ['/submit', '/submit.php'];

// Contact/Feedback Submission API
router.post(submitPaths, async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return sendJsonResponse(res, "error", "All fields are required for transmission.");
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return sendJsonResponse(res, "error", "Invalid communication endpoint (email).");
    }

    try {
        const query = `
            INSERT INTO contacts (name, email, subject, message, status, priority) 
            VALUES ($1, $2, $3, $4, 'new', 'Medium') 
            RETURNING id
        `;
        const result = await db.query(query, [name, email, subject, message]);
        const contactId = result.rows[0].id;

        return sendJsonResponse(res, "success", "Inquiry transmitted to the core. We will reach out soon.", { id: contactId });
    } catch (err) {
        console.error("Feedback Submission API Error:", err);
        return sendJsonResponse(res, "error", "Transmission failed. Neural link unstable.", null, 500);
    }
});

export default router;
