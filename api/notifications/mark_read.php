<?php
/**
 * Mark Notification as Read API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse("error", "Method not allowed.", null, 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$notificationId = $input['id'] ?? null;

if (!$notificationId) {
    sendJsonResponse("error", "Target signal missing.", null, 400);
}

try {
    $db = getDbConnection();
    $userId = $_SESSION['user_id'];

    $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)");
    $stmt->execute([$notificationId, $userId]);

    sendJsonResponse("success", "Signal synchronized.", null);

} catch (Exception $e) {
    error_log("Mark Read API Error: " . $e->getMessage());
    sendJsonResponse("error", "Internal orchestration fault.", null, 500);
}
?>