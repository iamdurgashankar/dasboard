<?php
/**
 * Schema Verification Script
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../includes/db.php';

header('Content-Type: text/plain');

try {
    $db = getDbConnection();
    echo "Schema Verification Report\n";
    echo "==========================\n\n";

    $tables = ['users', 'projects', 'tasks', 'subtasks', 'task_comments', 'blog_posts', 'notifications', 'contacts'];

    foreach ($tables as $table) {
        echo "Table: $table\n";
        try {
            $stmt = $db->query("DESCRIBE $table");
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            echo " - Columns: " . implode(", ", $columns) . "\n";
        } catch (Exception $e) {
            echo " - [ERROR] " . $e->getMessage() . "\n";
        }
        echo "\n";
    }

} catch (Exception $e) {
    echo "Critical Error: " . $e->getMessage();
}
?>
