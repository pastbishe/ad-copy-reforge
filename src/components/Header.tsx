import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, FileText, Moon, Sun, Monitor, LogOut, Link as LinkIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

const LanguageFlag = ({ code }: { code: string }) => {
  const flags: Record<string, string> = {
    en: "🇺🇸",
    ru: "🇷🇺",
    de: "🇩🇪",
    pl: "🇵🇱"
  };
  return <span className="text-lg mr-2">{flags[code]}</span>;
};

export const Header = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, isDemoUser, signOut } = useAuth();
  const isAuthenticated = user || isDemoUser;

  return (
    <header className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hover:opacity-80 transition-opacity">
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
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-[100]">
              <SelectItem value="en">
                <div className="flex items-center">
                  <LanguageFlag code="en" />
                  <span>English</span>
                </div>
              </SelectItem>
              <SelectItem value="ru">
                <div className="flex items-center">
                  <LanguageFlag code="ru" />
                  <span>Русский</span>
                </div>
              </SelectItem>
              <SelectItem value="de">
                <div className="flex items-center">
                  <LanguageFlag code="de" />
                  <span>Deutsch</span>
                </div>
              </SelectItem>
              <SelectItem value="pl">
                <div className="flex items-center">
                  <LanguageFlag code="pl" />
                  <span>Polski</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-[100]">
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  {t("light")}
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  {t("dark")}
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  {t("system")}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {isAuthenticated ? (
            <>
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
