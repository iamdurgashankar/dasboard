<?php
/**
 * Core Utility and Security Functions
 */

require_once __DIR__ . '/config.php';

/**
 * Return a standardized JSON response and exit
 */
function sendJsonResponse($status, $message, $data = null, $httpCode = 200)
{
    header('Content-Type: application/json');
    http_response_code($httpCode);

    $response = [
        "status" => $status,
        "message" => $message
    ];

    if ($data !== null) {
        $response["data"] = $data;
    }

    echo json_encode($response);
    exit;
}

/**
 * Sanitize input data
 */
function sanitizeInput($data)
{
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

/**
 * Validate CSRF Token
 */
function validateCsrfToken($token = null)
{
    if ($token === null) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST[CSRF_TOKEN_NAME] ?? '';
    }

    if (!isset($_SESSION[CSRF_TOKEN_NAME]) || empty($token) || $token !== $_SESSION[CSRF_TOKEN_NAME]) {
        return false;
    }
    return true;
}

/**
 * Generate a new CSRF Token
 */
function generateCsrfToken()
{
    if (!isset($_SESSION[CSRF_TOKEN_NAME])) {
        $_SESSION[CSRF_TOKEN_NAME] = bin2hex(random_bytes(32));
    }
    return $_SESSION[CSRF_TOKEN_NAME];
}

/**
 * Check if user is logged in
 */
function isAuthenticated()
{
    return isset($_SESSION['user_id']);
}

/**
 * Require authentication or return 401
 */
function requireAuth()
{
    if (!isAuthenticated()) {
        sendJsonResponse("error", "Unauthorized: Neural link closed.", null, 401);
    }
}

/**
 * Require authentication and validate CSRF for state-changing operations
 */
function requireMutatingAuth()
{
    requireAuth();
    if (!validateCsrfToken()) {
        sendJsonResponse("error", "Security Violation: CSRF mismatch. Access revoked.", null, 403);
    }
}

/**
 * Password hashing helper
 */
function hashPassword($password)
{
    return password_hash($password, PASSWORD_DEFAULT);
}

/**
 * Verify password helper
 */
function verifyPassword($password, $hash)
{
    return password_verify($password, $hash);
}

/**
 * Create a new notification Signal
 */
function createNotification($db, $userId, $type, $title, $message, $link = null)
{
    try {
        $stmt = $db->prepare("INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $type, $title, $message, $link]);
        return true;
    } catch (Exception $e) {
        error_log("Notification Signal Fault: " . $e->getMessage());
        return false;
    }
}
?>