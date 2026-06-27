/**
 * Users Router
 * Handles listing, updating, and decommissioning users.
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
const updatePaths = ['/update', '/update.php'];
const deletePaths = ['/delete', '/delete.php'];

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
        
        // Map active_tasks count to number
        const users = result.rows.map(user => ({
            ...user,
            active_tasks: parseInt(user.active_tasks, 10)
        }));

        return sendJsonResponse(res, "success", "User directory retrieved.", users);
    } catch (err) {
        console.error("User List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve user directory.", null, 500);
    }
});

// Update User Identity API
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
    const { id, role, status, name, email } = req.body;

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

        if (fields.length === 0) {
            return sendJsonResponse(res, "error", "No parameters provided for update.");
        }

        params.push(id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`;
        await db.query(query, params);

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
