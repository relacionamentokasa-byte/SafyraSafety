import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { SafyraLogo } from "@/components/common/SafyraLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Acesso ao Sistema" },
      {
        name: "description",
        content: "Sistema de gestão comercial e operações de campo Safyra Safety.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
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
      <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
        {/* Painel Esquerdo: Imagem Imersiva de Segurança / EPI + Branding */}
        <div className="relative hidden lg:flex lg:w-7/12 flex-col justify-between p-12 xl:p-16 overflow-hidden">
          {/* Imagem de Fundo de Alta Resolução de EPI & Segurança Industrial */}
          <img
            src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop"
            alt="Profissional com Equipamento de Proteção Individual (EPI)"
            className="absolute inset-0 h-full w-full object-cover object-center brightness-[0.38] contrast-[1.1] scale-105"
          />

          {/* Gradiente e Overlays Cinematográficos */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/70" />
          <div className="absolute inset-0 bg-blue-950/20 mix-blend-multiply" />

          {/* Topo: Logo Oficial */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl">
              <SafyraLogo logoUrl={settings?.logo_url} size="sm" />
              <div className="h-6 w-[1px] bg-slate-700" />
              <div className="text-left">
                <span className="block text-xs font-bold tracking-wider text-white uppercase">Safyra Safety</span>
                <span className="block text-[10px] text-slate-400">Representações Comerciais</span>
              </div>
            </div>
          </div>

          {/* Meio: Mensagem Forte */}
          <div className="relative z-10 max-w-xl space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-400 font-mono">
                <ShieldCheck className="h-4 w-4" /> Proteção & Excelência Operacional
              </span>
              <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight drop-shadow-sm">
                A força da representação técnica em Segurança do Trabalho.
              </h1>
              <p className="text-sm xl:text-base text-slate-300 leading-relaxed max-w-lg font-normal">
                Gestão comercial integrada, suporte consultivo a distribuidores e controle de operações de campo para Goiás e Centro-Oeste.
              </p>
            </div>
          </div>

          {/* Rodapé do Painel */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-white/10">
            <span>Ambiente Corporativo Seguro</span>
            <span>© {new Date().getFullYear()} Safyra Safety</span>
          </div>
        </div>

        {/* Painel Direito: Formulário de Autenticação */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 pt-12 pb-8 sm:p-12 xl:p-16 bg-white text-slate-900 min-h-screen">
          <div className="w-full max-w-sm mx-auto my-auto flex flex-col justify-center pt-8 sm:pt-0">
            {/* Logo no Mobile / Cabeçalho */}
            <div className="lg:hidden flex flex-col items-center justify-center mb-4">
              <SafyraLogo logoUrl={settings?.logo_url} size="md" imageClassName="h-36 max-w-[220px]" />
            </div>

            <div className="mb-6 space-y-1 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Acesse sua conta
              </h2>
              <p className="text-xs text-slate-500">
                Digite suas credenciais de usuário para entrar no portal.
              </p>
            </div>

            <div className="bg-slate-50/50 rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
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
                        borderRadiusButton: "0.5rem",
                        buttonBorderRadius: "0.5rem",
                        inputBorderRadius: "0.5rem",
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
                    button: "!font-semibold !h-10 !shadow-none !bg-slate-900 hover:!bg-slate-800 !transition-colors !rounded-lg",
                    input: "!h-10 !border-slate-300 !text-slate-900 focus:!ring-1 focus:!ring-slate-900 focus:!border-slate-900 !rounded-lg",
                    label: "!font-semibold !text-slate-700 !mb-1.5",
                  },
                }}
                localization={{
                  variables: {
                    sign_in: {
                      email_label: "E-mail de acesso",
                      password_label: "Sua senha",
                      button_label: "Entrar no Sistema",
                      loading_button_label: "Validando acesso...",
                      email_input_placeholder: "usuario@safyrasafety.com.br",
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
              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Autenticação direta via Safyra Cloud
              </p>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400 pt-8 mt-auto">
            <p>© {new Date().getFullYear()} Safyra Safety</p>
          </div>
        </div>
      </div>
    );
  }

  return <Navigate to="/dashboard" />;
}



