import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { loginUser, getStoredUserId } from "@/lib/api";
import { Loader2, LogIn } from "lucide-react";

const loginFormSchema = z.object({
  loginId: z.string().min(1, "Login ID is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const existingUserId = getStoredUserId();
    if (existingUserId) {
      setLocation("/feed");
    }
  }, [setLocation]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      loginId: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const result = await loginUser(data.loginId, data.password);
      
      if (result) {
        toast({
          title: `Welcome back, ${result.display_name}!`,
          description: "You have been logged in successfully.",
        });
        
        setLocation("/feed");
      } else {
        toast({
          title: "Login failed",
          description: "Invalid login ID or password.",
          variant: "destructive",
        });
      }
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
            <CardTitle className="text-2xl font-bold" data-testid="login-title">
              Log in to VeriVerse
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="loginId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Login ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your login ID"
                          data-testid="input-login-id"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-login"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Log In
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline" data-testid="link-signup">
                Sign up
              </Link>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground text-center mb-2">
                Demo credentials:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">aakash / aakash123</div>
                <div className="text-muted-foreground">aneesha / aneesha123</div>
                <div className="text-muted-foreground">shaurya / shaurya123</div>
                <div className="text-muted-foreground">parth / parth123</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
