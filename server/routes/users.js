/**
 * Users Router
 * Handles listing, updating, and decommissioning users.
 */
import express from 'express';
import bcrypt from 'bcryptjs';
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

// Create / Provision User API (Admin)
router.post(createPaths, requireMutatingAuth, async (req, res) => {
    const { name, email, password, role, avatar } = req.body;
    if (!name || !email) {
        return sendJsonResponse(res, "error", "Name and email are required.");
    }
    try {
        const checkRes = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        if (checkRes.rows && checkRes.rows.length > 0) {
            return sendJsonResponse(res, "error", "An account with this email already exists.");
        }
        const rawPassword = password && String(password).trim() ? String(password).trim() : 'DevInquire2026!';
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        const assignedRole = ['Admin', 'Developer', 'Viewer'].includes(role) ? role : 'Developer';

        const insertRes = await db.query(
            'INSERT INTO users (email, password, name, role, status, avatar) VALUES ($1, $2, $3, $4::user_role, $5::user_status, $6) RETURNING id',
            [email.trim().toLowerCase(), hashedPassword, name.trim(), assignedRole, 'active', avatar || null]
        );
        return sendJsonResponse(res, "success", "User account provisioned.", {
            id: insertRes.rows?.[0]?.id
        });
    } catch (err) {
        console.error("User Create API Error:", err);
        return sendJsonResponse(res, "error", "Failed to provision user.", null, 500);
    }
});

// List Users API
router.get(listPaths, requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, u.name, u.email, u.role, u.status, u.avatar, u.created_at as "joinDate",
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status != 'completed') as active_tasks
            FROM users u 
            ORDER BY u.created_at DESC
        `;
        const result = await db.query(query);
        
        // Map active_tasks count to number and normalize status
        const users = result.rows.map(user => {
            const rawStatus = String(user.status || '').trim().toLowerCase();
            const normalizedStatus = rawStatus || (user.is_active === 1 ? 'active' : 'pending');
            return {
                ...user,
                status: normalizedStatus,
                active_tasks: parseInt(user.active_tasks, 10) || 0
            };
        });

        return sendJsonResponse(res, "success", "User directory retrieved.", users);
    } catch (err) {
        console.error("User List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve user directory.", null, 500);
    }
});

// Update User Identity API
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
    const { id, role, status, name, email, password, avatar } = req.body;

    if (!id) {
        return sendJsonResponse(res, "error", "User ID required for update.");
    }

    try {
        // Check if user exists
        const checkQuery = 'SELECT id, role, status FROM users WHERE id = $1';
        const checkRes = await db.query(checkQuery, [id]);
        const existingUser = checkRes.rows[0];

        if (!existingUser) {
            return sendJsonResponse(res, "error", "User not found.");
        }

        const fields = [];
        const params = [];
        let paramCount = 1;

        if (role !== undefined && role !== '') {
            fields.push(`role = $${paramCount++}::user_role`);
            params.push(role);
        }
        if (status !== undefined && status !== '') {
            fields.push(`status = $${paramCount++}::user_status`);
            params.push(status);
        }
        if (name !== undefined && name !== '') {
            fields.push(`name = $${paramCount++}`);
            params.push(name);
        }
        if (email !== undefined && email !== '') {
            fields.push(`email = $${paramCount++}`);
            params.push(email);
        }
        if (avatar !== undefined) {
            fields.push(`avatar = $${paramCount++}`);
            params.push(avatar);
        }
        if (password !== undefined && String(password).trim() !== '') {
            const hashedPassword = await bcrypt.hash(String(password).trim(), 10);
            fields.push(`password = $${paramCount++}`);
            params.push(hashedPassword);
        }

        if (fields.length === 0) {
            return sendJsonResponse(res, "error", "No parameters provided for update.");
        }

        params.push(id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`;
        await db.query(query, params);

        if (status !== undefined && status !== '') {
            const activeFlag = String(status).toLowerCase() === 'active' ? 1 : 0;
            await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [activeFlag, id]).catch(() => {});
        }

        // Notify User of Changes
        if (status && status !== existingUser.status) {
            await createNotification(
                id, 
                'info', 
                'Identity Status Updated', 
                `Your account status has been updated to: ${status}`
            );
        }
        if (role && role !== existingUser.role) {
            await createNotification(
                id, 
                'warning', 
                'Privilege Level Modified', 
                `Your role has been updated to: ${role}`
            );
        }

        return sendJsonResponse(res, "success", "User identity updated.");
    } catch (err) {
        console.error("User Update API Error:", err);
        return sendJsonResponse(res, "error", "Failed to update user identity.", null, 500);
    }
});

// Decommission User API
router.post(deletePaths, requireMutatingAuth, async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return sendJsonResponse(res, "error", "User ID required for decommissioning.");
    }

    try {
        // Prevent self-deletion
        if (id == req.session.user_id) {
            return sendJsonResponse(res, "error", "Security Interlock: Self-decommissioning is restricted.");
        }

        const query = 'DELETE FROM users WHERE id = $1';
        await db.query(query, [id]);

        return sendJsonResponse(res, "success", "User decommissioned successfully.");
    } catch (err) {
        console.error("User Delete API Error:", err);
        return sendJsonResponse(res, "error", "Failed to decommission user.", null, 500);
    }
});

export default router;
