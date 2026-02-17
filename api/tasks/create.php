<?php
/**
 * Task Creation API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireMutatingAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse("error", "Method not allowed.", null, 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input)
    $input = $_POST;

$projectId = sanitizeInput($input['projectId'] ?? '');
$title = sanitizeInput($input['title'] ?? '');
$description = sanitizeInput($input['description'] ?? '');
$assigneeId = sanitizeInput($input['assigneeId'] ?? '');
$priority = sanitizeInput($input['priority'] ?? 'Medium');
$dueDate = sanitizeInput($input['dueDate'] ?? NULL);
$points = (int) ($input['points'] ?? 0);
$tags = $input['tags'] ?? [];

if (empty($title)) {
    sendJsonResponse("error", "Task title required for provisioning.");
}

try {
    $db = getDbConnection();

    $stmt = $db->prepare("INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, points, tags) VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?)");
    $stmt->execute([
        empty($projectId) ? NULL : $projectId,
        $title,
        $description,
        empty($assigneeId) ? NULL : $assigneeId,
        $priority,
        $dueDate,
        $points,
        json_encode($tags)
    ]);

    $taskId = $db->lastInsertId();

    // Log the creation
    $stmt = $db->prepare("INSERT INTO task_comments (task_id, text, is_system_log) VALUES (?, ?, 1)");
    $stmt->execute([$taskId, "Task initialized in the ledger."]);

    // Notify Assignee
    if ($assigneeId) {
        createNotification($db, $assigneeId, 'task', 'New Task Assigned', "You have been assigned to: $title", "/tasks");
    }

    sendJsonResponse("success", "Task provisioned successfully.", ["id" => $taskId]);

} catch (Exception $e) {
    error_log("Task Create API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to provision task payload.", null, 500);
}
?>