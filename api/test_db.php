<?php
/**
 * Database Diagnostic Script
 * Visit this script to check if the database connection is working.
 */

// Force error reporting for diagnostics
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../includes/config.php';

header('Content-Type: text/plain');

echo "DevInquire Database Diagnostic\n";
echo "------------------------------\n";
echo "PHP Version: " . phpversion() . "\n";
echo "Interface: " . php_sapi_name() . "\n";
echo "Server: " . $_SERVER['SERVER_SOFTWARE'] . "\n\n";

// Check PDO
if (!extension_loaded('pdo_mysql')) {
    echo "[FAIL] pdo_mysql extension is NOT loaded.\n";
} else {
    echo "[OK] pdo_mysql extension is loaded.\n";
}

// Check Credentials
echo "DB Host: " . DB_HOST . "\n";
echo "DB Name: " . DB_NAME . "\n";
echo "DB User: " . DB_USER . "\n";
echo "DB Pass: " . (empty(DB_PASS) ? "EMPTY" : "SET") . "\n\n";

// Attempt Connection
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5
    ];

    echo "Attempting connection to $dsn...\n";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);

    echo "[SUCCESS] Connected to database successfully.\n";

    // Check tables
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo "Tables found: " . count($tables) . "\n";
    foreach ($tables as $table) {
        echo " - $table\n";
    }

} catch (PDOException $e) {
    echo "[FAIL] Database Connection Error: " . $e->getMessage() . "\n";
    echo "Error Code: " . $e->getCode() . "\n";
} catch (Exception $e) {
    echo "[FAIL] General Error: " . $e->getMessage() . "\n";
}
?>