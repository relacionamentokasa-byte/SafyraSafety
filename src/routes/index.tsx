import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import {
  Loader2,
  ShieldCheck,
  MapPin,
  TrendingUp,
  Boxes,
  Lock,
  Sparkles,
} from "lucide-react";
import { SafyraLogo } from "@/components/common/SafyraLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Acesso ao Sistema" },
      {
        name: "description",
        content:
          "Plataforma integrada de gestão comercial, roteirização e inteligência de vendas para representantes de EPI e proteção industrial.",
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
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        <Loader2 className="h-9 w-9 animate-spin text-amber-500" />
        <div className="text-center">
          <p className="text-base font-semibold tracking-wide">Safyra Safety</p>
          <p className="text-xs text-slate-400 mt-0.5">Carregando ambiente seguro...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 text-slate-900 font-sans">
        {/* Painel Esquerdo: Identidade Institucional (Desktop) */}
        <div className="relative hidden lg:flex lg:w-1/2 bg-[#0B132B] text-white flex-col justify-between p-12 xl:p-16 overflow-hidden">
          {/* Elementos visuais de fundo sutis */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          {/* Topo: Logo & Selo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <SafyraLogo logoUrl={settings?.logo_url} size="md" className="brightness-110" />
            </div>
          </div>

          {/* Centro: Mensagem de Posicionamento e Pilares */}
          <div className="relative z-10 my-auto py-8 space-y-8 max-w-lg">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-medium text-amber-400">
                <Sparkles className="h-3.5 w-3.5" />
                Gestão Comercial & Operação de Campo
              </div>
              <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Controle estratégico de clientes, pedidos e representantes
              </h1>
              <p className="text-sm xl:text-base text-slate-300/90 leading-relaxed">
                Plataforma corporativa desenhada para acelerar vendas técnicas de EPIs, proteção industrial e operações em campo.
              </p>
            </div>

            {/* Destaques Rápidos */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
                <div className="h-9 w-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Catálogos Oficiais & Tabelas
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-normal">
                    Linhas técnicas completas <strong>Nutriex Profissional</strong> e <strong>LIBUS do Brasil</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
                <div className="h-9 w-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Roteirização & Inteligência de Campo
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-normal">
                    Check-in de visitas, rotas geolocalizadas e histórico consolidado por cliente.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Metas & Cálculo de Comissões
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-normal">
                    Painel em tempo real de faturamento, metas atingidas e previsão de repasses.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé do Painel Esquerdo */}
          <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Ambiente Seguro • Criptografia SSL
            </span>
            <span>© {new Date().getFullYear()} Safyra Safety</span>
          </div>
        </div>

        {/* Painel Direito: Formulário de Autenticação */}
        <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 xl:p-24 bg-slate-50">
          {/* Logo Mobile (visível apenas em telas menores) */}
          <div className="lg:hidden flex items-center justify-center pt-4 pb-6">
            <SafyraLogo logoUrl={settings?.logo_url} size="md" />
          </div>

          <div className="w-full max-w-md mx-auto my-auto py-6">
            <div className="text-center lg:text-left mb-8 space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Acesse sua conta
              </h2>
              <p className="text-sm text-slate-600">
                Digite suas credenciais corporativas para entrar na plataforma.
              </p>
            </div>

            {/* Container do Form com Card Elevation Sofisticado */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 space-y-4">
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
                        baseBodySize: "14px",
                        baseInputSize: "14px",
                        baseLabelSize: "13px",
                        baseButtonSize: "14px",
                      },
                    },
                  },
                  className: {
                    button: "!font-semibold !h-11 !transition-all !duration-150 !shadow-sm hover:!opacity-95",
                    input: "!h-11 !border-slate-300 !text-slate-900 focus:!ring-2 focus:!ring-slate-900/10",
                    label: "!font-medium !text-slate-700 !mb-1.5",
                  },
                }}
                localization={{
                  variables: {
                    sign_in: {
                      email_label: "E-mail corporativo",
                      password_label: "Senha de acesso",
                      button_label: "Entrar na Plataforma",
                      loading_button_label: "Autenticando credenciais...",
                      email_input_placeholder: "ex: seu-nome@safyrasafety.com.br",
                      password_input_placeholder: "Digite sua senha",
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

            {/* Informação de Apoio / Suporte */}
            <div className="mt-8 text-center text-xs text-slate-500 space-y-2">
              <p className="flex items-center justify-center gap-1.5 text-slate-500">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Acesso restrito a colaboradores e representantes autorizados.
              </p>
            </div>
          </div>

          {/* Rodapé Mobile */}
          <div className="lg:hidden text-center text-xs text-slate-400 py-4 border-t border-slate-200">
            <p>© {new Date().getFullYear()} Safyra Safety • Todos os direitos reservados</p>
          </div>
        </div>
      </div>
    );
  }

  return <Navigate to="/dashboard" />;
}


