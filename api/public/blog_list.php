<?php
/**
 * Public List Blog Posts API
 * Used by devinquire.com/blog
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';



try {
    $db = getDbConnection();

    $category = $_GET['category'] ?? null;

    $query = "SELECT b.id, b.title, b.excerpt, b.category, b.tags, b.created_at, u.name as author_name 
              FROM blog_posts b 
              LEFT JOIN users u ON b.author_id = u.id 
              WHERE b.status = 'published'";

    $params = [];
    if ($category) {
        $query .= " AND b.category = ?";
        $params[] = $category;
    }

    $query .= " ORDER BY b.created_at DESC";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($posts as &$post) {
        $post['tags'] = json_decode($post['tags'] ?? '[]');
    }

    sendJsonResponse("success", "Public blog posts retrieved.", $posts);

} catch (Exception $e) {
    error_log("Public Blog List API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to retrieve blog posts.", null, 500);
}
?>