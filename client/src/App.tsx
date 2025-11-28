import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/LandingPage";
import AskPage from "@/pages/AskPage";
import VerifyPage from "@/pages/VerifyPage";
import HistoryPage from "@/pages/HistoryPage";
import RewardsPage from "@/pages/RewardsPage";
import SignupPage from "@/pages/SignupPage";
import LoginPage from "@/pages/LoginPage";
import FeedPage from "@/pages/FeedPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/ask" component={AskPage} />
      <Route path="/feed" component={FeedPage} />
      <Route path="/verify" component={VerifyPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/rewards" component={RewardsPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/login" component={LoginPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
