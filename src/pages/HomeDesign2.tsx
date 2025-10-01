import { Button } from "@/components/ui/button";
import { Upload, Wand2, Download, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import heroBg from "@/assets/hero-bg.jpg";

const HomeDesign2 = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section - Minimalist Clean Design */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 bg-background">
        <div className="absolute inset-0 z-0 opacity-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_hsl(var(--primary))_0%,_transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,_hsl(var(--accent))_0%,_transparent_50%)]" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-6xl mx-auto">
          <h1 className="text-7xl md:text-9xl font-black mb-8 tracking-tight">
            {t("heroTitle")}
          </h1>
          <p className="text-2xl md:text-3xl mb-12 text-muted-foreground max-w-3xl mx-auto font-light">
            {t("heroSubtitle")}
          </p>
          <div className="flex gap-6 justify-center flex-wrap mb-16">
            <Link to="/signup">
              <Button size="lg" className="text-xl px-12 py-8 rounded-full bg-foreground text-background hover:bg-foreground/90">
                {t("signup")}
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="text-xl px-12 py-8 rounded-full border-2">
                {t("login")}
              </Button>
            </Link>
          </div>

          {/* Featured in */}
          <div className="text-sm text-muted-foreground mb-4">TRUSTED BY LEADING BRANDS</div>
          <div className="flex justify-center gap-12 items-center opacity-50">
            {["Meta", "Google", "TikTok", "LinkedIn"].map(brand => (
              <div key={brand} className="text-2xl font-bold">{brand}</div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Horizontal Flow */}
      <section className="py-32 px-6 bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <h2 className="text-6xl font-black text-center mb-24">{t("howItWorks")}</h2>
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-24 left-0 right-0 h-0.5 bg-border" />
            
            {[
              { icon: Upload, title: t("step1Title"), desc: t("step1Desc"), number: "01" },
              { icon: Wand2, title: t("step2Title"), desc: t("step2Desc"), number: "02" },
              { icon: Download, title: t("step3Title"), desc: t("step3Desc"), number: "03" }
            ].map((step, i) => (
              <div key={i} className="flex-1 relative">
                <div className="bg-primary w-16 h-16 rounded-full flex items-center justify-center mb-6 relative z-10 mx-auto md:mx-0">
                  <step.icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="text-8xl font-black text-muted-foreground/5 absolute -top-8 left-0">
                  {step.number}
                </div>
                <h3 className="text-3xl font-bold mb-4">{step.title}</h3>
                <p className="text-muted-foreground text-xl leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Different - Side by Side Comparison */}
      <section className="py-32 px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-6xl font-black text-center mb-8">{t("whyDifferent")}</h2>
          <p className="text-center text-2xl text-muted-foreground mb-20 max-w-3xl mx-auto">
            {t("whyDifferentDesc")}
          </p>
          
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h3 className="text-4xl font-bold mb-10">{t("traditionalTools")}</h3>
              <ul className="space-y-6">
                {[t("traditional1"), t("traditional2"), t("traditional3")].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-xl">
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-destructive font-bold">✗</span>
                    </div>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-4xl font-bold mb-10 text-primary">{t("copyAdd")}</h3>
              <ul className="space-y-6">
                {[t("copyAdd1"), t("copyAdd2"), t("copyAdd3")].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-xl">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-3xl font-black">COPY ADD</div>
          <div className="flex gap-10 text-lg">
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

export default HomeDesign2;
