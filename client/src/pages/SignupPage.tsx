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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { createUser, getStoredUserId } from "@/lib/api";
import { Loader2, X, Plus } from "lucide-react";

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

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const existingUserId = getStoredUserId();
    if (existingUserId) {
      setLocation("/ask");
    }
  }, [setLocation]);

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
