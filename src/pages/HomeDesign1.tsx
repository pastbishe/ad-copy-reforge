import { Button } from "@/components/ui/button";
import { Upload, Wand2, Download, Sparkles, Zap, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import heroBg from "@/assets/hero-bg.jpg";

const HomeDesign1 = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <Header />

      {/* Hero Section - Modern Gradient Design */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroBg} 
            alt="Hero background" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto fade-in">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI-Powered Ad Creation</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
            {t("heroTitle")}
          </h1>
          <p className="text-xl md:text-2xl mb-10 text-muted-foreground max-w-3xl mx-auto">
            {t("heroSubtitle")}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/signup">
              <Button size="lg" className="text-lg px-10 py-7 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                {t("signup")}
                <Zap className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="text-lg px-10 py-7 border-2 hover:bg-accent/50">
                {t("login")}
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">10K+</div>
              <div className="text-sm text-muted-foreground">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">50K+</div>
              <div className="text-sm text-muted-foreground">Ads Created</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">95%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <h2 className="text-5xl font-bold text-center mb-20">{t("howItWorks")}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Upload, title: t("step1Title"), desc: t("step1Desc"), color: "from-blue-500 to-purple-500" },
              { icon: Wand2, title: t("step2Title"), desc: t("step2Desc"), color: "from-purple-500 to-pink-500" },
              { icon: Download, title: t("step3Title"), desc: t("step3Desc"), color: "from-pink-500 to-orange-500" }
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl blur-xl" 
                     style={{ background: `linear-gradient(to bottom right, var(--primary), var(--accent))` }} />
                <div className="relative bg-card border border-border rounded-2xl p-8 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/10">
                  <div className={`w-16 h-16 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-6xl font-bold text-muted-foreground/10 absolute top-4 right-4">
                    {i + 1}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Different */}
      <section className="py-24 px-6 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-6">{t("whyDifferent")}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("whyDifferentDesc")}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border border-destructive/30 rounded-2xl p-10 bg-card/50 backdrop-blur">
              <h3 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3">
                <span className="text-destructive">✗</span>
                {t("traditionalTools")}
              </h3>
              <ul className="space-y-5">
                {[t("traditional1"), t("traditional2"), t("traditional3")].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-lg">
                    <span className="text-destructive text-2xl mt-1">✗</span>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="border-2 border-primary rounded-2xl p-10 bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <h3 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3 relative z-10">
                <TrendingUp className="text-primary" />
                {t("copyAdd")}
              </h3>
              <ul className="space-y-5 relative z-10">
                {[t("copyAdd1"), t("copyAdd2"), t("copyAdd3")].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-lg">
                    <span className="text-primary text-2xl mt-1">✓</span>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-6 bg-card/50 backdrop-blur">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            COPY ADD
          </div>
          <div className="flex gap-8">
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

export default HomeDesign1;
