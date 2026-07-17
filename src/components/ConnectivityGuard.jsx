import { useEffect, useRef, useState } from 'react';

// Session keys written at login (see Login.jsx). Cleared on a forced logout.
// Branding (company_name/tagline) and remembered_* creds are intentionally
// kept so the re-login screen still looks right and stays convenient.
const SESSION_KEYS = [
  'auth_token', 'isLoggedIn', 'userRole', 'username', 'user_id',
  'active_user_role', 'active_user_name', 'user_branch_id', 'user_area_id',
  'user_agent_id', 'user_permissions', 'user_can_approve_accounts',
];

function clearSession() {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
}

/**
 * Financial app connectivity policy:
 *  - Offline  → block the whole app with a full-screen overlay so the
 *    service-worker-cached shell can never be used with stale/no data.
 *  - Reconnect after an offline drop → force a fresh login (logout), instead
 *    of silently resuming the old session.
 *
 * Rendered once at the app root. Uses window.location so it works regardless
 * of router state.
 */
export function ConnectivityGuard() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const wasOffline = useRef(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => {
      wasOffline.current = true;
      setOffline(true);
    };
    const handleOnline = () => {
      setOffline(false);
      if (wasOffline.current) {
        // Connection was lost then restored — end the session and send the
        // user back to login rather than quietly reloading into the app.
        clearSession();
        window.location.href = '/';
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center">
      {/* logo.png is service-worker precached, so it renders even offline */}
      <img src="/logo.png" alt="" className="w-16 h-16 mb-6 rounded-2xl opacity-95" />
      {/* Inline SVG (no icon-font dependency, which may be unavailable offline) */}
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
        stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="mb-4 opacity-90">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <h2 className="text-white text-lg font-black mb-2">No Internet Connection</h2>
      <p className="text-white/70 text-sm font-semibold max-w-xs leading-relaxed">
        Your connection was lost. For your security you'll be signed out and
        need to log in again once you're back online.
      </p>
    </div>
  );
}
