<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3306', 'root', 'ok123456');
    $pdo->exec('CREATE DATABASE IF NOT EXISTS fsadvisory_crm;');
    echo "SUCCESS: Connected to MySQL with root / ok123456! Database fsadvisory_crm created or exists.\n";
} catch (PDOException $e) {
    echo "MySQL Error: " . $e->getMessage() . "\n";
}
