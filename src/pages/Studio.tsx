import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, LogOut, ChevronLeft, ChevronRight, Plus, X, Menu, User, Sun, Moon, Monitor } from "lucide-react";
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

type StudioState = "empty" | "loading" | "active";

interface Ad {
  id: number;
  image: string;
  title: string;
  brand: string;
  date: string;
  format: string;
}

const Studio = () => {
  const [url, setUrl] = useState("");
  const [studioState, setStudioState] = useState<StudioState>("empty");
  const [progress, setProgress] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);
  const [uploadedProducts, setUploadedProducts] = useState<File[]>([]);
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const ads: Ad[] = [
    { id: 1, image: demoAd1, title: "Smartwatch Ad", brand: "TechBrand", date: "2024-09-15", format: "1080x1080" },
    { id: 2, image: demoAd2, title: "Headphones Ad", brand: "AudioCo", date: "2024-09-20", format: "1200x628" }
  ];

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

  // Keyboard navigation
  useEffect(() => {
    if (studioState !== "active") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentAdIndex > 0) {
        setCurrentAdIndex(prev => prev - 1);
      } else if (e.key === "ArrowRight" && currentAdIndex < ads.length - 1) {
        setCurrentAdIndex(prev => prev + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [studioState, currentAdIndex, ads.length]);

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
        setStudioState("active");
        toast({
          title: "Ads imported",
          description: `Successfully scraped ${ads.length} competitor ads`,
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
      title: "Upload complete",
      description: `${acceptedFiles.length} product(s) added`,
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
      title: "Generating variants",
      description: "AI is creating your ad variations...",
    });
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-foreground" />
      </div>
    );
  }

  // STATE 1: EMPTY
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
              Import Competitor Ads
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
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Select>
              <SelectTrigger className="h-12 mb-6 bg-card border-border text-foreground">
                <SelectValue placeholder="Choose from history" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="none" className="text-foreground">No previous imports</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="secondary" 
              size="lg" 
              className="w-full h-14 text-base font-medium"
              onClick={handleImport}
              disabled={!url}
            >
              Import
            </Button>
          </motion.div>
        </main>
      </div>
    );
  }

  // STATE 2: LOADING
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
              Scraping competitor ads...
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

  // STATE 3: ACTIVE STUDIO
  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="w-4 h-4" />;
    if (theme === "dark") return <Moon className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar - Adaptive Height */}
      <header style={{ height: "clamp(3.5rem, 5vh, 4rem)" }} className="bg-card border-b border-border flex items-center justify-between px-[clamp(1rem,3vw,1.5rem)] flex-shrink-0">
        <h1 style={{ fontSize: "clamp(1.125rem, 1.5vw, 1.25rem)" }} className="font-bold text-foreground">COPY ADD</h1>
        
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
        {/* Left Panel - Adaptive Width */}
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
                style={{ padding: "clamp(0.75rem, 1.5vw, 1rem)" }}
                className="h-full overflow-y-auto"
              >
                <h3 style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }} className="font-semibold text-foreground mb-[clamp(0.75rem,1.5vh,1rem)]">
                  Competitor Ads ({ads.length})
                </h3>
                
                <div style={{ gap: "clamp(0.5rem, 1vh, 0.75rem)" }} className="flex flex-col">
                  {ads.map((ad, index) => (
                    <motion.div
                      key={ad.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setCurrentAdIndex(index)}
                      style={{ padding: "clamp(0.375rem, 0.8vw, 0.5rem)" }}
                      className={`cursor-pointer rounded-lg transition-all duration-300 ${
                        currentAdIndex === index ? "border-2 border-primary bg-accent/50" : "border-2 border-transparent hover:bg-accent/30"
                      }`}
                    >
                      <img
                        src={ad.image}
                        alt={ad.title}
                        className="w-full aspect-square object-cover rounded mb-2"
                      />
                      <p style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }} className="font-medium text-foreground">{ad.brand}</p>
                      <p style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }} className="text-muted-foreground">{ad.date}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Center Canvas - Adaptive Sizing */}
        <div className="flex-1 flex items-center justify-center relative">
          <motion.div 
            style={{ 
              width: isRightPanelVisible ? "calc(100% - clamp(18rem, 30vw, 25rem))" : "clamp(60%, 75vw, 80%)",
              height: "clamp(70%, 85vh, 90%)"
            }}
            className="relative flex items-center justify-center"
            onMouseEnter={() => {
              setIsHoveringImage(true);
              setIsRightPanelVisible(true);
            }}
            onMouseLeave={() => {
              setIsHoveringImage(false);
              setIsRightPanelVisible(false);
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Ad Info Overlay - Adaptive */}
            <div 
              style={{ 
                top: "clamp(0.75rem, 2vh, 1rem)", 
                left: "clamp(0.75rem, 2vw, 1rem)",
                padding: "clamp(0.5rem, 1vw, 0.75rem) clamp(0.75rem, 1.5vw, 1rem)"
              }} 
              className="absolute z-10 bg-background/80 backdrop-blur-sm rounded border border-border"
            >
              <p style={{ fontSize: "clamp(0.875rem, 1.2vw, 1rem)" }} className="font-medium text-foreground">{ads[currentAdIndex].brand}</p>
              <p style={{ fontSize: "clamp(0.75rem, 1vw, 0.875rem)" }} className="text-muted-foreground">{ads[currentAdIndex].format}</p>
            </div>

            {/* Main Ad Image */}
            <AnimatePresence mode="wait">
              <motion.img
                key={currentAdIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                src={ads[currentAdIndex].image}
                alt={ads[currentAdIndex].title}
                className="w-full h-full object-contain rounded-lg shadow-2xl"
              />
            </AnimatePresence>

            {/* Navigation Arrows - Adaptive Size */}
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
                  className="absolute top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground shadow-lg transition-all duration-300 border-2 border-border hover:bg-accent"
                  onClick={() => setCurrentAdIndex(prev => prev - 1)}
                >
                  <ChevronLeft style={{ width: "clamp(1.5rem, 2vw, 2rem)", height: "clamp(1.5rem, 2vw, 2rem)" }} />
                </motion.button>
              )}

              {isHoveringImage && currentAdIndex < ads.length - 1 && (
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
                  className="absolute top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground shadow-lg transition-all duration-300 border-2 border-border hover:bg-accent"
                  onClick={() => setCurrentAdIndex(prev => prev + 1)}
                >
                  <ChevronRight style={{ width: "clamp(1.5rem, 2vw, 2rem)", height: "clamp(1.5rem, 2vw, 2rem)" }} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Right Panel - Compact & Slides from Image on Hover */}
            <motion.div
              initial={{ x: "100%", opacity: 0.3 }}
              animate={{ 
                x: isRightPanelVisible ? "0%" : "calc(100% - clamp(3rem, 5vw, 4rem))",
                opacity: isRightPanelVisible ? 1 : 0.3,
                width: isRightPanelVisible ? "clamp(18rem, 30vw, 25rem)" : "clamp(3rem, 5vw, 4rem)"
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              onMouseEnter={() => setIsRightPanelVisible(true)}
              onMouseLeave={() => setIsRightPanelVisible(false)}
              style={{ padding: isRightPanelVisible ? "clamp(1rem, 2vw, 1.5rem)" : "clamp(0.5rem, 1vw, 0.75rem)" }}
              className="absolute right-0 top-0 h-full bg-card/95 border-l border-border flex flex-col backdrop-blur-sm shadow-2xl rounded-r-lg overflow-hidden"
            >
              {uploadedProducts.length === 0 ? (
                <div
                  {...getRootProps()}
                  className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                    isDragActive 
                      ? "border-primary bg-accent/20" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <input {...getInputProps()} />
                  <Plus 
                    style={{ 
                      width: isRightPanelVisible ? "clamp(2.5rem, 4vw, 3rem)" : "clamp(1.5rem, 2.5vw, 2rem)",
                      height: isRightPanelVisible ? "clamp(2.5rem, 4vw, 3rem)" : "clamp(1.5rem, 2.5vw, 2rem)"
                    }}
                    className="text-muted-foreground opacity-50 mb-2 relative z-10 group-hover:scale-110 group-hover:opacity-80 transition-all" 
                  />
                  {isRightPanelVisible && (
                    <>
                      <p style={{ fontSize: "clamp(0.875rem, 1vw, 1rem)" }} className="text-muted-foreground text-center relative z-10 font-medium">
                        {isDragActive ? "Drop here" : "Add Product"}
                      </p>
                      <p style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }} className="text-muted-foreground/70 text-sm text-center mt-1 relative z-10">
                        Drag & drop or click
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ gap: "clamp(0.5rem, 1vh, 0.75rem)", marginBottom: "clamp(0.75rem, 1.5vh, 1rem)" }} className="flex-1 overflow-y-auto flex flex-col">
                    {uploadedProducts.map((file, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative group"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full aspect-square object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeProduct(index)}
                          style={{ 
                            width: "clamp(1.5rem, 2vw, 1.75rem)", 
                            height: "clamp(1.5rem, 2vw, 1.75rem)",
                            top: "clamp(0.375rem, 0.8vw, 0.5rem)",
                            right: "clamp(0.375rem, 0.8vw, 0.5rem)"
                          }}
                          className="absolute bg-destructive/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                        >
                          <X style={{ width: "clamp(1rem, 1.2vw, 1.125rem)", height: "clamp(1rem, 1.2vw, 1.125rem)" }} className="text-destructive-foreground" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  
                  <Button
                    onClick={handleGenerate}
                    variant="default"
                    style={{ height: "clamp(2.75rem, 4vh, 3rem)", fontSize: "clamp(0.875rem, 1vw, 1rem)" }}
                    className="w-full"
                  >
                    Generate
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default Studio;
