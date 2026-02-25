<?php
/**
 * Authentication API: Login
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse("error", "Method not allowed.", null, 405);
}

// Sanitize inputs
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$email = sanitizeInput($input['email'] ?? '');
$password = $input['password'] ?? '';

// Basic validation
if (empty($email) || empty($password)) {
    sendJsonResponse("error", "Email and password required.");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendJsonResponse("error", "Invalid email format.");
}

try {
    $db = getDbConnection();

    // Fetch user
    $stmt = $db->prepare("SELECT id, name, email, password, role, status, avatar FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && verifyPassword($password, $user['password'])) {

        if ($user['status'] !== 'active') {
            sendJsonResponse("error", "Account pending approval.");
        }

        // Set session
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_name'] = $user['name'];
        $_SESSION['user_role'] = $user['role'];

        // Remove password hash from response
        unset($user['password']);

        sendJsonResponse("success", "Authentication successful. Welcome to the Neural Hub.", [
            "user" => $user,
            "csrf_token" => generateCsrfToken()
        ]);
    } else {
        sendJsonResponse("error", "Invalid credentials. Link denied.", null, 401);
    }

} catch (Exception $e) {
    error_log("Login API Error: " . $e->getMessage());
    sendJsonResponse("error", "Login Error: " . $e->getMessage(), null, 500);
}
?>