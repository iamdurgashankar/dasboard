/**
 * Tasks Router
 * Handles tasks, subtasks, and comments.
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

// Define route matching paths
const listPaths = ['/list', '/list.php'];
const createPaths = ['/create', '/create.php'];
const updateStatusPaths = ['/update_status', '/update_status.php'];
const createSubtaskPaths = ['/subtasks/create', '/subtasks/create.php'];
const toggleSubtaskPaths = ['/subtasks/toggle', '/subtasks/toggle.php'];
const createCommentPaths = ['/comments/create', '/comments/create.php'];

// List Tasks API
router.get(listPaths, requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT t.*, p.name as project_name, u.name as assignee_name, u.avatar as assignee_avatar 
            FROM tasks t 
            LEFT JOIN projects p ON t.project_id = p.id 
            LEFT JOIN users u ON t.assignee_id = u.id 
            ORDER BY t.created_at DESC
        `;
        const result = await db.query(query);
        const tasks = result.rows;

        // Fetch subtasks and comments for each task
        for (let task of tasks) {
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

        return sendJsonResponse(res, "success", "Tasks synchronized.", tasks);
    } catch (err) {
        console.error("Tasks List API Error:", err);
        return sendJsonResponse(res, "error", "Failed to retrieve tasks.", null, 500);
    }
});

// Create Task API
router.post(createPaths, requireMutatingAuth, async (req, res) => {
    const { projectId, title, description, assigneeId, priority, dueDate, points, tags } = req.body;
    const taskPriority = priority || 'Medium';
    const taskPoints = parseInt(points, 10) || 0;
    const taskTags = Array.isArray(tags) ? tags : [];

    if (!title) {
        return sendJsonResponse(res, "error", "Task title required for provisioning.");
    }

    try {
        // Prepare tags for Postgres JSONB
        const tagsJson = JSON.stringify(taskTags);

        const insertQuery = `
            INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, points, tags) 
            VALUES ($1, $2, $3, $4, 'todo', $5::task_priority, $6, $7, $8::jsonb) 
            RETURNING id
        `;
        const result = await db.query(insertQuery, [
            projectId ? parseInt(projectId, 10) : null,
            title,
            description || null,
            assigneeId ? parseInt(assigneeId, 10) : null,
            taskPriority,
            dueDate || null,
            taskPoints,
            tagsJson
        ]);
        const taskId = result.rows[0].id;

        // Log task creation in task comments
        const logQuery = `
            INSERT INTO task_comments (task_id, text, is_system_log) 
            VALUES ($1, 'Task initialized in the ledger.', true)
        `;
        await db.query(logQuery, [taskId]);

        // Notify Assignee
        if (assigneeId) {
            await createNotification(
                parseInt(assigneeId, 10), 
                'task', 
                'New Task Assigned', 
                `You have been assigned to: ${title}`, 
                '/tasks'
            );
        }

        return sendJsonResponse(res, "success", "Task provisioned successfully.", { id: taskId });
    } catch (err) {
        console.error("Task Create API Error:", err);
        return sendJsonResponse(res, "error", "Failed to provision task payload.", null, 500);
    }
});

// Update Task Status API
router.post(updateStatusPaths, requireMutatingAuth, async (req, res) => {
    const { id, status } = req.body;

    if (!id || !status) {
        return sendJsonResponse(res, "error", "Task ID and Status required.");
    }

    const allowedStatuses = ['todo', 'in-progress', 'completed'];
    if (!allowedStatuses.includes(status)) {
        return sendJsonResponse(res, "error", "Invalid status protocol.");
    }

    try {
        const query = 'UPDATE tasks SET status = $1::task_status WHERE id = $2';
        await db.query(query, [status, id]);
        return sendJsonResponse(res, "success", "Task status synchronized.");
    } catch (err) {
        console.error("Task Update Status API Error:", err);
        return sendJsonResponse(res, "error", "Failed to update task status.", null, 500);
    }
});

// Create Subtask API
router.post(createSubtaskPaths, requireMutatingAuth, async (req, res) => {
    const { taskId, title } = req.body;

    if (!taskId || !title) {
        return sendJsonResponse(res, "error", "Task ID and title required for subtask provisioning.");
    }

    try {
        const query = `
            INSERT INTO subtasks (task_id, title, completed) 
            VALUES ($1, $2, false) 
            RETURNING id
        `;
        const result = await db.query(query, [taskId, title]);
        const subtaskId = result.rows[0].id;

        return sendJsonResponse(res, "success", "Subtask provisioned.", { id: subtaskId });
    } catch (err) {
        console.error("Subtask Create API Error:", err);
        return sendJsonResponse(res, "error", "Failed to provision subtask.", null, 500);
    }
});

// Toggle Subtask API
router.post(toggleSubtaskPaths, requireMutatingAuth, async (req, res) => {
    const { id, completed } = req.body;

    if (id === undefined) {
        return sendJsonResponse(res, "error", "Subtask ID required for toggle.");
    }

    try {
        const isCompleted = completed === 1 || completed === true;
        const completedAt = isCompleted ? new Date() : null;

        const query = 'UPDATE subtasks SET completed = $1, completed_at = $2 WHERE id = $3';
        await db.query(query, [isCompleted, completedAt, id]);

        return sendJsonResponse(res, "success", "Subtask state toggled.");
    } catch (err) {
        console.error("Subtask Toggle API Error:", err);
        return sendJsonResponse(res, "error", "Failed to toggle subtask state.", null, 500);
    }
});

// Create Task Comment/Log API
router.post(createCommentPaths, requireMutatingAuth, async (req, res) => {
    const { taskId, text, isSystem } = req.body;

    if (!taskId || !text) {
        return sendJsonResponse(res, "error", "Task ID and text required for logging.");
    }

    try {
        const isSystemLog = isSystem === 1 || isSystem === true;
        const userId = isSystemLog ? null : req.session.user_id;

        const query = `
            INSERT INTO task_comments (task_id, user_id, text, is_system_log) 
            VALUES ($1, $2, $3, $4) 
            RETURNING id
        `;
        const result = await db.query(query, [taskId, userId, text, isSystemLog]);
        const commentId = result.rows[0].id;

        return sendJsonResponse(res, "success", "Log entry recorded.", { id: commentId });
    } catch (err) {
        console.error("Task Comment Create API Error:", err);
        return sendJsonResponse(res, "error", "Failed to record log entry.", null, 500);
    }
});

export default router;
