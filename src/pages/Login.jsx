import React, { useState, useEffect } from 'react';
import { authApi } from '../services/api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
      const y = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
      setMouseOffset({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetUsername, setResetUsername] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [resetUser, setResetUser] = useState(null);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // PIN Input Refs and Handlers
  const pinRef0 = React.useRef(null);
  const pinRef1 = React.useRef(null);
  const pinRef2 = React.useRef(null);
  const pinRef3 = React.useRef(null);
  const pinRefs = [pinRef0, pinRef1, pinRef2, pinRef3];

  const handlePinDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const pinArr = pin.split('');
      pinArr[index] = '';
      const newPin = pinArr.join('');
      setPin(newPin);
      return;
    }

    const digit = cleaned[cleaned.length - 1];
    const pinArr = pin.split('');
    for (let k = 0; k < 4; k++) {
      if (pinArr[k] === undefined) pinArr[k] = '';
    }
    pinArr[index] = digit;
    const newPin = pinArr.join('');
    setPin(newPin);

    // Auto-focus next box
    if (index < 3 && digit) {
      pinRefs[index + 1].current.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!pin[index] && index > 0) {
        const pinArr = pin.split('');
        pinArr[index - 1] = '';
        const newPin = pinArr.join('');
        setPin(newPin);
        pinRefs[index - 1].current.focus();
      }
    }
  };

  const handlePinPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    setPin(pastedData);
    const nextFocusIndex = Math.min(pastedData.length, 3);
    if (pinRefs[nextFocusIndex]?.current) {
      pinRefs[nextFocusIndex].current.focus();
    }
  };

  // Check if input is mobile number (only contains numbers, +, space, or dashes)
  const isMobileNum = /^[0-9+\s-]*$/.test(username) && username.length > 0;

  // Authentication is fully server-side via authApi.login — no local user database

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!username) {
      setError('Please enter your email or mobile number.');
      return;
    }

    if (isMobileNum) {
      if (!pin) {
        setError('Please enter your 4-digit security PIN.');
        return;
      }
      if (!/^\d{4}$/.test(pin)) {
        setError('PIN must be exactly a 4-digit number.');
        return;
      }
    } else {
      if (!password) {
        setError('Please enter your password.');
        return;
      }
    }

    setLoading(true);

    authApi.login(username.trim(), password, pin)
      .then((res) => {
        setLoading(false);
        const { token, user } = res.data;
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('auth_token', token);
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('username', user.name);
        localStorage.setItem('user_id', user.user_id || '');
        localStorage.setItem('active_user_role', user.role);
        localStorage.setItem('active_user_name', user.name);
        localStorage.setItem('user_branch_id', user.branch_id || '');
        localStorage.setItem('user_area_id', user.area_id || '');
        localStorage.setItem('user_agent_id', user.agent_id || '');
        localStorage.setItem('user_permissions', JSON.stringify(user.permissions || []));
        onLogin();
      })
      .catch((err) => {
        setLoading(false);
        setError(err.message || 'Login failed. Please check credentials.');
      });
  };

  const handleVerifyUser = (e) => {
    e.preventDefault();
    setResetError('');
    if (!resetUsername) {
      setResetError('Please enter your email or mobile number.');
      return;
    }

    setResetLoading(true);
    // Just move to step 2 and let the final API call verify/update
    setTimeout(() => {
      setResetLoading(false);
      setResetStep(2);
    }, 500);
  };

  const handleUpdateCredentials = (e) => {
    e.preventDefault();
    setResetError('');

    if (!resetPassword) {
      setResetError('Please enter a new password.');
      return;
    }
    if (resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (!resetPin) {
      setResetError('Please enter a new 4-digit PIN.');
      return;
    }
    if (!/^\d{4}$/.test(resetPin)) {
      setResetError('PIN must be exactly 4 digits.');
      return;
    }

    setResetLoading(true);
    authApi.resetCredentials(resetUsername.trim(), resetPassword, resetPin)
      .then(() => {
        setResetLoading(false);
        setResetStep(3);
      })
      .catch((err) => {
        setResetLoading(false);
        setResetError(err.message || 'Account not found or password update failed.');
      });
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-y-auto py-6 sm:py-10 bg-[#F8FAFC]">
      
      {/* Styles for SVG Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }

        @keyframes sway {
          0%, 100% { transform: rotate(0deg); transform-origin: 210px 380px; }
          50% { transform: rotate(1.2deg); transform-origin: 210px 380px; }
        }

        @keyframes waveMove1 {
          0% { transform: translateX(0); }
          50% { transform: translateX(-40px) translateY(4px); }
          100% { transform: translateX(0); }
        }

        @keyframes waveMove2 {
          0% { transform: translateX(0); }
          50% { transform: translateX(40px) translateY(-4px); }
          100% { transform: translateX(0); }
        }

        @keyframes pulseOpacity {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 1; }
        }

        @keyframes strokeDraw {
          0% { stroke-dashoffset: 400; }
          100% { stroke-dashoffset: 0; }
        }

        @keyframes glowFlow {
          0% { stroke-dashoffset: 400; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { stroke-dashoffset: -400; opacity: 0; }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-sway {
          animation: sway 8s ease-in-out infinite;
        }

        .animate-wave-slow {
          animation: waveMove1 15s ease-in-out infinite;
        }

        .animate-wave-fast {
          animation: waveMove2 11s ease-in-out infinite;
        }

        .animate-sparkle-1 {
          animation: pulseOpacity 3s ease-in-out infinite;
        }

        .animate-sparkle-2 {
          animation: pulseOpacity 4s ease-in-out infinite 1s;
        }

        .animate-sparkle-3 {
          animation: pulseOpacity 2.5s ease-in-out infinite 0.5s;
        }

        .animate-chart-arrow {
          stroke-dasharray: 400;
          animation: strokeDraw 3.5s ease-out forwards;
        }

        .animate-umbrella-glow {
          stroke-dasharray: 180;
          animation: glowFlow 7s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* SVG Animated Background */}
      <div className="absolute inset-0 w-full h-full z-0 select-none pointer-events-none flex items-center justify-center">
        <svg 
          viewBox="0 0 1672 941" 
          className="w-full h-auto opacity-95 transition-opacity duration-700"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Static Base Image */}
          <image href="/login-bg.png" x="0" y="0" width="1672" height="941" style={{ mixBlendMode: 'multiply' }} />

          {/* Bottom Wave Animations */}
          <path 
            d="M 0 941 L 0 862 Q 418 830 836 875 T 1672 850 L 1672 941 Z" 
            fill="none" 
            stroke="#0A3598" 
            strokeWidth="2.5" 
            opacity="0.35" 
            className="animate-wave-slow" 
          />
          <path 
            d="M 0 941 L 0 878 Q 418 862 836 845 T 1672 870 L 1672 941 Z" 
            fill="none" 
            stroke="#FFC107" 
            strokeWidth="3" 
            opacity="0.45" 
            className="animate-wave-fast" 
          />

          {/* Floating Rupee Coin */}
          <g className="animate-float" style={{ transformOrigin: '270px 820px' }}>
            <circle cx="270" cy="820" r="38" fill="#FFFFFF" stroke="#FFC107" strokeWidth="4" />
            <circle cx="270" cy="820" r="31" fill="none" stroke="#FFC107" strokeWidth="1" strokeDasharray="3 3" />
            <text 
              x="270" 
              y="833" 
              fontFamily="Manrope, sans-serif" 
              fontSize="38" 
              fontWeight="900" 
              fill="#FFC107" 
              textAnchor="middle"
            >
              ₹
            </text>
          </g>

          {/* Growth Chart Arrow */}
          <g>
            <path 
              d="M 1370 550 Q 1450 540 1530 460" 
              fill="none" 
              stroke="#0A3598" 
              strokeWidth="5" 
              strokeLinecap="round"
              className="animate-chart-arrow"
            />
            <path 
              d="M 1518 458 L 1534 456 L 1528 472" 
              fill="none" 
              stroke="#0A3598" 
              strokeWidth="5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            {/* Travelling glowing amber dot along the arrow */}
            <circle r="7" fill="#FFC107" className="shadow-lg">
              <animateMotion 
                path="M 1370 550 Q 1450 540 1530 460" 
                dur="4.5s" 
                repeatCount="indefinite" 
                rotate="auto" 
              />
            </circle>
          </g>

          {/* Umbrella Line Drawing Glow Overlay */}
          <g className="animate-sway" style={{ transformOrigin: '210px 380px' }}>
            <path 
              d="M 60 485 C 60 485 60 380 210 380 C 360 380 360 485 360 485" 
              fill="none" 
              stroke="#FFC107" 
              strokeWidth="4" 
              strokeLinecap="round"
              className="animate-umbrella-glow"
            />
          </g>

          {/* Sparkles Fading In/Out */}
          {/* Sparkle 1 (Top Left) */}
          <g transform="translate(170, 100)" className="animate-sparkle-1">
            <path d="M 0 -12 L 0 12 M -12 0 L 12 0" stroke="#FFC107" strokeWidth="3" strokeLinecap="round" />
            <circle cx="0" cy="0" r="3.5" fill="#0A3598" />
          </g>

          {/* Sparkle 2 (Top Right) */}
          <g transform="translate(1580, 210)" className="animate-sparkle-2">
            <path d="M 0 -15 L 0 15 M -15 0 L 15 0" stroke="#FFC107" strokeWidth="3" strokeLinecap="round" />
            <circle cx="0" cy="0" r="4" fill="#0A3598" />
          </g>

          {/* Sparkle 3 (Center Right) */}
          <g transform="translate(1140, 530)" className="animate-sparkle-3">
            <path d="M 0 -10 L 0 10 M -10 0 L 10 0" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="0" r="2.5" fill="#0A3598" />
          </g>

          {/* Sparkle 4 (Near wallet) */}
          <g transform="translate(1410, 680)" className="animate-sparkle-2">
            <path d="M 0 -11 L 0 11 M -11 0 L 11 0" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="0" r="3" fill="#0A3598" />
          </g>

          {/* Sparkle 5 (Near family) */}
          <g transform="translate(80, 610)" className="animate-sparkle-1">
            <path d="M 0 -10 L 0 10 M -10 0 L 10 0" stroke="#0A3598" strokeWidth="2" strokeLinecap="round" />
          </g>
          {/* Interactive Parallax Clouds */}
          {/* Cloud A (Left-center) */}
          <g style={{ transform: `translate(${mouseOffset.x * 28}px, ${mouseOffset.y * 16}px)`, transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <path 
              d="M 620 180 L 700 180 A 12 12 0 0 0 712 168 A 16 16 0 0 0 696 152 A 22 22 0 0 0 654 136 A 16 16 0 0 0 622 152 A 12 12 0 0 0 608 168 A 12 12 0 0 0 620 180 Z" 
              fill="none" 
              stroke="#0A3598" 
              strokeWidth="2.5" 
              opacity="0.35" 
            />
          </g>

          {/* Cloud B (Right-center) */}
          <g style={{ transform: `translate(${mouseOffset.x * -20}px, ${mouseOffset.y * -12}px)`, transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <path 
              d="M 930 140 L 1010 140 A 12 12 0 0 0 1022 128 A 16 16 0 0 0 1006 112 A 22 22 0 0 0 964 96 A 16 16 0 0 0 932 112 A 12 12 0 0 0 918 128 A 12 12 0 0 0 930 140 Z" 
              fill="none" 
              stroke="#0A3598" 
              strokeWidth="2.5" 
              opacity="0.35" 
            />
          </g>
          {/* Interactive Parallax Particles (+ and Circles) */}
          {/* Left Yellow Cross */}
          <g style={{ transform: `translate(${mouseOffset.x * 35}px, ${mouseOffset.y * 20}px)`, transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <g transform="translate(120, 280)">
              <path d="M -7 0 L 7 0 M 0 -7 L 0 7" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </g>

          {/* Left Blue Circle */}
          <g style={{ transform: `translate(${mouseOffset.x * -18}px, ${mouseOffset.y * -12}px)`, transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <circle cx="240" cy="160" r="6" fill="none" stroke="#0A3598" strokeWidth="2" />
          </g>

          {/* Right Blue Cross */}
          <g style={{ transform: `translate(${mouseOffset.x * 40}px, ${mouseOffset.y * 25}px)`, transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <g transform="translate(1420, 260)">
              <path d="M -8 0 L 8 0 M 0 -8 L 0 8" stroke="#0A3598" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </g>

          {/* Right Yellow Circle */}
          <g style={{ transform: `translate(${mouseOffset.x * -25}px, ${mouseOffset.y * -15}px)`, transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <circle cx="1550" cy="140" r="7" fill="none" stroke="#FFC107" strokeWidth="2" />
          </g>

          {/* Center-Right Yellow Dot */}
          <g style={{ transform: `translate(${mouseOffset.x * 22}px, ${mouseOffset.y * 14}px)`, transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <circle cx="1280" cy="380" r="4.5" fill="#FFC107" />
          </g>
        </svg>
      </div>

      {/* Login Card Container */}
      <div className="relative z-10 w-full max-w-md mx-4 my-auto p-5 sm:p-6 bg-white/95 backdrop-blur-lg border border-[#E2E8F0] shadow-2xl rounded-3xl transition-all duration-300">
        
        {/* Logo and Header */}
        <div className="text-center mb-5">
          <div className="flex justify-center mb-2">
            <img 
              src="/logo.png" 
              alt="Umbrella Finance Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>
          <h2 className="text-xl font-black text-[#0A3598] tracking-tight">
            Umbrella Finance
          </h2>
          <p className="text-[10px] text-[#64748B] font-extrabold mt-0.5 uppercase tracking-wide">
            Secure Wealth & Micro Lending
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-[#E11D48]/10 border-l-4 border-[#E11D48] rounded-xl flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-rounded text-[#E11D48] select-none text-xl mt-0.5">
              error
            </span>
            <div className="text-xs font-bold text-[#E11D48] leading-relaxed">
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* Username Input Field with Peer Floating Label */}
          <div className="relative">
            <input
              type="text"
              id="username"
              placeholder=" "
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full px-4 py-3.5 text-sm text-[#0F172A] bg-white border border-[#E2E8F0] rounded-2xl appearance-none focus:outline-none focus:ring-4 focus:ring-[#0A3598]/5 focus:border-[#0A3598] peer pr-10 font-semibold transition-all"
              disabled={loading}
              autoComplete="username"
            />
            <label 
              htmlFor="username" 
              className="absolute text-xs text-[#64748B] duration-200 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-[#0A3598] peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-3 font-semibold pointer-events-none"
            >
              Email or Mobile Number
            </label>
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 material-symbols-rounded text-[#64748B]/60 text-lg select-none pointer-events-none">
              {isMobileNum ? 'phone_android' : 'mail'}
            </span>
          </div>

          {/* Conditional Password/PIN Field with Peer Floating Label */}
          {isMobileNum ? (
            /* PIN Field if mobile input detected */
            <div className="space-y-2.5 animate-fade-in">
              <div className="text-center">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Enter 4-Digit Security PIN
                </span>
              </div>
              <div className="flex items-center justify-center gap-3 relative">
                {/* Spacer to center the inputs */}
                <div className="w-8" />
                
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    ref={pinRefs[index]}
                    type={showPassword ? 'text' : 'password'}
                    value={pin[index] || ''}
                    onChange={(e) => handlePinDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    onPaste={handlePinPaste}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    className="w-12 h-12 text-center text-lg font-black text-[#0A3598] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#0A3598]/10 focus:border-[#0A3598] transition-all focus:scale-105"
                    disabled={loading}
                    autoComplete="one-time-code"
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="w-8 h-8 flex items-center justify-center text-[#64748B]/60 hover:text-[#0A3598] transition-colors cursor-pointer select-none"
                >
                  <span className="material-symbols-rounded text-lg">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Password Field (Default) */
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3.5 text-sm text-[#0F172A] bg-white border border-[#E2E8F0] rounded-2xl appearance-none focus:outline-none focus:ring-4 focus:ring-[#0A3598]/5 focus:border-[#0A3598] peer pr-12 font-semibold transition-all"
                disabled={loading}
                autoComplete="current-password"
              />
              <label 
                htmlFor="password" 
                className="absolute text-xs text-[#64748B] duration-200 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-[#0A3598] peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-3 font-semibold pointer-events-none"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B]/60 hover:text-[#0A3598] transition-colors cursor-pointer select-none"
              >
                <span className="material-symbols-rounded text-lg">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          )}

          {/* Options Row: Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 font-bold text-[#64748B] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4.5 h-4.5 rounded-md border-[#E2E8F0] text-[#0A3598] focus:ring-[#0A3598] transition-all cursor-pointer accent-[#0A3598]"
                disabled={loading}
              />
              <span>Remember me</span>
            </label>
            <button 
              type="button"
              onClick={() => { setShowResetModal(true); setResetStep(1); }}
              className="text-[#0A3598] hover:text-[#FFC107] font-extrabold transition-colors cursor-pointer select-none bg-transparent border-none p-0 outline-none"
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full mt-4 py-3.5 bg-[#0A3598] hover:bg-[#0A3598]/95 text-white font-black rounded-2xl shadow-lg hover:shadow-xl hover:shadow-[#0A3598]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer select-none group border-2 border-transparent focus:border-[#FFC107] focus:outline-none"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Verifying Secure Credentials...</span>
              </>
            ) : (
              <>
                <span>Secure Sign In</span>
                <span className="material-symbols-rounded text-lg transition-transform duration-300 group-hover:translate-x-1 select-none">
                  lock_open
                </span>
              </>
            )}
          </button>
        </form>

        {/* Secure Trust Stamp */}
        <div className="mt-5 text-center border-t border-[#E2E8F0]/80 pt-4 flex items-center justify-center gap-1.5 text-[10px] font-black text-[#64748B]/60 uppercase tracking-widest">
          <span className="material-symbols-rounded text-xs text-[#16A34A] select-none">
            verified_user
          </span>
          <span>Umbrella Finance Central Auth Node</span>
        </div>
      </div>

      {/* Forgot Password / PIN Recovery Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div 
            className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-sm w-full p-6 space-y-6 text-center animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step 1: Find User */}
            {resetStep === 1 && (
              <form onSubmit={handleVerifyUser} className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#0A3598]/10 text-[#0A3598] flex items-center justify-center">
                  <span className="material-symbols-rounded text-2xl select-none">
                    lock_reset
                  </span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-[#0F172A] tracking-tight">
                    Reset Security Access
                  </h4>
                  <p className="text-xs text-[#64748B] font-semibold leading-relaxed">
                    Enter your registered Email or Mobile Number to locate your account profile.
                  </p>
                </div>

                {resetError && (
                  <div className="text-[11px] font-bold text-[#E11D48] bg-[#E11D48]/5 p-2.5 rounded-xl border border-[#E11D48]/10">
                    {resetError}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder=" "
                    className="block w-full px-4 py-3 text-xs text-[#0F172A] bg-white border border-[#E2E8F0] rounded-xl appearance-none focus:outline-none focus:ring-4 focus:ring-[#0A3598]/5 focus:border-[#0A3598] peer font-semibold"
                  />
                  <label className="absolute text-[10px] text-[#64748B] duration-200 transform -translate-y-3.5 scale-75 top-2 z-10 origin-[0] bg-white px-1.5 peer-focus:px-1.5 peer-focus:text-[#0A3598] peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-3.5 left-3.5 font-semibold pointer-events-none">
                    Email or Mobile Number
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowResetModal(false); setResetError(''); setResetUsername(''); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-[#64748B] text-xs font-black rounded-xl cursor-pointer select-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-black rounded-xl cursor-pointer select-none flex items-center justify-center gap-1.5"
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Verifying...' : 'Verify User'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Set New Password/PIN */}
            {resetStep === 2 && (
              <form onSubmit={handleUpdateCredentials} className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#FFC107]/10 text-[#FFC107] flex items-center justify-center">
                  <span className="material-symbols-rounded text-2xl select-none">
                    password
                  </span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-[#0F172A] tracking-tight">
                    Set New Credentials
                  </h4>
                  <p className="text-xs text-[#64748B] font-semibold leading-relaxed">
                    User: <strong className="text-[#0A3598]">{resetUser?.name}</strong> ({resetUser?.role})
                  </p>
                </div>

                {resetError && (
                  <div className="text-[11px] font-bold text-[#E11D48] bg-[#E11D48]/5 p-2.5 rounded-xl border border-[#E11D48]/10">
                    {resetError}
                  </div>
                )}

                {/* New Password Field */}
                <div className="relative">
                  <input
                    type="text"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder=" "
                    className="block w-full px-4 py-3 text-xs text-[#0F172A] bg-white border border-[#E2E8F0] rounded-xl appearance-none focus:outline-none focus:ring-4 focus:ring-[#0A3598]/5 focus:border-[#0A3598] peer font-semibold"
                  />
                  <label className="absolute text-[10px] text-[#64748B] duration-200 transform -translate-y-3.5 scale-75 top-2 z-10 origin-[0] bg-white px-1.5 peer-focus:px-1.5 peer-focus:text-[#0A3598] peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-3.5 left-3.5 font-semibold pointer-events-none">
                    New Password
                  </label>
                </div>

                {/* New 4-Digit PIN Field */}
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={resetPin}
                    onChange={(e) => setResetPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder=" "
                    className="block w-full px-4 py-3 text-center text-sm font-black tracking-widest text-[#0F172A] bg-white border border-[#E2E8F0] rounded-xl appearance-none focus:outline-none focus:ring-4 focus:ring-[#0A3598]/5 focus:border-[#0A3598] peer"
                  />
                  <label className="absolute text-[10px] text-[#64748B] duration-200 transform -translate-y-3.5 scale-75 top-2 z-10 origin-[0] bg-white px-1.5 peer-focus:px-1.5 peer-focus:text-[#0A3598] peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-3.5 left-1/2 -translate-x-1/2 font-semibold pointer-events-none">
                    New 4-Digit PIN
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setResetStep(1); setResetError(''); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-[#64748B] text-xs font-black rounded-xl cursor-pointer select-none"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-black rounded-xl cursor-pointer select-none flex items-center justify-center gap-1.5"
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Saving...' : 'Save New Code'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Success */}
            {resetStep === 3 && (
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center">
                  <span className="material-symbols-rounded text-2xl select-none">
                    check_circle
                  </span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-[#0F172A] tracking-tight">
                    Access Code Updated
                  </h4>
                  <p className="text-xs text-[#64748B] font-semibold leading-relaxed">
                    Your security credentials have been successfully updated. You can now use them to sign in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUsername(resetUsername);
                    setShowResetModal(false);
                    setResetStep(1);
                    setResetUsername('');
                    setResetPassword('');
                    setResetPin('');
                    setResetUser(null);
                  }}
                  className="w-full py-2.5 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-black rounded-xl cursor-pointer select-none"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
