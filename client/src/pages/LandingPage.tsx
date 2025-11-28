import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import HowItWorks from "@/components/HowItWorks";
import CounterMetric from "@/components/CounterMetric";
import { ArrowRight, Users } from "lucide-react";

export default function LandingPage() {
  return (
    <Layout>
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
        <section className="flex-1 flex items-center justify-center px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight mb-6"
              data-testid="hero-title"
            >
              Agentic AI + Community
              <br />
              <span className="text-primary">vs Misinformation</span>
            </h1>
            
            <p 
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
              data-testid="hero-subtitle"
            >
              Ask a claim, let AI verify with tools, and see how the community backs it up.
            </p>

            <div className="mb-16">
              <HowItWorks />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/ask">
                <Button size="lg" data-testid="button-try-demo">
                  Try the Ask Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/verify">
                <Button size="lg" variant="outline" data-testid="button-see-community">
                  <Users className="mr-2 h-4 w-4" />
                  See Community
                </Button>
              </Link>
            </div>

            <div className="inline-block px-8 py-6 rounded-xl bg-card border">
              <CounterMetric target={1248} label="Claims Verified (demo)" />
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
