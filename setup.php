<?php
/**
 * Production Setup & Seeding Script
 * Run this ONCE to initialize the database and create the first admin.
 */

require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/functions.php';

header('Content-Type: text/plain');

try {
    $db = getDbConnection();
    echo "Neural Link Established. System Initialization Starting...\n";

    // 1. Create Admin User
    $adminEmail = 'admin@devinquire.com';
    $adminPass = 'DevInquire2025!'; // Secure production default - user should change immediately
    $hashedPass = hashPassword($adminPass);

    $stmt = $db->prepare("INSERT IGNORE INTO users (email, password, name, role, status) VALUES (?, ?, 'System Alpha', 'Admin', 'active')");
    $stmt->execute([$adminEmail, $hashedPass]);
    echo "✓ Admin credentials provisioned.\n";

    // 2. Seed Initial Projects
    $projects = [
        ['Neural Gateway', 'High-performance API mesh for distributed intelligence.', 'Rust', 'active', 98, 85],
        ['DevInquire v2.0', 'Production-ready dashboard core transition.', 'TypeScript', 'active', 100, 45]
    ];

    foreach ($projects as $p) {
        $stmt = $db->prepare("INSERT IGNORE INTO projects (name, description, language, status, health, progress) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute($p);
    }
    echo "✓ Production projects indexed.\n";

    // 3. Seed Initial Tasks
    $stmt = $db->query("SELECT id FROM projects LIMIT 1");
    $pId = $stmt->fetch()['id'];

    $stmt = $db->query("SELECT id FROM users LIMIT 1");
    $user = $stmt->fetch();
    $uId = $user['id'];
    $uName = $user['name'];

    $tasks = [
        [$pId, 'Hardening API Security', 'Implement CSRF and rate limiting.', $uId, 'in-progress', 'Critical', date('Y-m-d', strtotime('+3 days')), 8, json_encode(['Security', 'Core'])],
        [$pId, 'Database Migration', 'Transition from mock to MySQL PDO.', $uId, 'completed', 'High', date('Y-m-d'), 5, json_encode(['Database', 'Infrastructure'])]
    ];

    foreach ($tasks as $t) {
        $stmt = $db->prepare("INSERT IGNORE INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, points, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute($t);
        $tId = $db->lastInsertId();

        // Seed Subtasks for the first task
        if ($tId && $t[1] === 'Hardening API Security') {
            $subtasks = [
                ['Research CSRF patterns', 1, date('Y-m-d H:i:s')],
                ['Implement token validation', 0, NULL]
            ];
            foreach ($subtasks as $st) {
                $db->prepare("INSERT INTO subtasks (task_id, title, completed, completed_at) VALUES (?, ?, ?, ?)")->execute([$tId, $st[0], $st[1], $st[2]]);
            }

            // Seed Comments
            $comments = [
                ['Status transitioned to IN PROGRESS', 1],
                ['Security audit pending for new tokens.', 0]
            ];
            foreach ($comments as $c) {
                $db->prepare("INSERT INTO task_comments (task_id, user_id, text, is_system_log) VALUES (?, ?, ?, ?)")->execute([$tId, $c[1] ? NULL : $uId, $c[0], $c[1]]);
            }
        }
    }
    echo "✓ Task backlog and telemetry initialized.\n";

    echo "\n[SUCCESS] System ready for deployment. Please delete setup.php before going live.\n";

} catch (Exception $e) {
    echo "[ERROR] System malfunction: " . $e->getMessage();
}
?>