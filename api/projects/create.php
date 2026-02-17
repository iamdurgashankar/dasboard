<?php
/**
 * Create Project API
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

$name = sanitizeInput($input['name'] ?? '');
$description = sanitizeInput($input['description'] ?? '');
$language = sanitizeInput($input['language'] ?? 'TypeScript');

if (empty($name)) {
    sendJsonResponse("error", "Project name required.");
}

try {
    $db = getDbConnection();

    $stmt = $db->prepare("INSERT INTO projects (name, description, language, status, health, progress) VALUES (?, ?, ?, 'active', 100, 0)");
    $stmt->execute([$name, $description, $language]);

    $projectId = $db->lastInsertId();

    sendJsonResponse("success", "Architectural payload initialized.", ["id" => $projectId]);

} catch (Exception $e) {
    error_log("Project Create API Error: " . $e->getMessage());
    sendJsonResponse("error", "Failed to initialize project.", null, 500);
}
?>