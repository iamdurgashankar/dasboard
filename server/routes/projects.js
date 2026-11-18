/**
 * Projects Router
 * Handles project list, details, creation, and updates.
 */
import express from 'express';
import db from '../db.js';
import { 
    sendJsonResponse, 
    requireAuth, 
    requireMutatingAuth 
} from '../utils.js';

const router = express.Router();

const listPaths = ['/list', '/list.php'];
const detailPaths = ['/detail', '/detail.php'];
const createPaths = ['/create', '/create.php'];
const updatePaths = ['/update', '/update.php'];
const deletePaths = ['/delete', '/delete.php'];
const clearPaths = ['/clear', '/clear.php'];

// List Projects API
router.get(listPaths, requireAuth, async (req, res) => {
    try {
        const query = 'SELECT * FROM projects ORDER BY created_at DESC';
        const result = await db.query(query);
        const rows = (result.rows || []).map(p => ({
            ...p,
            id: String(p.id),
            lastUpdate: p.lastUpdate || (p.last_update ? new Date(p.last_update).toLocaleDateString() : 'Active')
        }));
        return sendJsonResponse(res, "success", "Projects retrieved.", rows);
    } catch (err) {
        console.error("Projects List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve projects.", null, 500);
    }
});

// Project Detail API
router.get(detailPaths, requireAuth, async (req, res) => {
    const projectId = req.query.id;

    if (!projectId) {
        return sendJsonResponse(res, "error", "Project ID required for uplink.");
    }

    try {
        // Fetch project
        const projectQuery = 'SELECT * FROM projects WHERE id = $1 LIMIT 1';
        const projectResult = await db.query(projectQuery, [projectId]);
        const project = projectResult.rows[0];

        if (!project) {
            return sendJsonResponse(res, "error", "Project not found in index.", null, 404);
        }

        // Fetch tasks/issues for this project
        const tasksQuery = `
            SELECT t.*, u.name as assignee_name, u.avatar as assignee_avatar 
            FROM tasks t 
            LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.project_id = $1 
            ORDER BY t.created_at DESC
        `;
        const tasksResult = await db.query(tasksQuery, [projectId]);
        const tasks = tasksResult.rows;

        // Fetch subtasks and comments for each task
        for (let task of tasks) {
            // Postgres returns jsonb directly as an object/array, so no need to parse!
            // But if it's text representation, parse it.
            if (typeof task.tags === 'string') {
                try {
                    task.tags = JSON.parse(task.tags);
                } catch {
                    task.tags = [];
                }
            } else if (!task.tags) {
                task.tags = [];
            }

            // Fetch subtasks
            const subtasksQuery = 'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY id ASC';
            const subtasksResult = await db.query(subtasksQuery, [task.id]);
            task.subtasks = subtasksResult.rows;

            // Fetch comments
            const commentsQuery = `
                SELECT tc.*, u.name as user_name, u.avatar as user_avatar 
                FROM task_comments tc 
                LEFT JOIN users u ON tc.user_id = u.id 
                WHERE tc.task_id = $1 
                ORDER BY tc.created_at DESC
            `;
            const commentsResult = await db.query(commentsQuery, [task.id]);
            task.comments = commentsResult.rows;
        }

        project.issues = tasks;

        return sendJsonResponse(res, "success", "Project telemetry retrieved.", project);
    } catch (err) {
        console.error("Project Detail API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve project detail.", null, 500);
    }
});

// Create Project API
router.post(createPaths, requireMutatingAuth, async (req, res) => {
    const { name, description, language, clientName, assignedDeveloper, assignedViewer, dueDate, progress } = req.body;
    const lang = language || 'TypeScript';
    const initialProgress = progress !== undefined ? parseInt(progress, 10) : 10;

    if (!name) {
        return sendJsonResponse(res, "error", "Project name required.");
    }

    try {
        const query = `
            INSERT INTO projects (name, description, language, status, health, progress) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id
        `;
        const result = await db.query(query, [
            name,
            description || null,
            lang,
            'active',
            100,
            initialProgress,
            { clientName, assignedDeveloper, assignedViewer, dueDate }
        ]);
        const projectId = result.rows[0].id;

        return sendJsonResponse(res, "success", "Client project initialized.", { id: projectId });
    } catch (err) {
        console.error("Project Create API Error:", err);
        return sendJsonResponse(res, "error", "Failed to initialize project.", null, 500);
    }
});

// Update Project API
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
    const { id, name, description, status, progress, health, clientName, assignedDeveloper, assignedViewer, dueDate, newUpdate } = req.body;

    if (!id) {
        return sendJsonResponse(res, "error", "Project ID required for update.");
    }

    try {
        const existingRes = await db.query('SELECT * FROM projects WHERE id = $1 LIMIT 1', [id]);
        const existing = existingRes.rows?.[0] || {};

        const fields = [];
        const params = [];
        let paramCount = 1;

        if (name !== undefined && name !== '') {
            fields.push(`name = $${paramCount++}`);
            params.push(name);
        }
        if (description !== undefined) {
            fields.push(`description = $${paramCount++}`);
            params.push(description);
        }
        if (status !== undefined && status !== '') {
            fields.push(`status = $${paramCount++}::project_status`);
            params.push(status);
        }
        if (progress !== undefined && progress !== '') {
            fields.push(`progress = $${paramCount++}`);
            params.push(parseInt(progress, 10));
        }
        if (health !== undefined && health !== '') {
            fields.push(`health = $${paramCount++}`);
            params.push(parseInt(health, 10));
        }
        if (clientName !== undefined) {
            fields.push(`clientName = $${paramCount++}`);
            params.push(clientName);
        }
        if (assignedDeveloper !== undefined) {
            fields.push(`assignedDeveloper = $${paramCount++}`);
            params.push(assignedDeveloper);
        }
        if (assignedViewer !== undefined) {
            fields.push(`assignedViewer = $${paramCount++}`);
            params.push(assignedViewer);
        }
        if (dueDate !== undefined) {
            fields.push(`dueDate = $${paramCount++}`);
            params.push(dueDate);
        }
        if (newUpdate && newUpdate.title) {
            const currentUpdates = Array.isArray(existing.updates) ? existing.updates : [];
            const nextProg = progress !== undefined ? parseInt(progress, 10) : (existing.progress || 0);
            const todayStr = new Date().toISOString().split('T')[0];
            const updateEntry = {
                id: `upd-${Date.now()}`,
                title: newUpdate.title,
                summary: newUpdate.summary || '',
                author: newUpdate.author || 'Developer',
                authorRole: newUpdate.authorRole || 'Developer',
                date: todayStr,
                timestamp: 'Just now',
                progress: nextProg,
                progressAfter: nextProg
            };
            fields.push(`updates = $${paramCount++}`);
            params.push([updateEntry, ...currentUpdates]);
        }

        if (fields.length === 0) {
            return sendJsonResponse(res, "error", "No update parameters provided.");
        }

        params.push(id);
        const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramCount}`;
        await db.query(query, params);

        return sendJsonResponse(res, "success", "Project progress updated.");
    } catch (err) {
        console.error("Project Update API Error:", err);
        return sendJsonResponse(res, "error", "Failed to update project state.", null, 500);
    }
});

// Delete Single Project API (Admin only)
router.post(deletePaths, requireMutatingAuth, async (req, res) => {
    const role = String(req.session?.user_role || '').toLowerCase();
    if (role !== 'admin') {
        return sendJsonResponse(res, "error", "Forbidden: Administrator access required.", null, 403);
    }

    const { id } = req.body || {};
    if (!id) {
        return sendJsonResponse(res, "error", "Project ID required for deletion.", null, 400);
    }

    try {
        await db.query('DELETE FROM tasks WHERE project_id = $1', [id]).catch(() => {});
        await db.query('DELETE FROM projects WHERE id = $1', [id]);
        return sendJsonResponse(res, "success", "Project deleted successfully.");
    } catch (err) {
        console.error("Project Delete API Error:", err);
        return sendJsonResponse(res, "error", "Failed to delete project.", null, 500);
    }
});

// Clear All Projects API (Admin only)
router.post(clearPaths, requireMutatingAuth, async (req, res) => {
    const role = String(req.session?.user_role || '').toLowerCase();
    if (role !== 'admin') {
        return sendJsonResponse(res, "error", "Forbidden: Administrator access required.", null, 403);
    }

    try {
        await db.query('DELETE FROM tasks WHERE project_id IS NOT NULL').catch(() => {});
        await db.query('DELETE FROM projects');
        return sendJsonResponse(res, "success", "All client projects cleared.");
    } catch (err) {
        console.error("Projects Clear API Error:", err);
        return sendJsonResponse(res, "error", "Failed to clear projects.", null, 500);
    }
});

export default router;
