import { Link, useLocation } from "wouter";
import { Moon, Sun, LogIn, LogOut, User, History, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getStoredUserId, clearStoredUserId } from "@/lib/api";

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

function UserMenu() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [localUserId, setLocalUserId] = useState<string | null>(null);

  useEffect(() => {
    setLocalUserId(getStoredUserId());
  }, []);

  const handleSignOut = () => {
    clearStoredUserId();
    setLocalUserId(null);
    if (isAuthenticated) {
      window.location.href = "/api/logout";
    } else {
      setLocation("/");
    }
  };

  if (isLoading) {
    return (
      <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
    );
  }

  const hasUser = isAuthenticated || localUserId;

  if (!hasUser) {
    return (
      <Link href="/signup">
        <Button
          variant="outline"
          size="sm"
          data-testid="button-signup"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Sign Up
        </Button>
      </Link>
    );
  }

  const initials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  const displayName = user?.firstName 
    ? `${user.firstName} ${user.lastName || ""}` 
    : user?.displayName || user?.email || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2 p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-medium" data-testid="user-name">
              {displayName}
            </p>
            {user?.email && (
              <p className="text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/history")} data-testid="menu-history">
          <History className="mr-2 h-4 w-4" />
          <span>My History</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/rewards")} data-testid="menu-rewards">
          <User className="mr-2 h-4 w-4" />
          <span>Rewards</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSignOut}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
            <UserMenu />
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
