import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните все поля",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: t("loginSuccess"),
      });

      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Получаем понятное сообщение об ошибке
      const { handleNetworkError } = await import("@/lib/networkUtils");
      const { message: userMessage } = handleNetworkError(error);
      
      toast({
        title: "Ошибка входа",
        description: userMessage || error.message || "Неверный email или пароль",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Google login error:", error);
      toast({
        title: t("error"),
        description: t("googleLoginError"),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    
    try {
      // Создаем демо-пользователя в Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "demo@copyadd.com",
        password: "demo123456"
      });

      if (error) {
        // Если демо-пользователь не существует, создаем его
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: "demo@copyadd.com",
          password: "demo123456",
          options: {
            data: {
              is_demo: true
            }
          }
        });

        if (signUpError) {
          console.error("Demo user creation failed:", signUpError);
          // Fallback к старому способу
          localStorage.setItem("demo_user", "true");
        } else {
          localStorage.setItem("demo_user", "true");
        }
      } else {
        localStorage.setItem("demo_user", "true");
      }
      
      toast({
        title: t("demoLogin"),
      });
      
      navigate("/");
    } catch (error) {
      console.error("Demo login error:", error);
      // Fallback к старому способу
      localStorage.setItem("demo_user", "true");
      toast({
        title: t("demoLogin"),
      });
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
            COPY ADD
          </Link>
        </div>
      </header>

      <div className="flex items-center justify-center p-6 min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">{t("login")}</CardTitle>
            <CardDescription>{t("authRequiredDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "..." : t("login")}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{t("or")}</span>
                </div>
              </div>

              <Button 
                type="button" 
                className="w-full" 
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t("continueWithGoogle")}
              </Button>

              <Button 
                type="button" 
                className="w-full" 
                variant="outline"
                onClick={handleDemoLogin}
                disabled={isLoading}
              >
                {t("demoLogin")}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {t("noAccount")}{" "}
                <Link to="/signup" className="underline underline-offset-4 hover:text-foreground">
                  {t("signup")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
