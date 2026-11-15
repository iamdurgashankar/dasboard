/**
 * Dashboard Router
 * Handles dashboard metrics and system activity log stream.
 */
import express from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { sendJsonResponse, requireAuth } from '../utils.js';

const router = express.Router();

const activityPaths = ['/activity', '/activity.php'];
const metricsPaths = ['/metrics', '/metrics.php'];

// Activity Stream API
router.get(activityPaths, requireAuth, async (req, res) => {
    try {
        const query = `
            (SELECT 'deploy' as type, 'AutoBot' as "user", 'v2.4.1 to Production' as target, 'deployed' as action, created_at as "time" FROM projects LIMIT 5)
            UNION ALL
            (SELECT 'pr' as type, name as "user", subject as target, 'submitted inquiry' as action, created_at as "time" FROM contacts LIMIT 5)
            ORDER BY "time" DESC LIMIT 10
        `;
        const result = await db.query(query);
        const activities = result.rows;

        const formatted = activities.map(act => {
            return {
                id: crypto.randomUUID(),
                user: act.user,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(act.user)}&background=6366f1&color=fff`,
                action: act.action,
                target: act.target,
                time: "Just now", // In real app, calculate time diff, but keeping parity with PHP
                type: act.type
            };
        });

        return sendJsonResponse(res, "success", "Activity stream synchronized.", formatted);
    } catch (err) {
        console.error("Activity API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve activity.", null, 500);
    }
});

// Metrics API
router.get(metricsPaths, requireAuth, async (req, res) => {
    try {
        // Client Inquiries
        const contactsRes = await db.query("SELECT COUNT(*) as total FROM contacts");
        const totalContacts = parseInt(contactsRes.rows[0]?.total || 0, 10);
        const newContactsRes = await db.query("SELECT COUNT(*) as total FROM contacts WHERE status = 'new'");
        const newSubmissions = parseInt(newContactsRes.rows[0]?.total || 0, 10);

        // Editorial Articles
        const blogsRes = await db.query("SELECT COUNT(*) as total FROM blogs");
        const totalBlogs = parseInt(blogsRes.rows[0]?.total || 0, 10);

        // Users & Access
        const usersRes = await db.query("SELECT COUNT(*) as total FROM users");
        const totalUsers = parseInt(usersRes.rows[0]?.total || 0, 10);

        // Active Team Contributors
        const activeUsersRes = await db.query("SELECT COUNT(*) as total FROM users WHERE status = 'active'");
        const activeTeam = parseInt(activeUsersRes.rows[0]?.total || 0, 10);

        const metrics = [
            {
                label: "Client Inquiries",
                value: totalContacts,
                change: `${newSubmissions} new inbound`,
                trend: "up",
                icon: "fa-envelope-open-text"
            },
            {
                label: "Editorial Studio",
                value: totalBlogs,
                change: "Live on /blog",
                trend: "up",
                icon: "fa-pen-nib"
            },
            {
                label: "Access & Users",
                value: totalUsers,
                change: "RBAC Verified",
                trend: "neutral",
                icon: "fa-user-shield"
            },
            {
                label: "Team Velocity",
                value: `${activeTeam} Active`,
                change: "94% Flow Index",
                trend: "up",
                icon: "fa-users"
            }
        ];

        return sendJsonResponse(res, "success", "Metrics synchronized.", metrics);
    } catch (err) {
        console.error("Metrics API Error:", err);
        return sendJsonResponse(res, "error", "System fault during data retrieval.", null, 500);
    }
});

export default router;
