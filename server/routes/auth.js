/**
 * Authentication Router
 * Handles login, identity checks, and logout.
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { 
    sendJsonResponse, 
    generateCsrfToken, 
    requireAuth 
} from '../utils.js';

const router = express.Router();

// Helper to support both clean and .php endpoints
const loginPaths = ['/login', '/login.php'];
const mePaths = ['/me', '/me.php'];
const logoutPaths = ['/logout', '/logout.php'];

// Login API
router.post(loginPaths, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return sendJsonResponse(res, "error", "Email and password required.");
    }

    try {
        const query = 'SELECT id, name, email, password, role, status, avatar FROM users WHERE email = $1 LIMIT 1';
        const result = await db.query(query, [email.trim()]);
        const user = result.rows[0];

        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                if (user.status !== 'active') {
                    return sendJsonResponse(res, "error", "Account pending approval.");
                }

                // Set session
                req.session.user_id = user.id;
                req.session.user_name = user.name;
                req.session.user_role = user.role;

                // Remove password hash from response
                delete user.password;

                // Generate CSRF token
                const csrfToken = generateCsrfToken(req);

                return sendJsonResponse(res, "success", "Authentication successful. Welcome to the Neural Hub.", {
                    user,
                    csrf_token: csrfToken
                });
            }
        }

        return sendJsonResponse(res, "error", "Invalid credentials. Link denied.", null, 401);
    } catch (err) {
        console.error("Login API Error:", err);
        return sendJsonResponse(res, "error", `Login Error: ${err.message}`, null, 500);
    }
});

// Get Current User Identity API
router.get(mePaths, requireAuth, async (req, res) => {
    const userId = req.session.user_id;

    try {
        const query = 'SELECT id, name, email, role, status, avatar FROM users WHERE id = $1 LIMIT 1';
        const result = await db.query(query, [userId]);
        const user = result.rows[0];

        if (user) {
            return sendJsonResponse(res, "success", "Identity retrieved.", user);
        } else {
            // Clean up session if user not found in DB
            req.session.destroy();
            return sendJsonResponse(res, "error", "Identity purged or not found.", null, 401);
        }
    } catch (err) {
        console.error("Me API Error:", err);
        return sendJsonResponse(res, "error", "System fault during identity retrieval.", null, 500);
    }
});

// Logout API
router.post(logoutPaths, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout Error:", err);
            return sendJsonResponse(res, "error", "Failed to terminate session.", null, 500);
        }
        res.clearCookie('connect.sid'); // Clear Express session cookie
        return sendJsonResponse(res, "success", "Session terminated. Neural link severed.");
    });
});

export default router;
