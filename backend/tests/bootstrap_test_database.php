<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}

require_once __DIR__ . '/../config/database.php';

if (config_value('APP_ENV', 'NOVALINK_APP_ENV', '') !== 'testing') {
    fwrite(STDERR, "Refusing to reset a database outside APP_ENV=testing.\n");
    exit(2);
}
$pdo = requireDbConnection();
$databaseName = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();
if (!preg_match('/(?:_ci|_test)$/', $databaseName)) {
    fwrite(STDERR, "Test database name must end in _ci or _test.\n");
    exit(2);
}

$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
foreach ($tables as $table) {
    if (!preg_match('/^[A-Za-z0-9_]+$/', (string) $table)) {
        throw new RuntimeException('Unsafe table name returned by the test database.');
    }
    $pdo->exec('DROP TABLE `' . $table . '`');
}
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

$schema = file_get_contents(__DIR__ . '/../schema.sql');
if ($schema === false) {
    throw new RuntimeException('Test schema could not be read.');
}
$statements = preg_split('/;[\t ]*(?:\r?\n|$)/', trim($schema));
foreach ($statements ?: [] as $statement) {
    $statement = trim($statement);
    if ($statement !== '') {
        $pdo->exec($statement);
    }
}

$users = [
    ['10000000-0000-4000-8000-000000000001', 1, 'CI Administrator', 'admin@example.test', 'AdminReliability123!'],
    ['10000000-0000-4000-8000-000000000002', 2, 'CI Security', 'security@example.test', 'GuardReliability123!'],
    ['10000000-0000-4000-8000-000000000003', 3, 'CI Resident', 'resident@example.test', 'ResidentReliability123!'],
];
$insertUser = $pdo->prepare(
    "INSERT INTO users
     (user_id, role_id, full_name, email, password_hash, account_status,
      email_verified, email_verified_at, force_password_change)
     VALUES (?, ?, ?, ?, ?, 'active', 1, UTC_TIMESTAMP(), 0)"
);
foreach ($users as [$id, $roleId, $name, $email, $password]) {
    $insertUser->execute([$id, $roleId, $name, $email, password_hash($password, PASSWORD_DEFAULT)]);
}

$insertHomeowner = $pdo->prepare(
    'INSERT INTO homeowners
     (homeowner_id, user_id, owner_name, block_lot, street, contact_number, email, record_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, \'active\')'
);
$insertHomeowner->execute([
    '20000000-0000-4000-8000-000000000001',
    null,
    'CI Resident', 'Block A Lot 1', 'Reliability Street', '09170000001', 'resident@example.test',
]);
$insertHomeowner->execute([
    '20000000-0000-4000-8000-000000000002',
    null,
    'New CI Resident', 'Block A Lot 2', 'Reliability Street', '09170000002', 'newresident@example.test',
]);

$pdo->prepare(
    'INSERT INTO homeowner_user_links (homeowner_id, user_id, linked_by_user_id)
     VALUES (?, ?, ?)'
)->execute([
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
]);

$registrationToken = 'ci-registration-action-token';
$insertToken = $pdo->prepare(
    "INSERT INTO email_verification_tokens
     (token_id, email, full_name, contact_number, purpose, code_hash,
      action_token_hash, expires_at, verified_at)
     VALUES (?, ?, ?, ?, 'registration', ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR), UTC_TIMESTAMP())"
);
$insertToken->execute([
    '30000000-0000-4000-8000-000000000001',
    'newresident@example.test',
    'New CI Resident',
    '09170000002',
    password_hash('123456', PASSWORD_DEFAULT),
    password_hash($registrationToken, PASSWORD_DEFAULT),
]);

fwrite(STDOUT, "MariaDB test database initialized.\n");
