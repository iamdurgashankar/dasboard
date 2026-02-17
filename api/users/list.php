<?php
/**
 * List Users API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

try {
    $db = getDbConnection();

    // In a real scenario, we might restrict this to Admins
    // if ($_SESSION['role'] !== 'Admin') { ... }

    $stmt = $db->prepare("
        SELECT 
            u.id, u.name, u.email, u.role, u.status, u.avatar, u.created_at as joinDate,
            (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status != 'completed') as active_tasks
        FROM users u 
        ORDER BY u.created_at DESC
    ");
    $stmt->execute();
    $users = $stmt->fetchAll();

    sendJsonResponse("success", "User directory retrieved.", $users);

} catch (Exception $e) {
    error_log("User List API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve user directory.", null, 500);
}
?>