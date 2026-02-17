<?php
/**
 * Decommission User API
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

if (empty($id)) {
    sendJsonResponse("error", "User ID required for decommissioning.");
}

try {
    $db = getDbConnection();

    // Prevent self-deletion if needed
    if ($id == $_SESSION['user_id']) {
        sendJsonResponse("error", "Security Interlock: Self-decommissioning is restricted.");
    }

    $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);

    sendJsonResponse("success", "User decommissioned successfully.");

} catch (Exception $e) {
    error_log("User Delete API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to decommission user.", null, 500);
}
?>