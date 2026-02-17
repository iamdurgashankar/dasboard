<?php
/**
 * Toggle Subtask API
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

$id = sanitizeInput($input['id'] ?? '');
$completed = (int) ($input['completed'] ?? 0);

if (empty($id)) {
    sendJsonResponse("error", "Subtask ID required for toggle.");
}

try {
    $db = getDbConnection();

    $completedAt = $completed ? date('Y-m-d H:i:s') : NULL;

    $stmt = $db->prepare("UPDATE subtasks SET completed = ?, completed_at = ? WHERE id = ?");
    $stmt->execute([$completed, $completedAt, $id]);

    sendJsonResponse("success", "Subtask state toggled.");

} catch (Exception $e) {
    error_log("Subtask Toggle API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to toggle subtask state.", null, 500);
}
?>