<?php
/**
 * List Blog Posts API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

requireAuth();

try {
    $db = getDbConnection();

    $stmt = $db->prepare("SELECT b.*, u.name as author_name FROM blog_posts b LEFT JOIN users u ON b.author_id = u.id ORDER BY b.created_at DESC");
    $stmt->execute();
    $posts = $stmt->fetchAll();

    foreach ($posts as &$post) {
        $post['tags'] = json_decode($post['tags'] ?? '[]');
    }

    sendJsonResponse("success", "Blog posts retrieved.", $posts);

} catch (Exception $e) {
    error_log("Blog List API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve blog posts.", null, 500);
}
?>