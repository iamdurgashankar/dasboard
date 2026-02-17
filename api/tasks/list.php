<?php
/**
 * Tasks List API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

try {
    $db = getDbConnection();

    $stmt = $db->query("SELECT t.*, p.name as project_name, u.name as assignee_name, u.avatar as assignee_avatar 
                        FROM tasks t 
                        LEFT JOIN projects p ON t.project_id = p.id 
                        LEFT JOIN users u ON t.assignee_id = u.id 
                        ORDER BY t.created_at DESC");
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

    sendJsonResponse("success", "Tasks synchronized.", $tasks);

} catch (Exception $e) {
    error_log("Tasks List API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve tasks.", null, 500);
}
?>