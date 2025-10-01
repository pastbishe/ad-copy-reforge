import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";

const Docs = () => {
  const { t } = useLanguage();
  const sections = [
    { title: "Getting Started", path: "/docs/getting-started" },
    { title: "Finding Competitor Ads", path: "/docs/finding-competitor-ads" },
    { title: "Image Requirements", path: "/docs/image-requirements" },
    { title: "Prompting Guide", path: "/docs/prompting-guide" },
    { title: "FAQ", path: "/docs/faq" },
  ];

  return (
    <div className="min-h-screen">
      <Header />

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border min-h-[calc(100vh-4rem)] p-6">
          <nav className="space-y-2">
            {sections.map((section) => (
              <Link
                key={section.path}
                to={section.path}
                className="block px-3 py-2 rounded-lg text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
              >
                {section.title}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-8">Documentation</h1>
            
            <div className="prose prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
                <p className="text-muted-foreground leading-relaxed">
                  COPY ADD helps you transform competitor Facebook ads into custom creatives for your products. 
                  Start by importing ads from Facebook's Ad Library, then upload your product images to generate 
                  variations that match proven creative strategies.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Open the Studio from the homepage</li>
                  <li>Paste a Facebook Ad Library URL or profile link</li>
                  <li>Upload your product images</li>
                  <li>Review and download generated variants</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Finding Competitor Ads</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Use Facebook's Ad Library to discover competitor ads. Search for brands in your niche and 
                  filter by active ads. Copy the URL of ads that resonate with you.
                </p>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Tip:</strong> Look for ads with high engagement and recent creation dates for the best results.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Docs;
