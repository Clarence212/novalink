<?php
// Copy this file to env.php on the server and replace every placeholder.
// env.php is excluded from version control and deployment overwrites.

define('APP_ENV', 'production');
define('APP_ORIGIN', 'https://novalinkhub.tech');
define('SESSION_NAME', 'novalink_session');
// Optional: an absolute directory writable only by the PHP service account.
define('SESSION_SAVE_PATH', '');

define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'novalink_db');
define('DB_USER', 'novalink_app');
define('DB_PASS', 'replace-with-a-long-random-password');

define('SYSTEM_EMAIL', 'mail@novalinkhub.tech');
define('BREVO_API_KEY', 'replace-with-your-brevo-api-key');
