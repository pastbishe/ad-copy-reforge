import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, LogOut, ChevronLeft, ChevronRight, Plus, X, Menu, User, Sun, Moon, Monitor } from "lucide-react";
import { SnakeGame } from "@/components/SnakeGame";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import demoAd1 from "@/assets/demo-ad-1.jpg";
import demoAd2 from "@/assets/demo-ad-2.jpg";
import demoAd3 from "@/assets/demo-ad-3.svg";
import demoAd4 from "@/assets/demo-ad-4.svg";
import demoAd5 from "@/assets/demo-ad-5.svg";
import demoAd6 from "@/assets/demo-ad-6.svg";
import demoAd7 from "@/assets/demo-ad-7.svg";
import demoAd8 from "@/assets/demo-ad-8.svg";
import demoAd9 from "@/assets/demo-ad-9.svg";
import demoAd10 from "@/assets/demo-ad-10.svg";

type StudioState = "empty" | "loading" | "active";

interface Ad {
  id: number;
  image: string;
  title: string;
  brand: string;
  date: string;
  format: string;
  selected: boolean;
  individualPrompt?: string;
  settings?: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
}

const initialAds: Ad[] = [
  { id: 1, image: demoAd1, title: "Smartwatch Ad", brand: "TechBrand", date: "2024-09-15", format: "1080x1080", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 2, image: demoAd2, title: "Headphones Ad", brand: "AudioCo", date: "2024-09-20", format: "1200x628", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 3, image: demoAd3, title: "Fashion Ad", brand: "StyleCo", date: "2024-09-22", format: "1080x1080", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 4, image: demoAd4, title: "Tech Gadget", brand: "InnovateTech", date: "2024-09-23", format: "1200x628", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 5, image: demoAd5, title: "Fitness Gear", brand: "FitLife", date: "2024-09-24", format: "1080x1080", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 6, image: demoAd6, title: "Home Decor", brand: "HomePlus", date: "2024-09-25", format: "1200x628", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 7, image: demoAd7, title: "Beauty Product", brand: "BeautyBox", date: "2024-09-26", format: "1080x1080", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 8, image: demoAd8, title: "Gaming Setup", brand: "GameZone", date: "2024-09-27", format: "1200x628", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 9, image: demoAd9, title: "Food & Drink", brand: "TastyCo", date: "2024-09-28", format: "1080x1080", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } },
  { id: 10, image: demoAd10, title: "Travel Gear", brand: "AdventureX", date: "2024-09-29", format: "1200x628", selected: false, individualPrompt: "", settings: { brightness: 100, contrast: 100, saturation: 100 } }
];

const Studio = () => {
  const [url, setUrl] = useState("");
  const [studioState, setStudioState] = useState<StudioState>("empty");
  const [progress, setProgress] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);
  const [uploadedProducts, setUploadedProducts] = useState<File[]>([]);
  const [promptText, setPromptText] = useState("");
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [showIndividualPrompt, setShowIndividualPrompt] = useState(false);
  const [snakeEnabled, setSnakeEnabled] = useState(() => {
    const saved = localStorage.getItem("snake_enabled");
    return saved === null ? true : saved === "true";
  });
  const [ads, setAds] = useState<Ad[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const toggleSnake = (checked: boolean) => {
    setSnakeEnabled(checked);
    localStorage.setItem("snake_enabled", String(checked));
    window.location.reload();
  };

  // Загрузка из localStorage
  useEffect(() => {
    if (studioState === "active") {
      const savedGeneralPrompt = localStorage.getItem("studio_general_prompt");
      const savedAdsData = localStorage.getItem("studio_ads_data");
      
      if (savedGeneralPrompt) {
        setPromptText(savedGeneralPrompt);
      }
      
      if (savedAdsData) {
        try {
          const parsedAds = JSON.parse(savedAdsData);
          if (Array.isArray(parsedAds) && parsedAds.length > 0) {
            setAds(parsedAds);
          } else if (ads.length === 0) {
            setAds(initialAds);
          }
        } catch (e) {
          console.error("Failed to load saved ads data");
          if (ads.length === 0) {
            setAds(initialAds);
          }
        }
      } else if (ads.length === 0) {
        setAds(initialAds);
      }
    }
  }, [studioState]);

  // Сохранение общего промпта
  useEffect(() => {
    if (studioState === "active") {
      localStorage.setItem("studio_general_prompt", promptText);
    }
  }, [promptText, studioState]);

  // Сохранение данных ads
  useEffect(() => {
    if (studioState === "active" && ads.length > 0) {
      localStorage.setItem("studio_ads_data", JSON.stringify(ads));
    }
  }, [ads, studioState]);

  const updateIndividualPrompt = (adId: number, prompt: string) => {
    setAds(prev => prev.map(ad => 
      ad.id === adId ? { ...ad, individualPrompt: prompt } : ad
    ));
  };

  const updateAdSettings = (adId: number, setting: keyof NonNullable<Ad['settings']>, value: number) => {
    setAds(prev => prev.map(ad => 
      ad.id === adId ? { 
        ...ad, 
        settings: { ...ad.settings!, [setting]: value } 
      } : ad
    ));
  };

  const toggleAdSelection = (id: number) => {
    setAds(prev => {
      const newAds = prev.map(ad => 
        ad.id === id ? { ...ad, selected: !ad.selected } : ad
      );
      
      const clickedAd = newAds.find(ad => ad.id === id);
      const newSelectedCount = newAds.filter(ad => ad.selected).length;
      
      if (newSelectedCount === 0) {
        setCurrentAdIndex(0);
      } else if (selectedCount > 0 && clickedAd && !clickedAd.selected) {
        const currentDisplayedAd = displayedAds[currentAdIndex];
        const selectedAds = newAds.filter(ad => ad.selected);
        
        if (currentDisplayedAd && currentDisplayedAd.id === id) {
          setCurrentAdIndex(0);
        } else if (currentDisplayedAd) {
          const newIndex = selectedAds.findIndex(ad => ad.id === currentDisplayedAd.id);
          if (newIndex !== -1) {
            setCurrentAdIndex(newIndex);
          } else {
            setCurrentAdIndex(0);
          }
        }
      }
      
      return newAds;
    });
  };

  const toggleSelectAll = () => {
    const allSelected = ads.every(ad => ad.selected);
    setAds(prev => prev.map(ad => ({ ...ad, selected: !allSelected })));
    if (allSelected) {
      setCurrentAdIndex(0);
    }
  };

  const selectedCount = ads.filter(ad => ad.selected).length;
  const displayedAds = selectedCount > 0 ? ads.filter(ad => ad.selected) : ads;
  
  useEffect(() => {
    if (currentAdIndex >= displayedAds.length && displayedAds.length > 0) {
      setCurrentAdIndex(displayedAds.length - 1);
    }
  }, [currentAdIndex, displayedAds.length]);

  useEffect(() => {
    const checkAuth = async () => {
      const isDemoUser = localStorage.getItem("demo_user") === "true";
      
      if (isDemoUser) {
        setIsCheckingAuth(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: t("authRequired"),
          description: t("authRequiredDesc"),
          variant: "destructive",
        });
        navigate("/login");
        return;
      }
      
      setIsCheckingAuth(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !localStorage.getItem("demo_user")) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast, t]);

  useEffect(() => {
    if (studioState !== "active") return;

    const displayedLength = selectedCount > 0 ? ads.filter(ad => ad.selected).length : ads.length;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentAdIndex > 0) {
        setCurrentAdIndex(prev => prev - 1);
      } else if (e.key === "ArrowRight" && currentAdIndex < displayedLength - 1) {
        setCurrentAdIndex(prev => prev + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [studioState, currentAdIndex, ads, selectedCount]);

  const handleImport = () => {
    if (!url) return;
    
    setStudioState("loading");
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 5;
      });
    }, 250);

    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        // Сброс всех промптов и настроек при импорте новых фотографий
        localStorage.removeItem("studio_general_prompt");
        localStorage.removeItem("studio_ads_data");
        setPromptText("");
        
        setStudioState("active");
        setAds(initialAds);
        toast({
          title: t("adsImported"),
          description: `${t("successfullyScraped")} ${initialAds.length} ${t("competitorAdsCount")}`,
        });
      }, 500);
    }, 5000);
  };

  const handleLogout = async () => {
    localStorage.removeItem("demo_user");
    await supabase.auth.signOut();
    toast({
      title: t("loggedOut"),
      description: t("loggedOutDesc"),
    });
    navigate("/");
  };

  const onDrop = (acceptedFiles: File[]) => {
    setUploadedProducts(prev => [...prev, ...acceptedFiles]);
    toast({
      title: t("uploadComplete"),
      description: `${acceptedFiles.length} ${t("productsAdded")}`,
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    }
  });

  const removeProduct = (index: number) => {
    setUploadedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    toast({
      title: t("generatingVariants"),
      description: t("aiCreatingVariations"),
    });
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (studioState === "empty") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md text-center"
          >
            <h1 className="text-4xl font-bold mb-8 text-foreground">
              {t("importAds")}
            </h1>
            
            <Input
              type="url"
              placeholder="https://facebook.com/ads/library/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-14 text-base mb-6 bg-card border-border text-foreground placeholder:text-muted-foreground"
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">{t("or")}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Select>
              <SelectTrigger className="h-12 mb-6 bg-card border-border text-foreground">
                <SelectValue placeholder={t("chooseFromHistory")} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="none" className="text-foreground">{t("noPreviousImports")}</SelectItem>
              </SelectContent>
            </Select>

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
        </main>
      </div>
    );
  }

  if (studioState === "loading") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mb-8"
            >
              <Loader2 className="w-16 h-16 mx-auto animate-spin text-foreground" />
            </motion.div>
            
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t("scrapingCompetitorAds")}
            </h2>
            
            <div className="w-full max-w-md mx-auto mb-3">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </motion.div>
        </main>
      </div>
    );
  }

  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="w-4 h-4" />;
    if (theme === "dark") return <Moon className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header style={{ height: "clamp(3.5rem, 5vh, 4rem)" }} className="bg-card border-b border-border flex items-center justify-between px-[clamp(1rem,3vw,1.5rem)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <AnimatedLogo />
          <SnakeGame />
        </div>
        
        <div className="flex items-center gap-[clamp(0.5rem,1vw,0.75rem)]">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger style={{ width: "clamp(7rem, 10vw, 8.125rem)" }} className="bg-secondary border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[100]" position="popper" sideOffset={5}>
              <SelectItem value="en" className="text-foreground hover:bg-accent">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇬🇧</span>
                  <span>English</span>
                </div>
              </SelectItem>
              <SelectItem value="ru" className="text-foreground hover:bg-accent">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇷🇺</span>
                  <span>Русский</span>
                </div>
              </SelectItem>
              <SelectItem value="de" className="text-foreground hover:bg-accent">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇩🇪</span>
                  <span>Deutsch</span>
                </div>
              </SelectItem>
              <SelectItem value="pl" className="text-foreground hover:bg-accent">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇵🇱</span>
                  <span>Polski</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger style={{ width: "clamp(6.5rem, 9vw, 7.5rem)" }} className="bg-secondary border-border text-foreground">
              <div className="flex items-center gap-2">
                {getThemeIcon()}
                <span className="capitalize">{theme}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[100]" position="popper" sideOffset={5}>
              <SelectItem value="light" className="text-foreground hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  {t("light")}
                </div>
              </SelectItem>
              <SelectItem value="dark" className="text-foreground hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  {t("dark")}
                </div>
              </SelectItem>
              <SelectItem value="system" className="text-foreground hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  {t("system")}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 bg-secondary px-3 py-2 rounded-md border border-border hidden md:flex">
            <Checkbox 
              id="snake-toggle" 
              checked={snakeEnabled}
              onCheckedChange={toggleSnake}
            />
            <label 
              htmlFor="snake-toggle" 
              className="text-sm text-foreground cursor-pointer select-none"
              style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }}
              title={t("enableSnake")}
            >
              🐍
            </label>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-foreground hover:bg-accent"
            style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)", padding: "clamp(0.375rem, 0.8vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)" }}
          >
            <LogOut style={{ width: "clamp(1rem, 1.2vw, 1.25rem)", height: "clamp(1rem, 1.2vw, 1.25rem)" }} className="mr-2" />
            {t("logout")}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-foreground hover:bg-accent"
            style={{ width: "clamp(2.25rem, 3vw, 2.5rem)", height: "clamp(2.25rem, 3vw, 2.5rem)" }}
          >
            <User style={{ width: "clamp(1.125rem, 1.5vw, 1.25rem)", height: "clamp(1.125rem, 1.5vw, 1.25rem)" }} />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        <motion.div
          initial={false}
          animate={{ width: isLeftPanelOpen ? "clamp(15rem, 20vw, 17.5rem)" : "clamp(2.5rem, 3vw, 2.75rem)" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          onMouseEnter={() => setIsLeftPanelOpen(true)}
          onMouseLeave={() => setIsLeftPanelOpen(false)}
          className="bg-card border-r border-border overflow-hidden relative z-10"
        >
          {!isLeftPanelOpen && (
            <div className="h-full flex items-center justify-center">
              <Menu style={{ width: "clamp(1.125rem, 1.5vw, 1.25rem)", height: "clamp(1.125rem, 1.5vw, 1.25rem)" }} className="text-muted-foreground" />
            </div>
          )}
          
          <AnimatePresence>
            {isLeftPanelOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col"
              >
                <div style={{ padding: "clamp(0.75rem, 1.5vw, 1rem)" }} className="flex items-center justify-between">
                  <h3 style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }} className="font-semibold text-foreground">
                    {t("competitorAds")} ({ads.length})
                  </h3>
                </div>
                
                <div 
                  className={`flex items-center gap-2 p-2 mx-[clamp(0.75rem,1.5vw,1rem)] mb-3 bg-accent/30 rounded-lg ${
                    selectedCount > 0 ? "sticky top-0 z-10 shadow-md" : ""
                  }`}
                  style={{ 
                    backgroundColor: selectedCount > 0 ? "hsl(var(--accent))" : "hsl(var(--accent) / 0.3)"
                  }}
                >
                  <Checkbox 
                    id="select-all"
                    checked={ads.length > 0 && ads.every(ad => ad.selected)}
                    onCheckedChange={toggleSelectAll}
                  />
                  <label 
                    htmlFor="select-all" 
                    style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }}
                    className="text-foreground cursor-pointer select-none flex-1"
                  >
                    {t("selectAll")}
                  </label>
                  <span 
                    style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }}
                    className="text-muted-foreground font-medium"
                  >
                    {t("selected")}: {selectedCount}
                  </span>
                </div>
                
                <div style={{ padding: "0 clamp(0.75rem, 1.5vw, 1rem) clamp(0.75rem, 1.5vw, 1rem)" }} className="flex-1 overflow-y-auto">
                
                  <div style={{ gap: "clamp(0.5rem, 1vh, 0.75rem)" }} className="flex flex-col">
                    {ads.map((ad, allAdsIndex) => {
                      const displayedIndex = displayedAds.findIndex(dispAd => dispAd.id === ad.id);
                      const isCurrentlyDisplayed = displayedIndex !== -1 && displayedIndex === currentAdIndex;
                      
                      return (
                        <motion.div
                          key={ad.id}
                          whileHover={{ scale: 1.02 }}
                          style={{ padding: "clamp(0.375rem, 0.8vw, 0.5rem)" }}
                          className={`rounded-lg transition-all duration-300 relative cursor-pointer ${
                            isCurrentlyDisplayed ? "border-2 border-primary bg-accent/50" : "border-2 border-transparent hover:bg-accent/30"
                          }`}
                          onClick={() => {
                            toggleAdSelection(ad.id);
                            if (ad.selected || selectedCount === 0) {
                              const newDisplayedAds = selectedCount === 0 ? ads : ads.filter(a => a.selected || a.id === ad.id);
                              const newIndex = newDisplayedAds.findIndex(a => a.id === ad.id);
                              if (newIndex !== -1) {
                                setCurrentAdIndex(newIndex);
                              }
                            }
                          }}
                        >
                          <img
                            src={ad.image}
                            alt={ad.title}
                            className="w-full aspect-square object-cover rounded mb-2 pointer-events-none"
                          />
                          <p style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }} className="font-medium text-foreground pointer-events-none">{ad.brand}</p>
                          <p style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }} className="text-muted-foreground pointer-events-none">{ad.date}</p>
                          
                          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded p-1 pointer-events-none">
                            <Checkbox 
                              checked={ad.selected}
                              className="pointer-events-none"
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex-1 flex items-center justify-center relative">
          <motion.div 
            style={{ 
              width: "clamp(60%, 75vw, 80%)",
              height: "clamp(70%, 85vh, 90%)"
            }}
            className="relative flex items-center justify-center"
            onMouseEnter={() => setIsHoveringImage(true)}
            onMouseLeave={() => setIsHoveringImage(false)}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div 
              style={{ 
                top: "clamp(0.75rem, 2vh, 1rem)", 
                left: "clamp(0.75rem, 2vw, 1rem)",
                padding: "clamp(0.5rem, 1vw, 0.75rem) clamp(0.75rem, 1.5vw, 1rem)"
              }} 
              className="absolute z-10 bg-background/80 backdrop-blur-sm rounded border border-border"
            >
              <p style={{ fontSize: "clamp(0.875rem, 1.2vw, 1rem)" }} className="font-medium text-foreground">{displayedAds[currentAdIndex]?.brand}</p>
              <p style={{ fontSize: "clamp(0.75rem, 1vw, 0.875rem)" }} className="text-muted-foreground">{displayedAds[currentAdIndex]?.format}</p>
              {selectedCount > 0 && (
                <p style={{ fontSize: "clamp(0.625rem, 0.85vw, 0.75rem)" }} className="text-primary mt-1">
                  {currentAdIndex + 1} / {displayedAds.length}
                </p>
              )}
            </div>

            <AnimatePresence mode="wait">
              {displayedAds[currentAdIndex] && (
                <motion.img
                  key={displayedAds[currentAdIndex].id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  src={displayedAds[currentAdIndex].image}
                  alt={displayedAds[currentAdIndex].title}
                  className="w-full h-full object-contain rounded-lg shadow-2xl"
                  style={{
                    filter: `brightness(${displayedAds[currentAdIndex].settings?.brightness || 100}%) contrast(${displayedAds[currentAdIndex].settings?.contrast || 100}%) saturate(${displayedAds[currentAdIndex].settings?.saturation || 100}%)`
                  }}
                />
              )}
            </AnimatePresence>

            <div 
              className="absolute right-0 top-0 w-[30%] h-full z-20"
              onMouseEnter={() => setIsRightPanelVisible(true)}
              onMouseLeave={() => setIsRightPanelVisible(false)}
            />

            <AnimatePresence>
              {isHoveringImage && currentAdIndex > 0 && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  whileHover={{ scale: 1.1 }}
                  style={{ 
                    left: "clamp(0.75rem, 2vw, 1rem)",
                    width: "clamp(3rem, 4vw, 4rem)",
                    height: "clamp(3rem, 4vw, 4rem)"
                  }}
                  className="absolute top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground shadow-lg transition-all duration-300 border-2 border-border hover:bg-accent z-30"
                  onClick={() => setCurrentAdIndex(prev => prev - 1)}
                >
                  <ChevronLeft style={{ width: "clamp(1.5rem, 2vw, 2rem)", height: "clamp(1.5rem, 2vw, 2rem)" }} />
                </motion.button>
              )}

              {isHoveringImage && currentAdIndex < displayedAds.length - 1 && (
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  whileHover={{ scale: 1.1 }}
                  style={{ 
                    right: "clamp(0.75rem, 2vw, 1rem)",
                    width: "clamp(3rem, 4vw, 4rem)",
                    height: "clamp(3rem, 4vw, 4rem)"
                  }}
                  className="absolute top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground shadow-lg transition-all duration-300 border-2 border-border hover:bg-accent z-30"
                  onClick={() => setCurrentAdIndex(prev => prev + 1)}
                >
                  <ChevronRight style={{ width: "clamp(1.5rem, 2vw, 2rem)", height: "clamp(1.5rem, 2vw, 2rem)" }} />
                </motion.button>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowIndividualPrompt(!showIndividualPrompt)}
              style={{
                bottom: "clamp(1rem, 2vh, 1.5rem)",
                left: "clamp(1rem, 2vw, 1.5rem)"
              }}
              className={`absolute bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg z-40 transition-all ${
                showIndividualPrompt ? "ring-4 ring-primary/30" : ""
              }`}
              title="Промпт и настройки для этой фотографии"
            >
              <div style={{ padding: "clamp(0.75rem, 1.5vw, 1rem)" }} className="flex items-center gap-2">
                <span style={{ fontSize: "clamp(1.25rem, 2vw, 1.5rem)" }}>🎨</span>
              </div>
            </motion.button>

            <AnimatePresence>
              {showIndividualPrompt && displayedAds[currentAdIndex] && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{
                    bottom: "clamp(1rem, 2vh, 1.5rem)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "clamp(400px, 60vw, 700px)",
                    maxHeight: "60vh"
                  }}
                  className="absolute bg-card/98 backdrop-blur-xl border-2 border-primary/30 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-border bg-primary/5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <span className="text-2xl">🎨</span>
                        <span>Редактор фотографии</span>
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowIndividualPrompt(false)}
                        className="hover:bg-accent"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {displayedAds[currentAdIndex].brand} • {displayedAds[currentAdIndex].format}
                    </p>
                  </div>

                  <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(60vh - 80px)" }}>
                    <div className="mb-4">
                      <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
                        <span>✍️</span>
                        Промпт для этой фотографии
                      </label>
                      <textarea
                        placeholder="Опишите изменения для этой фотографии..."
                        value={displayedAds[currentAdIndex].individualPrompt || ""}
                        onChange={(e) => updateIndividualPrompt(displayedAds[currentAdIndex].id, e.target.value)}
                        className="w-full min-h-[100px] p-3 bg-background border-2 border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none text-sm"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">
                          {(displayedAds[currentAdIndex].individualPrompt || "").length} символов
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateIndividualPrompt(displayedAds[currentAdIndex].id, "")}
                          className="text-xs h-7"
                        >
                          Очистить
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                        <span>⚙️</span>
                        Настройки изображения
                      </h5>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-sm text-muted-foreground">☀️ Яркость</label>
                          <span className="text-sm font-medium text-foreground">
                            {displayedAds[currentAdIndex].settings?.brightness || 100}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          value={displayedAds[currentAdIndex].settings?.brightness || 100}
                          onChange={(e) => updateAdSettings(displayedAds[currentAdIndex].id, 'brightness', Number(e.target.value))}
                          className="w-full h-2 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-sm text-muted-foreground">◐ Контраст</label>
                          <span className="text-sm font-medium text-foreground">
                            {displayedAds[currentAdIndex].settings?.contrast || 100}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          value={displayedAds[currentAdIndex].settings?.contrast || 100}
                          onChange={(e) => updateAdSettings(displayedAds[currentAdIndex].id, 'contrast', Number(e.target.value))}
                          className="w-full h-2 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-sm text-muted-foreground">🎨 Насыщенность</label>
                          <span className="text-sm font-medium text-foreground">
                            {displayedAds[currentAdIndex].settings?.saturation || 100}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={displayedAds[currentAdIndex].settings?.saturation || 100}
                          onChange={(e) => updateAdSettings(displayedAds[currentAdIndex].id, 'saturation', Number(e.target.value))}
                          className="w-full h-2 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateAdSettings(displayedAds[currentAdIndex].id, 'brightness', 100);
                          updateAdSettings(displayedAds[currentAdIndex].id, 'contrast', 100);
                          updateAdSettings(displayedAds[currentAdIndex].id, 'saturation', 100);
                        }}
                        className="w-full mt-4"
                      >
                        🔄 Сбросить настройки
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isRightPanelVisible && (
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 50, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  onMouseEnter={() => setIsRightPanelVisible(true)}
                  onMouseLeave={() => setIsRightPanelVisible(false)}
                  style={{ 
                    width: "clamp(5rem, 12vw, 9rem)",
                    height: "clamp(5rem, 12vw, 9rem)",
                    right: "clamp(0.5rem, 1.5vw, 1rem)",
                    top: "clamp(0.5rem, 1.5vh, 1rem)",
                    padding: "clamp(0.4rem, 0.8vw, 0.6rem)"
                  }}
                  className="absolute bg-card/95 border-2 border-border flex flex-col backdrop-blur-sm shadow-2xl rounded-xl overflow-hidden z-40"
                >
                  {uploadedProducts.length === 0 ? (
                    <div
                      {...getRootProps()}
                      className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                        isDragActive 
                          ? "border-primary bg-accent/20" 
                          : "border-border hover:border-primary/50 hover:bg-accent/10"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <Plus 
                        style={{ 
                          width: "clamp(1.5rem, 4vw, 2rem)", 
                          height: "clamp(1.5rem, 4vw, 2rem)" 
                        }}
                        className="text-muted-foreground opacity-60 group-hover:scale-110 group-hover:opacity-90 transition-all"
                      />
                      <p style={{ fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)" }} className="text-muted-foreground text-center mt-1 font-medium px-1">
                        {isDragActive ? t("dropHere") : t("addProduct")}
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-1">
                      <div className="w-full aspect-square relative">
                        <img
                          src={URL.createObjectURL(uploadedProducts[0])}
                          alt={uploadedProducts[0].name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        {uploadedProducts.length > 1 && (
                          <div 
                            style={{ 
                              width: "clamp(1rem, 2.5vw, 1.25rem)", 
                              height: "clamp(1rem, 2.5vw, 1.25rem)",
                              fontSize: "clamp(0.5rem, 0.7vw, 0.625rem)"
                            }}
                            className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold"
                          >
                            {uploadedProducts.length}
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={handleGenerate}
                        variant="default"
                        size="sm"
                        className="w-full"
                        style={{ 
                          fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)",
                          height: "clamp(1.5rem, 3vh, 2rem)",
                          padding: "clamp(0.25rem, 0.5vw, 0.375rem)"
                        }}
                      >
                        {t("generate")}
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <motion.div
          initial={false}
          animate={{ width: isRightPanelOpen ? "clamp(15rem, 20vw, 17.5rem)" : "clamp(2.5rem, 3vw, 2.75rem)" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          onMouseEnter={() => setIsRightPanelOpen(true)}
          onMouseLeave={() => setIsRightPanelOpen(false)}
          className="bg-card border-l border-border overflow-hidden relative z-10"
        >
          {!isRightPanelOpen && (
            <div className="h-full flex items-center justify-center">
              <Menu style={{ width: "clamp(1.125rem, 1.5vw, 1.25rem)", height: "clamp(1.125rem, 1.5vw, 1.25rem)" }} className="text-muted-foreground" />
            </div>
          )}
          
          <AnimatePresence>
            {isRightPanelOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ padding: "clamp(0.75rem, 1.5vw, 1rem)" }}
                className="h-full overflow-y-auto flex flex-col gap-4"
              >
                <div>
                  <h3 style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }} className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="text-xl">✨</span>
                    {t("enterPrompt")}
                  </h3>

                  <div className="bg-accent/20 border border-border rounded-lg p-3 mb-4">
                    <p style={{ fontSize: "clamp(0.7rem, 0.85vw, 0.8rem)" }} className="text-muted-foreground">
                      {selectedCount > 0 
                        ? `Промпт применится к ${selectedCount} выбранным фото` 
                        : "Общий промпт для всех фотографий"
                      }
                    </p>
                  </div>

                  <div className="mb-4">
                    <textarea
                      placeholder="Опишите что хотите изменить во всех выбранных фотографиях..."
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      className="w-full min-h-[140px] p-3 bg-background border-2 border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                      style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-muted-foreground">
                        {promptText.length} символов
                      </span>
                      {promptText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPromptText("")}
                          className="text-xs h-7"
                        >
                          Очистить
                        </Button>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleGenerate}
                    className="w-full"
                    disabled={!promptText && selectedCount === 0}
                  >
                    <span className="mr-2">✨</span>
                    {t("generate")}
                  </Button>
                </div>

                <div className="flex-1">
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </div>
  );
};

export default Studio;