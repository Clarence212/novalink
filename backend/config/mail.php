<?php
// hey reader! mail configuration for SMTP and email notifications
return [
    'driver' => 'smtp', // 'smtp' or 'mail'
    'smtp_host' => 'smtp.gmail.com',
    'smtp_port' => 587,
    'smtp_user' => 'notifications@novaville.org',
    'smtp_pass' => 'your_app_password_here',
    'from_email' => 'no-reply@novaville.org',
    'from_name' => 'Novaville Homeowners Association, Inc.',
];
