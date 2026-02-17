<?php
/**
 * Update Project API
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
$name = sanitizeInput($input['name'] ?? '');
$description = sanitizeInput($input['description'] ?? '');
$status = sanitizeInput($input['status'] ?? '');
$progress = sanitizeInput($input['progress'] ?? '');
$health = sanitizeInput($input['health'] ?? '');

if (empty($id)) {
    sendJsonResponse("error", "Project ID required for update.");
}

try {
    $db = getDbConnection();

    $fields = [];
    $params = [];

    if (!empty($name)) {
        $fields[] = "name = ?";
        $params[] = $name;
    }
    if (!empty($description)) {
        $fields[] = "description = ?";
        $params[] = $description;
    }
    if (!empty($status)) {
        $fields[] = "status = ?";
        $params[] = $status;
    }
    if ($progress !== '') {
        $fields[] = "progress = ?";
        $params[] = $progress;
    }
    if ($health !== '') {
        $fields[] = "health = ?";
        $params[] = $health;
    }

    if (empty($fields)) {
        sendJsonResponse("error", "No update parameters provided.");
    }

    $params[] = $id;
    $sql = "UPDATE projects SET " . implode(", ", $fields) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    sendJsonResponse("success", "Architectural state updated.");

} catch (Exception $e) {
    error_log("Project Update API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to update project state.", null, 500);
}
?>