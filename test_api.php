<?php
$_GET = ['limit' => 100];
require 'api/config/constants.php';
require 'api/config/database.php';
require 'api/helpers/Response.php';
require 'api/helpers/Validator.php';
require 'api/models/SavingAccount.php';

// Mock Response class to prevent exit
class Response {
    public static function paginated($data, $total, $page, $perPage) {
        echo "TOTAL: " . $total . "\n";
        print_r($data);
    }
}

$db = Database::connect();
$authUser = [
    'id' => 1,
    'name' => 'Sandeep Kumar',
    'role_slug' => 'super_admin'
];

[$page, $perPage, $offset] = Validator::getPaginationParams();
$params = $_GET;
$params['limit'] = $perPage;
$params['offset'] = $offset;

[$data, $total] = SavingAccount::getAll($db, $params);
Response::paginated($data, $total, $page, $perPage);

unlink(__FILE__);
