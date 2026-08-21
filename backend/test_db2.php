<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=novalink_db;charset=utf8mb4', 'novalink', 'Novalink123!', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    echo "SUCCESS: Connected to DB!";
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage();
}