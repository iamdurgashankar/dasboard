<?php
/**
 * Contact Submission API
 */

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/db.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse("error", "Method not allowed.", null, 405);
}

// Sanitize inputs
$input = json_decode(file_get_contents('php://input'), true);
if (!$input)
    $input = $_POST;

$name = sanitizeInput($input['name'] ?? '');
$email = sanitizeInput($input['email'] ?? '');
$subject = sanitizeInput($input['subject'] ?? '');
$message = sanitizeInput($input['message'] ?? '');

// Validation
if (empty($name) || empty($email) || empty($subject) || empty($message)) {
    sendJsonResponse("error", "All fields are required for transmission.");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendJsonResponse("error", "Invalid communication endpoint (email).");
}

try {
    $db = getDbConnection();

    $stmt = $db->prepare("INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)");
    $stmt->execute([$name, $email, $subject, $message]);

    sendJsonResponse("success", "Inquiry transmitted to the core. We will reach out soon.");

} catch (Exception $e) {
    error_log("Contact API Error: " . $e->getMessage());
    sendJsonResponse("error", "Transmission failed. Neural link unstable.", null, 500);
}
?>