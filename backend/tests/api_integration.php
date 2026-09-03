<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}

final class ApiClient
{
    private string $baseUrl;
    private string $cookieFile;
    private string $csrfToken = '';

    public function __construct(string $baseUrl)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $cookie = tempnam(sys_get_temp_dir(), 'novalink-ci-cookie-');
        if ($cookie === false) {
            throw new RuntimeException('Could not create a test cookie jar.');
        }
        $this->cookieFile = $cookie;
        $session = $this->request('GET', '/backend/api/auth.php?action=session');
        $this->csrfToken = (string) ($session['json']['csrfToken'] ?? '');
        if ($this->csrfToken === '') {
            throw new RuntimeException('The API did not issue a CSRF token.');
        }
    }

    public function __destruct()
    {
        @unlink($this->cookieFile);
    }

    public function login(string $email, string $password): array
    {
        $response = $this->postJson('/backend/api/auth.php', [
            'action' => 'login', 'email' => $email, 'password' => $password,
        ]);
        if (isset($response['json']['csrfToken'])) {
            $this->csrfToken = (string) $response['json']['csrfToken'];
        }
        return $response;
    }

    public function get(string $path): array
    {
        return $this->request('GET', $path);
    }

    public function postJson(string $path, array $payload): array
    {
        return $this->request('POST', $path, $payload);
    }

    public function postMultipart(string $path, array $fields): array
    {
        return $this->request('POST', $path, $fields, true);
    }

    private function request(string $method, string $path, ?array $payload = null, bool $multipart = false): array
    {
        $handle = curl_init($this->baseUrl . $path);
        $headers = ['Accept: application/json'];
        if ($method !== 'GET') {
            $headers[] = 'X-CSRF-Token: ' . $this->csrfToken;
        }
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_COOKIEJAR => $this->cookieFile,
            CURLOPT_COOKIEFILE => $this->cookieFile,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 20,
        ]);
        if ($payload !== null) {
            if ($multipart) {
                curl_setopt($handle, CURLOPT_POSTFIELDS, $payload);
            } else {
                $headers[] = 'Content-Type: application/json';
                curl_setopt($handle, CURLOPT_HTTPHEADER, $headers);
                curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($payload, JSON_THROW_ON_ERROR));
            }
        }
        $body = curl_exec($handle);
        if (!is_string($body)) {
            $message = curl_error($handle);
            curl_close($handle);
            throw new RuntimeException('HTTP test request failed: ' . $message);
        }
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $contentType = (string) curl_getinfo($handle, CURLINFO_CONTENT_TYPE);
        curl_close($handle);
        $json = str_contains($contentType, 'application/json') ? json_decode($body, true) : null;
        return ['status' => $status, 'json' => is_array($json) ? $json : [], 'body' => $body, 'contentType' => $contentType];
    }
}

$assertions = 0;
function expect_true(bool $condition, string $message): void
{
    global $assertions;
    $assertions++;
    if (!$condition) {
        throw new RuntimeException("Assertion failed: {$message}");
    }
}
function expect_status(array $response, int $status, string $message): void
{
    expect_true(
        $response['status'] === $status,
        $message . " (expected {$status}, received {$response['status']}: " . substr($response['body'], 0, 500) . ')'
    );
}
function find_by(array $rows, string $key, mixed $value): ?array
{
    foreach ($rows as $row) {
        if (($row[$key] ?? null) === $value) {
            return $row;
        }
    }
    return null;
}

$baseUrl = getenv('NOVALINK_TEST_BASE_URL') ?: 'http://127.0.0.1:8080';
$anonymous = new ApiClient($baseUrl);
$health = $anonymous->get('/backend/api/health.php');
expect_status($health, 200, 'Health endpoint must succeed');
expect_true(($health['json']['database'] ?? null) === 'ok', 'Health endpoint must confirm the database');
$unauthorized = $anonymous->get('/backend/api/state.php');
expect_status($unauthorized, 401, 'Anonymous state access must be denied');
expect_true(strlen((string) ($unauthorized['json']['requestId'] ?? '')) >= 16, 'Error responses must include a request ID');

$admin = new ApiClient($baseUrl);
$security = new ApiClient($baseUrl);
$resident = new ApiClient($baseUrl);
expect_status($admin->login('admin@example.test', 'AdminReliability123!'), 200, 'Administrator login must work');
expect_status($security->login('security@example.test', 'GuardReliability123!'), 200, 'Security login must work');
expect_status($resident->login('resident@example.test', 'ResidentReliability123!'), 200, 'Resident login must work');

$adminState = $admin->get('/backend/api/state.php');
$securityState = $security->get('/backend/api/state.php');
$residentState = $resident->get('/backend/api/state.php');
expect_status($adminState, 200, 'Administrator state must load');
expect_status($securityState, 200, 'Security state must load');
expect_status($residentState, 200, 'Resident state must load');
expect_true(count($adminState['json']['state']['users'] ?? []) === 3, 'Administrator must receive account records');
expect_true(($securityState['json']['state']['users'] ?? null) === [], 'Security must not receive account records');
expect_true(($residentState['json']['state']['users'] ?? null) === [], 'Resident must not receive account records');
expect_true(count($residentState['json']['state']['homeowners'] ?? []) === 1, 'Resident state must be homeowner-scoped');
expect_true(($residentState['json']['state']['visitorLogs'] ?? null) === [], 'Resident must not receive gate logs');

expect_status($resident->postJson('/backend/api/records.php', ['resource' => 'users', 'action' => 'status']), 403, 'Resident must not administer users');
expect_status($security->postJson('/backend/api/records.php', ['resource' => 'dues', 'action' => 'configure']), 403, 'Security must not configure dues');
expect_status($admin->postJson('/backend/api/records.php', ['resource' => 'visitor-passes', 'action' => 'create']), 403, 'Administrator must not create resident passes');

$registration = $anonymous->postJson('/backend/api/auth.php', [
    'action' => 'register',
    'email' => 'newresident@example.test',
    'fullName' => 'New CI Resident',
    'password' => 'NewResidentReliability123!',
    'verificationToken' => 'ci-registration-action-token',
    'requestedAddress' => 'Block A Lot 1, Reliability Street',
]);
expect_status($registration, 201, 'Verified resident registration must succeed without a required household link');
$adminState = $admin->get('/backend/api/state.php');
$newUser = find_by($adminState['json']['state']['users'] ?? [], 'email', 'newresident@example.test');
expect_true($newUser !== null && $newUser['status'] === 'pending', 'Registration must create a pending user');
expect_true(($newUser['requestedAddress'] ?? '') === 'Block A Lot 1, Reliability Street', 'Registration must retain the address for administrator review');
$sharedHomeowner = find_by($adminState['json']['state']['homeowners'] ?? [], 'id', '20000000-0000-4000-8000-000000000001');
expect_true($sharedHomeowner !== null && ($sharedHomeowner['linkedUserCount'] ?? 0) === 1, 'Existing household must start with one linked account');
expect_status($admin->postJson('/backend/api/records.php', [
    'resource' => 'users', 'action' => 'status', 'id' => $newUser['id'], 'status' => 'active',
]), 200, 'Administrator must be able to approve an account without linking a household');
expect_status($admin->postJson('/backend/api/records.php', [
    'resource' => 'users', 'action' => 'update', 'id' => $newUser['id'],
    'fullName' => $newUser['fullName'], 'email' => $newUser['email'], 'role' => 'resident',
    'homeownerId' => $sharedHomeowner['id'], 'confirmAccessChange' => true,
]), 200, 'Administrator must be able to link another account to an occupied household record');
$adminState = $admin->get('/backend/api/state.php');
$sharedHomeowner = find_by($adminState['json']['state']['homeowners'] ?? [], 'id', '20000000-0000-4000-8000-000000000001');
expect_true(($sharedHomeowner['linkedUserCount'] ?? 0) === 2, 'Household master record must support multiple linked accounts');
$newResident = new ApiClient($baseUrl);
expect_status($newResident->login('newresident@example.test', 'NewResidentReliability123!'), 200, 'Approved resident login must work');

$facility = ($residentState['json']['state']['facilities'] ?? [])[0] ?? null;
expect_true(is_array($facility), 'Resident state must contain an active facility');
$reservation = $resident->postJson('/backend/api/records.php', [
    'resource' => 'reservations', 'action' => 'create', 'facilityId' => $facility['id'],
    'date' => gmdate('Y-m-d', time() + 86400), 'timeSlot' => '10:00 AM - 11:00 AM',
    'purpose' => 'CI reliability reservation',
]);
expect_status($reservation, 201, 'Resident reservation workflow must succeed');

$proofPath = tempnam(sys_get_temp_dir(), 'novalink-ci-proof-');
if ($proofPath === false) {
    throw new RuntimeException('Could not create a payment fixture.');
}
file_put_contents($proofPath, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true));
$reference = 'CI-' . bin2hex(random_bytes(8));
$payment = $resident->postMultipart('/backend/api/records.php', [
    'resource' => 'payments', 'action' => 'submit', 'amount' => '1700.00',
    'reference' => $reference,
    'proof' => new CURLFile($proofPath, 'image/png', 'payment.png'),
]);
@unlink($proofPath);
expect_status($payment, 201, 'Resident payment submission must succeed');
$paymentId = (string) ($payment['json']['id'] ?? '');
expect_status($admin->postJson('/backend/api/records.php', [
    'resource' => 'payments', 'action' => 'validate', 'id' => $paymentId,
]), 200, 'Administrator payment validation must succeed');
$residentState = $resident->get('/backend/api/state.php');
$validatedPayment = find_by($residentState['json']['state']['payments'] ?? [], 'id', $paymentId);
expect_true($validatedPayment !== null && $validatedPayment['validationStatus'] === 'validated', 'Validated payment must appear in resident state');
$receipt = $resident->get('/backend/api/receipt.php?paymentId=' . rawurlencode($paymentId));
expect_status($receipt, 200, 'Resident must download their validated receipt');
expect_true(str_starts_with($receipt['body'], '%PDF-'), 'Receipt must be a PDF');

$visitDate = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
$pass = $resident->postJson('/backend/api/records.php', [
    'resource' => 'visitor-passes', 'action' => 'create', 'visitorName' => 'CI Visitor',
    'contactNumber' => '09179999999', 'purpose' => 'Reliability test',
    'vehiclePlate' => 'CI 1234', 'visitDate' => $visitDate,
]);
expect_status($pass, 201, 'Resident visitor-pass creation must succeed');
$passCode = (string) ($pass['json']['passCode'] ?? '');
expect_status($security->postJson('/backend/api/records.php', [
    'resource' => 'visitor-passes', 'action' => 'lookup', 'passCode' => $passCode,
]), 200, 'Security pass lookup must succeed');
$admission = $security->postJson('/backend/api/records.php', [
    'resource' => 'visitor-passes', 'action' => 'redeem', 'passCode' => $passCode,
]);
expect_status($admission, 200, 'Security pass admission must succeed');
$visitorLogId = (string) ($admission['json']['visitorLogId'] ?? '');
expect_status($security->postJson('/backend/api/records.php', [
    'resource' => 'visitors', 'action' => 'exit', 'id' => $visitorLogId,
]), 200, 'Security quick checkout must succeed');
$visitorReport = $security->get('/backend/api/visitor_report.php?date=' . rawurlencode($visitDate));
expect_status($visitorReport, 200, 'Security daily visitor report must download');
expect_true(str_contains($visitorReport['body'], 'CI Visitor'), 'Daily visitor report must include the admitted visitor');

fwrite(STDOUT, "NovaLink API integration suite passed {$assertions} assertions.\n");
