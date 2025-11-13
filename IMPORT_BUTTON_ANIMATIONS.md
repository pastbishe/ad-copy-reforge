# Варианты перманентной анимации для кнопки импорта

## Вариант 1: Пульсирующее свечение (Pulse Glow)
**Описание:** Мягкое пульсирующее свечение вокруг кнопки
**Эффект:** Кнопка слегка "дышит" с мягким свечением

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden"
  onClick={handleImport}
  disabled={!url}
  style={{
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
    animation: 'pulseGlow 2s ease-in-out infinite'
  }}
>
  <style>{`
    @keyframes pulseGlow {
      0%, 100% {
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
      }
      50% {
        box-shadow: 0 0 30px rgba(139, 92, 246, 0.7), 0 0 40px rgba(139, 92, 246, 0.5);
      }
    }
  `}</style>
  {t("import")}
</Button>
```

---

## Вариант 2: Движущийся градиент (Shimmer Effect)
**Описание:** Градиент движется слева направо по кнопке
**Эффект:** Эффект "блеска" или "перелива"

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden"
  onClick={handleImport}
  disabled={!url}
>
  <motion.div
    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
    animate={{
      x: ['-100%', '200%']
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'linear'
    }}
  />
  <span className="relative z-10">{t("import")}</span>
</Button>
```

---

## Вариант 3: Вращающаяся граница (Rotating Border)
**Описание:** Градиентная граница вращается вокруг кнопки
**Эффект:** Динамичная вращающаяся рамка

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative"
  onClick={handleImport}
  disabled={!url}
  style={{
    background: 'transparent',
    border: '2px solid transparent',
    backgroundImage: 'linear-gradient(var(--background), var(--background)), linear-gradient(90deg, #8b5cf6, #ec4899, #8b5cf6)',
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    animation: 'rotateBorder 3s linear infinite'
  }}
>
  <style>{`
    @keyframes rotateBorder {
      0% {
        background-image: linear-gradient(var(--background), var(--background)), 
          linear-gradient(0deg, #8b5cf6, #ec4899, #8b5cf6);
      }
      100% {
        background-image: linear-gradient(var(--background), var(--background)), 
          linear-gradient(360deg, #8b5cf6, #ec4899, #8b5cf6);
      }
    }
  `}</style>
  {t("import")}
</Button>
```

---

## Вариант 4: Волновая анимация (Wave Ripple)
**Описание:** Волны расходятся от центра кнопки
**Эффект:** Эффект "ряби" на воде

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden"
  onClick={handleImport}
  disabled={!url}
>
  <motion.div
    className="absolute inset-0 flex items-center justify-center"
    style={{
      background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)'
    }}
    animate={{
      scale: [1, 1.5, 2],
      opacity: [0.5, 0.3, 0]
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeOut'
    }}
  />
  <motion.div
    className="absolute inset-0 flex items-center justify-center"
    style={{
      background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)'
    }}
    animate={{
      scale: [1, 1.5, 2],
      opacity: [0.5, 0.3, 0]
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeOut',
      delay: 1
    }}
  />
  <span className="relative z-10">{t("import")}</span>
</Button>
```

---

## Вариант 5: Пульсирующий масштаб (Gentle Pulse)
**Описание:** Кнопка слегка увеличивается и уменьшается
**Эффект:** Мягкое "дыхание" кнопки

```tsx
<motion.div
  animate={{
    scale: [1, 1.02, 1]
  }}
  transition={{
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut'
  }}
>
  <Button 
    variant="secondary" 
    size="lg" 
    className="w-full h-14 text-base font-medium"
    onClick={handleImport}
    disabled={!url}
  >
    {t("import")}
  </Button>
</motion.div>
```

---

## Вариант 6: Комбинированный (Pulse + Shimmer)
**Описание:** Комбинация пульсации и движущегося градиента
**Эффект:** Самый заметный и динамичный эффект

```tsx
<motion.div
  animate={{
    scale: [1, 1.02, 1]
  }}
  transition={{
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut'
  }}
  className="w-full"
>
  <Button 
    variant="secondary" 
    size="lg" 
    className="w-full h-14 text-base font-medium relative overflow-hidden"
    onClick={handleImport}
    disabled={!url}
    style={{
      boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
      animation: 'pulseGlow 2s ease-in-out infinite'
    }}
  >
    <style>{`
      @keyframes pulseGlow {
        0%, 100% {
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
        }
        50% {
          box-shadow: 0 0 30px rgba(139, 92, 246, 0.7), 0 0 40px rgba(139, 92, 246, 0.5);
        }
      }
    `}</style>
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      animate={{
        x: ['-100%', '200%']
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'linear'
      }}
    />
    <span className="relative z-10">{t("import")}</span>
  </Button>
</motion.div>
```

---

## Вариант 7: Градиентный фон (Animated Gradient Background)
**Описание:** Градиентный фон плавно меняет цвета
**Эффект:** Плавная смена цветов фона

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden"
  onClick={handleImport}
  disabled={!url}
  style={{
    background: 'linear-gradient(-45deg, #8b5cf6, #ec4899, #8b5cf6, #06b6d4)',
    backgroundSize: '400% 400%',
    animation: 'gradientShift 4s ease infinite'
  }}
>
  <style>{`
    @keyframes gradientShift {
      0% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0% 50%;
      }
    }
  `}</style>
  <span className="relative z-10 text-white">{t("import")}</span>
</Button>
```

---

## Вариант 8: Минималистичный (Subtle Glow)
**Описание:** Очень тонкое свечение, почти незаметное
**Эффект:** Элегантный и ненавязчивый

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium"
  onClick={handleImport}
  disabled={!url}
  style={{
    boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)',
    transition: 'box-shadow 0.3s ease'
  }}
>
  {t("import")}
</Button>
```

---

## Рекомендации:
- **Вариант 1** - классический, хорошо заметный
- **Вариант 2** - современный и стильный
- **Вариант 5** - минималистичный, не отвлекающий
- **Вариант 6** - самый заметный и привлекающий внимание
- **Вариант 7** - яркий и динамичный

Выберите вариант, и я применю его к кнопке импорта!

