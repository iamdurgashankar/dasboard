<?php
/**
 * Task Update Status API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireMutatingAuth();

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse("error", "Method not allowed.", null, 405);
}

// Sanitize inputs
$input = json_decode(file_get_contents('php://input'), true);
if (!$input)
    $input = $_POST;

$taskId = sanitizeInput($input['id'] ?? '');
$status = sanitizeInput($input['status'] ?? '');

if (empty($taskId) || empty($status)) {
    sendJsonResponse("error", "Task ID and Status required.");
}

// Validate status enum
$allowedStatuses = ['todo', 'in-progress', 'completed'];
if (!in_array($status, $allowedStatuses)) {
    sendJsonResponse("error", "Invalid status protocol.");
}

try {
    $db = getDbConnection();

    $stmt = $db->prepare("UPDATE tasks SET status = ? WHERE id = ?");
    $stmt->execute([$status, $taskId]);

    sendJsonResponse("success", "Task status synchronized.");

} catch (Exception $e) {
    error_log("Task Update API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to update task status.", null, 500);
}
?>