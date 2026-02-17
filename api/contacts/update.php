<?php
/**
 * Update Contact Submission API (Status/Priority)
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
$status = sanitizeInput($input['status'] ?? '');
$priority = sanitizeInput($input['priority'] ?? '');

if (empty($id)) {
    sendJsonResponse("error", "Inquiry ID required for update.");
}

try {
    $db = getDbConnection();

    $fields = [];
    $params = [];

    if (!empty($status)) {
        $fields[] = "status = ?";
        $params[] = $status;
    }
    if (!empty($priority)) {
        $fields[] = "priority = ?";
        $params[] = $priority;
    }

    if (empty($fields)) {
        sendJsonResponse("error", "No parameters provided for update.");
    }

    $params[] = $id;
    $sql = "UPDATE contacts SET " . implode(", ", $fields) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    sendJsonResponse("success", "Inquiry state updated.");

} catch (Exception $e) {
    error_log("Contact Update API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to update inquiry state.", null, 500);
}
?>