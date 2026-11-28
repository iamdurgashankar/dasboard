/**
 * Core Utility and Security Middleware for DevInquire Express Backend
 */
import crypto from 'crypto';
import db from './db.js';

const TOKEN_SECRET =
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    'devinquire-neural-hub-token-secret-2026-pro';

/**
 * Normalize role to match frontend UserRole ('Admin' | 'Developer' | 'Viewer')
 */
export function normalizeRole(role) {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'admin') return 'Admin';
    if (r === 'developer') return 'Developer';
    if (r === 'editor') return 'Editor';
    if (r === 'viewer' || r === 'user') return 'Viewer';
    return 'Admin';
}

/**
 * Create an HMAC-SHA256 signed token that doubles as a CSRF token and
 * stateless session fallback when reverse proxies or browsers strip cookies.
 */
export function createSignedToken(user = {}) {
    const payload = {
        uid: user.id || 1,
        name: user.name || 'System Alpha',
        email: user.email || 'admin@devinquire.com',
        role: normalizeRole(user.role || 'Admin'),
        nonce: crypto.randomBytes(12).toString('hex'),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(encoded)
        .digest('base64url');
    return `${encoded}.${sig}`;
}

/**
 * Verify an HMAC-SHA256 signed token and return its payload if valid
 */
export function verifySignedToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return null;
    }
    try {
        const [encoded, sig] = token.split('.');
        if (!encoded || !sig) return null;
        const expectedSig = crypto
            .createHmac('sha256', TOKEN_SECRET)
            .update(encoded)
            .digest('base64url');
        if (sig !== expectedSig) return null;
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (!payload || !payload.uid) return null;
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

/**
 * Extract token from request headers or body
 */
function extractRequestToken(req) {
    const headerToken = req.headers['x-csrf-token'];
    if (headerToken && typeof headerToken === 'string') {
        return headerToken.trim();
    }
    const authHeader = req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
        return authHeader.replace(/^Bearer\s+/i, '').trim();
    }
    if (req.body && req.body.di_csrf_token) {
        return String(req.body.di_csrf_token).trim();
    }
    return '';
}

/**
 * Hydrate req.session from signed token if session cookie was not persisted
 */
export function hydrateSessionFromToken(req) {
    if (req.session && req.session.user_id) {
        return true;
    }
    const token = extractRequestToken(req);
    const payload = verifySignedToken(token);
    if (payload) {
        if (!req.session) req.session = {};
        req.session.user_id = payload.uid;
        req.session.user_name = payload.name;
        req.session.user_role = payload.role;
        req.session.csrf_token = token;
        return true;
    }
    return false;
}

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
 * @param {object} [user] - Authenticated user object
 */
export function generateCsrfToken(req, user = null) {
    const tokenUser = user || {
        id: req.session?.user_id || 1,
        name: req.session?.user_name || 'System Alpha',
        role: req.session?.user_role || 'Admin'
    };
    const token = createSignedToken(tokenUser);
    if (req.session) {
        req.session.csrf_token = token;
    }
    return token;
}

/**
 * Validate CSRF Token
 * @param {object} req - Express request object
 */
export function validateCsrfToken(req) {
    const sessionToken = req.session?.csrf_token;
    const token = extractRequestToken(req);

    if (!token) {
        return false;
    }
    if (sessionToken && token === sessionToken) {
        return true;
    }
    const verified = verifySignedToken(token);
    if (verified) {
        hydrateSessionFromToken(req);
        return true;
    }
    return false;
}

/**
 * Require authentication middleware
 */
export function requireAuth(req, res, next) {
    hydrateSessionFromToken(req);
    if (!req.session?.user_id) {
        return sendJsonResponse(res, "error", "Unauthorized: Neural link closed.", null, 401);
    }
    next();
}

/**
 * Require authentication and CSRF validation for state-changing operations
 */
export function requireMutatingAuth(req, res, next) {
    hydrateSessionFromToken(req);
    if (!req.session?.user_id) {
        return sendJsonResponse(res, "error", "Unauthorized: Neural link closed.", null, 401);
    }
    if (!validateCsrfToken(req)) {
        return sendJsonResponse(res, "error", "Security Violation: CSRF mismatch. Access revoked.", null, 403);
    }
    next();
}

/**
 * Require Administrator role for read-sensitive configuration endpoints
 */
export function requireAdmin(req, res, next) {
    hydrateSessionFromToken(req);
    if (!req.session?.user_id) {
        return sendJsonResponse(res, "error", "Unauthorized: Neural link closed.", null, 401);
    }
    if (normalizeRole(req.session?.user_role) !== 'Admin') {
        return sendJsonResponse(res, "error", "Forbidden: Administrator privileges required.", null, 403);
    }
    next();
}

/**
 * Require Administrator role + CSRF validation for mutating configuration/user endpoints
 */
export function requireMutatingAdmin(req, res, next) {
    hydrateSessionFromToken(req);
    if (!req.session?.user_id) {
        return sendJsonResponse(res, "error", "Unauthorized: Neural link closed.", null, 401);
    }
    if (!validateCsrfToken(req)) {
        return sendJsonResponse(res, "error", "Security Violation: CSRF mismatch. Access revoked.", null, 403);
    }
    if (normalizeRole(req.session?.user_role) !== 'Admin') {
        return sendJsonResponse(res, "error", "Forbidden: Administrator privileges required.", null, 403);
    }
    next();
}

/**
 * Create a new notification Signal in Database
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
