import { Button } from "@/components/ui/button";
import { Upload, Wand2, Download, Star, Rocket, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import heroBg from "@/assets/hero-bg.jpg";

const HomeDesign3 = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section - Dynamic 3D-inspired Design */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroBg} 
            alt="Hero background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-background/80 to-background/90" />
          {/* Animated orbs */}
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-xl border border-primary/30 rounded-2xl px-6 py-3 mb-8 shadow-2xl">
            <Star className="w-5 h-5 text-primary fill-primary" />
            <span className="font-semibold text-lg">Rated 5/5 by 10,000+ users</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black mb-8 leading-tight">
            <span className="block">{t("heroTitle").split(" ").slice(0, 3).join(" ")}</span>
            <span className="block text-primary">{t("heroTitle").split(" ").slice(3).join(" ")}</span>
          </h1>
          <p className="text-xl md:text-2xl mb-12 text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t("heroSubtitle")}
          </p>
          <div className="flex gap-5 justify-center flex-wrap">
            <Link to="/signup">
              <Button size="lg" className="text-xl px-12 py-8 bg-primary hover:bg-primary/90 shadow-2xl hover:shadow-primary/50 hover:scale-105 transition-all">
                <Rocket className="w-6 h-6 mr-3" />
                {t("signup")}
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="text-xl px-12 py-8 border-2 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                {t("login")}
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-16 flex items-center justify-center gap-12 flex-wrap">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div className="text-left">
                <div className="text-3xl font-bold">10,000+</div>
                <div className="text-sm text-muted-foreground">Happy Users</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Wand2 className="w-8 h-8 text-primary" />
              <div className="text-left">
                <div className="text-3xl font-bold">50,000+</div>
                <div className="text-sm text-muted-foreground">Ads Created</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-primary fill-primary" />
              <div className="text-left">
                <div className="text-3xl font-bold">4.9/5</div>
                <div className="text-sm text-muted-foreground">User Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Card Grid */}
      <section className="py-28 px-6 bg-card/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <h2 className="text-6xl font-black mb-6">{t("howItWorks")}</h2>
            <p className="text-2xl text-muted-foreground">Simple, fast, and effective</p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { icon: Upload, title: t("step1Title"), desc: t("step1Desc"), gradient: "from-blue-500 via-purple-500 to-pink-500" },
              { icon: Wand2, title: t("step2Title"), desc: t("step2Desc"), gradient: "from-purple-500 via-pink-500 to-orange-500" },
              { icon: Download, title: t("step3Title"), desc: t("step3Desc"), gradient: "from-pink-500 via-orange-500 to-yellow-500" }
            ].map((step, i) => (
              <div key={i} className="group relative">
                <div className={`absolute -inset-1 bg-gradient-to-r ${step.gradient} rounded-3xl blur-xl opacity-30 group-hover:opacity-60 transition-opacity`} />
                <div className="relative bg-background border-2 border-border rounded-3xl p-10 hover:border-primary/50 transition-all h-full">
                  <div className={`w-20 h-20 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center mb-8 shadow-2xl`}>
                    <step.icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-7xl font-black text-primary/10 absolute top-6 right-6">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="text-3xl font-bold mb-5">{step.title}</h3>
                  <p className="text-muted-foreground text-xl leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Different */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-6xl font-black mb-6">{t("whyDifferent")}</h2>
            <p className="text-2xl text-muted-foreground max-w-3xl mx-auto">
              {t("whyDifferentDesc")}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-10">
            <div className="bg-destructive/5 border-2 border-destructive/20 rounded-3xl p-12 backdrop-blur">
              <h3 className="text-4xl font-bold mb-10 flex items-center gap-3">
                <span className="text-destructive">✗</span>
                {t("traditionalTools")}
              </h3>
              <ul className="space-y-6">
                {[t("traditional1"), t("traditional2"), t("traditional3")].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-destructive text-2xl font-bold">✗</span>
                    </div>
                    <span className="text-muted-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary rounded-3xl p-12 backdrop-blur relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
              <h3 className="text-4xl font-bold mb-10 flex items-center gap-3 relative z-10">
                <Rocket className="text-primary" />
                {t("copyAdd")}
              </h3>
              <ul className="space-y-6 relative z-10">
                {[t("copyAdd1"), t("copyAdd2"), t("copyAdd3")].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary text-2xl font-bold">✓</span>
                    </div>
                    <span className="font-bold">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-border py-12 px-6 bg-card">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-4xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            COPY ADD
          </div>
          <div className="flex gap-10 text-lg font-medium">
            <Link to="/docs" className="hover:text-primary transition-colors">
              {t("docs")}
            </Link>
            <Link to="/legal/privacy" className="hover:text-primary transition-colors">
              {t("privacy")}
            </Link>
            <Link to="/legal/terms" className="hover:text-primary transition-colors">
              {t("terms")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomeDesign3;
