import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { syncApi, authApi, settingsApi } from '../services/api';

export function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('company_name') || 'Umbrella Finance');
  const [companyTagline, setCompanyTagline] = useState(() => localStorage.getItem('company_tagline') || 'Chhote Kadam, Bade Sapne');

  const renderCompanyName = (className = "") => {
    const parts = companyName.split(' ');
    if (parts.length > 1) {
      return (
        <span className={className}>
          <span className="text-[#0A3598]" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900 }}>{parts[0]}</span>{' '}
          <span className="text-[#FFC107]" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900 }}>{parts.slice(1).join(' ')}</span>
        </span>
      );
    }
    return <span className="text-[#0A3598]" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900 }}>{companyName}</span>;
  };

  const isProfilePage = location.pathname.startsWith('/account/') || location.pathname.startsWith('/customer/');

  const [customTitle, setCustomTitle] = useState('');

  useEffect(() => {
    setCustomTitle(window.activePageTitle || '');
    const handleTitleChange = () => {
      setCustomTitle(window.activePageTitle || '');
    };
    window.addEventListener('titlechange', handleTitleChange);
    return () => {
      window.removeEventListener('titlechange', handleTitleChange);
    };
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const loggedInName = localStorage.getItem('username') || '';
  const loggedInRole = localStorage.getItem('userRole') || '';

  // Fetch notifications from backend
  const fetchNotifications = () => {
    syncApi.notifications()
      .then(res => setNotifications(res.data || []))
      .catch(() => setNotifications([]));
  };

  // Hydrate global settings into localStorage so every page sees backend values
  useEffect(() => {
    settingsApi.get()
      .then(res => {
        const s = res.data || {};
        Object.entries(s).forEach(([key, val]) => {
          localStorage.setItem(key, typeof val === 'boolean' ? String(val) : String(val ?? ''));
        });
        if (s.company_name) setCompanyName(s.company_name);
        if (s.company_tagline) setCompanyTagline(s.company_tagline);
      })
      .catch(() => {});
  }, [location.pathname]);

  // Listen to custom event for settings update
  useEffect(() => {
    const handleSettingsUpdate = () => {
      setCompanyName(localStorage.getItem('company_name') || 'Umbrella Finance');
      setCompanyTagline(localStorage.getItem('company_tagline') || 'Chhote Kadam, Bade Sapne');
    };
    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    fetchNotifications();

    let intervalId = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(fetchNotifications, 15000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchNotifications();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read && n.is_read !== 1).length;

  const markAllRead = () => {
    syncApi.markAllRead().then(fetchNotifications).catch(() => {});
  };

  const markOneRead = (id) => {
    syncApi.markRead(id).then(fetchNotifications).catch(() => {});
  };

  const handleLogout = () => {
    authApi.logout().catch(() => {}).finally(() => {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('username');
      localStorage.removeItem('userRole');
      window.location.href = '/';
    });
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  const initials = getInitials(loggedInName);

  const [userId, setUserId] = useState(() => localStorage.getItem('user_id') || '');

  useEffect(() => {
    if (!userId) {
      authApi.profile()
        .then(res => {
          const uid = res.data?.user_id || res.data?.id;
          if (uid) {
            localStorage.setItem('user_id', String(uid));
            setUserId(String(uid));
          }
        })
        .catch(() => {});
    }
  }, [userId]);

  const searchInputRef = useRef(null);

  // Keep search input in sync with URL search param
  const queryParam = new URLSearchParams(location.search).get('search') || '';
  useEffect(() => {
    setSearchValue(queryParam);
  }, [queryParam]);

  const handleSearchChange = (val) => {
    setSearchValue(val);
    const query = val.trim();
    if (location.pathname === '/collection' || location.pathname === '/daily-collection' || location.pathname === '/funds') {
      if (query) {
        navigate(`${location.pathname}?search=${encodeURIComponent(query)}`, { replace: true });
      } else {
        navigate(`${location.pathname}`, { replace: true });
      }
    }
  };

  const handleSearchSubmit = () => {
    const query = searchValue.trim();
    if (location.pathname !== '/collection' && location.pathname !== '/daily-collection' && location.pathname !== '/funds') {
      if (query) {
        navigate(`/collection?search=${encodeURIComponent(query)}`);
      }
    }
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN'; // Transcribes both Hindi and English mixed Speech beautifully!
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const val = transcript.trim();
        setSearchValue(val);
        handleSearchChange(val);
        setIsListening(false);
      };

      recognition.onerror = (e) => {
        console.error('Speech recognition error', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    } else {
      alert("Voice Search is not supported in this browser. Please use Chrome or Safari.");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigationItems = [
    { name: 'Dashboard', path: '/', icon: 'dashboard' },
    { name: 'Registration', path: '/register', icon: 'person_add' },
    { name: 'Accounts', path: '/collection', icon: 'assignment_ind' },
    { name: 'Daily Collection', path: '/daily-collection', icon: 'payments' },
    { name: 'Reports', path: '/reports', icon: 'description' },
    // Expense + Funds Management sirf Super Admin ko dikhte hain
    // (backend routes bhi guarded hain)
    ...(loggedInRole === 'Super Admin' ? [{ name: 'Expense', path: '/expense', icon: 'receipt_long' }] : []),
    ...(loggedInRole === 'Super Admin' ? [{ name: 'Funds Management', path: '/funds', icon: 'account_balance_wallet' }] : [])
  ];

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Dashboard';
    if (location.pathname === '/register') return 'Customer Registration (Stepper)';
    if (location.pathname === '/collection') return 'Accounts Directory';
    if (location.pathname === '/daily-collection') return 'Daily Collection Dashboard';
    if (location.pathname === '/expense') return 'Expense Management';
    if (location.pathname === '/funds') return 'Capital & Fund Management';
    if (location.pathname === '/reports') return 'Financial Reports & Ledger';
    if (location.pathname.startsWith('/customer')) return 'Customer Profile';
    if (location.pathname.startsWith('/settings')) {
      if (location.pathname === '/settings/branches') return 'Branch Management';
      if (location.pathname === '/settings/areas') return 'Area Management';
      if (location.pathname === '/settings/agents') return 'Agent Management';
      if (location.pathname === '/settings/plans') return 'Plan Master';
      return 'System Settings';
    }
    return companyName;
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-fin">
      {/* Desktop Left Sidebar */}
      <aside className={`relative hidden lg:flex lg:flex-col lg:flex-shrink-0 bg-surface border-r border-border-fin z-20 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}`}>
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex absolute top-6 -right-3 w-6 h-6 rounded-full border border-border-fin bg-surface hover:bg-background-fin text-secondary-text hover:text-primary-text items-center justify-center shadow-sm cursor-pointer active:scale-95 transition-all z-30"
          title={isSidebarCollapsed ? "Expand Menu" : "Collapse Menu"}
        >
          <span className="material-symbols-rounded select-none text-[16px]">
            {isSidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>

        {/* Brand Header */}
        <div className={`py-4 ${isSidebarCollapsed ? 'px-4 justify-center' : 'px-5'} border-b border-border-fin flex items-center gap-3 overflow-hidden select-none h-16`}>
          <img src="/logo.png" className="h-11 w-11 object-contain flex-shrink-0 rounded-full" alt="Logo" />
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0 animate-fade-in">
              <span className="text-lg uppercase tracking-tight mb-0.5" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900, lineHeight: 1.1 }}>
                {renderCompanyName()}
              </span>
              <span className="text-[9px] font-bold text-secondary-text tracking-wide whitespace-nowrap">
                {companyTagline}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar Nav */}
        <nav className={`flex-1 ${isSidebarCollapsed ? 'px-3 overflow-visible' : 'px-4 overflow-y-auto'} py-6 space-y-1.5`}>
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`relative group flex items-center ${isSidebarCollapsed ? 'justify-center px-0 h-11 w-11 mx-auto' : 'gap-3.5 px-4 py-3'} rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                isActive(item.path)
                  ? 'bg-primary text-surface shadow-md shadow-primary/10'
                  : 'text-secondary-text hover:text-primary-text hover:bg-background-fin'
              }`}
            >
              <span className="material-symbols-rounded select-none">{item.icon}</span>
              {!isSidebarCollapsed && <span className="animate-fade-in">{item.name}</span>}
              
              {/* Custom Animated Tooltip */}
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-md z-50 transform translate-x-[-10px] group-hover:translate-x-0 flex items-center gap-1 pointer-events-none">
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-primary"></div>
                  {item.name}
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* User Info / Footer */}
        <div className="p-4 border-t border-border-fin bg-background-fin">
          <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-3.5' : 'items-center justify-between gap-3'} px-2 py-1.5`}>
            <Link
              to={userId ? `/settings/user/${userId}` : '#'}
              className={`relative group flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3 min-w-0 flex-1'} hover:bg-border-fin/50 p-1.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] ${userId ? '' : 'pointer-events-none'}`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
                {initials}
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1 animate-fade-in">
                  <span className="text-sm font-bold text-primary-text block truncate leading-none mb-1" title={loggedInName}>
                    {loggedInName}
                  </span>
                  <span className="text-xs font-medium text-secondary-text block truncate" title={loggedInRole}>
                    {loggedInRole}
                  </span>
                </div>
              )}

              {/* Custom Animated Tooltip */}
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-md z-50 transform translate-x-[-10px] group-hover:translate-x-0 flex items-center gap-1 pointer-events-none">
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-primary"></div>
                  {loggedInName} ({loggedInRole})
                </div>
              )}
            </Link>

            <div className="relative group">
              <button
                onClick={handleLogout}
                className={`p-2 rounded-xl text-danger-fin hover:bg-danger-fin/10 transition-all cursor-pointer active:scale-[0.95] flex items-center justify-center`}
              >
                <span className="material-symbols-rounded select-none block text-lg">logout</span>
              </button>
              
              {/* Custom Animated Tooltip */}
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-danger-fin text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-md z-50 transform translate-x-[-10px] group-hover:translate-x-0 flex items-center gap-1 pointer-events-none">
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-danger-fin"></div>
                  Logout
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sticky Header */}
        <header className="sticky top-0 bg-surface border-b border-border-fin h-16 flex items-center justify-between px-4 sm:px-6 z-10 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile Logo next to menu button */}
            <div className="lg:hidden flex items-center gap-2 overflow-hidden h-10 select-none">
              <img src="/logo.png" className="h-7 w-7 object-contain flex-shrink-0 rounded-full" alt="Logo" />
              <span className="text-sm uppercase tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900 }}>
                {renderCompanyName()}
              </span>
            </div>

            {/* Breadcrumb / Title */}
            <div className="hidden lg:block">
              <span className="hidden sm:block text-[11px] font-bold text-secondary-text uppercase tracking-wider mb-0.5">
                {companyName} / {getPageTitle()}
              </span>
              <h1 className="text-lg font-bold text-primary-text leading-none sm:text-xl">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          {/* Action Header controls */}
          <div className="flex items-center gap-3">
            {/* Global Search - Only on Account and Collection pages, Hidden on Mobile */}
            {(location.pathname.startsWith('/account/') || location.pathname === '/collection' || location.pathname === '/daily-collection') && (
              <div className="hidden lg:flex items-center relative sm:w-72 group bg-[#F1F5F9] p-[3px] rounded-full border border-[#E2E8F0] focus-within:border-primary/30 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-inner-sm">
                <span className="material-symbols-rounded pl-2.5 text-base text-secondary-text/80 select-none group-focus-within:text-primary transition-colors duration-300">
                  search
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search Account..."
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                  className="w-full bg-transparent pl-2 pr-16 py-1.5 text-xs font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none"
                />
                {/* Voice Search Button */}
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`absolute right-9 p-1 rounded-full hover:bg-slate-200 transition-colors flex items-center justify-center cursor-pointer ${
                    isListening ? 'text-red-500 animate-pulse bg-red-50' : 'text-secondary-text'
                  }`}
                  title="Voice Search (Hindi/English)"
                >
                  <span className="material-symbols-rounded text-base select-none">
                    mic
                  </span>
                </button>
                <div className="absolute right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-border-fin rounded-md text-[9px] font-bold text-secondary-text shadow-sm pointer-events-none select-none group-focus-within:opacity-0 transition-opacity duration-200">
                  <span className="text-[8px] font-sans">⌘</span>K
                </div>
              </div>
            )}

            {/* Create Account Link/Button */}
            <Link
              to="/register"
              className="hidden lg:flex items-center justify-center w-10 h-10 rounded-xl bg-[#0A3598] hover:bg-[#0A3598]/90 text-white transition-all active:scale-[0.95] shadow-sm cursor-pointer"
              title="Create Account"
            >
              <span className="material-symbols-rounded text-lg select-none">person_add</span>
            </Link>

            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="p-2 rounded-xl bg-background-fin hover:bg-border-fin/50 text-secondary-text relative cursor-pointer active:scale-[0.95]"
              >
                <span className="material-symbols-rounded select-none">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border border-surface"></span>
                )}
              </button>

              {/* Notification Dropdown — backend driven */}
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-surface border border-border-fin rounded-2xl shadow-xl z-50 p-4">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-fin">
                    <span className="text-xs font-bold text-primary-text uppercase">Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[11px] text-primary font-bold hover:underline cursor-pointer">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-xs text-secondary-text font-semibold">No notifications</div>
                    ) : notifications.map((n) => {
                      const typeColor = n.type === 'warning' ? 'text-warning-fin' : n.type === 'danger' ? 'text-danger-fin' : n.type === 'success' ? 'text-success-fin' : 'text-primary';
                      return (
                        <button
                          key={n.id}
                          onClick={() => markOneRead(n.id)}
                          className={`block w-full text-left p-2.5 rounded-xl hover:bg-background-fin transition-colors cursor-pointer ${(!n.is_read && n.is_read !== 1) ? 'bg-background-fin/40' : ''}`}
                        >
                          <div className="flex justify-between text-xs mb-1">
                            <span className={`font-bold ${typeColor}`}>{n.title}</span>
                            <span className="text-secondary-text font-bold">{timeAgo(n.created_at)}</span>
                          </div>
                          <p className="text-xs text-secondary-text font-semibold">{n.message}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Settings Icon trigger in place of Profile Avatar */}
            <Link
              to="/settings"
              className={`p-2 rounded-xl text-secondary-text hover:text-primary hover:bg-border-fin/50 transition-all duration-200 cursor-pointer active:scale-[0.95] ${
                location.pathname.startsWith('/settings') ? 'bg-primary/10 text-primary' : 'bg-background-fin'
              }`}
              title="Settings"
            >
              <span className="material-symbols-rounded select-none block">settings</span>
            </Link>
          </div>
        </header>

        {/* Mobile Sub-Header: Title & Create Account Button */}
        {!isProfilePage && (
          <div className="lg:hidden bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
            <h1 className="text-[#0F172A] text-base font-extrabold tracking-tight">
              {getPageTitle()}
            </h1>
            {location.pathname === '/collection' && (
              <Link
                to="/register"
                className="w-10 h-10 rounded-xl bg-[#0A3598] hover:bg-[#0A3598]/90 text-white flex items-center justify-center transition-all active:scale-[0.95] shadow-sm cursor-pointer"
              >
                <span className="material-symbols-rounded text-lg select-none">person_add</span>
              </Link>
            )}
            {location.pathname === '/register' && (
              <Link
                to="/collection"
                className="w-10 h-10 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-secondary-text hover:text-primary-text border border-[#E2E8F0] flex items-center justify-center transition-all active:scale-[0.95] shadow-sm cursor-pointer"
              >
                <span className="material-symbols-rounded text-lg select-none">close</span>
              </Link>
            )}
          </div>
        )}

        {/* Page Content viewport */}
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 lg:pb-8 ${location.pathname !== '/' ? 'pb-36' : 'pb-24'}`}>
          {children}
        </main>

        {/* Mobile Floating Bottom Search Bar (Only on Account and Collection pages, Sticky at bottom above footer) */}
        {(location.pathname.startsWith('/account/') || location.pathname === '/collection' || location.pathname === '/daily-collection') && (
          <div className="lg:hidden fixed bottom-[80px] left-4 right-4 z-20">
            <div className="flex items-center bg-white/95 backdrop-blur-md border border-[#E2E8F0] p-1.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] gap-2">
              <span className="material-symbols-rounded pl-3 text-lg text-[#64748B]/80 select-none">
                search
              </span>
              <input
                type="text"
                placeholder="Search Account..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 bg-transparent py-1 text-xs font-bold text-primary-text placeholder-secondary-text/60 focus:outline-none"
              />
              {/* Mic button */}
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={`p-2 rounded-full transition-colors flex items-center justify-center cursor-pointer ${
                  isListening ? 'text-red-500 bg-red-50 animate-pulse scale-105' : 'text-[#64748B] bg-slate-100 hover:bg-slate-200'
                }`}
                title="Voice Search"
              >
                <span className="material-symbols-rounded text-lg select-none">
                  mic
                </span>
              </button>
              {searchValue && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="p-1.5 rounded-full text-[#64748B] hover:text-[#0F172A] mr-1"
                >
                  <span className="material-symbols-rounded text-base select-none">close</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Drawer (Hamburger Side Navigation) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop mask */}
          <div
            className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          {/* Drawer contents */}
          <div className="relative w-72 max-w-xs bg-surface h-full flex flex-col p-6 shadow-2xl z-50 animate-slide-in">
            <div className="flex justify-between items-center pb-4 border-b border-border-fin mb-6">
              <div className="flex items-center gap-2 select-none">
                <img src="/logo.png" className="h-9 w-9 object-contain flex-shrink-0 rounded-full" alt="Logo" />
                <div className="flex flex-col min-w-0">
                  <span className="text-base uppercase tracking-tight mb-0.5" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900, lineHeight: 1.1 }}>
                    {renderCompanyName()}
                  </span>
                  <span className="text-[8px] font-bold text-secondary-text tracking-wide whitespace-nowrap">
                    {companyTagline}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-background-fin text-secondary-text cursor-pointer active:scale-[0.95]"
              >
                <span className="material-symbols-rounded select-none">close</span>
              </button>
            </div>

            {/* Scrollable drawer links */}
            <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
              <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider block px-3 mb-2">Operations</span>
              <Link
                to="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/register') ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">person_add</span>
                <span>Customer Registration</span>
              </Link>
              <Link
                to="/funds"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/funds') ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">account_balance_wallet</span>
                <span>Funds Management</span>
              </Link>

              <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider block px-3 mt-4 mb-2">Administration</span>
              <Link
                to="/settings/branches"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/settings/branches') ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">store</span>
                <span>Branches</span>
              </Link>
              <Link
                to="/settings/areas"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/settings/areas') ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">map</span>
                <span>Areas</span>
              </Link>
              <Link
                to="/settings/agents"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/settings/agents') ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">badge</span>
                <span>Agents</span>
              </Link>
              <Link
                to="/settings/plans"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/settings/plans') ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">analytics</span>
                <span>Plans</span>
              </Link>
              <Link
                to="/settings/users"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/settings/users') ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">group</span>
                <span>Users</span>
              </Link>

              <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider block px-3 mt-4 mb-2">System</span>
              <Link
                to="/settings/policies"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/settings/policies') ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">gavel</span>
                <span>Policies & Security</span>
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsNotificationOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
              >
                <span className="material-symbols-rounded text-lg select-none">notifications</span>
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-[#0A3598] text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              <Link
                to="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  isActive('/settings') && location.pathname === '/settings' ? 'bg-[#0A3598]/10 text-[#0A3598] font-bold' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-rounded text-lg select-none">settings</span>
                <span>Settings</span>
              </Link>
            </nav>

            {/* Logout/User Section */}
            <div className="pt-4 border-t border-border-fin flex items-center justify-between">
              <Link
                to={userId ? `/settings/user/${userId}` : '#'}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block min-w-0 flex-1 hover:bg-background-fin p-1.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] ${userId ? '' : 'pointer-events-none'}`}
              >
                <span className="text-[9px] text-secondary-text font-bold uppercase block mb-0.5">Logged In</span>
                <span className="text-xs font-bold text-primary-text block truncate max-w-[150px]">{loggedInName}</span>
                <span className="text-[9px] text-secondary-text font-semibold block leading-none">{loggedInRole}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl text-danger-fin hover:bg-danger-fin/10 transition-all cursor-pointer active:scale-[0.95] flex items-center justify-center flex-shrink-0"
                title="Logout"
              >
                <span className="material-symbols-rounded select-none block text-lg">logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Redesigned with Solid Backing & Premium Active Indicators) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] shadow-[0_-4px_16px_rgba(0,0,0,0.05)] z-30 pb-safe-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {/* Tab 1: Dashboard */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center w-16 py-1 select-none transition-all cursor-pointer ${
              isActive('/') && location.pathname === '/'
                ? 'text-[#0A3598]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <span className={`material-symbols-rounded text-[22px] leading-none mb-0.5 ${isActive('/') && location.pathname === '/' ? 'fill-1 font-bold' : ''}`}>
              dashboard
            </span>
            <span className="text-[9px] font-bold tracking-tight">Dashboard</span>
            {isActive('/') && location.pathname === '/' ? (
              <span className="w-1 h-1 rounded-full bg-[#0A3598] mt-0.5"></span>
            ) : (
              <span className="w-1 h-1 mt-0.5 opacity-0"></span>
            )}
          </Link>

          {/* Tab 2: Customers */}
          <Link
            to="/collection"
            className={`flex flex-col items-center justify-center w-16 py-1 select-none transition-all cursor-pointer ${
              isActive('/collection')
                ? 'text-[#0A3598]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <span className={`material-symbols-rounded text-[22px] leading-none mb-0.5 ${isActive('/collection') ? 'fill-1 font-bold' : ''}`}>
              assignment_ind
            </span>
            <span className="text-[9px] font-bold tracking-tight">Accounts</span>
            {isActive('/collection') ? (
              <span className="w-1 h-1 rounded-full bg-[#0A3598] mt-0.5"></span>
            ) : (
              <span className="w-1 h-1 mt-0.5 opacity-0"></span>
            )}
          </Link>

          {/* Tab 3: Collection (Floating Center Button with Blue Gradient & White border) */}
          <div className="relative -top-5 flex flex-col items-center justify-center">
            <Link
              to="/daily-collection"
              className="w-14 h-14 rounded-full flex items-center justify-center text-white cursor-pointer transition-transform active:scale-90 border-[3.5px] border-white shadow-[0_6px_20px_rgba(10,53,152,0.3)] hover:shadow-[0_8px_24px_rgba(10,53,152,0.4)]"
              style={{
                background: 'linear-gradient(120deg, #0A3598 0%, #3B82F6 40%, #1E3A8A 70%, #0A3598 100%)',
                backgroundSize: '200% auto',
              }}
            >
              <span className="material-symbols-rounded text-2xl select-none leading-none text-white">payments</span>
            </Link>
            <span className={`text-[8.5px] font-black uppercase tracking-wider mt-0.5 ${isActive('/daily-collection') ? 'text-[#0A3598]' : 'text-[#64748B]'}`}>
              Collect
            </span>
          </div>

          {/* Tab 4: Reports */}
          <Link
            to="/reports"
            className={`flex flex-col items-center justify-center w-16 py-1 select-none transition-all cursor-pointer ${
              isActive('/reports')
                ? 'text-[#0A3598]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <span className={`material-symbols-rounded text-[22px] leading-none mb-0.5 ${isActive('/reports') ? 'fill-1 font-bold' : ''}`}>
              description
            </span>
            <span className="text-[9px] font-bold tracking-tight">Reports</span>
            {isActive('/reports') ? (
              <span className="w-1 h-1 rounded-full bg-[#0A3598] mt-0.5"></span>
            ) : (
              <span className="w-1 h-1 mt-0.5 opacity-0"></span>
            )}
          </Link>

          {/* Tab 5: Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center w-16 py-1 select-none transition-all cursor-pointer text-[#64748B] hover:text-[#0F172A]"
          >
            <span className="material-symbols-rounded text-[22px] leading-none mb-0.5">
              menu
            </span>
            <span className="text-[9px] font-bold tracking-tight">Menu</span>
            <span className="w-1 h-1 mt-0.5 opacity-0"></span>
          </button>
        </div>
      </div>
    </div>
  );
}
