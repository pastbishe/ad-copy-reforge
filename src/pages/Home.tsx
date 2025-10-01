import { Button } from "@/components/ui/button";
import { Upload, Wand2, Download, User, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";

const Home = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
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
            <Link to="/profile">
              <Button variant="ghost" size="icon">
                <User className="w-4 h-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center text-white overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
          </div>
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto fade-in">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            {t("heroTitle")}
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">
            {t("heroSubtitle")}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8 py-6 bg-white text-purple-900 hover:bg-gray-100">
                {t("signup")}
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 border-white text-white hover:bg-white/10">
                {t("login")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-16">{t("howItWorks")}</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center fade-in hover-scale">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-primary">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">{t("step1Title")}</h3>
              <p className="text-muted-foreground text-lg">
                {t("step1Desc")}
              </p>
            </div>
            <div className="text-center fade-in hover-scale" style={{ animationDelay: "0.1s" }}>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-primary">
                <Wand2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">{t("step2Title")}</h3>
              <p className="text-muted-foreground text-lg">
                {t("step2Desc")}
              </p>
            </div>
            <div className="text-center fade-in hover-scale" style={{ animationDelay: "0.2s" }}>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-primary">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">{t("step3Title")}</h3>
              <p className="text-muted-foreground text-lg">
                {t("step3Desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Different */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-4xl font-bold text-center mb-6">{t("whyDifferent")}</h2>
          <p className="text-center text-muted-foreground text-xl mb-12">
            {t("whyDifferentDesc")}
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border border-border rounded-lg p-8 fade-in bg-card hover-scale">
              <h3 className="text-2xl font-bold mb-6 text-center">{t("traditionalTools")}</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-destructive text-xl">✗</span>
                  <span className="text-muted-foreground">{t("traditional1")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-destructive text-xl">✗</span>
                  <span className="text-muted-foreground">{t("traditional2")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-destructive text-xl">✗</span>
                  <span className="text-muted-foreground">{t("traditional3")}</span>
                </li>
              </ul>
            </div>
            
            <div className="border-2 border-primary rounded-lg p-8 bg-primary/5 fade-in hover-scale" style={{ animationDelay: "0.1s" }}>
              <h3 className="text-2xl font-bold mb-6 text-center">{t("copyAdd")}</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-primary text-xl">✓</span>
                  <span>{t("copyAdd1")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-xl">✓</span>
                  <span>{t("copyAdd2")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-xl">✓</span>
                  <span>{t("copyAdd3")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 bg-muted/30">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-2xl font-bold">COPY ADD</div>
          <div className="flex gap-6">
            <Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("docs")}
            </Link>
            <Link to="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("privacy")}
            </Link>
            <Link to="/legal/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("terms")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
