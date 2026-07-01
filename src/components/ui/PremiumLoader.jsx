import React, { useState, useEffect } from 'react';

export function PremiumLoader() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 2400; // 2.4 seconds for progress completion
    const intervalTime = 30; 
    const step = 100 / (duration / intervalTime);
    
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(100, prev + step);
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  const roundedProgress = Math.round(progress);
  const strokeCircumference = 2 * Math.PI * 54; // r=54 -> ~339.29
  const strokeDashoffset = strokeCircumference - (strokeCircumference * progress) / 100;

  return (
    <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-lg flex flex-col items-center justify-center z-[9999] overflow-hidden select-none">
      <style>{`
        /* 3D Spin Animation for the Rupee Coin */
        .coin-wrapper {
          perspective: 1000px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .coin-3d {
          transform-style: preserve-3d;
          animation: spin3D 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes spin3D {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }

        /* Ambient Glow Pulse */
        .ambient-radial-glow {
          animation: radialPulse 3s ease-in-out infinite;
        }
        @keyframes radialPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.95); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }

        /* Smooth text reveal with blue gradient motion */
        .loading-text {
          font-family: 'Manrope', sans-serif;
          letter-spacing: 0.05em;
          font-weight: 900;
          background: linear-gradient(120deg, #0A3598 0%, #3B82F6 40%, #1E3A8A 70%, #0A3598 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shineText 2.5s linear infinite;
        }

        @keyframes shineText {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        
        .loading-subtext {
          font-family: 'Manrope', sans-serif;
          letter-spacing: 0.02em;
          color: #64748B;
        }
      `}</style>

      {/* Radial Amber/Blue Background Glow */}
      <div className="absolute w-[350px] h-[350px] rounded-full bg-gradient-to-tr from-[#0A3598]/5 via-[#F59E0B]/5 to-transparent blur-3xl pointer-events-none ambient-radial-glow"></div>

      <div className="relative flex flex-col items-center justify-center">
        {/* Progress Circle & 3D Rotating Coin Container */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          
          {/* Background Outer Ring */}
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 120 120">
            {/* Background Track Circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#F1F5F9"
              strokeWidth="3.5"
            />
            {/* Animated Progress Indicator (Solid deep royal blue) */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#0A3598"
              strokeWidth="4"
              strokeDasharray={strokeCircumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              className="transition-all duration-75 ease-out"
            />
            
            {/* Glowing Yellow/Gold dot at the leading position of the progress ring */}
            {progress > 0 && (
              <circle
                cx={60 + 54 * Math.cos(((-90 + progress * 3.6) * Math.PI) / 180)}
                cy={60 + 54 * Math.sin(((-90 + progress * 3.6) * Math.PI) / 180)}
                r="4.5"
                fill="#FFC107"
                stroke="#FF8F00"
                strokeWidth="1.5"
                filter="drop-shadow(0 0 5px #F59E0B)"
                className="transition-all duration-75 ease-out"
              />
            )}
          </svg>

          {/* 3D Rotating Gold Rupee Coin */}
          <div className="coin-wrapper w-20 h-20 z-10">
            <svg viewBox="0 0 100 100" className="w-full h-full coin-3d">
              <defs>
                {/* Gold Gradient for Coin Plate */}
                <radialGradient id="gold-metal" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#FFE082" />
                  <stop offset="35%" stopColor="#FFC107" />
                  <stop offset="85%" stopColor="#FF8F00" />
                  <stop offset="100%" stopColor="#E65100" />
                </radialGradient>
              </defs>

              {/* Coin Body (Radial gold metal finish) */}
              <circle cx="50" cy="50" r="44" fill="url(#gold-metal)" stroke="#E65100" strokeWidth="2" filter="drop-shadow(0 3px 5px rgba(0,0,0,0.15))" />
              
              {/* Inner Decorative Dashed Ring */}
              <circle cx="50" cy="50" r="37" fill="none" stroke="#FFE082" strokeWidth="1" strokeDasharray="3 3" opacity="0.85" />
              
              {/* Embossed Rupee Symbol (Deep brand Royal Blue) */}
              <text 
                x="50" 
                y="63" 
                fontFamily="'Manrope', sans-serif" 
                fontSize="36" 
                fontWeight="900" 
                fill="#0A3598" 
                textAnchor="middle"
                filter="drop-shadow(0 1px 2px rgba(255,255,255,0.4))"
              >
                ₹
              </text>
            </svg>
          </div>
        </div>

        {/* Loading Progress Text */}
        <div className="mt-6 text-center space-y-1">
          <div className="loading-text text-sm flex items-center justify-center gap-1.5">
            <span>LOADING</span>
            <span className="font-black text-amber-500">{roundedProgress}%</span>
          </div>
          <p className="loading-subtext text-[10px] uppercase font-bold tracking-widest opacity-80">
            Umbrella Finance
          </p>
        </div>
      </div>
    </div>
  );
}
