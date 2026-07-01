<?php
// We will test by calling the API via curl
$loginUrl = "http://localhost/api/auth/login";

// Get password hash from db to verify we can login
require 'api/config/database.php';
$db = Database::connect();
$stmt = $db->query("SELECT * FROM users WHERE email = 'sandeep@umbrellafinance.in'");
$user = $stmt->fetch();
if (!$user) {
    echo "Admin user not found.\n";
    exit;
}

// Since we cannot login easily if we don't know the plain password, we can generate a temporary auth token
// or we can mock the request by invoking index.php programmatically in-process!
// Overriding $_SERVER variables and requiring index.php is much more reliable and doesn't depend on network/ports!
// Let's do that.

$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/api/saving-accounts/3/deposit';
$_SERVER['HTTP_AUTHORIZATION'] = ''; // We will bypass auth check by mock

// To bypass auth, we can override Auth::authenticate in our script before including index.php!
// Wait, we cannot easily override a class method in PHP unless we use run-time monkey patching.
// But we can write a token that is valid!
// How does Auth::authenticate work?
// Let's view api/middleware/Auth.php to see how it decodes JWT or checks tokens!
unlink(__FILE__);
