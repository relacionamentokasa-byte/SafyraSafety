import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { SafyraLogo } from "@/components/common/SafyraLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Acesso ao Sistema" },
      {
        name: "description",
        content: "Sistema de gestão comercial e operações de campo Safyra Safety.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [session, setSession] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`sb-hxogosqpcewvtwdyerru-auth-token`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
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
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm font-medium text-slate-400">Iniciando sistema...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 text-slate-900">
        {/* Painel Institucional Corporativo (Esquerda) */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-16">
          <div>
            <SafyraLogo logoUrl={settings?.logo_url} size="md" />
          </div>

          <div className="space-y-6 max-w-lg my-auto">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
                Gestão Comercial e Operações de Campo
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Plataforma integrada para controle de carteira de clientes, tabelas de preços, pedidos e apuração de comissões.
              </p>
            </div>

            <div className="border-t border-slate-800 pt-6 space-y-4">
              <div className="flex justify-between items-center text-xs text-slate-400 py-1">
                <span>Representadas Oficiais</span>
                <span className="font-semibold text-slate-200">Nutriex Profissional & LIBUS do Brasil</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 py-1 border-t border-slate-800/60">
                <span>Ambiente de Operação</span>
                <span className="font-semibold text-slate-200">Goiás & Centro-Oeste</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 py-1 border-t border-slate-800/60">
                <span>Controle de Acesso</span>
                <span className="font-semibold text-slate-200">Restrito a Usuários Autorizados</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-6 border-t border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              Conexão Segura
            </span>
            <span>© {new Date().getFullYear()} Safyra Safety</span>
          </div>
        </div>

        {/* Formulário de Acesso (Direita) */}
        <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-slate-50">
          <div className="lg:hidden flex items-center justify-center pt-4 pb-6">
            <SafyraLogo logoUrl={settings?.logo_url} size="md" />
          </div>

          <div className="w-full max-w-sm mx-auto my-auto py-6">
            <div className="mb-8 space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Entrar no Sistema
              </h2>
              <p className="text-xs text-slate-500">
                Informe seu e-mail e senha para acessar sua conta.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-sm">
              <Auth
                supabaseClient={supabase}
                appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: {
                        brand: "#0F172A",
                        brandAccent: "#1E293B",
                        inputBackground: "#FFFFFF",
                        inputText: "#0F172A",
                        inputBorder: "#E2E8F0",
                        inputBorderFocus: "#0F172A",
                        inputBorderHover: "#CBD5E1",
                      },
                      radii: {
                        borderRadiusButton: "0.375rem",
                        buttonBorderRadius: "0.375rem",
                        inputBorderRadius: "0.375rem",
                      },
                      fontSizes: {
                        baseBodySize: "13px",
                        baseInputSize: "13px",
                        baseLabelSize: "12px",
                        baseButtonSize: "13px",
                      },
                    },
                  },
                  className: {
                    button: "!font-semibold !h-10 !shadow-none !bg-slate-900 hover:!bg-slate-800",
                    input: "!h-10 !border-slate-300 !text-slate-900 focus:!ring-1 focus:!ring-slate-900 focus:!border-slate-900",
                    label: "!font-medium !text-slate-700 !mb-1",
                  },
                }}
                localization={{
                  variables: {
                    sign_in: {
                      email_label: "E-mail",
                      password_label: "Senha",
                      button_label: "Entrar",
                      loading_button_label: "Acessando...",
                      email_input_placeholder: "nome@safyrasafety.com.br",
                      password_input_placeholder: "••••••••",
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
            </div>

            <div className="mt-6 text-center">
              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Lock className="h-3.5 w-3.5" />
                Acesso corporativo seguro
              </p>
            </div>
          </div>

          <div className="lg:hidden text-center text-xs text-slate-400 py-4">
            <p>© {new Date().getFullYear()} Safyra Safety</p>
          </div>
        </div>
      </div>
    );
  }

  return <Navigate to="/dashboard" />;
}


