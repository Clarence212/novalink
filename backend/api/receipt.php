<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

function pdf_text(string $value): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $ascii === false ? $value : $ascii);
}

function simple_receipt_pdf(array $lines): string
{
    $commands = [];
    $y = 770;
    foreach ($lines as $index => $line) {
        $fontSize = $index === 0 ? 18 : ($index === 1 ? 11 : 10);
        $commands[] = "BT /F1 {$fontSize} Tf 50 {$y} Td (" . pdf_text($line) . ") Tj ET";
        $y -= $index < 2 ? 28 : 20;
    }
    $stream = implode("\n", $commands) . "\n";
    $objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        "<< /Length " . strlen($stream) . " >>\nstream\n{$stream}endstream",
    ];
    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $index => $object) {
        $offsets[] = strlen($pdf);
        $number = $index + 1;
        $pdf .= "{$number} 0 obj\n{$object}\nendobj\n";
    }
    $xref = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
    for ($index = 1; $index <= count($objects); $index++) {
        $pdf .= sprintf('%010d 00000 n ', $offsets[$index]) . "\n";
    }
    $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    return $pdf;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    $pdo = requireDbConnection();
    $user = require_auth($pdo, ['admin', 'resident']);
    $paymentId = trim((string) ($_GET['paymentId'] ?? ''));
    if ($paymentId === '' || strlen($paymentId) > 36) {
        json_response(['error' => 'Invalid receipt request.'], 422);
    }
    $statement = $pdo->prepare(
        "SELECT p.*, h.owner_name, h.block_lot, h.street, validator.full_name AS validator_name
         FROM payments p
         JOIN homeowners h ON h.homeowner_id = p.homeowner_id
         LEFT JOIN users validator ON validator.user_id = p.validated_by_user_id
         WHERE p.payment_id = ? AND p.validation_status = 'validated' LIMIT 1"
    );
    $statement->execute([$paymentId]);
    $payment = $statement->fetch();
    if (!$payment) {
        json_response(['error' => 'A validated payment receipt was not found.'], 404);
    }
    if ($user['role'] === 'resident' && $user['homeownerId'] !== $payment['homeowner_id']) {
        json_response(['error' => 'You do not have access to this receipt.'], 403);
    }
    $allocationStatement = $pdo->prepare(
        "SELECT DATE_FORMAT(d.billing_month, '%M %Y') AS billing_month, pa.amount_applied
         FROM payment_allocations pa JOIN dues d ON d.dues_id = pa.dues_id
         WHERE pa.payment_id = ? ORDER BY d.billing_month"
    );
    $allocationStatement->execute([$paymentId]);
    $allocations = $allocationStatement->fetchAll();
    $receiptNumber = 'NHAI-' . gmdate('Y', strtotime((string) ($payment['validated_at'] ?: $payment['created_at'])))
        . '-' . strtoupper(substr(str_replace('-', '', $paymentId), 0, 8));
    $lines = [
        'NHAI OFFICIAL PAYMENT RECEIPT',
        'NovaLink Homeowners Association Portal',
        '',
        'Receipt No: ' . $receiptNumber,
        'Homeowner: ' . $payment['owner_name'],
        'Property: ' . $payment['block_lot'] . ', ' . $payment['street'],
        'Payment reference: ' . $payment['payment_reference'],
        'Payment date: ' . $payment['payment_date'],
        'Validated at: ' . $payment['validated_at'],
        'Validated by: ' . ($payment['validator_name'] ?: 'NHAI Administrator'),
        'Amount received: PHP ' . number_format((float) $payment['amount_paid'], 2),
        '',
        'ALLOCATIONS',
    ];
    if (!$allocations) {
        $lines[] = 'No dues allocated; held as homeowner credit.';
    }
    foreach ($allocations as $allocation) {
        $lines[] = $allocation['billing_month'] . ': PHP ' . number_format((float) $allocation['amount_applied'], 2);
    }
    $lines[] = 'Unallocated credit: PHP ' . number_format((float) $payment['unallocated_amount'], 2);
    $lines[] = '';
    $lines[] = 'This system-generated receipt confirms validation in NovaLink.';
    $lines[] = 'Generated: ' . gmdate('Y-m-d H:i:s') . ' UTC';
    $pdf = simple_receipt_pdf($lines);
    header_remove('Content-Type');
    header('Content-Type: application/pdf');
    header('Content-Length: ' . strlen($pdf));
    header('Content-Disposition: attachment; filename="' . $receiptNumber . '.pdf"');
    header('Cache-Control: private, no-store');
    echo $pdf;
    exit;
} catch (Throwable $error) {
    api_exception($error);
}
