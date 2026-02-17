<?php
/**
 * Projects List API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

try {
    $db = getDbConnection();

    $stmt = $db->query("SELECT * FROM projects ORDER BY last_update DESC");
    $projects = $stmt->fetchAll();

    sendJsonResponse("success", "Projects retrieved.", $projects);

} catch (Exception $e) {
    error_log("Projects List API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve projects.", null, 500);
}
?>