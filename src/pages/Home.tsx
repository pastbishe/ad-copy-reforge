import { Button } from "@/components/ui/button";
import { Upload, Wand2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import heroBg from "@/assets/hero-bg.jpg";

const Home = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center text-white overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroBg} 
            alt="Hero background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-blue-900/60 to-indigo-900/60" />
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
