import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MapPin,
  Users,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  BarChart3,
} from "lucide-react";
import { SafyraLogo } from "@/components/common/SafyraLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Gestão Comercial & Performance" },
      {
        name: "description",
        content:
          "Sistema inteligente para gestão de segurança operacional, equipes de vendas e operações de campo.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    });

    return () => subscription.unsubscribe();
  }, []);

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
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-50 to-slate-100/70 text-slate-900">
        {/* Top Navbar */}
        <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-28 flex items-center justify-between">
            <SafyraLogo logoUrl={settings?.logo_url} size="md" />
            <div className="flex items-center gap-3">
              <Button asChild size="sm">
                <Link to="/auth" className="flex items-center gap-2">
                  Entrar no Sistema
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16 flex flex-col items-center text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-tight">
            Controle total de clientes, representantes e operações
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-slate-600 max-w-2xl">
            A plataforma integrada para acelerar pedidos, roteirização em campo, metas e comissões
            da Safyra Safety.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto font-bold text-base h-12 px-8 shadow-lg shadow-primary/25"
            >
              <Link to="/auth">Fazer Login</Link>
            </Button>
          </div>

          {/* Diretrizes e Módulos */}
          <div className="mt-16 w-full text-left">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Diretrizes da Plataforma</h2>
                <p className="text-xs text-slate-500">
                  Módulos centrais integrados da Safyra Safety
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">1. HIERARQUIA TERRITORIAL</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-11">
                  Vendas e prospecções vinculadas por <strong>Região</strong> e{" "}
                  <strong>Representante exclusivo</strong>.
                </p>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    <Users className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">2. CARTEIRA DE CLIENTES</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-11">
                  Gestão completa com busca por CNPJ, geolocalização e histórico de compras.
                </p>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">3. CRM & OPORTUNIDADES</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-11">
                  Funil de vendas, visitas em campo com check-in e cálculo automático de comissões.
                </p>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                    <Layers className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">4. PRODUTOS & MATERIAIS</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-11">
                  Catálogo digital, fichas técnicas e tabela de preços com regras por fabricante.
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Safyra Safety. Todos os direitos reservados.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Ambiente Seguro
              </span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return <Navigate to="/dashboard" />;
}
