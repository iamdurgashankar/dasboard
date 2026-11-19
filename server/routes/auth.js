/**
 * Authentication Router
 * Handles login, registration/access requests, identity checks, and logout.
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { 
    sendJsonResponse, 
    generateCsrfToken, 
    requireAuth,
    normalizeRole,
    createNotification
} from '../utils.js';

const router = express.Router();

// Helper to support both clean and .php endpoints
const loginPaths = ['/login', '/login.php'];
const registerPaths = ['/register', '/register.php'];
const mePaths = ['/me', '/me.php'];
const logoutPaths = ['/logout', '/logout.php'];

// Login API
router.post(loginPaths, async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return sendJsonResponse(res, "error", "Email and password required.", null, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    try {
        let result = await db.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [normalizedEmail]
        );
        let user = result.rows && result.rows[0];

        // If admin user is logging in on an unseeded DB, trigger bootstrap once and re-query
        if (!user && normalizedEmail === 'admin@devinquire.com') {
            await db.bootstrap();
            result = await db.query(
                'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
                [normalizedEmail]
            );
            user = result.rows && result.rows[0];
        }

        if (user) {
            const rawHash = user.password || user.password_hash || '';
            // Support PHP $2y$ bcrypt hashes in Node bcryptjs
            const compatibleHash = String(rawHash).replace(/^\$2y\$/, '$2a$');
            const isMatch = compatibleHash
                ? await bcrypt.compare(password, compatibleHash)
                : false;

            if (isMatch) {
                const rawStatus = String(user.status || '').trim().toLowerCase();
                const status = rawStatus || (user.is_active === 1 ? 'active' : 'pending');
                if (status !== 'active') {
                    return sendJsonResponse(res, "error", "Account pending approval.", null, 403);
                }

                const cleanUser = {
                    id: String(user.id),
                    name: user.name || 'System Alpha',
                    email: user.email,
                    role: normalizeRole(user.role),
                    status: 'active',
                    avatar: user.avatar || undefined,
                    joinDate: user.join_date
                        ? String(user.join_date).split('T')[0].split(' ')[0]
                        : user.created_at
                            ? String(user.created_at).split('T')[0].split(' ')[0]
                            : new Date().toISOString().split('T')[0]
                };

                // Set session
                req.session.user_id = user.id;
                req.session.user_name = cleanUser.name;
                req.session.user_role = cleanUser.role;

                // Generate signed CSRF/session token
                const csrfToken = generateCsrfToken(req, cleanUser);

                return req.session.save(() => {
                    return sendJsonResponse(
                        res,
                        "success",
                        "Authentication successful. Welcome to the Neural Hub.",
                        {
                            user: cleanUser,
                            csrf_token: csrfToken
                        }
                    );
                });
            }
        }

        return sendJsonResponse(res, "error", "Invalid credentials. Link denied.", null, 401);
    } catch (err) {
        console.error("Login API Error:", err);
        return sendJsonResponse(res, "error", `Login Error: ${err.message}`, null, 500);
    }
});

// Registration / Access Request API
router.post(registerPaths, async (req, res) => {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
        return sendJsonResponse(res, "error", "Name, email, and password required.", null, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    try {
        const existing = await db.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [normalizedEmail]
        );
        if (existing.rows && existing.rows.length > 0) {
            return sendJsonResponse(res, "error", "Identity already registered in ledger.", null, 409);
        }

        const hashedPass = await bcrypt.hash(password, 10);
        const insertRes = await db.query(
            `INSERT INTO users (email, password, name, role, status)
             VALUES ($1, $2, $3, $4::user_role, $5::user_status)
             RETURNING id`,
            [normalizedEmail, hashedPass, String(name).trim(), 'Developer', 'pending']
        );
        const userId = insertRes.rows?.[0]?.id || `req-${Date.now()}`;

        if (insertRes.rows?.[0]?.id) {
            await db.query(
                "UPDATE users SET role = $1, status = $2 WHERE id = $3",
                ['Developer', 'pending', userId]
            ).catch(() => {});
            await db.query(
                "UPDATE users SET is_active = 0 WHERE id = $1",
                [userId]
            ).catch(() => {});
        }

        await createNotification(
            null,
            'info',
            'New Access Request',
            `${String(name).trim()} (${normalizedEmail}) requested workspace access.`,
            '/users'
        ).catch(() => {});

        return sendJsonResponse(res, "success", "Access request queued for administrative override.", {
            user: {
                id: String(userId),
                name: String(name).trim(),
                email: normalizedEmail,
                role: 'Developer',
                status: 'pending',
                joinDate: new Date().toISOString().split('T')[0]
            }
        });
    } catch (err) {
        console.error("Register API Error:", err);
        return sendJsonResponse(res, "error", `Registration Error: ${err.message}`, null, 500);
    }
});

// Get Current User Identity API
router.get(mePaths, requireAuth, async (req, res) => {
    const userId = req.session.user_id;

    try {
        const query = 'SELECT * FROM users WHERE id = $1 LIMIT 1';
        const result = await db.query(query, [userId]);
        const user = result.rows[0];

        if (user) {
            const cleanUser = {
                id: String(user.id),
                name: user.name || req.session.user_name || 'System Alpha',
                email: user.email,
                role: normalizeRole(user.role),
                status: user.status || 'active',
                avatar: user.avatar || undefined,
                joinDate: user.join_date
                    ? String(user.join_date).split('T')[0].split(' ')[0]
                    : user.created_at
                        ? String(user.created_at).split('T')[0].split(' ')[0]
                        : new Date().toISOString().split('T')[0]
            };
            return sendJsonResponse(res, "success", "Identity retrieved.", cleanUser);
        } else {
            req.session.destroy(() => {});
            return sendJsonResponse(res, "error", "Identity purged or not found.", null, 401);
        }
    } catch (err) {
        console.error("Me API Error:", err);
        return sendJsonResponse(res, "error", "System fault during identity retrieval.", null, 500);
    }
});

// Logout API
router.post(logoutPaths, (req, res) => {
    if (!req.session) {
        res.clearCookie('connect.sid');
        return sendJsonResponse(res, "success", "Session terminated. Neural link severed.");
    }
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout Error:", err);
            return sendJsonResponse(res, "error", "Failed to terminate session.", null, 500);
        }
        res.clearCookie('connect.sid');
        return sendJsonResponse(res, "success", "Session terminated. Neural link severed.");
    });
});

export default router;
