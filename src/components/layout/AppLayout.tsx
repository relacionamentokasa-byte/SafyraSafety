import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { cn } from "@/lib/utils";
import { ReactNode, useState, useEffect } from "react";
import { Menu, User, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationPanel } from "./NotificationPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: userProfile } = useCurrentProfile();

  useEffect(() => {
    if (userProfile?.force_password_change && location.pathname !== "/auth/reset-password") {
      navigate({ to: "/auth/reset-password" } as any);
    }
  }, [userProfile, location.pathname, navigate]);

  // Gera URL assinada sob demanda a partir do caminho estável (avatar_path)
  // com fallback para avatar_url legado (URL completa)
  const { data: signedAvatarUrl } = useAvatarUrl(
    userProfile?.avatar_path || userProfile?.avatar_url,
  );

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    // Aplica apenas cores válidas e não-default para não sobrescrever o design system do CSS
    if (settings?.primary_color && settings.primary_color !== '#3b82f6') {
      document.documentElement.style.setProperty("--primary", settings.primary_color);
    }
    if (settings?.secondary_color) {
      document.documentElement.style.setProperty("--secondary", settings.secondary_color);
    }
  }, [settings]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" } as any);
  };

  return (
    <div className="flex h-dvh min-h-dvh w-full bg-background overflow-hidden relative">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:flex shrink-0" />

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <Sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        onNavigate={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
        {/* Header */}
        <header className="flex items-center h-16 px-4 md:px-8 border-b border-slate-200/80 bg-white shrink-0 justify-between z-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-slate-700 hover:bg-slate-100"
            >
              <Menu size={22} />
            </Button>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <NotificationPanel />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-1 ring-slate-200 hover:ring-slate-300 transition-all p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={signedAvatarUrl || ""} alt="User" />
                    <AvatarFallback className="bg-slate-900 text-white font-semibold text-xs">
                      {userProfile?.full_name?.charAt(0) || <User size={15} />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userProfile?.full_name || "Minha Conta"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userProfile?.email || "Usuário Safyra"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/minha-conta" })}>
                  <UserRound className="mr-2 h-4 w-4" />
                  Minha conta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes/notificacoes" })}>
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-500 font-medium cursor-pointer"
                >
                  Sair do sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 pb-32 md:pb-8 min-h-0 touch-pan-y -webkit-overflow-scrolling-touch">
          <div className="w-full space-y-6">{children}</div>
        </main>
      </div>

      {/* Botão de Ação Flutuante (FAB) */}
      <FloatingActionButton />

      {/* Barra de Navegação Inferior para Mobile */}
      <BottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
    </div>
  );
}
