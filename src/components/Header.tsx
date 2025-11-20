import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, FileText, Flame, Moon, LogOut, Link as LinkIcon, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";


export const Header = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, effectiveTheme } = useTheme();
  const { user, isDemoUser, signOut } = useAuth();
  const isAuthenticated = user || isDemoUser;

  const toggleTheme = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hover:opacity-80 transition-opacity" style={{ fontSize: "clamp(1.25rem, 2vw, 1.5rem)" }}>
          COPY ADD
        </Link>
        <nav className="flex items-center gap-3">
          {isAuthenticated && (
            <Link to="/studio/empty">
              <Button 
                variant="ghost" 
                size="icon" 
                className="hover:bg-accent relative overflow-visible" 
                title={t("importLink") || "Import Link"}
              >
                <div 
                  style={{
                    animation: 'rotateIcon 5s linear infinite',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    transformOrigin: 'center center',
                    willChange: 'transform'
                  }}
                >
                  <LinkIcon className="w-5 h-5" />
                </div>
              </Button>
            </Link>
          )}
          <Link to="/docs">
            <Button variant="ghost" size="icon" className="hover:bg-accent">
              <FileText className="w-5 h-5" />
            </Button>
          </Link>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger style={{ width: "clamp(7rem, 10vw, 8.125rem)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-[100]">
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ru">Русский</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="pl">Polski</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" />
            <Switch 
              checked={effectiveTheme === "dark"} 
              onCheckedChange={toggleTheme}
              aria-label={t("theme")}
            />
            <Moon className="w-4 h-4" />
          </div>
          {isAuthenticated ? (
            <>
              <Link to="/history">
                <Button variant="ghost" size="icon" className="hover:bg-accent" title={t("history") || "История генераций"}>
                  <History className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="hover:bg-accent">
                  <User className="w-4 h-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="hover:bg-accent" onClick={signOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t("login")}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">
                  {t("signup")}
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
