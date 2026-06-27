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

// List Projects API
router.get(listPaths, requireAuth, async (req, res) => {
    try {
        const query = 'SELECT * FROM projects ORDER BY last_update DESC';
        const result = await db.query(query);
        return sendJsonResponse(res, "success", "Projects retrieved.", result.rows);
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
    const { name, description, language } = req.body;
    const lang = language || 'TypeScript';

    if (!name) {
        return sendJsonResponse(res, "error", "Project name required.");
    }

    try {
        const query = `
            INSERT INTO projects (name, description, language, status, health, progress) 
            VALUES ($1, $2, $3, 'active', 100, 0) 
            RETURNING id
        `;
        const result = await db.query(query, [name, description || null, lang]);
        const projectId = result.rows[0].id;

        return sendJsonResponse(res, "success", "Architectural payload initialized.", { id: projectId });
    } catch (err) {
        console.error("Project Create API Error:", err);
        return sendJsonResponse(res, "error", "Failed to initialize project.", null, 500);
    }
});

// Update Project API
router.post(updatePaths, requireMutatingAuth, async (req, res) => {
    const { id, name, description, status, progress, health } = req.body;

    if (!id) {
        return sendJsonResponse(res, "error", "Project ID required for update.");
    }

    try {
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

        if (fields.length === 0) {
            return sendJsonResponse(res, "error", "No update parameters provided.");
        }

        params.push(id);
        const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramCount}`;
        await db.query(query, params);

        return sendJsonResponse(res, "success", "Architectural state updated.");
    } catch (err) {
        console.error("Project Update API Error:", err);
        return sendJsonResponse(res, "error", "Failed to update project state.", null, 500);
    }
});

export default router;
