import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Loader2, LogOut } from "lucide-react";
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
import { Header } from "@/components/Header";

const Studio = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    // Проверяем авторизацию
    const checkAuth = async () => {
      // Проверяем demo пользователя
      const isDemoUser = localStorage.getItem("demo_user") === "true";
      
      if (isDemoUser) {
        setIsCheckingAuth(false);
        return;
      }

      // Проверяем реальную сессию Supabase (с автоматическим сохранением)
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

    // Подписываемся на изменения авторизации для автоматического сохранения сессии
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !localStorage.getItem("demo_user")) {
        navigate("/login");
      }
      // Событие SIGNED_IN автоматически сохранит сессию благодаря настройке persistSession: true
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogout = async () => {
    localStorage.removeItem("demo_user");
    await supabase.auth.signOut();
    toast({
      title: t("loggedOut"),
      description: t("loggedOutDesc"),
    });
    navigate("/");
  };

  const handleImport = () => {
    if (!url) return;
    
    setIsLoading(true);
    setProgress(0);
    
    // Simulate scraping progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 5;
      });
    }, 200);

    // Stop after 4 seconds for demo
    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 500);
    }, 4000);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="fixed top-16 right-4 z-40">
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          {t("logout")}
        </Button>
      </div>

      <main className="flex-1 flex items-center justify-center p-6 pt-24 bg-background">
        <div className="w-full max-w-3xl text-center fade-in">
          {isLoading ? (
            <div className="space-y-8">
              <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
              <div className="space-y-3">
                <p className="text-2xl font-semibold">{t("analyzingAds")}</p>
                <div className="w-full max-w-md mx-auto bg-secondary/30 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{progress}%</p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-24 h-24 bg-secondary/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-border/50">
                <ChevronDown className="w-12 h-12 text-muted-foreground" />
              </div>
              
              <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {t("importCompetitorAds")}
              </h2>
              <p className="text-muted-foreground/80 mb-12 text-lg">
                {t("pasteAdUrls")}
              </p>

              <div className="space-y-6">
                <Input
                  type="url"
                  placeholder="https://facebook.com/ads/library/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-16 text-base bg-card/50 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                />
                
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  <span className="text-sm text-muted-foreground/60 px-4">{t("or")}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>

                <Select>
                  <SelectTrigger className="h-14 bg-card/50 backdrop-blur-sm border-border/50">
                    <SelectValue placeholder={t("chooseFromHistory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noPreviousImports")}</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  variant="default" 
                  size="lg" 
                  className="w-full h-14 text-base font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                  onClick={handleImport}
                  disabled={!url}
                >
                  {t("importCompetitorAds")}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Studio;
