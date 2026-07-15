<?php
/**
 * Application Constants
 */

// JWT
define('JWT_SECRET', Env::get('JWT_SECRET', 'uf_s3cr3t_k3y_2026_umbrella_finance_jwt_token'));
define('JWT_EXPIRY_HOURS', (int)Env::get('JWT_EXPIRY_HOURS', 24));

// Numbering Prefixes
define('PREFIX_CUSTOMER', 'CU');
define('PREFIX_LOAN', 'LN');
define('PREFIX_SAVING', 'SV');
define('PREFIX_RECEIPT', 'RC');
define('PREFIX_TRANSACTION', 'TX');
define('NUMBER_PREFIX', 'UF');

// File Upload
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB
define('ALLOWED_FILE_TYPES', ['jpg', 'jpeg', 'png', 'pdf']);
define('ALLOWED_MIME_TYPES', [
    'image/jpeg', 'image/png', 'image/jpg', 'application/pdf'
]);

// Pagination
define('DEFAULT_PAGE_SIZE', 20);
define('MAX_PAGE_SIZE', 100);

// Account Status
define('STATUS_PROCESSING', 'Processing');
define('STATUS_APPROVED', 'Approved');
define('STATUS_ACTIVE', 'Active');
define('STATUS_DEFAULTER', 'Defaulter');
define('STATUS_NPA', 'NPA');
define('STATUS_CLOSED', 'Closed');
define('STATUS_REJECTED', 'Rejected');
define('STATUS_MATURED', 'Matured');
