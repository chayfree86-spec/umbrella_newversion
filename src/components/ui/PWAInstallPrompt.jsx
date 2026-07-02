import React, { useState, useEffect } from 'react';

export function PWAInstallPrompt() {
  const companyName = localStorage.getItem('company_name') || 'Umbrella Finance';
  const companyTagline = localStorage.getItem('company_tagline') || 'Chhote Kadam, Bade Sapne';
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed app wrapper)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt immediately on load as requested
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If it's iOS Safari, show the iOS manual install prompt after 1.5 seconds
    if (iosDevice && !isStandalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Fallback: If beforeinstallprompt is supported but didn't fire yet, wait for it.
    // Or if the app is already installable, we can also check if we want to show it.
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If prompt is not available, try to suggest standalone mode or do nothing
      return;
    }
    // Hide custom prompt UI
    setShowPrompt(false);
    // Show the browser's install dialog
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    // Clear deferred prompt
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Keep a record in sessionStorage so it doesn't pop up again during the current session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // If already dismissed in this session, don't show it
  if (sessionStorage.getItem('pwa-prompt-dismissed') === 'true') {
    return null;
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fade-in">
      <style>{`
        .pwa-shine-button {
          background: linear-gradient(120deg, #0A3598 0%, #3B82F6 40%, #1E3A8A 70%, #0A3598 100%);
          background-size: 200% auto;
          animation: btnShine 2.5s linear infinite;
        }
        @keyframes btnShine {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
      
      <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-sm w-full p-6 space-y-5 text-center relative overflow-hidden animate-scale-up">
        {/* Decorative Background Aura */}
        <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-[#FFC107]/10 blur-xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-24 h-24 rounded-full bg-[#0A3598]/10 blur-xl pointer-events-none"></div>

        {/* Circular Icon with Radial Glow */}
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-[#E2E8F0] shadow-sm relative z-10">
          <img src="/logo.png" className="w-11 h-11 object-contain" alt="Umbrella Logo" />
        </div>

        {/* Text Details */}
        <div className="space-y-2 relative z-10">
          <h3 className="text-base font-extrabold text-[#0F172A] tracking-tight">
            Install {companyName}
          </h3>
          <p className="text-[11px] text-[#64748B] font-medium leading-relaxed px-2">
            {companyTagline}
            <br />
            Add to your home screen for a fast, full-screen, native-quality banking experience.
          </p>
        </div>

        {/* Dynamic iOS/Android Instructions */}
        <div className="relative z-10">
          {isIOS ? (
            <div className="bg-slate-50 border border-[#E2E8F0] rounded-2xl p-4 text-left space-y-2">
              <span className="text-[10px] font-bold text-[#0A3598] uppercase tracking-wider block">
                How to Install on iPhone:
              </span>
              <ol className="text-[10px] text-[#64748B] space-y-1.5 list-decimal list-inside font-semibold leading-relaxed">
                <li>
                  Tap the <span className="text-[#0F172A] font-extrabold">Share</span> button (bottom bar in Safari).
                </li>
                <li>
                  Scroll down and tap <span className="text-[#0F172A] font-extrabold">Add to Home Screen</span>.
                </li>
                <li>
                  Tap <span className="text-[#0A3598] font-extrabold">Add</span> in the top-right corner.
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleInstallClick}
                disabled={!deferredPrompt}
                className={`w-full py-3 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                  deferredPrompt 
                    ? 'pwa-shine-button hover:shadow-lg' 
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                }`}
              >
                <span className="material-symbols-rounded text-sm">install_mobile</span>
                {deferredPrompt ? 'Install Now' : 'App Already Installed'}
              </button>
            </div>
          )}
        </div>

        {/* Later/Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="w-full py-2.5 text-[#64748B] hover:text-[#0F172A] text-xs font-bold transition-all hover:bg-slate-50 rounded-xl cursor-pointer block"
        >
          Later
        </button>
      </div>
    </div>
  );
}
