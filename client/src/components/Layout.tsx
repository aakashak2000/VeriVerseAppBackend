import { Link, useLocation } from "wouter";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from "react";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  );
}

interface LayoutProps {
  children: ReactNode;
  error?: string | null;
}

export default function Layout({ children, error }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-center text-sm text-destructive" data-testid="error-banner">
          {error}
        </div>
      )}

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" data-testid="link-logo">
            <span className="relative text-xl font-bold text-foreground">
              VeriVerse
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary"></span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link href="/ask">
              <Button
                variant={location === "/ask" ? "secondary" : "ghost"}
                size="sm"
                data-testid="link-ask"
              >
                Ask
              </Button>
            </Link>
            <Link href="/verify">
              <Button
                variant={location === "/verify" ? "secondary" : "ghost"}
                size="sm"
                data-testid="link-community"
              >
                Community
              </Button>
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
