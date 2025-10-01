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
  const [uploadedProducts, setUploadedProducts] = useState<File[]>([]);
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  // STATE 1: EMPTY
  if (studioState === "empty") {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <main className="flex-1 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md text-center"
          >
            <h1 className="text-4xl font-bold mb-8 text-white">
              Import Competitor Ads
            </h1>
            
            <Input
              type="url"
              placeholder="https://facebook.com/ads/library/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-14 text-base mb-6 bg-[#1a1a1a] border-[#404040] text-white placeholder:text-[#a0a0a0]"
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-[#404040]" />
              <span className="text-sm text-[#a0a0a0]">or</span>
              <div className="flex-1 h-px bg-[#404040]" />
            </div>

            <Select>
              <SelectTrigger className="h-12 mb-6 bg-[#1a1a1a] border-[#404040] text-white">
                <SelectValue placeholder="Choose from history" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#404040]">
                <SelectItem value="none" className="text-white">No previous imports</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="default" 
              size="lg" 
              className="w-full h-14 text-base font-medium bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white transition-all duration-300"
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
      <div className="min-h-screen flex flex-col bg-black">
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
              <Loader2 className="w-16 h-16 mx-auto animate-spin text-white" />
            </motion.div>
            
            <h2 className="text-2xl font-semibold text-white mb-4">
              Scraping competitor ads...
            </h2>
            
            <div className="w-full max-w-md mx-auto mb-3">
              <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            
            <p className="text-sm text-[#a0a0a0]">{progress}%</p>
          </motion.div>
        </main>
      </div>
    );
  }

  // STATE 3: ACTIVE STUDIO
  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Top Bar */}
      <header className="h-[60px] bg-[#0a0a0a] border-b border-[#404040] flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-white">COPY ADD</h1>
        
        <div className="flex items-center gap-3">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[130px] bg-[#1a1a1a] border-[#404040] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#404040] z-[100]">
              <SelectItem value="en" className="text-white hover:bg-[#2a2a2a]">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇬🇧</span>
                  <span>English</span>
                </div>
              </SelectItem>
              <SelectItem value="ru" className="text-white hover:bg-[#2a2a2a]">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇷🇺</span>
                  <span>Русский</span>
                </div>
              </SelectItem>
              <SelectItem value="de" className="text-white hover:bg-[#2a2a2a]">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇩🇪</span>
                  <span>Deutsch</span>
                </div>
              </SelectItem>
              <SelectItem value="pl" className="text-white hover:bg-[#2a2a2a]">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇵🇱</span>
                  <span>Polski</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-[120px] bg-[#1a1a1a] border-[#404040] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#404040] z-[100]">
              <SelectItem value="light" className="text-white hover:bg-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  {t("light")}
                </div>
              </SelectItem>
              <SelectItem value="dark" className="text-white hover:bg-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  {t("dark")}
                </div>
              </SelectItem>
              <SelectItem value="system" className="text-white hover:bg-[#2a2a2a]">
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
            className="text-white hover:bg-[#1a1a1a]"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t("logout")}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white hover:bg-[#1a1a1a]"
          >
            <User className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Left Panel */}
        <motion.div
          initial={false}
          animate={{ width: isLeftPanelOpen ? 280 : 40 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          onMouseEnter={() => setIsLeftPanelOpen(true)}
          onMouseLeave={() => setIsLeftPanelOpen(false)}
          className="bg-[#1a1a1a] border-r border-[#404040] overflow-hidden relative z-10"
        >
          {!isLeftPanelOpen && (
            <div className="h-full flex items-center justify-center">
              <Menu className="w-5 h-5 text-[#a0a0a0]" />
            </div>
          )}
          
          <AnimatePresence>
            {isLeftPanelOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4 h-full overflow-y-auto"
              >
                <h3 className="text-sm font-semibold text-white mb-4">Competitor Ads ({ads.length})</h3>
                
                <div className="space-y-3">
                  {ads.map((ad, index) => (
                    <motion.div
                      key={ad.id}
                      whileHover={{ backgroundColor: "#2a2a2a" }}
                      onClick={() => setCurrentAdIndex(index)}
                      className={`cursor-pointer rounded-lg p-2 transition-all duration-300 ${
                        currentAdIndex === index ? "border-2 border-white" : "border-2 border-transparent"
                      }`}
                    >
                      <img
                        src={ad.image}
                        alt={ad.title}
                        className="w-full aspect-square object-cover rounded mb-2"
                      />
                      <p className="text-sm font-medium text-white">{ad.brand}</p>
                      <p className="text-xs text-[#a0a0a0]">{ad.date}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Center Canvas */}
        <div className="flex-1 flex items-center justify-center relative group">
          <div className="relative max-w-[800px]">
            {/* Ad Info Overlay */}
            <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded px-3 py-2">
              <p className="text-sm font-medium text-white">{ads[currentAdIndex].brand}</p>
              <p className="text-xs text-[#a0a0a0]">{ads[currentAdIndex].format}</p>
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
                className="w-full rounded-lg shadow-2xl"
              />
            </AnimatePresence>

            {/* Add Product Button on Hover */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileHover={{ opacity: 1, x: 0 }}
              className="absolute right-[-120px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300"
            >
              <Button
                variant="default"
                size="lg"
                className="bg-white text-black hover:bg-white/90 shadow-xl"
                {...getRootProps()}
              >
                <input {...getInputProps()} />
                <Plus className="w-5 h-5 mr-2" />
                Add your product
              </Button>
            </motion.div>

            {/* Navigation Arrows - Always Visible */}
            {currentAdIndex > 0 && (
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.3)" }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 border-2 border-white/40"
                onClick={() => setCurrentAdIndex(prev => prev - 1)}
              >
                <ChevronLeft className="w-7 h-7" />
              </motion.button>
            )}

            {currentAdIndex < ads.length - 1 && (
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.3)" }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 border-2 border-white/40"
                onClick={() => setCurrentAdIndex(prev => prev + 1)}
              >
                <ChevronRight className="w-7 h-7" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Right Panel - Upload Zone */}
        <div className="w-[320px] bg-[#1a1a1a] border-l border-[#404040] p-6 flex flex-col">
          {uploadedProducts.length === 0 ? (
            <div
              {...getRootProps()}
              className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 ${
                isDragActive 
                  ? "border-white bg-white/5" 
                  : "border-[#404040] hover:border-[#606060]"
              }`}
            >
              <input {...getInputProps()} />
              <Plus className="w-16 h-16 text-white opacity-30 mb-4" />
              <p className="text-[#a0a0a0] text-center">
                {isDragActive ? "Drop files here" : "Add your product"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
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
                      className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </motion.div>
                ))}
              </div>
              
              <Button
                onClick={handleGenerate}
                className="w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white h-12"
              >
                Generate
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Studio;
