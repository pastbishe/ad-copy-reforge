import { Link } from "react-router-dom";

const Terms = () => {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">COPY ADD</Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Acceptance of Terms</h2>
              <p>
                By accessing and using COPY ADD, you accept and agree to be bound by these Terms of Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Use License</h2>
              <p>
                We grant you a limited, non-exclusive, non-transferable license to use COPY ADD for your business purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">User Responsibilities</h2>
              <p>You agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account</li>
                <li>Use the service in compliance with all applicable laws</li>
                <li>Respect intellectual property rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Intellectual Property</h2>
              <p>
                You retain ownership of content you upload. We retain ownership of our platform and generated outputs 
                are licensed to you for commercial use.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact</h2>
              <p>
                Questions about these Terms? Contact us at{" "}
                <a href="mailto:legal@copyadd.com" className="text-foreground underline">
                  legal@copyadd.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
