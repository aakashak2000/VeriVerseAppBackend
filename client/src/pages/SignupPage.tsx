import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { createUser, getStoredUserId } from "@/lib/api";
import { Loader2, X, Plus, MapPin, Briefcase, Trophy } from "lucide-react";

const signupFormSchema = z.object({
  displayName: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email").or(z.literal("")),
  location: z.string(),
  expertiseTags: z.array(z.string()),
});

type SignupFormData = z.infer<typeof signupFormSchema>;

const EXPERTISE_SUGGESTIONS = [
  "Technology",
  "Healthcare",
  "Politics",
  "Science",
  "Finance",
  "Environment",
  "Aviation",
  "Sports",
  "Entertainment",
  "Education",
];

const ONBOARDING_SHOWN_KEY = "veriverse_onboarding_shown";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const existingUserId = getStoredUserId();
    if (existingUserId) {
      setLocation("/ask");
      return;
    }

    const onboardingShown = sessionStorage.getItem(ONBOARDING_SHOWN_KEY);
    if (!onboardingShown) {
      setShowOnboarding(true);
    }
  }, [setLocation]);

  const handleOnboardingDismiss = () => {
    sessionStorage.setItem(ONBOARDING_SHOWN_KEY, "true");
    setShowOnboarding(false);
  };

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      location: "",
      expertiseTags: [],
    },
  });

  const expertiseTags = form.watch("expertiseTags");

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !expertiseTags.includes(trimmedTag)) {
      form.setValue("expertiseTags", [...expertiseTags, trimmedTag]);
    }
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    form.setValue(
      "expertiseTags",
      expertiseTags.filter((tag) => tag !== tagToRemove)
    );
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      await createUser({
        displayName: data.displayName,
        email: data.email || undefined,
        location: data.location || undefined,
        expertiseTags: data.expertiseTags,
      });
      
      toast({
        title: "Welcome to VeriVerse!",
        description: "Your profile has been created successfully.",
      });
      
      setLocation("/ask");
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <AlertDialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <AlertDialogContent className="max-w-md" data-testid="onboarding-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-center" data-testid="onboarding-title">
              Welcome to VeriVerse
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <p className="text-center text-muted-foreground">
                  Before you get started, here's why your profile matters:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Location builds credibility</p>
                      <p className="text-sm text-muted-foreground">Your location helps verify regional expertise and connect you with local claims.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Briefcase className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Expertise fast-tracks you</p>
                      <p className="text-sm text-muted-foreground">Adding expertise areas gives your votes more weight and helps you earn expert status faster.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Trophy className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Accuracy boosts your rank</p>
                      <p className="text-sm text-muted-foreground">Contribute accurate information to climb the leaderboard and maintain your reputation.</p>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogAction 
              onClick={handleOnboardingDismiss}
              className="w-full"
              data-testid="onboarding-dismiss"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-md mx-auto px-4 py-12">
        <Card className="border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold" data-testid="signup-title">
              Create your VeriVerse profile
            </CardTitle>
            <CardDescription data-testid="signup-subtitle">
              Join our community of fact-checkers and help combat misinformation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your name"
                          {...field}
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., San Francisco, London"
                          {...field}
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expertiseTags"
                  render={() => (
                    <FormItem>
                      <FormLabel>Expertise Areas (optional)</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add expertise..."
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={handleTagKeyDown}
                              data-testid="input-expertise"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => addTag(tagInput)}
                              disabled={!tagInput.trim()}
                              data-testid="button-add-tag"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {expertiseTags.length > 0 && (
                            <div className="flex flex-wrap gap-2" data-testid="expertise-tags">
                              {expertiseTags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="gap-1"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    className="ml-1 rounded-full hover:bg-muted"
                                    data-testid={`button-remove-tag-${tag}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {EXPERTISE_SUGGESTIONS.filter(
                              (s) => !expertiseTags.includes(s)
                            ).slice(0, 6).map((suggestion) => (
                              <Button
                                key={suggestion}
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => addTag(suggestion)}
                                data-testid={`button-suggest-${suggestion}`}
                              >
                                + {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-signup"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating profile...
                    </>
                  ) : (
                    "Get Started"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
