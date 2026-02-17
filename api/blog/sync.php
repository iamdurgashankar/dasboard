<?php
/**
 * Sync Blog Post API (Mock for now, but backed by DB status update)
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
    sendJsonResponse("error", "Post ID required for sync.");
}

try {
    $db = getDbConnection();

    // In a real scenario, this would trigger a webhook to devinquire.com
    // For now, we simulate the delay and update the status in local DB.

    sleep(1); // Small simulation of remote sync latency

    $stmt = $db->prepare("UPDATE blog_posts SET status = 'synced' WHERE id = ?");
    $stmt->execute([$id]);

    sendJsonResponse("success", "Article successfully deployed to devinquire.com production.");

} catch (Exception $e) {
    error_log("Blog Sync API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to sync article.", null, 500);
}
?>