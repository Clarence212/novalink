<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = getDbConnection();
    if (!$pdo) {
        throw new Exception('Database connection failed.');
    }

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $stmt = $pdo->query("
            SELECT 
                u.user_id as id, 
                r.role_name as role, 
                u.full_name as fullName, 
                u.email, 
                u.account_status as status, 
                u.email_verified as emailVerified
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            ORDER BY u.created_at DESC
        ");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format boolean emailVerified
        foreach ($users as &$u) {
            $u['emailVerified'] = (bool)$u['emailVerified'];
        }

        echo json_encode([
            'success' => true,
            'users' => $users
        ]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $action = $input['action'] ?? '';
        $email = trim($input['email'] ?? '');
        $userId = $input['user_id'] ?? $input['id'] ?? '';

        if ($action === 'create' || $action === 'register') {
            $fullName = trim($input['fullName'] ?? $input['full_name'] ?? '');
            $roleName = strtolower(trim($input['role'] ?? 'resident'));
            $status = trim($input['status'] ?? ($roleName === 'resident' ? 'pending' : 'active'));
            $password = $input['password'] ?? 'novalink2026';

            if (empty($email) || empty($fullName)) {
                http_response_code(400);
                echo json_encode(['error' => 'Full name and email are required.']);
                exit;
            }

            // Map role name to role_id
            $roleMap = ['admin' => 1, 'security' => 2, 'resident' => 3];
            $roleId = $roleMap[$roleName] ?? 3;

            // Check if email already exists
            $chk = $pdo->prepare("SELECT user_id, account_status FROM users WHERE email = ?");
            $chk->execute([$email]);
            $existing = $chk->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Update existing user status if needed
                $upd = $pdo->prepare("UPDATE users SET full_name = ?, account_status = ?, role_id = ? WHERE email = ?");
                $upd->execute([$fullName, $status, $roleId, $email]);
                echo json_encode(['success' => true, 'message' => 'User account updated successfully.']);
                exit;
            }

            $newId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
            $passwordHash = password_hash($password, PASSWORD_BCRYPT);

            $ins = $pdo->prepare("
                INSERT INTO users (user_id, role_id, full_name, email, password_hash, account_status, email_verified, email_verified_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
            ");
            $ins->execute([$newId, $roleId, $fullName, $email, $passwordHash, $status]);

            echo json_encode(['success' => true, 'message' => 'User account created successfully.', 'id' => $newId]);
            exit;
        }

        if (in_array($action, ['approve', 'reject', 'deactivate', 'reactivate'])) {
            $statusMap = [
                'approve' => 'active',
                'reject' => 'rejected',
                'deactivate' => 'inactive',
                'reactivate' => 'active'
            ];
            $newStatus = $statusMap[$action];

            if ($userId) {
                $upd = $pdo->prepare("UPDATE users SET account_status = ? WHERE user_id = ? OR email = ?");
                $upd->execute([$newStatus, $userId, $email]);
            } else if ($email) {
                $upd = $pdo->prepare("UPDATE users SET account_status = ? WHERE email = ?");
                $upd->execute([$newStatus, $email]);
            }

            echo json_encode(['success' => true, 'message' => "User status updated to {$newStatus}."]);
            exit;
        }

        http_response_code(400);
        echo json_encode(['error' => 'Invalid action.']);
        exit;
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
