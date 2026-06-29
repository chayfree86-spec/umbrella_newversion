import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import CustomerRegistration from './pages/CustomerRegistration';
import DailyCollection from './pages/DailyCollection';
import Collection from './pages/Collection';
import CustomerProfile from './pages/CustomerProfile';
import AccountDetails from './pages/AccountDetails';
import Reports from './pages/Reports';
import FundManagement from './pages/FundManagement';
import General from './pages/settings/General';
import Users from './pages/settings/Users';
import Policies from './pages/settings/Policies';
import Branches from './pages/settings/Branches';
import Areas from './pages/settings/Areas';
import Agents from './pages/settings/Agents';
import Plans from './pages/settings/Plans';
import UserProfile from './pages/settings/UserProfile';
import AgentProfile from './pages/settings/AgentProfile';
import Login from './pages/Login';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('isLoggedIn') === 'true' && !!localStorage.getItem('auth_token')
  );

  const [alertState, setAlertState] = useState({
    isOpen: false,
    message: ''
  });

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    message: '',
    resolve: null
  });

  const [promptState, setPromptState] = useState({
    isOpen: false,
    message: '',
    defaultValue: '',
    resolve: null
  });

  useEffect(() => {
    // Intercept native browser alert
    window.alert = (msg) => {
      setAlertState({ isOpen: true, message: String(msg) });
    };

    // Intercept native browser confirm
    window.confirm = (msg) => {
      return new Promise((resolve) => {
        setConfirmState({
          isOpen: true,
          message: String(msg),
          resolve
        });
      });
    };

    // Intercept native browser prompt
    window.prompt = (msg, defaultValue = '') => {
      return new Promise((resolve) => {
        setPromptState({
          isOpen: true,
          message: String(msg),
          defaultValue: String(defaultValue),
          resolve
        });
      });
    };
  }, []);

  const closeAlert = () => {
    setAlertState({ isOpen: false, message: '' });
  };

  const parseMessage = (msg) => {
    if (!msg) return '';
    const regex = /(₹[0-9,]+|[A-Z]{2,3}-[0-9]{4}|Sumit Kumar)/g;
    const parts = msg.split(regex);
    return parts.map((part, i) => {
      if (part.startsWith('₹')) {
        return <strong key={i} className="text-[#16A34A] font-black text-sm">{part}</strong>;
      }
      if (/^[A-Z]{2,3}-[0-9]{4}$/.test(part)) {
        return <strong key={i} className="text-[#1E3A8A] font-black text-xs">{part}</strong>;
      }
      if (part === 'Sumit Kumar') {
        return <strong key={i} className="text-[#1E3A8A] font-black text-xs">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <Router>
      {isLoggedIn ? (
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/register" element={<CustomerRegistration />} />
            <Route path="/collection" element={<DailyCollection />} />
            <Route path="/daily-collection" element={<Collection />} />
            <Route path="/funds" element={<FundManagement />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/customer/:id" element={<CustomerProfile />} />
            <Route path="/account/:accNo" element={<AccountDetails />} />
            
            {/* Settings Sub-routes */}
            <Route path="/settings" element={<General />} />
            <Route path="/settings/users" element={<Users />} />
            <Route path="/settings/user/:id" element={<UserProfile />} />
            <Route path="/settings/policies" element={<Policies />} />
            <Route path="/settings/branches" element={<Branches />} />
            <Route path="/settings/areas" element={<Areas />} />
            <Route path="/settings/agents" element={<Agents />} />
            <Route path="/settings/agent/:id" element={<AgentProfile />} />
            <Route path="/settings/plans" element={<Plans />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      ) : (
        <Routes>
          <Route path="*" element={<Login onLogin={() => setIsLoggedIn(true)} />} />
        </Routes>
      )}

      {/* Global Custom Styled Alert */}
      {alertState.isOpen && (() => {
        const isSuccess = /success|recorded|closed|completed/i.test(alertState.message);
        return (
          <div 
            className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in"
            onClick={closeAlert}
          >
            <div 
              className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-sm w-full p-6 space-y-4 text-center animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Custom Icon */}
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                isSuccess ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#1E3A8A]/10 text-[#1E3A8A]'
              }`}>
                <span className="material-symbols-rounded text-2xl select-none">
                  {isSuccess ? 'check_circle' : 'notifications_active'}
                </span>
              </div>

              {/* Alert Message */}
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-[#0F172A] tracking-tight">
                  {isSuccess ? 'Success Message' : 'System Message'}
                </h4>
                <p className="text-xs text-[#64748B] font-semibold leading-relaxed whitespace-pre-line">
                  {parseMessage(alertState.message)}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={closeAlert}
                className={`w-full py-2.5 text-white text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer select-none ${
                  isSuccess ? 'bg-[#16A34A] hover:bg-[#16A34A]/90' : 'bg-[#1E3A8A] hover:bg-[#1E3A8A]/90'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        );
      })()}

      {/* Global Custom Styled Confirm */}
      {confirmState.isOpen && (() => {
        const isDelete = /delete|reject|remove/i.test(confirmState.message);
        const handleConfirm = (value) => {
          if (confirmState.resolve) {
            confirmState.resolve(value);
          }
          setConfirmState({ isOpen: false, message: '', resolve: null });
        };
        return (
          <div 
            className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in"
            onClick={() => handleConfirm(false)}
          >
            <div 
              className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-sm w-full p-6 space-y-4 text-center animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Custom Icon */}
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                isDelete ? 'bg-danger-fin/10 text-danger-fin' : 'bg-primary/10 text-primary'
              }`}>
                <span className="material-symbols-rounded text-2xl select-none">
                  {isDelete ? 'delete_forever' : 'help'}
                </span>
              </div>

              {/* Message */}
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-[#0F172A] tracking-tight">
                  {isDelete ? 'Confirm Action' : 'Are you sure?'}
                </h4>
                <p className="text-xs text-[#64748B] font-semibold leading-relaxed whitespace-pre-line">
                  {confirmState.message}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirm(true)}
                  className={`flex-1 py-2.5 text-white text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer select-none ${
                    isDelete ? 'bg-danger-fin hover:bg-danger-fin/90' : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Global Custom Styled Prompt */}
      <PromptModal
        isOpen={promptState.isOpen}
        message={promptState.message}
        defaultValue={promptState.defaultValue}
        onSubmit={(value) => {
          if (promptState.resolve) {
            promptState.resolve(value);
          }
          setPromptState({ isOpen: false, message: '', defaultValue: '', resolve: null });
        }}
      />
    </Router>
  );
}

function PromptModal({ isOpen, message, defaultValue, onSubmit }) {
  const [inputValue, setInputValue] = useState(defaultValue);
  
  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue || '');
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in"
      onClick={() => onSubmit(null)}
    >
      <div 
        className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Message */}
        <div className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-primary/10 text-primary">
            <span className="material-symbols-rounded text-2xl select-none">
              edit
            </span>
          </div>
          <h4 className="text-sm font-extrabold text-[#0F172A] tracking-tight">
            Input Required
          </h4>
          <p className="text-xs text-[#64748B] font-semibold leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* Input Field */}
        <div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold text-slate-800"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSubmit(inputValue);
              }
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSubmit(null)}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all cursor-pointer select-none"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(inputValue)}
            className="flex-1 py-2.5 text-white text-xs font-black bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm cursor-pointer select-none"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
