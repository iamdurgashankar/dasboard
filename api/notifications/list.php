<?php
/**
 * List Notifications API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

try {
    $db = getDbConnection();
    $userId = $_SESSION['user_id'];

    $stmt = $db->prepare("SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50");
    $stmt->execute([$userId]);
    $notifications = $stmt->fetchAll();

    foreach ($notifications as &$n) {
        $n['isRead'] = (bool) $n['is_read'];
        $n['timestamp'] = $n['created_at'];
        unset($n['is_read']);
        unset($n['created_at']);
    }

    sendJsonResponse("success", "Notification ledger retrieved.", $notifications);

} catch (Exception $e) {
    error_log("Notifications List API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve notification ledger.", null, 500);
}
?>