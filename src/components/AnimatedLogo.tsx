import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AnimatedLogo = () => {
  const [displayText, setDisplayText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const fullText = "COPY ADD";
  const navigate = useNavigate();

  // Typewriter effect on mount
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setDisplayText(fullText.slice(0, index));
        index++;
      } else {
        setIsTypingComplete(true);
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  const handleClick = () => {
    navigate("/");
  };

  // Универсальный градиент для всех тем
  const universalGradient = 'linear-gradient(90deg, #06b6d4, #8F7356, #ec4899, #f59e0b, #06b6d4)';
  const baseColor = '#8F7356'; // brown-gray как базовый цвет

  return (
    <div 
      className="relative inline-block cursor-pointer group" 
      onClick={handleClick}
      title="Go to Home"
    >
      {/* Base layer - ВСЕГДА ВИДИМЫЙ слой с базовым цветом */}
      <h1 
        className="absolute top-0 left-0 font-bold pointer-events-none select-none"
        style={{ 
          fontSize: "clamp(1.125rem, 1.5vw, 1.25rem)",
          color: baseColor,
          opacity: 0.5,
          zIndex: 1,
        }}
        aria-hidden="true"
      >
        {displayText}
      </h1>

      {/* Gradient layer - анимированный градиент ПОВЕРХ */}
      <h1 
        className="relative font-bold transition-all duration-300"
        style={{ 
          fontSize: "clamp(1.125rem, 1.5vw, 1.25rem)",
          background: universalGradient,
          backgroundSize: '300% 100%',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: isTypingComplete ? 'gradientFlow 8s linear infinite' : 'none',
          filter: 'drop-shadow(0 0 6px rgba(143, 115, 86, 0.4))',
          zIndex: 2,
          willChange: 'background-position',
        }}
      >
        {displayText}
        {!isTypingComplete && <span className="animate-pulse">|</span>}
      </h1>
      
      {/* Hover indicator */}
      <div 
        className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-500 via-amber-700 to-pink-500 transition-all duration-300 group-hover:w-full opacity-0 group-hover:opacity-70"
        style={{ zIndex: 3 }}
      />

      <style>{`
        @keyframes gradientFlow {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        /* Hover effect */
        .group:hover h1 {
          filter: brightness(1.2) drop-shadow(0 0 8px rgba(143, 115, 86, 0.5)) !important;
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
};
