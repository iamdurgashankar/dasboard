<?php
/**
 * Database Connection Handler using PDO
 */

require_once __DIR__ . '/config.php';

function getDbConnection()
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (\PDOException $e) {
            // Log error internally, don't expose to user
            error_log("Database Connection Error: " . $e->getMessage());

            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode([
                "status" => "error",
                "message" => "Internal System Fault: Infrastructure unreachable."
            ]);
            exit;
        }
    }

    return $pdo;
}
?>