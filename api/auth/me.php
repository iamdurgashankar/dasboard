<?php
/**
 * Authentication API: Get Current User
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

try {
    $db = getDbConnection();

    $userId = $_SESSION['user_id'];
    $stmt = $db->prepare("SELECT id, name, email, role, status, avatar FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if ($user) {
        sendJsonResponse("success", "Identity retrieved.", $user);
    } else {
        // Clean up session if user not found in DB
        session_destroy();
        sendJsonResponse("error", "Identity purged or not found.", null, 401);
    }

} catch (Exception $e) {
    error_log("Me API Error: " . $e->getMessage());
    sendJsonResponse("error", "System fault during identity retrieval.", null, 500);
}
?>