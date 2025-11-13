# Варианты тематических анимаций для кнопки импорта

## Вариант 1: Стрелка вниз (Download/Import Arrow)
**Тематика:** Загрузка/импорт данных
**Эффект:** Стрелка вниз пульсирует, имитируя загрузку

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden flex items-center justify-center gap-2"
  onClick={handleImport}
  disabled={!url}
>
  <motion.div
    animate={{
      y: [0, 4, 0]
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
  >
    <LinkIcon className="w-5 h-5" />
  </motion.div>
  <span>{t("import")}</span>
</Button>
```

---

## Вариант 2: Волны данных (Data Flow)
**Тематика:** Поток данных, передача информации
**Эффект:** Волны движутся от центра к краям, как поток данных

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
      background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)'
    }}
    animate={{
      scale: [1, 1.8, 2.5],
      opacity: [0.6, 0.3, 0]
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
      background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)'
    }}
    animate={{
      scale: [1, 1.8, 2.5],
      opacity: [0.6, 0.3, 0]
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeOut',
      delay: 1
    }}
  />
  <span className="relative z-10 flex items-center gap-2">
    <LinkIcon className="w-5 h-5" />
    {t("import")}
  </span>
</Button>
```

---

## Вариант 3: Ссылка в движении (Animated Link)
**Тематика:** Ссылка, соединение, связь
**Эффект:** Иконка ссылки вращается и пульсирует

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden flex items-center justify-center gap-2"
  onClick={handleImport}
  disabled={!url}
>
  <motion.div
    animate={{
      rotate: [0, 15, -15, 0],
      scale: [1, 1.1, 1]
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
  >
    <LinkIcon className="w-5 h-5" />
  </motion.div>
  <motion.span
    animate={{
      opacity: [1, 0.7, 1]
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
  >
    {t("import")}
  </motion.span>
</Button>
```

---

## Вариант 4: Поток данных (Data Stream)
**Тематика:** Передача данных, синхронизация
**Эффект:** Линии движутся сверху вниз, как поток данных

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden"
  onClick={handleImport}
  disabled={!url}
>
  <motion.div
    className="absolute inset-0"
    style={{
      background: 'linear-gradient(to bottom, transparent 0%, rgba(139, 92, 246, 0.3) 50%, transparent 100%)',
      backgroundSize: '100% 200%'
    }}
    animate={{
      backgroundPosition: ['0% 0%', '0% 100%']
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'linear'
    }}
  />
  <span className="relative z-10 flex items-center gap-2">
    <LinkIcon className="w-5 h-5" />
    {t("import")}
  </span>
</Button>
```

---

## Вариант 5: Пульсирующая ссылка (Pulsing Link)
**Тематика:** Активная ссылка, готовность к импорту
**Эффект:** Иконка ссылки пульсирует с эффектом свечения

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden flex items-center justify-center gap-2"
  onClick={handleImport}
  disabled={!url}
  style={{
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
    animation: 'pulseLink 2s ease-in-out infinite'
  }}
>
  <style>{`
    @keyframes pulseLink {
      0%, 100% {
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
      }
      50% {
        box-shadow: 0 0 30px rgba(139, 92, 246, 0.7), 0 0 40px rgba(139, 92, 246, 0.5);
      }
    }
  `}</style>
  <motion.div
    animate={{
      scale: [1, 1.15, 1]
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
  >
    <LinkIcon className="w-5 h-5" />
  </motion.div>
  <span>{t("import")}</span>
</Button>
```

---

## Вариант 6: Синхронизация (Sync Animation)
**Тематика:** Синхронизация данных, обмен информацией
**Эффект:** Две стрелки вращаются в противоположных направлениях

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden flex items-center justify-center gap-2"
  onClick={handleImport}
  disabled={!url}
>
  <motion.div
    className="relative"
    animate={{
      rotate: 360
    }}
    transition={{
      duration: 3,
      repeat: Infinity,
      ease: 'linear'
    }}
  >
    <LinkIcon className="w-5 h-5" />
  </motion.div>
  <motion.span
    animate={{
      opacity: [1, 0.8, 1]
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
  >
    {t("import")}
  </motion.span>
</Button>
```

---

## Вариант 7: Загрузка с прогрессом (Loading Progress)
**Тематика:** Процесс загрузки, прогресс импорта
**Эффект:** Полоса прогресса движется слева направо

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden"
  onClick={handleImport}
  disabled={!url}
>
  <motion.div
    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
    style={{
      width: '100%',
      backgroundSize: '200% 100%'
    }}
    animate={{
      backgroundPosition: ['0% 0%', '100% 0%']
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'linear'
    }}
  />
  <span className="relative z-10 flex items-center gap-2">
    <LinkIcon className="w-5 h-5" />
    {t("import")}
  </span>
</Button>
```

---

## Вариант 8: Соединение точек (Connecting Dots)
**Тематика:** Связь, соединение, сеть
**Эффект:** Точки появляются и соединяются линиями

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden flex items-center justify-center gap-2"
  onClick={handleImport}
  disabled={!url}
>
  <div className="relative w-5 h-5">
    <motion.div
      className="absolute top-0 left-0 w-1.5 h-1.5 bg-purple-500 rounded-full"
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0.5, 1, 0.5]
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: 0
      }}
    />
    <motion.div
      className="absolute top-0 right-0 w-1.5 h-1.5 bg-purple-500 rounded-full"
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0.5, 1, 0.5]
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: 0.5
      }}
    />
    <motion.div
      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-purple-500 rounded-full"
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0.5, 1, 0.5]
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: 1
      }}
    />
    <LinkIcon className="w-5 h-5 absolute inset-0" />
  </div>
  <span>{t("import")}</span>
</Button>
```

---

## Вариант 9: Двойная стрелка (Double Arrow Import)
**Тематика:** Импорт в обе стороны, обмен данными
**Эффект:** Две стрелки движутся навстречу друг другу

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden flex items-center justify-center gap-2"
  onClick={handleImport}
  disabled={!url}
>
  <motion.div
    className="flex items-center gap-1"
    animate={{
      x: [0, 3, 0]
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
  >
    <LinkIcon className="w-5 h-5" />
  </motion.div>
  <span>{t("import")}</span>
  <motion.div
    className="flex items-center gap-1"
    animate={{
      x: [0, -3, 0]
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
  >
    <LinkIcon className="w-5 h-5 rotate-180" />
  </motion.div>
</Button>
```

---

## Вариант 10: Комбинированный (Link + Data Flow)
**Тематика:** Полный процесс импорта
**Эффект:** Иконка ссылки + волны данных + пульсация

```tsx
<Button 
  variant="secondary" 
  size="lg" 
  className="w-full h-14 text-base font-medium relative overflow-hidden flex items-center justify-center gap-2"
  onClick={handleImport}
  disabled={!url}
  style={{
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
    animation: 'pulseLink 2s ease-in-out infinite'
  }}
>
  <style>{`
    @keyframes pulseLink {
      0%, 100% {
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
      }
      50% {
        box-shadow: 0 0 30px rgba(139, 92, 246, 0.7), 0 0 40px rgba(139, 92, 246, 0.5);
      }
    }
  `}</style>
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
    animate={{
      scale: [1, 1.1, 1],
      rotate: [0, 5, -5, 0]
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
  >
    <LinkIcon className="w-5 h-5 relative z-10" />
  </motion.div>
  <span className="relative z-10">{t("import")}</span>
</Button>
```

---

## Рекомендации по выбору:

- **Вариант 1** - Классический, понятный (стрелка вниз = загрузка)
- **Вариант 2** - Визуально привлекательный (волны данных)
- **Вариант 5** - Заметный, но не отвлекающий (пульсирующая ссылка)
- **Вариант 7** - Показывает процесс (прогресс загрузки)
- **Вариант 10** - Самый выразительный (комбинация эффектов)

Выберите вариант, и я применю его к кнопке импорта!

