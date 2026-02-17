<?php
/**
 * DevInquire Production Configuration
 * Load database credentials and system constants
 */

// Deployment Mode
define('DEBUG_MODE', false); // Set to true only in development

// Database Configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'u180145459_dashboard_dev');
define('DB_USER', 'u180145459_dashboard_dev');
define('DB_PASS', 'DevInquire2026!');
define('DB_CHARSET', 'utf8mb4');

// Security Configurations
define('SESSION_LIFETIME', 86400); // 24 hours
define('CSRF_TOKEN_NAME', 'di_csrf_token');

// API Settings
define('API_ALLOWED_ORIGINS', ['http://localhost:3000', 'https://devinquire.com']);

// Error Reporting
if (DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/../logs/php_errors.log');
}

// Start secure session if not already started
if (session_status() == PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path' => '/',
        'domain' => '',
        'secure' => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}
?>