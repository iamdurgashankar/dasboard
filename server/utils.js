/**
 * Core Utility and Security Middleware for DevInquire Express Backend
 */
import crypto from 'crypto';
import db from './db.js';


/**
 * Send a standardized JSON response
 * @param {object} res - Express response object
 * @param {string} status - "success" or "error"
 * @param {string} message - User-facing message
 * @param {any} data - Optional payload
 * @param {number} httpCode - HTTP status code
 */
export function sendJsonResponse(res, status, message, data = null, httpCode = 200) {
    const response = { status, message };
    if (data !== null) {
        response.data = data;
    }
    return res.status(httpCode).json(response);
}

/**
 * Generate a new CSRF Token and store in session
 * @param {object} req - Express request object
 */
export function generateCsrfToken(req) {
    if (!req.session.csrf_token) {
        req.session.csrf_token = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrf_token;
}

/**
 * Validate CSRF Token
 * @param {object} req - Express request object
 */
export function validateCsrfToken(req) {
    const sessionToken = req.session.csrf_token;
    const headerToken = req.headers['x-csrf-token'];
    const bodyToken = req.body ? req.body.di_csrf_token : null;
    
    const token = headerToken || bodyToken;
    
    if (!sessionToken || !token || token !== sessionToken) {
        return false;
    }
    return true;
}

/**
 * Require authentication middleware
 */
export function requireAuth(req, res, next) {
    if (!req.session.user_id) {
        return sendJsonResponse(res, "error", "Unauthorized: Neural link closed.", null, 401);
    }
    next();
}

/**
 * Require authentication and CSRF validation for state-changing operations
 */
export function requireMutatingAuth(req, res, next) {
    if (!req.session.user_id) {
        return sendJsonResponse(res, "error", "Unauthorized: Neural link closed.", null, 401);
    }
    if (!validateCsrfToken(req)) {
        return sendJsonResponse(res, "error", "Security Violation: CSRF mismatch. Access revoked.", null, 403);
    }
    next();
}

/**
 * Create a new notification Signal in PostgreSQL
 */
export async function createNotification(userId, type, title, message, link = null) {
    try {
        const query = `
            INSERT INTO notifications (user_id, type, title, message, link) 
            VALUES ($1, $2::notification_type, $3, $4, $5)
        `;
        await db.query(query, [userId, type, title, message, link]);
        return true;
    } catch (err) {
        console.error("Notification Signal Fault:", err);
        return false;
    }
}

