import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "ru" | "de" | "pl";

interface Translations {
  [key: string]: {
    [key: string]: string;
  };
}

const translations: Translations = {
  en: {
    // Navigation
    home: "Home",
    studio: "Studio",
    docs: "Documentation",
    login: "Login",
    signup: "Sign Up",
    logout: "Logout",
    profile: "Profile",
    
    // Home page
    heroTitle: "Turn Competitor Ads Into Your Winners",
    heroSubtitle: "Import proven ads, overlay your product, generate variants. Skip the guesswork, launch what works.",
    getStarted: "Get Started",
    howItWorks: "How It Works",
    step1Title: "Import Competitor Ads",
    step1Desc: "Paste Facebook Ad Library URLs to scrape successful campaigns",
    step2Title: "Upload Your Product",
    step2Desc: "Drop in your product images to replace competitor items",
    step3Title: "Generate Variants",
    step3Desc: "AI creates multiple ad variations instantly",
    whyDifferent: "Why Different",
    whyDifferentDesc: "Most tools start from scratch. We start from what already converts.",
    traditionalTools: "Traditional Tools",
    copyAdd: "COPY ADD",
    traditional1: "Start with blank canvas",
    traditional2: "Guess what works",
    traditional3: "Test everything",
    copyAdd1: "Start with proven ads",
    copyAdd2: "Know what converts",
    copyAdd3: "Iterate winners",
    
    // Auth
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    demoLogin: "Demo Login",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    signupSuccess: "Check your email for verification code",
    loginSuccess: "Successfully logged in",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 6 characters",
    invalidEmail: "Please enter a valid email",
    
    // Verify Email
    verifyEmail: "Verify Email",
    verifyDescription: "Enter the 6-digit code sent to your email",
    verifyButton: "Verify",
    verifying: "Verifying...",
    verifySuccess: "Email verified successfully",
    verifyError: "Invalid verification code",
    
    // Studio
    importAds: "Import Competitor Ads",
    importDescription: "Paste Facebook Ad Library URLs or profile links",
    urlPlaceholder: "https://facebook.com/ads/library/...",
    chooseHistory: "Choose from history",
    noPreviousImports: "No previous imports",
    analyzingAds: "Analyzing competitor ads...",
    importButton: "Import Ads",
    authRequired: "Authentication Required",
    authRequiredDesc: "Please log in to access the studio",
    logoutSuccess: "Successfully logged out",
    
    // Profile
    balance: "Balance",
    username: "Username",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm New Password",
    saveChanges: "Save Changes",
    changeAvatar: "Change Avatar",
    referralCode: "Your Referral Code",
    referralDesc: "Share this code for 25% discount",
    copyCode: "Copy Code",
    codeCopied: "Code copied!",
    settings: "Settings",
    editProfile: "Edit Profile",
    usernameExists: "Username already taken",
    usernameUpdated: "Username updated successfully",
    passwordUpdated: "Password updated successfully",
    avatarUpdated: "Avatar updated successfully",
    
    // Footer
    privacy: "Privacy",
    terms: "Terms",
    
    // Settings
    language: "Language",
    theme: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    systemTheme: "System",
  },
  ru: {
    // Navigation
    home: "Главная",
    studio: "Студия",
    docs: "Документация",
    login: "Вход",
    signup: "Регистрация",
    logout: "Выход",
    profile: "Профиль",
    
    // Home page
    heroTitle: "Превратите рекламу конкурентов в ваши победы",
    heroSubtitle: "Импортируйте проверенную рекламу, добавьте свой продукт, создайте варианты. Пропустите догадки, запустите то, что работает.",
    getStarted: "Начать",
    howItWorks: "Как это работает",
    step1Title: "Импорт рекламы конкурентов",
    step1Desc: "Вставьте URL из библиотеки рекламы Facebook для сбора успешных кампаний",
    step2Title: "Загрузите свой продукт",
    step2Desc: "Добавьте изображения вашего продукта, чтобы заменить товары конкурентов",
    step3Title: "Создание вариантов",
    step3Desc: "ИИ мгновенно создает множество вариантов рекламы",
    whyDifferent: "Почему отличается",
    whyDifferentDesc: "Большинство инструментов начинают с нуля. Мы начинаем с того, что уже конвертирует.",
    traditionalTools: "Традиционные инструменты",
    copyAdd: "COPY ADD",
    traditional1: "Начать с чистого листа",
    traditional2: "Угадать, что работает",
    traditional3: "Тестировать все",
    copyAdd1: "Начать с проверенной рекламы",
    copyAdd2: "Знать, что конвертирует",
    copyAdd3: "Улучшать победителей",
    
    // Auth
    email: "Электронная почта",
    password: "Пароль",
    confirmPassword: "Подтвердите пароль",
    demoLogin: "Демо вход",
    noAccount: "Нет аккаунта?",
    haveAccount: "Уже есть аккаунт?",
    signupSuccess: "Проверьте почту для кода подтверждения",
    loginSuccess: "Успешный вход",
    passwordMismatch: "Пароли не совпадают",
    passwordTooShort: "Пароль должен содержать минимум 6 символов",
    invalidEmail: "Введите корректный email",
    
    // Verify Email
    verifyEmail: "Подтверждение Email",
    verifyDescription: "Введите 6-значный код, отправленный на вашу почту",
    verifyButton: "Подтвердить",
    verifying: "Проверка...",
    verifySuccess: "Email успешно подтвержден",
    verifyError: "Неверный код подтверждения",
    
    // Studio
    importAds: "Импорт рекламы конкурентов",
    importDescription: "Вставьте URL библиотеки рекламы Facebook или ссылки на профили",
    urlPlaceholder: "https://facebook.com/ads/library/...",
    chooseHistory: "Выбрать из истории",
    noPreviousImports: "Нет предыдущих импортов",
    analyzingAds: "Анализ рекламы конкурентов...",
    importButton: "Импортировать",
    authRequired: "Требуется авторизация",
    authRequiredDesc: "Пожалуйста, войдите в систему для доступа к студии",
    logoutSuccess: "Выход выполнен",
    
    // Profile
    balance: "Баланс",
    username: "Имя пользователя",
    changePassword: "Сменить пароль",
    currentPassword: "Текущий пароль",
    newPassword: "Новый пароль",
    confirmNewPassword: "Подтвердите новый пароль",
    saveChanges: "Сохранить изменения",
    changeAvatar: "Изменить аватар",
    referralCode: "Ваш реферальный код",
    referralDesc: "Поделитесь этим кодом для скидки 25%",
    copyCode: "Копировать код",
    codeCopied: "Код скопирован!",
    settings: "Настройки",
    editProfile: "Редактировать профиль",
    usernameExists: "Имя пользователя уже занято",
    usernameUpdated: "Имя пользователя обновлено",
    passwordUpdated: "Пароль успешно изменен",
    avatarUpdated: "Аватар обновлен",
    
    // Footer
    privacy: "Конфиденциальность",
    terms: "Условия",
    
    // Settings
    language: "Язык",
    theme: "Тема",
    lightTheme: "Светлая",
    darkTheme: "Темная",
    systemTheme: "Системная",
  },
  de: {
    // Navigation
    home: "Startseite",
    studio: "Studio",
    docs: "Dokumentation",
    login: "Anmelden",
    signup: "Registrieren",
    logout: "Abmelden",
    profile: "Profil",
    
    // Home page
    heroTitle: "Verwandeln Sie Konkurrenzanzeigen in Ihre Gewinner",
    heroSubtitle: "Importieren Sie bewährte Anzeigen, überlagern Sie Ihr Produkt, generieren Sie Varianten. Überspringen Sie das Rätselraten, starten Sie was funktioniert.",
    getStarted: "Loslegen",
    howItWorks: "Wie es funktioniert",
    step1Title: "Konkurrenzanzeigen importieren",
    step1Desc: "Fügen Sie Facebook Ad Library URLs ein, um erfolgreiche Kampagnen zu scrapen",
    step2Title: "Laden Sie Ihr Produkt hoch",
    step2Desc: "Fügen Sie Ihre Produktbilder ein, um Konkurrenzartikel zu ersetzen",
    step3Title: "Varianten generieren",
    step3Desc: "KI erstellt sofort mehrere Anzeigenvarianten",
    whyDifferent: "Warum anders",
    whyDifferentDesc: "Die meisten Tools beginnen bei Null. Wir beginnen mit dem, was bereits konvertiert.",
    traditionalTools: "Traditionelle Tools",
    copyAdd: "COPY ADD",
    traditional1: "Mit leerer Leinwand beginnen",
    traditional2: "Raten, was funktioniert",
    traditional3: "Alles testen",
    copyAdd1: "Mit bewährten Anzeigen beginnen",
    copyAdd2: "Wissen, was konvertiert",
    copyAdd3: "Gewinner iterieren",
    
    // Auth
    email: "E-Mail",
    password: "Passwort",
    confirmPassword: "Passwort bestätigen",
    demoLogin: "Demo-Anmeldung",
    noAccount: "Noch kein Konto?",
    haveAccount: "Bereits ein Konto?",
    signupSuccess: "Überprüfen Sie Ihre E-Mail für den Bestätigungscode",
    loginSuccess: "Erfolgreich angemeldet",
    passwordMismatch: "Passwörter stimmen nicht überein",
    passwordTooShort: "Passwort muss mindestens 6 Zeichen lang sein",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail ein",
    
    // Verify Email
    verifyEmail: "E-Mail bestätigen",
    verifyDescription: "Geben Sie den 6-stelligen Code ein, der an Ihre E-Mail gesendet wurde",
    verifyButton: "Bestätigen",
    verifying: "Überprüfung läuft...",
    verifySuccess: "E-Mail erfolgreich bestätigt",
    verifyError: "Ungültiger Bestätigungscode",
    
    // Studio
    importAds: "Konkurrenzanzeigen importieren",
    importDescription: "Facebook Ad Library URLs oder Profillinks einfügen",
    urlPlaceholder: "https://facebook.com/ads/library/...",
    chooseHistory: "Aus Historie wählen",
    noPreviousImports: "Keine vorherigen Importe",
    analyzingAds: "Konkurrenzanzeigen werden analysiert...",
    importButton: "Importieren",
    authRequired: "Authentifizierung erforderlich",
    authRequiredDesc: "Bitte melden Sie sich an, um auf das Studio zuzugreifen",
    logoutSuccess: "Erfolgreich abgemeldet",
    
    // Profile
    balance: "Guthaben",
    username: "Benutzername",
    changePassword: "Passwort ändern",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    confirmNewPassword: "Neues Passwort bestätigen",
    saveChanges: "Änderungen speichern",
    changeAvatar: "Avatar ändern",
    referralCode: "Ihr Empfehlungscode",
    referralDesc: "Teilen Sie diesen Code für 25% Rabatt",
    copyCode: "Code kopieren",
    codeCopied: "Code kopiert!",
    settings: "Einstellungen",
    editProfile: "Profil bearbeiten",
    usernameExists: "Benutzername bereits vergeben",
    usernameUpdated: "Benutzername aktualisiert",
    passwordUpdated: "Passwort erfolgreich geändert",
    avatarUpdated: "Avatar aktualisiert",
    
    // Footer
    privacy: "Datenschutz",
    terms: "Bedingungen",
    
    // Settings
    language: "Sprache",
    theme: "Thema",
    lightTheme: "Hell",
    darkTheme: "Dunkel",
    systemTheme: "System",
  },
  pl: {
    // Navigation
    home: "Strona główna",
    studio: "Studio",
    docs: "Dokumentacja",
    login: "Zaloguj się",
    signup: "Zarejestruj się",
    logout: "Wyloguj",
    profile: "Profil",
    
    // Home page
    heroTitle: "Zamień reklamy konkurencji w swoje zwycięstwa",
    heroSubtitle: "Importuj sprawdzone reklamy, nałóż swój produkt, generuj warianty. Pomiń zgadywanie, uruchom to, co działa.",
    getStarted: "Rozpocznij",
    howItWorks: "Jak to działa",
    step1Title: "Importuj reklamy konkurencji",
    step1Desc: "Wklej URL-e z biblioteki reklam Facebook, aby zebrać udane kampanie",
    step2Title: "Prześlij swój produkt",
    step2Desc: "Dodaj zdjęcia swojego produktu, aby zastąpić artykuły konkurencji",
    step3Title: "Generuj warianty",
    step3Desc: "AI natychmiast tworzy wiele wariantów reklam",
    whyDifferent: "Dlaczego inaczej",
    whyDifferentDesc: "Większość narzędzi zaczyna od zera. My zaczynamy od tego, co już konwertuje.",
    traditionalTools: "Tradycyjne narzędzia",
    copyAdd: "COPY ADD",
    traditional1: "Zacznij od pustego płótna",
    traditional2: "Zgaduj, co działa",
    traditional3: "Testuj wszystko",
    copyAdd1: "Zacznij od sprawdzonych reklam",
    copyAdd2: "Wiedz, co konwertuje",
    copyAdd3: "Iteruj zwycięzców",
    
    // Auth
    email: "E-mail",
    password: "Hasło",
    confirmPassword: "Potwierdź hasło",
    demoLogin: "Demo logowanie",
    noAccount: "Nie masz konta?",
    haveAccount: "Masz już konto?",
    signupSuccess: "Sprawdź swoją pocztę e-mail dla kodu weryfikacyjnego",
    loginSuccess: "Pomyślnie zalogowano",
    passwordMismatch: "Hasła nie pasują do siebie",
    passwordTooShort: "Hasło musi mieć co najmniej 6 znaków",
    invalidEmail: "Proszę wprowadzić poprawny e-mail",
    
    // Verify Email
    verifyEmail: "Zweryfikuj e-mail",
    verifyDescription: "Wprowadź 6-cyfrowy kod wysłany na Twój e-mail",
    verifyButton: "Zweryfikuj",
    verifying: "Weryfikacja...",
    verifySuccess: "E-mail pomyślnie zweryfikowany",
    verifyError: "Nieprawidłowy kod weryfikacyjny",
    
    // Studio
    importAds: "Importuj reklamy konkurencji",
    importDescription: "Wklej URL-e biblioteki reklam Facebook lub linki do profili",
    urlPlaceholder: "https://facebook.com/ads/library/...",
    chooseHistory: "Wybierz z historii",
    noPreviousImports: "Brak poprzednich importów",
    analyzingAds: "Analiza reklam konkurencji...",
    importButton: "Importuj",
    authRequired: "Wymagana autoryzacja",
    authRequiredDesc: "Proszę się zalogować, aby uzyskać dostęp do studia",
    logoutSuccess: "Pomyślnie wylogowano",
    
    // Profile
    balance: "Saldo",
    username: "Nazwa użytkownika",
    changePassword: "Zmień hasło",
    currentPassword: "Obecne hasło",
    newPassword: "Nowe hasło",
    confirmNewPassword: "Potwierdź nowe hasło",
    saveChanges: "Zapisz zmiany",
    changeAvatar: "Zmień awatar",
    referralCode: "Twój kod polecający",
    referralDesc: "Udostępnij ten kod dla zniżki 25%",
    copyCode: "Kopiuj kod",
    codeCopied: "Kod skopiowany!",
    settings: "Ustawienia",
    editProfile: "Edytuj profil",
    usernameExists: "Nazwa użytkownika już zajęta",
    usernameUpdated: "Nazwa użytkownika zaktualizowana",
    passwordUpdated: "Hasło pomyślnie zmienione",
    avatarUpdated: "Awatar zaktualizowany",
    
    // Footer
    privacy: "Prywatność",
    terms: "Warunki",
    
    // Settings
    language: "Język",
    theme: "Motyw",
    lightTheme: "Jasny",
    darkTheme: "Ciemny",
    systemTheme: "Systemowy",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    return (saved as Language) || "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
