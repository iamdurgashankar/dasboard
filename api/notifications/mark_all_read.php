<?php
/**
 * Mark All Notifications as Read API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse("error", "Method not allowed.", null, 405);
}

try {
    $db = getDbConnection();
    $userId = $_SESSION['user_id'];

    $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL");
    $stmt->execute([$userId]);

    sendJsonResponse("success", "All signals synchronized.", null);

} catch (Exception $e) {
    error_log("Mark All Read API Error: " . $e->getMessage());
    sendJsonResponse("error", "Internal orchestration fault.", null, 500);
}
?>