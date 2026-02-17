<?php
/**
 * List Contact Submissions API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

try {
    $db = getDbConnection();

    $stmt = $db->prepare("SELECT * FROM contacts ORDER BY created_at DESC");
    $stmt->execute();
    $submissions = $stmt->fetchAll();

    foreach ($submissions as &$s) {
        $s['date'] = explode(' ', $s['created_at'])[0];
    }

    sendJsonResponse("success", "Inquiry ledger retrieved.", $submissions);

} catch (Exception $e) {
    error_log("Contact List API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve inquiry ledger.", null, 500);
}
?>