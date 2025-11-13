// Настройки анимации ползунков
// Измените значение по умолчанию для смены анимации всех ползунков

export type SliderAnimationType = 'glow' | 'pulse' | 'wave' | 'gradient' | 'none';

// Текущая анимация по умолчанию
export const DEFAULT_SLIDER_ANIMATION: SliderAnimationType = 'glow';

// Описания анимаций для UI (если понадобится в настройках)
export const ANIMATION_DESCRIPTIONS = {
  glow: 'Свечение при наведении',
  pulse: 'Пульсация при взаимодействии', 
  wave: 'Волновой эффект',
  gradient: 'Градиентная анимация',
  none: 'Без анимации'
} as const;

// Настройки для каждой анимации
export const ANIMATION_CONFIGS = {
  glow: {
    duration: '0.3s',
    intensity: 'medium'
  },
  pulse: {
    duration: '1.5s',
    intensity: 'low'
  },
  wave: {
    duration: '2s',
    intensity: 'medium'
  },
  gradient: {
    duration: '3s',
    intensity: 'high'
  },
  none: {
    duration: '0s',
    intensity: 'none'
  }
} as const;
