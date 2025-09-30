import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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

const Studio = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Проверяем авторизацию
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Требуется авторизация",
          description: "Пожалуйста, войдите в систему для доступа к студии",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }
      
      setIsCheckingAuth(false);
    };

    checkAuth();

    // Слушаем изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Выход выполнен",
      description: "Вы вышли из системы",
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
      {/* Top Bar */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
            COPY ADD
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Выход
            </Button>
          </div>
        </div>
      </header>

      {/* Empty State */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl text-center fade-in">
          {isLoading ? (
            <div className="space-y-6">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-muted-foreground" />
              <div className="space-y-2">
                <p className="text-xl font-medium">Analyzing competitor ads...</p>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-foreground transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{progress}%</p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                <ChevronDown className="w-10 h-10 text-muted-foreground" />
              </div>
              
              <h2 className="text-3xl font-bold mb-4">Import Competitor Ads</h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Paste Facebook Ad Library URLs or profile links
              </p>

              <div className="space-y-4">
                <Input
                  type="url"
                  placeholder="https://facebook.com/ads/library/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-14 text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                />
                
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Select>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Choose from history" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No previous imports</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  variant="hero" 
                  size="lg" 
                  className="w-full"
                  onClick={handleImport}
                  disabled={!url}
                >
                  Import Ads
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
