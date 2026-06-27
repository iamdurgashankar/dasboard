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
        // Total Projects
        const projectsRes = await db.query("SELECT COUNT(*) as total FROM projects");
        const totalProjects = parseInt(projectsRes.rows[0].total, 10);

        // Active Tasks
        const tasksRes = await db.query("SELECT COUNT(*) as total FROM tasks WHERE status != 'completed'");
        const activeTasks = parseInt(tasksRes.rows[0].total, 10);

        // New Submissions
        const contactsRes = await db.query("SELECT COUNT(*) as total FROM contacts WHERE status = 'new'");
        const newSubmissions = parseInt(contactsRes.rows[0].total, 10);

        // Avg Project Health
        const healthRes = await db.query("SELECT AVG(health) as avg FROM projects");
        const avgHealth = Math.round(parseFloat(healthRes.rows[0].avg) || 100);

        // Generate metrics list with changes/trends matching PHP rand logic
        const metrics = [
            {
                label: "Active Projects",
                value: totalProjects,
                change: `+${Math.floor(Math.random() * 5) + 1} this week`,
                trend: "up",
                icon: "fa-layer-group"
            },
            {
                label: "Pending Tasks",
                value: activeTasks,
                change: `-${Math.floor(Math.random() * 3) + 1} today`,
                trend: "down",
                icon: "fa-list-check"
            },
            {
                label: "User Inquiries",
                value: newSubmissions,
                change: `+${Math.floor(Math.random() * 8) + 1}%`,
                trend: "up",
                icon: "fa-envelope-open-text"
            },
            {
                label: "System Health",
                value: `${avgHealth}%`,
                change: "Stable",
                trend: "neutral",
                icon: "fa-heart-pulse"
            }
        ];

        return sendJsonResponse(res, "success", "Metrics synchronized.", metrics);
    } catch (err) {
        console.error("Metrics API Error:", err);
        return sendJsonResponse(res, "error", "System fault during data retrieval.", null, 500);
    }
});

export default router;
