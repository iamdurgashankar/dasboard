<?php
/**
 * Create Subtask API
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

$taskId = sanitizeInput($input['taskId'] ?? '');
$title = sanitizeInput($input['title'] ?? '');

if (empty($taskId) || empty($title)) {
    sendJsonResponse("error", "Task ID and title required for subtask provisioning.");
}

try {
    $db = getDbConnection();

    $stmt = $db->prepare("INSERT INTO subtasks (task_id, title, completed) VALUES (?, ?, 0)");
    $stmt->execute([$taskId, $title]);

    $subtaskId = $db->lastInsertId();

    sendJsonResponse("success", "Subtask provisioned.", ["id" => $subtaskId]);

} catch (Exception $e) {
    error_log("Subtask Create API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to provision subtask.", null, 500);
}
?>