<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    $pdo = requireDbConnection();
    $user = require_auth($pdo, ['admin', 'resident']);
    if (($_GET['type'] ?? '') === 'payment-qr') {
        $file = $pdo->query(
            "SELECT qr_image_path AS storedName FROM payment_qr_codes WHERE is_active = 1 AND qr_image_path IS NOT NULL ORDER BY updated_at DESC LIMIT 1"
        )->fetch();
        $base = realpath(__DIR__ . '/../storage/payment-qr');
        $path = $base && $file ? realpath($base . DIRECTORY_SEPARATOR . basename($file['storedName'])) : false;
        if (!$base || !$path || !str_starts_with($path, $base . DIRECTORY_SEPARATOR) || !is_file($path)) {
            json_response(['error' => 'Payment QR image is unavailable.'], 404);
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        header_remove('Content-Type');
        header('Content-Type: ' . $finfo->file($path));
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: inline; filename="payment-qr"');
        header('Cache-Control: private, max-age=300');
        readfile($path);
        exit;
    }
    $paymentId = trim((string) ($_GET['paymentId'] ?? ''));
    if ($paymentId === '' || strlen($paymentId) > 36) {
        json_response(['error' => 'Invalid payment file request.'], 422);
    }

    $statement = $pdo->prepare(
        'SELECT p.homeowner_id, p.proof_stored_name, p.proof_original_name, p.proof_mime_type
         FROM payments p WHERE p.payment_id = ? LIMIT 1'
    );
    $statement->execute([$paymentId]);
    $file = $statement->fetch();
    if (!$file) {
        json_response(['error' => 'Payment proof not found.'], 404);
    }

    if ($user['role'] === 'resident' && $user['homeownerId'] !== $file['homeowner_id']) {
        json_response(['error' => 'You do not have access to this file.'], 403);
    }

    $base = realpath(__DIR__ . '/../storage/payment-proofs');
    $path = $base ? realpath($base . DIRECTORY_SEPARATOR . basename($file['proof_stored_name'])) : false;
    if (!$base || !$path || !str_starts_with($path, $base . DIRECTORY_SEPARATOR) || !is_file($path)) {
        json_response(['error' => 'Payment proof file is unavailable.'], 404);
    }

    header_remove('Content-Type');
    header('Content-Type: ' . $file['proof_mime_type']);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: inline; filename="' . rawurlencode(basename($file['proof_original_name'])) . '"');
    header('Cache-Control: private, no-store');
    readfile($path);
    exit;
} catch (Throwable $error) {
    api_exception($error);
}
