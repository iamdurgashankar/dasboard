<?php
/**
 * Create Task Comment API
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
$text = sanitizeInput($input['text'] ?? '');
$isSystem = (int) ($input['isSystem'] ?? 0);

if (empty($taskId) || empty($text)) {
    sendJsonResponse("error", "Task ID and text required for logging.");
}

try {
    $db = getDbConnection();

    $userId = $isSystem ? NULL : $_SESSION['user_id'];

    $stmt = $db->prepare("INSERT INTO task_comments (task_id, user_id, text, is_system_log) VALUES (?, ?, ?, ?)");
    $stmt->execute([$taskId, $userId, $text, $isSystem]);

    $commentId = $db->lastInsertId();

    sendJsonResponse("success", "Log entry recorded.", ["id" => $commentId]);

} catch (Exception $e) {
    error_log("Task Comment API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to record log entry.", null, 500);
}
?>