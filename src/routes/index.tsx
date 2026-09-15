import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { SafyraLogo } from "@/components/common/SafyraLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Autenticação" },
      {
        name: "description",
        content: "Acesso ao sistema de gestão comercial e operações de campo Safyra Safety.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        navigate({ to: "/dashboard" });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-slate-500">Iniciando Safyra Safety...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white">
            <CardHeader className="text-center space-y-3 pb-6">
              <div className="flex justify-center mb-1">
                <SafyraLogo logoUrl={settings?.logo_url} size="lg" />
              </div>
              <CardDescription className="text-sm text-slate-500">
                Acesse sua conta para gerenciar clientes, vendas e operações de campo.
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
                  typeof window !== "undefined"
                    ? `${window.location.origin}/dashboard`
                    : "/dashboard"
                }
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4">
          <div className="max-w-md mx-auto px-4 flex items-center justify-between text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Safyra Safety</p>
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Ambiente Seguro
            </span>
          </div>
        </footer>
      </div>
    );
  }

  return <Navigate to="/dashboard" />;
}

