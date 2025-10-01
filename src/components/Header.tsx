import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, FileText, Moon, Sun } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

export const Header = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
          COPY ADD
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/docs">
            <Button variant="ghost" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              {t("docs")}
            </Button>
          </Link>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="ru">RU</SelectItem>
              <SelectItem value="de">DE</SelectItem>
              <SelectItem value="pl">PL</SelectItem>
            </SelectContent>
          </Select>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
              <SelectItem value="system">{t("system")}</SelectItem>
            </SelectContent>
          </Select>
          <Link to="/profile">
            <Button variant="ghost" size="icon">
              <User className="w-4 h-4" />
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
};
