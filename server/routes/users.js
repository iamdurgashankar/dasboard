/**
 * Users Router
 * Handles listing, provisioning, approving, rejecting, and decommissioning users,
 * plus transactional email notifications to applicants and admin@devinquire.com.
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import {
    sendJsonResponse,
    requireAuth,
    requireAdmin,
    requireMutatingAdmin,
    createNotification
} from '../utils.js';
import {
    sendApplicantDecisionEmail,
    loadAccountMailConfig,
    saveAccountMailConfig,
    sendTestAccountEmail,
    getRecentEmailLogs
} from '../mailer.js';

const router = express.Router();

const listPaths = ['/list', '/list.php'];
const createPaths = ['/create', '/create.php'];
const updatePaths = ['/update', '/update.php'];
const rejectPaths = ['/reject', '/reject.php'];
const deletePaths = ['/delete', '/delete.php'];
const emailConfigPaths = ['/email-config', '/email-config.php'];
const emailTestPaths = ['/email-test', '/email-test.php'];

// Get Access & Notification Email Settings (Admin Only)
router.get(emailConfigPaths, requireAdmin, async (req, res) => {
    try {
        const cfg = await loadAccountMailConfig();
        return sendJsonResponse(res, "success", "Email notification settings retrieved.", {
            adminEmail: cfg.adminEmail,
            fromName: cfg.fromName,
            fromEmail: cfg.fromEmail,
            smtpHost: cfg.smtpHost,
            smtpPort: cfg.smtpPort,
            smtpUser: cfg.smtpUser,
            hasSmtpPass: Boolean(cfg.smtpPass),
            smtpConfigured: cfg.smtpConfigured,
            web3FormsEnabled: cfg.web3FormsEnabled,
            bccAdminOnDecision: cfg.bccAdminOnDecision,
            recentLogs: getRecentEmailLogs()
        });
    } catch (err) {
        console.error("User Email Config Get Error:", err);
        return sendJsonResponse(res, "error", "Failed to load email settings.", null, 500);
    }
});

// Save Access & Notification Email Settings (Admin)
router.post(emailConfigPaths, requireMutatingAdmin, async (req, res) => {
    try {
        const updated = await saveAccountMailConfig(req.body || {});
        return sendJsonResponse(res, "success", "Email notification settings saved.", {
            adminEmail: updated.adminEmail,
            fromName: updated.fromName,
            fromEmail: updated.fromEmail,
            smtpHost: updated.smtpHost,
            smtpPort: updated.smtpPort,
            smtpUser: updated.smtpUser,
            hasSmtpPass: Boolean(updated.smtpPass),
            smtpConfigured: updated.smtpConfigured,
            web3FormsEnabled: updated.web3FormsEnabled,
            bccAdminOnDecision: updated.bccAdminOnDecision,
            recentLogs: getRecentEmailLogs()
        });
    } catch (err) {
        console.error("User Email Config Save Error:", err);
        return sendJsonResponse(res, "error", "Failed to save email settings.", null, 500);
    }
});

// Send Test Email to Verify SMTP Delivery
router.post(emailTestPaths, requireMutatingAdmin, async (req, res) => {
    try {
        if (req.body && (req.body.smtpHost || req.body.smtpUser || req.body.smtpPass)) {
            await saveAccountMailConfig(req.body);
        }
        const target = req.body?.targetEmail || 'admin@devinquire.com';
        const result = await sendTestAccountEmail(target);
        return sendJsonResponse(
            res,
            "success",
            `Test email sent successfully to ${result.recipient}!`,
            {
                ...result,
                recentLogs: getRecentEmailLogs()
            }
        );
    } catch (err) {
        console.error("User Email Test Error:", err);
        return sendJsonResponse(
            res,
            "error",
            `SMTP Test Failed: ${err.message}`,
            null,
            400
        );
    }
});

// Create / Provision User API (Admin)
router.post(createPaths, requireMutatingAdmin, async (req, res) => {
    const { name, email, password, role, avatar, sendWelcomeEmail = true } = req.body || {};
    if (!name || !email) {
        return sendJsonResponse(res, "error", "Name and email are required.");
    }
    try {
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim();
        const checkRes = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [cleanEmail]);
        if (checkRes.rows && checkRes.rows.length > 0) {
            return sendJsonResponse(res, "error", "An account with this email already exists.");
        }
        const rawPassword = password && String(password).trim() ? String(password).trim() : 'DevInquire2026!';
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        const assignedRole = ['Admin', 'Developer', 'Editor', 'Viewer'].includes(role) ? role : 'Developer';

        const insertRes = await db.query(
            'INSERT INTO users (email, password, name, role, status, avatar) VALUES ($1, $2, $3, $4::user_role, $5::user_status, $6) RETURNING id',
            [cleanEmail, hashedPassword, cleanName, assignedRole, 'active', avatar || null]
        );
        const createdId = insertRes.rows?.[0]?.id;
        if (createdId) {
            await db.query('UPDATE users SET is_active = 1 WHERE id = $1', [createdId]).catch(() => {});
        }

        let emailResult = null;
        if (sendWelcomeEmail !== false) {
            emailResult = await sendApplicantDecisionEmail({
                name: cleanName,
                email: cleanEmail,
                decision: 'approved',
                role: assignedRole,
                decidedBy: req.session?.user_name || 'DevInquire Admin',
                requestOrigin: String(req.headers.origin || '').trim()
            }).catch(() => null);
        }

        return sendJsonResponse(
            res,
            "success",
            emailResult?.sent
                ? `User account provisioned and confirmation email sent to ${cleanEmail}.`
                : "User account provisioned.",
            {
                id: createdId,
                emailSent: Boolean(emailResult?.sent)
            }
        );
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
                u.id, u.name, u.email, u.role, u.status, u.avatar, u.rejection_reason, u.decided_at, u.created_at as "joinDate",
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status != 'completed') as active_tasks
            FROM users u 
            ORDER BY u.created_at DESC
        `;
        let result;
        try {
            result = await db.query(query);
        } catch {
            // Fallback if rejection_reason / decided_at column isn't migrated yet
            result = await db.query(`
                SELECT 
                    u.id, u.name, u.email, u.role, u.status, u.avatar, u.created_at as "joinDate",
                    (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status != 'completed') as active_tasks
                FROM users u 
                ORDER BY u.created_at DESC
            `);
        }

        const users = (result.rows || []).map((user) => {
            const rawStatus = String(user.status || '').trim().toLowerCase();
            const normalizedStatus =
                rawStatus === 'rejected'
                    ? 'rejected'
                    : rawStatus === 'pending'
                    ? 'pending'
                    : rawStatus === 'active'
                    ? 'active'
                    : user.is_active === 1
                    ? 'active'
                    : 'pending';
            return {
                ...user,
                status: normalizedStatus,
                rejectionReason: user.rejection_reason || undefined,
                decidedAt: user.decided_at || undefined,
                active_tasks: parseInt(user.active_tasks, 10) || 0
            };
        });

        return sendJsonResponse(res, "success", "User directory retrieved.", users);
    } catch (err) {
        console.error("User List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve user directory.", null, 500);
    }
});

// Update User Identity / Approve Access Request API
router.post(updatePaths, requireMutatingAdmin, async (req, res) => {
    const { id, role, status, name, email, password, avatar, reason } = req.body || {};

    if (!id) {
        return sendJsonResponse(res, "error", "User ID required for update.");
    }

    try {
        const checkQuery = 'SELECT id, name, email, role, status FROM users WHERE id = $1';
        const checkRes = await db.query(checkQuery, [id]);
        const existingUser = checkRes.rows?.[0];

        if (!existingUser) {
            return sendJsonResponse(res, "error", "User not found.", null, 404);
        }

        const prevStatus = String(existingUser.status || 'pending').toLowerCase();
        const nextStatus = status !== undefined && status !== '' ? String(status).toLowerCase() : undefined;

        const fields = [];
        const params = [];
        let paramCount = 1;

        if (role !== undefined && role !== '') {
            fields.push(`role = $${paramCount++}::user_role`);
            params.push(role);
        }
        if (nextStatus !== undefined) {
            fields.push(`status = $${paramCount++}::user_status`);
            params.push(nextStatus);
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
        if (nextStatus === 'active' || nextStatus === 'rejected') {
            fields.push(`decided_at = $${paramCount++}`);
            params.push(new Date().toISOString());
            fields.push(`rejection_reason = $${paramCount++}`);
            params.push(nextStatus === 'rejected' ? String(reason || '').trim() || null : null);
        }

        if (fields.length === 0) {
            return sendJsonResponse(res, "error", "No parameters provided for update.");
        }

        params.push(id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`;
        await db.query(query, params);

        if (nextStatus !== undefined) {
            const activeFlag = nextStatus === 'active' ? 1 : 0;
            await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [activeFlag, id]).catch(() => {});
        }

        const finalName = (name && String(name).trim()) || existingUser.name || 'User';
        const finalEmail = (email && String(email).trim().toLowerCase()) || existingUser.email;
        const finalRole = role || existingUser.role || 'Developer';
        const requestOrigin = String(req.headers.origin || '').trim();

        let emailResult = null;

        // Send Approval or Rejection confirmation email to the requested person when status changes
        if (nextStatus === 'active' && prevStatus !== 'active') {
            await createNotification(
                id,
                'success',
                'Workspace Access Approved',
                `Welcome ${finalName}! Your account has been approved as ${finalRole}.`
            ).catch(() => {});

            emailResult = await sendApplicantDecisionEmail({
                name: finalName,
                email: finalEmail,
                decision: 'approved',
                role: finalRole,
                decidedBy: req.session?.user_name || 'DevInquire Administrator',
                requestOrigin
            });
        } else if (nextStatus === 'rejected' && prevStatus !== 'rejected') {
            emailResult = await sendApplicantDecisionEmail({
                name: finalName,
                email: finalEmail,
                decision: 'rejected',
                role: finalRole,
                reason: reason || '',
                decidedBy: req.session?.user_name || 'DevInquire Administrator',
                requestOrigin
            });
        } else if (role && role !== existingUser.role) {
            await createNotification(
                id,
                'warning',
                'Privilege Level Modified',
                `Your role has been updated to: ${role}`
            ).catch(() => {});
        }

        const responseMessage =
            nextStatus === 'active' && prevStatus !== 'active'
                ? emailResult?.sent
                    ? `Approved ${finalName} (${finalRole}) — confirmation email sent to ${finalEmail}!`
                    : `Approved ${finalName} (${finalRole}). Configure SMTP in Email Notifications to deliver external emails to ${finalEmail}.`
                : nextStatus === 'rejected' && prevStatus !== 'rejected'
                ? emailResult?.sent
                    ? `Access request rejected — notification email sent to ${finalEmail}.`
                    : `Access request marked as rejected. Configure SMTP in Email Notifications to deliver external emails to ${finalEmail}.`
                : 'User identity updated.';

        return sendJsonResponse(res, "success", responseMessage, {
            emailSent: Boolean(emailResult?.sent),
            emailChannel: emailResult?.channel || null,
            emailError: emailResult?.error || null
        });
    } catch (err) {
        console.error("User Update API Error:", err);
        return sendJsonResponse(res, "error", "Failed to update user identity.", null, 500);
    }
});

// Reject Access Request API (Marks rejected + sends rejection email to requested person)
router.post(rejectPaths, requireMutatingAdmin, async (req, res) => {
    const { id, reason = '', deleteAccount = false } = req.body || {};

    if (!id) {
        return sendJsonResponse(res, "error", "User ID required to reject access request.", null, 400);
    }

    try {
        if (String(id) === String(req.session?.user_id)) {
            return sendJsonResponse(res, "error", "You cannot reject your own active administrator account.", null, 400);
        }

        const checkRes = await db.query('SELECT id, name, email, role, status FROM users WHERE id = $1', [id]);
        const targetUser = checkRes.rows?.[0];
        if (!targetUser) {
            return sendJsonResponse(res, "error", "User request not found.", null, 404);
        }

        const cleanReason = String(reason || '').trim();
        const requestOrigin = String(req.headers.origin || '').trim();

        // Dispatch rejection confirmation email to the requested person
        const emailResult = await sendApplicantDecisionEmail({
            name: targetUser.name || 'Applicant',
            email: targetUser.email,
            decision: 'rejected',
            role: targetUser.role || 'Developer',
            reason: cleanReason,
            decidedBy: req.session?.user_name || 'DevInquire Administrator',
            requestOrigin
        });

        if (deleteAccount) {
            await db.query('DELETE FROM users WHERE id = $1', [id]);
        } else {
            await db.query(
                'UPDATE users SET status = $1::user_status, rejection_reason = $2, decided_at = $3 WHERE id = $4',
                ['rejected', cleanReason || null, new Date().toISOString(), id]
            );
            await db.query('UPDATE users SET is_active = 0 WHERE id = $1', [id]).catch(() => {});
        }

        const msg = emailResult.sent
            ? `Rejected access request for ${targetUser.name} — notification email sent to ${targetUser.email}.`
            : `Rejected access request for ${targetUser.name}. Configure SMTP in Email Notifications to deliver external emails to ${targetUser.email}.`;

        return sendJsonResponse(res, "success", msg, {
            id: String(id),
            emailSent: Boolean(emailResult.sent),
            emailChannel: emailResult.channel,
            emailError: emailResult.error || null
        });
    } catch (err) {
        console.error("User Reject API Error:", err);
        return sendJsonResponse(res, "error", "Failed to reject access request.", null, 500);
    }
});

// Decommission User API
router.post(deletePaths, requireMutatingAdmin, async (req, res) => {
    const { id, reason = '' } = req.body || {};

    if (!id) {
        return sendJsonResponse(res, "error", "User ID required for decommissioning.");
    }

    try {
        if (String(id) === String(req.session?.user_id)) {
            return sendJsonResponse(res, "error", "Security Interlock: Self-decommissioning is restricted.");
        }

        const existingRes = await db
            .query('SELECT id, name, email, role, status FROM users WHERE id = $1', [id])
            .catch(() => ({ rows: [] }));
        const targetUser = existingRes.rows?.[0] || null;

        let emailResult = null;
        if (targetUser && String(targetUser.status || '').toLowerCase() === 'pending') {
            emailResult = await sendApplicantDecisionEmail({
                name: targetUser.name || 'Applicant',
                email: targetUser.email,
                decision: 'rejected',
                role: targetUser.role || 'Developer',
                reason: String(reason || '').trim(),
                decidedBy: req.session?.user_name || 'DevInquire Administrator',
                requestOrigin: String(req.headers.origin || '').trim()
            }).catch(() => null);
        }

        await db.query('DELETE FROM users WHERE id = $1', [id]);

        return sendJsonResponse(
            res,
            "success",
            emailResult?.sent
                ? `Access request removed and notification email sent to ${targetUser.email}.`
                : "User decommissioned successfully.",
            {
                emailSent: Boolean(emailResult?.sent)
            }
        );
    } catch (err) {
        console.error("User Delete API Error:", err);
        return sendJsonResponse(res, "error", "Failed to decommission user.", null, 500);
    }
});

export default router;
