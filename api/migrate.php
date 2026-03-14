<?php
/**
 * Production Database Migration Script
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../includes/db.php';

header('Content-Type: text/plain');

try {
    $db = getDbConnection();
    echo "Starting Neural Schema Synchronization...\n";

    // 1. Check for 'avatar' column in 'users'
    $stmt = $db->query("DESCRIBE users");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('avatar', $columns)) {
        echo " - Column 'avatar' missing in 'users'. Patching...\n";
        $db->exec("ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT NULL AFTER status");
        echo " ✓ 'avatar' column synchronized.\n";
    } else {
        echo " - 'avatar' column already exists in 'users'.\n";
    }

    // Add other missing columns here if found via check_schema.php
    
    echo "\n[SUCCESS] Neural link schema is now synchronized. You can now login.\n";
    echo "IMPORTANT: Delete this script (api/migrate.php) after use.\n";

} catch (Exception $e) {
    echo "\n[ERROR] Synchronization Failure: " . $e->getMessage();
}
?>
