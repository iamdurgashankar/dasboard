<?php
/**
 * Update User API (Role/Status/Profile)
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
$role = sanitizeInput($input['role'] ?? '');
$status = sanitizeInput($input['status'] ?? '');
$name = sanitizeInput($input['name'] ?? '');
$email = sanitizeInput($input['email'] ?? '');

if (empty($id)) {
    sendJsonResponse("error", "User ID required for update.");
}

try {
    $db = getDbConnection();

    // Check if user exists
    $stmt = $db->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        sendJsonResponse("error", "User not found.");
    }

    $fields = [];
    $params = [];

    if (!empty($role)) {
        $fields[] = "role = ?";
        $params[] = $role;
    }
    if (!empty($status)) {
        $fields[] = "status = ?";
        $params[] = $status;
    }
    if (!empty($name)) {
        $fields[] = "name = ?";
        $params[] = $name;
    }
    if (!empty($email)) {
        $fields[] = "email = ?";
        $params[] = $email;
    }

    if (empty($fields)) {
        sendJsonResponse("error", "No parameters provided for update.");
    }

    $params[] = $id;
    $sql = "UPDATE users SET " . implode(", ", $fields) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    // Notify User of Changes
    if (!empty($status)) {
        createNotification($db, $id, 'info', 'Identity Status Updated', "Your account status has been updated to: $status");
    }
    if (!empty($role)) {
        createNotification($db, $id, 'warning', 'Privilege Level Modified', "Your role has been updated to: $role");
    }

    sendJsonResponse("success", "User identity updated.");

} catch (Exception $e) {
    error_log("User Update API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to update user identity.", null, 500);
}
?>