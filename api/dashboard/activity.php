<?php
/**
 * Dashboard Activity API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

try {
    $db = getDbConnection();

    // For now, we simulate activity from various tables or return logs
    // In a real system, we'd have a dedicated activity_logs table
    $stmt = $db->query("
        (SELECT 'deploy' as type, 'AutoBot' as user, 'v2.4.1 to Production' as target, 'deployed' as action, created_at as time FROM projects LIMIT 5)
        UNION
        (SELECT 'pr' as type, name as user, subject as target, 'submitted inquiry' as action, created_at as time FROM contacts LIMIT 5)
        ORDER BY time DESC LIMIT 10
    ");

    $activities = $stmt->fetchAll();

    // Map to frontend format
    $formatted = array_map(function ($act) {
        return [
            "id" => uniqid(),
            "user" => $act['user'],
            "avatar" => "https://ui-avatars.com/api/?name=" . urlencode($act['user']) . "&background=6366f1&color=fff",
            "action" => $act['action'],
            "target" => $act['target'],
            "time" => "Just now", // In real app, calculate diff
            "type" => $act['type']
        ];
    }, $activities);

    sendJsonResponse("success", "Activity stream synchronized.", $formatted);

} catch (Exception $e) {
    error_log("Activity API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve activity.", null, 500);
}
?>