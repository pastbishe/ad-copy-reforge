import React, { useState, useRef, useEffect } from 'react';

interface AnimatedSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  icon: string;
  className?: string;
  animationType?: 'glow' | 'pulse' | 'wave' | 'gradient' | 'none';
}

export const AnimatedSlider: React.FC<AnimatedSliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  icon,
  className = '',
  animationType = 'glow'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const percentage = ((value - min) / (max - min)) * 100;

  const getAnimationStyles = () => {
    const baseStyles = {
      background: `linear-gradient(to right, 
        hsl(var(--primary)) 0%, 
        hsl(var(--primary)) ${percentage}%, 
        hsl(var(--muted)) ${percentage}%, 
        hsl(var(--muted)) 100%)`,
      transition: isDragging ? 'none' : 'all 0.3s ease',
    };

    switch (animationType) {
      case 'glow':
        return {
          ...baseStyles,
          boxShadow: isHovered || isDragging 
            ? `0 0 20px hsl(var(--primary) / 0.5), 0 0 40px hsl(var(--primary) / 0.3)`
            : 'none',
        };
      
      case 'pulse':
        return {
          ...baseStyles,
          animation: isHovered || isDragging ? 'pulse 1.5s ease-in-out infinite' : 'none',
        };
      
      case 'wave':
        return {
          ...baseStyles,
          background: `linear-gradient(90deg, 
            hsl(var(--primary)) 0%, 
            hsl(var(--primary)) ${percentage}%, 
            hsl(var(--muted)) ${percentage}%, 
            hsl(var(--muted)) 100%),
            linear-gradient(90deg, 
              transparent 0%, 
              hsl(var(--primary) / 0.3) 50%, 
              transparent 100%)`,
          backgroundSize: '100% 100%, 200% 100%',
          animation: isHovered || isDragging ? 'wave 2s linear infinite' : 'none',
        };
      
      case 'gradient':
        return {
          ...baseStyles,
          background: `linear-gradient(90deg, 
            hsl(var(--primary)) 0%, 
            hsl(var(--primary)) ${percentage}%, 
            hsl(var(--muted)) ${percentage}%, 
            hsl(var(--muted)) 100%),
            linear-gradient(45deg, 
              hsl(var(--primary)) 0%, 
              hsl(var(--secondary)) 25%, 
              hsl(var(--primary)) 50%, 
              hsl(var(--secondary)) 75%, 
              hsl(var(--primary)) 100%)`,
          backgroundSize: '100% 100%, 300% 100%',
          animation: isHovered || isDragging ? 'gradientShift 3s ease-in-out infinite' : 'none',
        };
      
      default:
        return baseStyles;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const newValue = min + (percentage / 100) * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    
    onChange(Math.max(min, Math.min(max, steppedValue)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => handleMove(e as any);
      const handleMouseUpGlobal = () => handleMouseUp();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUpGlobal);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUpGlobal);
      };
    }
  }, [isDragging]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          <span>{icon}</span>
          {label}
        </label>
        <span className="text-sm font-medium text-foreground">
          {value}%
        </span>
      </div>
      
      <div
        ref={sliderRef}
        className="relative h-2 bg-muted rounded-lg cursor-pointer group"
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={getAnimationStyles()}
      >
        <div
          className="absolute top-1/2 w-4 h-4 bg-primary rounded-full shadow-lg transform -translate-y-1/2 transition-all duration-200 group-hover:scale-110"
          style={{
            left: `calc(${percentage}% - 8px)`,
            boxShadow: isHovered || isDragging 
              ? `0 0 0 4px hsl(var(--primary) / 0.2), 0 0 10px hsl(var(--primary) / 0.4)`
              : '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>

    </div>
  );
};
