<?php
/**
 * Project Detail API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

$projectId = sanitizeInput($_GET['id'] ?? '');

if (empty($projectId)) {
    sendJsonResponse("error", "Project ID required for uplink.");
}

try {
    $db = getDbConnection();

    // Fetch Project
    $stmt = $db->prepare("SELECT * FROM projects WHERE id = ? LIMIT 1");
    $stmt->execute([$projectId]);
    $project = $stmt->fetch();

    if (!$project) {
        sendJsonResponse("error", "Project not found in index.", null, 404);
    }

    // Fetch Issues for this project
    $stmt = $db->prepare("SELECT t.*, u.name as assignee_name, u.avatar as assignee_avatar 
                        FROM tasks t 
                        LEFT JOIN users u ON t.assignee_id = u.id 
                        WHERE t.project_id = ? 
                        ORDER BY t.created_at DESC");
    $stmt->execute([$projectId]);
    $tasks = $stmt->fetchAll();

    foreach ($tasks as &$task) {
        $task['tags'] = json_decode($task['tags'] ?? '[]', true);

        // Fetch subtasks
        $stStmt = $db->prepare("SELECT * FROM subtasks WHERE task_id = ? ORDER BY id ASC");
        $stStmt->execute([$task['id']]);
        $task['subtasks'] = $stStmt->fetchAll();

        // Fetch comments
        $cStmt = $db->prepare("SELECT tc.*, u.name as user_name, u.avatar as user_avatar 
                               FROM task_comments tc 
                               LEFT JOIN users u ON tc.user_id = u.id 
                               WHERE tc.task_id = ? 
                               ORDER BY tc.created_at DESC");
        $cStmt->execute([$task['id']]);
        $task['comments'] = $cStmt->fetchAll();
    }

    $project['issues'] = $tasks;

    sendJsonResponse("success", "Project telemetry retrieved.", $project);

} catch (Exception $e) {
    error_log("Project Detail API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve project detail.", null, 500);
}
?>