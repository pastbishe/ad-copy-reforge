import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Wand2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import heroBg from "@/assets/hero-bg.jpg";

const Home = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.8)), url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto px-6 py-24 text-center fade-in">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 tracking-tight">
            Turn any competitor's<br />Facebook ad into your ad
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Analyze winning ads. Adapt them to your product. Export ready-to-run creatives.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/studio">
              <Button variant="hero" size="lg" className="text-lg">
                Open Studio <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <Link to="/docs">
              <Button variant="ghost" size="lg" className="text-lg">
                Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center hover-scale">
              <div className="w-16 h-16 bg-card rounded-lg flex items-center justify-center mx-auto mb-6 border border-border">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Import Competitor Ads</h3>
              <p className="text-muted-foreground">
                Paste Facebook Ad Library URLs or profile links. We'll scrape and analyze the winning creatives.
              </p>
            </div>
            <div className="text-center hover-scale">
              <div className="w-16 h-16 bg-card rounded-lg flex items-center justify-center mx-auto mb-6 border border-border">
                <Wand2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Upload Your Product</h3>
              <p className="text-muted-foreground">
                Drop in your product photos. Our AI adapts the competitor's creative strategy to your brand.
              </p>
            </div>
            <div className="text-center hover-scale">
              <div className="w-16 h-16 bg-card rounded-lg flex items-center justify-center mx-auto mb-6 border border-border">
                <Download className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Generate Variants</h3>
              <p className="text-muted-foreground">
                Export custom ad creatives ready to run. Multiple variants, formats, and styles in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Different */}
      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-8">Why Different</h2>
          <p className="text-xl text-muted-foreground text-center max-w-3xl mx-auto mb-16">
            Traditional ad creation tools start from scratch. COPY ADD starts from proven winners — 
            competitor ads that are already converting — and transforms them for your product.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-6 bg-background rounded-lg border border-border">
              <h3 className="text-lg font-semibold mb-3">Traditional Tools</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Start with blank canvas</li>
                <li>• Guess what works</li>
                <li>• Generic templates</li>
                <li>• No market insights</li>
              </ul>
            </div>
            <div className="p-6 bg-background rounded-lg border border-border">
              <h3 className="text-lg font-semibold mb-3">COPY ADD</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Start with proven winners</li>
                <li>• Learn from competitors</li>
                <li>• Custom adaptations</li>
                <li>• Built-in market research</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-2xl font-bold">COPY ADD</div>
            <div className="flex gap-8">
              <Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                Documentation
              </Link>
              <Link to="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link to="/legal/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
