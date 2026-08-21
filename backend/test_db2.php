<?php
require_once __DIR__ . '/config/env.php';

$tests = [
    'novalink @ localhost' => ['host' => 'localhost', 'user' => 'novalink', 'pass' => 'Novalink123!'],
    'novalink @ 127.0.0.1' => ['host' => '127.0.0.1', 'user' => 'novalink', 'pass' => 'Novalink123!'],
    'root @ localhost (empty pass)' => ['host' => 'localhost', 'user' => 'root', 'pass' => ''],
    'root @ 127.0.0.1 (empty pass)' => ['host' => '127.0.0.1', 'user' => 'root', 'pass' => ''],
];

foreach ($tests as $label => $config) {
    try {
        $dsn = "mysql:host={$config['host']};port=3306;dbname=novalink_db;charset=utf8mb4";
        $pdo = new PDO($dsn, $config['user'], $config['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        echo "[SUCCESS] {$label}\n";
    } catch (PDOException $e) {
        echo "[FAILED] {$label}: " . $e->getMessage() . "\n";
    }
}