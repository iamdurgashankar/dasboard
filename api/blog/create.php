<?php
/**
 * Create Blog Post API
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

$title = sanitizeInput($input['title'] ?? '');
$excerpt = sanitizeInput($input['excerpt'] ?? '');
$content = $input['content'] ?? ''; // Content can have markdown, sanitization needs care
$category = sanitizeInput($input['category'] ?? 'Engineering');
$tags = $input['tags'] ?? [];

if (empty($title)) {
    sendJsonResponse("error", "Title required for blog post.");
}

try {
    $db = getDbConnection();

    $authorId = $_SESSION['user_id'];

    $stmt = $db->prepare("INSERT INTO blog_posts (title, excerpt, content, author_id, category, tags, status) VALUES (?, ?, ?, ?, ?, ?, 'draft')");
    $stmt->execute([
        $title,
        $excerpt,
        $content,
        $authorId,
        $category,
        json_encode($tags),
    ]);

    $postId = $db->lastInsertId();

    sendJsonResponse("success", "Blog post draft saved.", ["id" => $postId]);

} catch (Exception $e) {
    error_log("Blog Create API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to save blog post.", null, 500);
}
?>