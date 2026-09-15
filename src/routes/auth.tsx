import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SafyraLogo } from "@/components/common/SafyraLogo";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("logo_url")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="text-slate-600 hover:text-slate-900">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar ao início
          </Link>
        </Button>
      </div>

      <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="flex justify-center mb-1">
            <SafyraLogo logoUrl={settings?.logo_url} size="lg" />
          </div>
          <CardDescription className="text-sm text-slate-500">
            Acesse sua conta para gerenciar clientes, vendas e equipe de campo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "oklch(0.225 0.085 258.4)",
                    brandAccent: "oklch(0.744 0.181 56.5)",
                  },
                },
              },
            }}
            localization={{
              variables: {
                sign_in: {
                  email_label: "E-mail",
                  password_label: "Senha",
                  button_label: "Entrar no sistema",
                  loading_button_label: "Autenticando...",
                  email_input_placeholder: "ex: seu-email@safyrasafety.com.br",
                  password_input_placeholder: "Sua senha",
                },
              },
            }}
            view="sign_in"
            showLinks={false}
            providers={[]}
            redirectTo={
              typeof window !== "undefined" ? `${window.location.origin}/dashboard` : "/dashboard"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
