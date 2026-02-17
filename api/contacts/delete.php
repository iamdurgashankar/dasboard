<?php
/**
 * Delete Contact Submission API
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
    sendJsonResponse("error", "Inquiry ID required for purge.");
}

try {
    $db = getDbConnection();

    $stmt = $db->prepare("DELETE FROM contacts WHERE id = ?");
    $stmt->execute([$id]);

    sendJsonResponse("success", "Inquiry purged from ledger.");

} catch (Exception $e) {
    error_log("Contact Delete API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to purge inquiry.", null, 500);
}
?>