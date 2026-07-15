import axios from 'axios';

// Create Central Axios Instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach Auth Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth endpoints jinka 401 "galat credentials" hai, "session expired" nahi —
// inpar auto-logout/reload nahi chalana (warna login form ka error message
// dikhne se pehle hi page reload ho jata hai aur user ko lagta hai "kuch hua hi nahi")
const AUTH_ENDPOINTS = ['/auth/login', '/auth/reset-credentials'];

// Response Interceptor: Handle Global Errors (like 401 Unauthorized)
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const url = error.config?.url || '';
      const isAuthEndpoint = AUTH_ENDPOINTS.some(ep => url.includes(ep));
      if (error.response.status === 401 && !isAuthEndpoint) {
        // Token expired or invalid, auto logout
        localStorage.removeItem('auth_token');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        if (window.location.pathname !== '/login') {
          window.location.href = '/';
        }
      }
      return Promise.reject(error.response.data || { message: 'Server error occurred' });
    }
    return Promise.reject({ message: 'Network connection failed' });
  }
);

// ============================================================
// 1. AUTH API MODULE
// ============================================================
export const authApi = {
  login: (username, password, pin) => 
    api.post('/auth/login', { username, password, pin }),
  logout: () => 
    api.post('/auth/logout'),
  profile: () => 
    api.get('/auth/profile'),
  changePassword: (password, pin) => 
    api.post('/auth/change-password', { password, pin }),
  resetCredentials: (username, password, pin) =>
    api.post('/auth/reset-credentials', { username, password, pin }),
  branding: () =>
    api.get('/auth/branding')
};

// ============================================================
// 2. BRANCH API MODULE
// ============================================================
export const branchApi = {
  list: () => api.get('/branches'),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`),
  areas: (id) => api.get(`/branches/${id}/areas`)
};

// ============================================================
// 3. AREA API MODULE
// ============================================================
export const areaApi = {
  list: () => api.get('/areas'),
  create: (data) => api.post('/areas', data),
  update: (id, data) => api.put(`/areas/${id}`, data),
  delete: (id) => api.delete(`/areas/${id}`),
  agents: (id) => api.get(`/areas/${id}/agents`)
};

// ============================================================
// 4. AGENT API MODULE
// ============================================================
export const agentApi = {
  list: () => api.get('/agents'),
  create: (data) => api.post('/agents', data),
  get: (id) => api.get(`/agents/${id}`),
  update: (id, data) => api.put(`/agents/${id}`, data),
  delete: (id) => api.delete(`/agents/${id}`)
};

// ============================================================
// 5. USER API MODULE
// ============================================================
export const userApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  get: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, password, pin) => api.post(`/users/${id}/reset-password`, { password, pin })
};

// ============================================================
// 6. PLAN API MODULE
// ============================================================
export const planApi = {
  loanPlans: {
    list: () => api.get('/loan-plans'),
    create: (data) => api.post('/loan-plans', data),
    update: (id, data) => api.put(`/loan-plans/${id}`, data),
    delete: (id) => api.delete(`/loan-plans/${id}`)
  },
  savingPlans: {
    list: () => api.get('/saving-plans'),
    create: (data) => api.post('/saving-plans', data),
    update: (id, data) => api.put(`/saving-plans/${id}`, data),
    delete: (id) => api.delete(`/saving-plans/${id}`)
  }
};

// ============================================================
// 7. CUSTOMER API MODULE
// ============================================================
export const customerApi = {
  list: (params) => api.get('/customers', { params }),
  register: (data) => api.post('/customer-registration', data),
  get: (id) => api.get(`/customers/${id}`),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  search: (q) => api.get(`/customers/search`, { params: { q } }),
  checkMobile: (mobile) => api.get('/customers/check-mobile', { params: { mobile } }),
  setStatus: (id, status) => api.post(`/customers/${id}/status`, { status }),
  // No manual Content-Type here — the browser must set the multipart
  // boundary itself, otherwise PHP receives an empty $_FILES
  uploadDocs: (id, formData) => api.post(`/customers/${id}/documents`, formData, {
    headers: { 'Content-Type': undefined }
  }),
  profile: (id) => api.get(`/customers/${id}/profile`)
};

// ============================================================
// 8. LOAN API MODULE
// ============================================================
export const loanApi = {
  list: (params) => api.get('/loan-accounts', { params }),
  create: (data) => api.post('/loan-accounts', data),
  get: (id) => api.get(`/loan-accounts/${id}`),
  statement: (id) => api.get(`/loan-accounts/${id}/statement`),
  installments: (id) => api.get(`/loan-accounts/${id}/installments`),
  approve: (id, start_date, approved_date) => api.post(`/loan-accounts/${id}/approve`, { start_date, approved_date }),
  reject: (id) => api.post(`/loan-accounts/${id}/reject`),
  reset: (id) => api.post(`/loan-accounts/${id}/reset`),
  collect: (id, collected_amount, penalty_amount, payment_mode, remarks, collection_date) =>
    api.post(`/loan-accounts/${id}/collect`, { collected_amount, penalty_amount, payment_mode, remarks, collection_date }),
  close: (id, data) => api.post(`/loan-accounts/${id}/close`, data),
  delete: (id) => api.delete(`/loan-accounts/${id}`),
  clearLedger: (id) => api.post(`/loan-accounts/${id}/clear-ledger`)
};

// ============================================================
// 9. SAVING API MODULE
// ============================================================
export const savingApi = {
  list: (params) => api.get('/saving-accounts', { params }),
  create: (data) => api.post('/saving-accounts', data),
  get: (id) => api.get(`/saving-accounts/${id}`),
  statement: (id) => api.get(`/saving-accounts/${id}/statement`),
  deposit: (id, deposit_amount, payment_mode, remarks, deposit_date) =>
    api.post(`/saving-accounts/${id}/deposit`, { deposit_amount, payment_mode, remarks, deposit_date }),
  approve: (id, start_date, approved_date) => api.post(`/saving-accounts/${id}/approve`, { start_date, approved_date }),
  reject: (id) => api.post(`/saving-accounts/${id}/reject`),
  reset: (id) => api.post(`/saving-accounts/${id}/reset`),
  mature: (id, payment_mode) => api.post(`/saving-accounts/${id}/mature`, { payment_mode }),
  close: (id) => api.post(`/saving-accounts/${id}/close`),
  delete: (id) => api.delete(`/saving-accounts/${id}`),
  clearLedger: (id) => api.post(`/saving-accounts/${id}/clear-ledger`)
};

// ============================================================
// 10. COLLECTION API MODULE
// ============================================================
export const collectionApi = {
  today: (params) => api.get('/collections/today', { params }),
  due: (params) => api.get('/collections/due', { params }),
  byAgent: (agentId) => api.get(`/collections/agent/${agentId}`),
  collectLoan: (data) => api.post('/collections/loan', data),
  collectSaving: (data) => api.post('/collections/saving', data),
  history: (params) => api.get('/collections/history', { params }),
  receipt: (receiptNo) => api.get(`/receipts/${receiptNo}`),
  deleteCollection: (receiptNo) => api.delete(`/collections/receipts/${receiptNo}`),
  updateCollection: (receiptNo, data) => api.put(`/collections/receipts/${receiptNo}`, data)
};

// ============================================================
// 11. FUND API MODULE
// ============================================================
export const fundApi = {
  summary: () => api.get('/funds/summary'),
  addCapital: (amount, description) => api.post('/funds/capital', { amount, description }),
  addInvestor: (investor_name, amount, description) => 
    api.post('/funds/investor-funding', { investor_name, amount, description }),
  transactions: () => api.get('/funds/transactions'),
  cashBalance: () => api.get('/funds/cash-balance'),
  updateTransaction: (id, amount, description, entry_date) => api.put(`/funds/transactions/${id}`, { amount, description, entry_date }),
  deleteTransaction: (id) => api.delete(`/funds/transactions/${id}`),
  executeTransfer: (type, amount, description, entry_date) => api.post('/funds/transfer', { type, amount, description, entry_date })
};

// ============================================================
// 12. REPORT API MODULE
// ============================================================
export const reportApi = {
  dashboard: () => api.get('/reports/dashboard'),
  dailyCollection: (params) => api.get('/reports/daily-collection', { params }),
  branchWise: () => api.get('/reports/branch-wise'),
  areaWise: () => api.get('/reports/area-wise'),
  agentWise: () => api.get('/reports/agent-wise'),
  loan: (params) => api.get('/reports/loan', { params }),
  saving: (params) => api.get('/reports/saving', { params }),
  due: (params) => api.get('/reports/due', { params }),
  maturity: (params) => api.get('/reports/maturity', { params }),
  customerLedger: (customer_id) => api.get('/reports/customer-ledger', { params: { customer_id } }),
  cashBook: (params) => api.get('/reports/cash-book', { params })
};

// ============================================================
// 13. SETTINGS API MODULE
// ============================================================
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  policies: {
    list: () => api.get('/policies'),
    create: (data) => api.post('/policies', data),
    update: (id, data) => api.put(`/policies/${id}`, data),
    delete: (id) => api.delete(`/policies/${id}`)
  }
};

// ============================================================
// 14. DASHBOARD API MODULE
// ============================================================
export const dashboardApi = {
  summary: (params) => api.get('/dashboard/summary', { params })
};

// ============================================================
// 15. SYNC / NOTIFICATIONS API MODULE
// ============================================================
export const syncApi = {
  events: (sinceId) => api.get('/sync/events', { params: { since_id: sinceId } }),
  notifications: () => api.get('/sync/notifications'),
  markRead: (id) => api.post(`/sync/notifications/${id}/read`),
  markAllRead: () => api.post('/sync/notifications/read-all')
};

// ============================================================
// 16. EXPENSE API MODULE
// ============================================================
export const expenseApi = {
  list: (month) => api.get('/expenses', { params: { month } }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`)
};

export default api;
