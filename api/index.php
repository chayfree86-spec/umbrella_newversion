<?php
/**
 * Umbrella Finance — API Entry Point & Router
 * All requests are routed through this file via .htaccess
 */

// Set timezone to IST
date_default_timezone_set('Asia/Kolkata');

// Error reporting (disable display in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Load core files
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/constants.php';
require_once __DIR__ . '/helpers/Response.php';
require_once __DIR__ . '/helpers/Validator.php';
require_once __DIR__ . '/helpers/JWT.php';
require_once __DIR__ . '/helpers/NumberGenerator.php';
require_once __DIR__ . '/helpers/FileUpload.php';
require_once __DIR__ . '/middleware/CORS.php';
require_once __DIR__ . '/middleware/Auth.php';
require_once __DIR__ . '/middleware/RoleGuard.php';

// Load Models
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/Branch.php';
require_once __DIR__ . '/models/Area.php';
require_once __DIR__ . '/models/Agent.php';
require_once __DIR__ . '/models/LoanPlan.php';
require_once __DIR__ . '/models/SavingPlan.php';
require_once __DIR__ . '/models/Policy.php';
require_once __DIR__ . '/models/Setting.php';
require_once __DIR__ . '/models/AuditLog.php';
require_once __DIR__ . '/models/Customer.php';
require_once __DIR__ . '/models/LoanAccount.php';
require_once __DIR__ . '/models/SavingAccount.php';
require_once __DIR__ . '/models/LoanCollection.php';
require_once __DIR__ . '/models/SavingDeposit.php';
require_once __DIR__ . '/models/Fund.php';
require_once __DIR__ . '/models/Report.php';
require_once __DIR__ . '/models/SyncEvent.php';
require_once __DIR__ . '/models/Notification.php';

// Load Controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/BranchController.php';
require_once __DIR__ . '/controllers/AreaController.php';
require_once __DIR__ . '/controllers/AgentController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/PlanController.php';
require_once __DIR__ . '/controllers/SettingsController.php';
require_once __DIR__ . '/controllers/CustomerController.php';
require_once __DIR__ . '/controllers/LoanController.php';
require_once __DIR__ . '/controllers/SavingController.php';
require_once __DIR__ . '/controllers/CollectionController.php';
require_once __DIR__ . '/controllers/FundController.php';
require_once __DIR__ . '/controllers/ReportController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/SyncController.php';

// Apply CORS middleware
CORS::handle();

// Get request method and URI
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];

// Remove query string for routing
$uri = strtok($uri, '?');

// Strip everything up to and including /api so routes work whether the app
// is mounted at /api or under a subdirectory like /umbrella_newversion/api
if (($apiPos = strpos($uri, '/api')) !== false) {
    $uri = substr($uri, $apiPos + 4);
}

// Remove trailing slash
$uri = rtrim($uri, '/');

// If empty, set to root
if ($uri === '') $uri = '/';

// Parse JSON body for POST/PUT requests
$input = [];
if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
    $rawInput = file_get_contents('php://input');
    if ($rawInput) {
        $input = json_decode($rawInput, true) ?? [];
    }
    // Merge with $_POST for multipart/form-data
    $input = array_merge($_POST, $input);
}

// Database connection
$db = Database::connect();

// ============================================================
// ROUTE DEFINITIONS
// ============================================================

try {
    // ----------------------------------------------------------
    // AUTH ROUTES (No auth required)
    // ----------------------------------------------------------
    if ($uri === '/auth/login' && $method === 'POST') {
        AuthController::login($db, $input);
    }
    elseif ($uri === '/auth/reset-credentials' && $method === 'POST') {
        AuthController::resetCredentials($db, $input);
    }
    elseif ($uri === '/auth/branding' && $method === 'GET') {
        $settings = Setting::getAll($db);
        Response::success([
            'company_name' => $settings['company_name'] ?? 'Umbrella Finance',
            'company_tagline' => $settings['company_tagline'] ?? 'Chhote Kadam, Bade Sapne'
        ]);
    }
    // ----------------------------------------------------------
    // Protected routes — require auth token
    // ----------------------------------------------------------
    else {
        // Authenticate user
        $authUser = Auth::authenticate($db);
        
        // AUTH routes (authenticated)
        if ($uri === '/auth/logout' && $method === 'POST') {
            AuthController::logout($db, $authUser);
        }
        elseif ($uri === '/auth/profile' && $method === 'GET') {
            AuthController::profile($db, $authUser);
        }
        elseif ($uri === '/auth/change-password' && $method === 'POST') {
            AuthController::changePassword($db, $authUser, $input);
        }

        // ----------------------------------------------------------
        // BRANCH ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/branches' && $method === 'GET') {
            BranchController::index($db, $authUser);
        }
        elseif ($uri === '/branches' && $method === 'POST') {
            RoleGuard::check($authUser, 'branches.manage');
            BranchController::store($db, $authUser, $input);
        }
        elseif (preg_match('#^/branches/(\d+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'branches.manage');
            BranchController::update($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/branches/(\d+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'branches.manage');
            BranchController::destroy($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/branches/(\d+)/areas$#', $uri, $m) && $method === 'GET') {
            AreaController::byBranch($db, $authUser, $m[1]);
        }

        // ----------------------------------------------------------
        // AREA ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/areas' && $method === 'GET') {
            AreaController::index($db, $authUser);
        }
        elseif ($uri === '/areas' && $method === 'POST') {
            RoleGuard::check($authUser, 'areas.manage');
            AreaController::store($db, $authUser, $input);
        }
        elseif (preg_match('#^/areas/(\d+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'areas.manage');
            AreaController::update($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/areas/(\d+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'areas.manage');
            AreaController::destroy($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/areas/(\d+)/agents$#', $uri, $m) && $method === 'GET') {
            AgentController::byArea($db, $authUser, $m[1]);
        }

        // ----------------------------------------------------------
        // AGENT ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/agents' && $method === 'GET') {
            AgentController::index($db, $authUser);
        }
        elseif ($uri === '/agents' && $method === 'POST') {
            RoleGuard::check($authUser, 'agents.manage');
            AgentController::store($db, $authUser, $input);
        }
        elseif (preg_match('#^/agents/(\d+)$#', $uri, $m) && $method === 'GET') {
            AgentController::show($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/agents/(\d+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'agents.manage');
            AgentController::update($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/agents/(\d+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'agents.manage');
            AgentController::destroy($db, $authUser, $m[1]);
        }

        // ----------------------------------------------------------
        // USER ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/users' && $method === 'GET') {
            RoleGuard::check($authUser, 'users.view');
            UserController::index($db, $authUser);
        }
        elseif ($uri === '/users' && $method === 'POST') {
            RoleGuard::check($authUser, 'users.create');
            UserController::store($db, $authUser, $input);
        }
        elseif (preg_match('#^/users/(\d+)$#', $uri, $m) && $method === 'GET') {
            UserController::show($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/users/(\d+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'users.edit');
            UserController::update($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/users/(\d+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'users.delete');
            UserController::destroy($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/users/(\d+)/reset-password$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'users.edit');
            UserController::resetPassword($db, $authUser, $m[1], $input);
        }

        // ----------------------------------------------------------
        // PLAN ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/loan-plans' && $method === 'GET') {
            PlanController::loanPlans($db, $authUser);
        }
        elseif ($uri === '/loan-plans' && $method === 'POST') {
            RoleGuard::check($authUser, 'plans.manage');
            PlanController::storeLoanPlan($db, $authUser, $input);
        }
        elseif (preg_match('#^/loan-plans/(\d+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'plans.manage');
            PlanController::updateLoanPlan($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/loan-plans/(\d+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'plans.manage');
            PlanController::destroyLoanPlan($db, $authUser, $m[1]);
        }
        elseif ($uri === '/saving-plans' && $method === 'GET') {
            PlanController::savingPlans($db, $authUser);
        }
        elseif ($uri === '/saving-plans' && $method === 'POST') {
            RoleGuard::check($authUser, 'plans.manage');
            PlanController::storeSavingPlan($db, $authUser, $input);
        }
        elseif (preg_match('#^/saving-plans/(\d+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'plans.manage');
            PlanController::updateSavingPlan($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/saving-plans/(\d+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'plans.manage');
            PlanController::destroySavingPlan($db, $authUser, $m[1]);
        }

        // ----------------------------------------------------------
        // CUSTOMER ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/customers' && $method === 'GET') {
            CustomerController::index($db, $authUser);
        }
        elseif ($uri === '/customer-registration' && $method === 'POST') {
            RoleGuard::check($authUser, 'customers.create');
            CustomerController::register($db, $authUser, $input);
        }
        elseif ($uri === '/customers/check-mobile' && $method === 'GET') {
            CustomerController::checkMobile($db, $authUser);
        }
        elseif (preg_match('#^/customers/search$#', $uri) && $method === 'GET') {
            CustomerController::search($db, $authUser);
        }
        elseif (preg_match('#^/customers/(\d+)$#', $uri, $m) && $method === 'GET') {
            CustomerController::show($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/customers/(\d+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'customers.edit');
            CustomerController::update($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/customers/(\d+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'customers.delete');
            CustomerController::destroy($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/customers/(\d+)/documents$#', $uri, $m) && $method === 'POST') {
            CustomerController::uploadDocuments($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/customers/(\d+)/profile$#', $uri, $m) && $method === 'GET') {
            CustomerController::profile($db, $authUser, $m[1]);
        }

        // ----------------------------------------------------------
        // LOAN ACCOUNT ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/loan-accounts' && $method === 'GET') {
            LoanController::index($db, $authUser);
        }
        elseif ($uri === '/loan-accounts' && $method === 'POST') {
            RoleGuard::check($authUser, 'loans.create');
            LoanController::store($db, $authUser, $input);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)$#', $uri, $m) && $method === 'GET') {
            LoanController::show($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)/statement$#', $uri, $m) && $method === 'GET') {
            LoanController::statement($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)/installments$#', $uri, $m) && $method === 'GET') {
            LoanController::installments($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)/collect$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'collections.create');
            LoanController::collect($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)/approve$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'loans.approve');
            LoanController::approve($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)/reject$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'loans.approve');
            LoanController::reject($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)/reset$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'loans.approve');
            LoanController::reset($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'loans.approve');
            LoanController::destroy($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)/close$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'loans.close');
            LoanController::close($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/loan-accounts/([^/]+)/clear-ledger$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'loans.approve');
            LoanController::clearLedger($db, $authUser, $m[1]);
        }

        // ----------------------------------------------------------
        // SAVING ACCOUNT ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/saving-accounts' && $method === 'GET') {
            SavingController::index($db, $authUser);
        }
        elseif ($uri === '/saving-accounts' && $method === 'POST') {
            RoleGuard::check($authUser, 'savings.create');
            SavingController::store($db, $authUser, $input);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)$#', $uri, $m) && $method === 'GET') {
            SavingController::show($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)/statement$#', $uri, $m) && $method === 'GET') {
            SavingController::statement($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)/deposit$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'collections.create');
            SavingController::deposit($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)/mature$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'savings.maturity');
            SavingController::mature($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)/approve$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'savings.approve');
            SavingController::approve($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)/reject$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'savings.approve');
            SavingController::reject($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)/reset$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'savings.approve');
            SavingController::reset($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'savings.approve');
            SavingController::destroy($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)/close$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'savings.close');
            SavingController::close($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/saving-accounts/([^/]+)/clear-ledger$#', $uri, $m) && $method === 'POST') {
            RoleGuard::check($authUser, 'savings.approve');
            SavingController::clearLedger($db, $authUser, $m[1]);
        }

        // ----------------------------------------------------------
        // COLLECTION ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/collections/today' && $method === 'GET') {
            CollectionController::today($db, $authUser);
        }
        elseif ($uri === '/collections/due' && $method === 'GET') {
            CollectionController::due($db, $authUser);
        }
        elseif (preg_match('#^/collections/agent/(\d+)$#', $uri, $m) && $method === 'GET') {
            CollectionController::byAgent($db, $authUser, $m[1]);
        }
        elseif ($uri === '/collections/loan' && $method === 'POST') {
            RoleGuard::check($authUser, 'collections.create');
            CollectionController::collectLoan($db, $authUser, $input);
        }
        elseif ($uri === '/collections/saving' && $method === 'POST') {
            RoleGuard::check($authUser, 'collections.create');
            CollectionController::collectSaving($db, $authUser, $input);
        }
        elseif ($uri === '/collections/history' && $method === 'GET') {
            CollectionController::history($db, $authUser);
        }
        elseif (preg_match('#^/receipts/(.+)$#', $uri, $m) && $method === 'GET') {
            CollectionController::receipt($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/collections/receipts/([^/]+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'collections.delete');
            CollectionController::delete($db, $authUser, $m[1]);
        }
        elseif (preg_match('#^/collections/receipts/([^/]+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'collections.create');
            CollectionController::update($db, $authUser, $m[1], $input);
        }

        // ----------------------------------------------------------
        // FUND MANAGEMENT ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/funds/summary' && $method === 'GET') {
            RoleGuard::check($authUser, 'funds.view');
            FundController::summary($db, $authUser);
        }
        elseif ($uri === '/funds/capital' && $method === 'POST') {
            RoleGuard::check($authUser, 'funds.manage');
            FundController::addCapital($db, $authUser, $input);
        }
        elseif ($uri === '/funds/investor-funding' && $method === 'POST') {
            RoleGuard::check($authUser, 'funds.manage');
            FundController::addInvestorFunding($db, $authUser, $input);
        }
        elseif ($uri === '/funds/transfer' && $method === 'POST') {
            RoleGuard::check($authUser, 'funds.manage');
            FundController::executeTransfer($db, $authUser, $input);
        }
        elseif ($uri === '/funds/transactions' && $method === 'GET') {
            RoleGuard::check($authUser, 'funds.view');
            FundController::transactions($db, $authUser);
        }
        elseif (preg_match('/^\/funds\/transactions\/(\d+)$/', $uri, $matches) && ($method === 'PUT' || $method === 'DELETE')) {
            $txnId = intval($matches[1]);
            RoleGuard::check($authUser, 'funds.manage');
            if ($method === 'PUT') {
                FundController::updateTransaction($db, $authUser, $txnId, $input);
            } elseif ($method === 'DELETE') {
                FundController::deleteTransaction($db, $authUser, $txnId);
            }
        }
        elseif ($uri === '/funds/cash-balance' && $method === 'GET') {
            RoleGuard::check($authUser, 'funds.view');
            FundController::cashBalance($db, $authUser);
        }

        // ----------------------------------------------------------
        // REPORT ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/reports/dashboard' && $method === 'GET') {
            // ReportController::dashboard does not exist; the dashboard
            // summary lives in DashboardController
            DashboardController::summary($db, $authUser);
        }
        elseif ($uri === '/reports/daily-collection' && $method === 'GET') {
            // collections.view (not reports.view) so agents can load their own
            // daily ledger — the controller already scopes data to the agent
            RoleGuard::check($authUser, 'collections.view');
            ReportController::dailyCollection($db, $authUser);
        }
        elseif ($uri === '/reports/branch-wise' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::branchWise($db, $authUser);
        }
        elseif ($uri === '/reports/area-wise' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::areaWise($db, $authUser);
        }
        elseif ($uri === '/reports/agent-wise' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::agentWise($db, $authUser);
        }
        elseif ($uri === '/reports/loan' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::loan($db, $authUser);
        }
        elseif ($uri === '/reports/saving' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::saving($db, $authUser);
        }
        elseif ($uri === '/reports/due' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::due($db, $authUser);
        }
        elseif ($uri === '/reports/maturity' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::maturity($db, $authUser);
        }
        elseif ($uri === '/reports/customer-ledger' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::customerLedger($db, $authUser);
        }
        elseif ($uri === '/reports/cash-book' && $method === 'GET') {
            RoleGuard::check($authUser, 'reports.view');
            ReportController::cashBook($db, $authUser);
        }

        // ----------------------------------------------------------
        // DASHBOARD ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/dashboard/summary' && $method === 'GET') {
            DashboardController::summary($db, $authUser);
        }

        // ----------------------------------------------------------
        // SETTINGS ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/settings' && $method === 'GET') {
            SettingsController::index($db, $authUser);
        }
        elseif ($uri === '/settings' && $method === 'PUT') {
            RoleGuard::check($authUser, 'settings.edit');
            SettingsController::update($db, $authUser, $input);
        }
        elseif ($uri === '/policies' && $method === 'GET') {
            SettingsController::policies($db, $authUser);
        }
        elseif ($uri === '/policies' && $method === 'POST') {
            RoleGuard::check($authUser, 'policies.manage');
            SettingsController::storePolicy($db, $authUser, $input);
        }
        elseif (preg_match('#^/policies/(\d+)$#', $uri, $m) && $method === 'PUT') {
            RoleGuard::check($authUser, 'policies.manage');
            SettingsController::updatePolicy($db, $authUser, $m[1], $input);
        }
        elseif (preg_match('#^/policies/(\d+)$#', $uri, $m) && $method === 'DELETE') {
            RoleGuard::check($authUser, 'policies.manage');
            SettingsController::destroyPolicy($db, $authUser, $m[1]);
        }

        // ----------------------------------------------------------
        // SYNC ROUTES
        // ----------------------------------------------------------
        elseif ($uri === '/sync/events' && $method === 'GET') {
            SyncController::events($db, $authUser);
        }
        elseif ($uri === '/sync/notifications' && $method === 'GET') {
            SyncController::notifications($db, $authUser);
        }
        elseif (preg_match('#^/sync/notifications/(\d+)/read$#', $uri, $m) && $method === 'POST') {
            SyncController::markRead($db, $authUser, $m[1]);
        }
        elseif ($uri === '/sync/notifications/read-all' && $method === 'POST') {
            SyncController::markAllRead($db, $authUser);
        }

        // ----------------------------------------------------------
        // 404 — Route not found
        // ----------------------------------------------------------
        else {
            Response::error('Route not found', 404);
        }
    }
} catch (Exception $e) {
    $code = $e->getCode() ?: 500;
    if ($code < 100 || $code > 599) $code = 500;
    Response::error($e->getMessage(), $code);
}
