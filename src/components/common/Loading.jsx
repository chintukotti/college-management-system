import React from 'react';

const Loading3 = ({ message = 'Loading...' }) => {
  return (
    <>
      <style>{`
        @keyframes capToss {
          0%   { transform: translateY(0) rotate(0deg); }
          30%  { transform: translateY(-100px) rotate(180deg); }
          50%  { transform: translateY(-120px) rotate(360deg); }
          70%  { transform: translateY(-80px) rotate(540deg); }
          100% { transform: translateY(0) rotate(720deg); }
        }
        @keyframes capShadow {
          0%, 100% { transform: scaleX(1); opacity: 0.15; }
          50%      { transform: scaleX(0.3); opacity: 0.05; }
        }
        @keyframes sparkBurst {
          0%   { transform: translate(0,0) scale(1); opacity: 0.8; }
          100% { transform: translate(var(--sx), var(--sy)) scale(0); opacity: 0; }
        }
        @keyframes slideUp {
          0%, 100% { transform: translateY(10px); opacity: 0; }
          20%, 80% { transform: translateY(0); opacity: 1; }
        }
        @keyframes progressRing {
          0%   { stroke-dashoffset: 220; }
          90%  { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 220; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-8">
          {/* Cap area */}
          <div className="relative w-40 h-44 flex items-end justify-center">
            {/* Sparkles on toss */}
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              return (
                <div key={i} className="absolute text-amber-400 text-xs"
                  style={{
                    top: '20px', left: '50%',
                    '--sx': `${Math.cos(angle) * 50}px`,
                    '--sy': `${Math.sin(angle) * 40 - 20}px`,
                    animation: 'sparkBurst 2.5s ease-out infinite',
                    animationDelay: `${0.8 + i * 0.08}s`,
                  }}
                >
                  ✦
                </div>
              );
            })}

            {/* Graduation cap */}
            <div style={{ animation: 'capToss 2.5s ease-in-out infinite' }}>
              <svg width="80" height="55" viewBox="0 0 80 55">
                {/* Cap top (mortarboard) */}
                <polygon points="40,0 80,18 40,36 0,18" fill="url(#capGrad)" stroke="#1e1b4b" strokeWidth="1" />
                {/* Cap band */}
                <path d="M15,18 L15,32 Q40,42 65,32 L65,18 Q40,28 15,18Z" fill="#312e81" stroke="#1e1b4b" strokeWidth="1" />
                {/* Button on top */}
                <circle cx="40" cy="18" r="3" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                {/* Tassel */}
                <line x1="40" y1="18" x2="65" y2="10" stroke="#f59e0b" strokeWidth="2" />
                <circle cx="65" cy="10" r="2" fill="#f59e0b" />
                <line x1="65" y1="12" x2="65" y2="25" stroke="#f59e0b" strokeWidth="1.5" />
                <line x1="63" y1="25" x2="67" y2="25" stroke="#f59e0b" strokeWidth="1" />

                <defs>
                  <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4338ca" />
                    <stop offset="100%" stopColor="#312e81" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Shadow */}
            <div className="absolute bottom-0 w-12 h-2 bg-slate-300 rounded-full"
              style={{ animation: 'capShadow 2.5s ease-in-out infinite', filter: 'blur(3px)' }}
            />
          </div>

          {/* Progress ring */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="35" fill="none" stroke="#e2e8f0" strokeWidth="4" />
              <circle cx="40" cy="40" r="35" fill="none"
                stroke="url(#ringGrad)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray="220"
                style={{ animation: 'progressRing 3s ease-in-out infinite' }}
              />
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute text-lg">🎓</span>
          </div>

          {/* Text */}
          <div className="flex flex-col items-center gap-2"
            style={{ animation: 'slideUp 3s ease-in-out infinite' }}
          >
            <p className="text-slate-700 text-sm font-bold tracking-[0.2em] uppercase"
              style={{ fontFamily: 'Courier New' }}
            >
              {message}
            </p>
            <p className="text-slate-400 text-[10px] tracking-wider" style={{ fontFamily: 'Courier New' }}>
              Preparing your dashboard...
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Loading3;