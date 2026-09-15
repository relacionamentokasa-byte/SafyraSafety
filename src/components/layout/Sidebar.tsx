import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Map as MapIcon,
  UserSquare2,
  BarChart3,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Contact2,
  MapPinned,
  Route,
  Package,
  Briefcase,
  UploadCloud
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SafyraLogo } from "@/components/common/SafyraLogo";

interface SidebarItemProps {
  icon: any;
  label: string;
  href: string;
  collapsed?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, href, collapsed, onClick }: SidebarItemProps) {
  return (
    <Link
      to={href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-slate-800/80 text-slate-300 hover:text-white font-medium text-sm"
      activeProps={{ className: "bg-slate-800 text-white font-semibold shadow-xs hover:bg-slate-800 hover:text-white border border-slate-700/60" }}
    >
      <Icon className="h-4.5 w-4.5 shrink-0 text-slate-400 group-hover:text-white" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export function Sidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('company_settings').select('*').limit(1).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <aside
      className={cn(
        "h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className={cn(
        "relative p-3 border-b border-sidebar-border flex items-center justify-center bg-white/95 rounded-b-xl mx-2 mt-2 shadow-xs",
        collapsed ? "min-h-[64px] !mx-1 !mt-1" : "min-h-[128px]"
      )}>
        {!collapsed ? (
          <div className="w-full flex items-center justify-center py-2 px-1">
            <SafyraLogo
              logoUrl={settings?.logo_url}
              size="md"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <SafyraLogo
              logoUrl={settings?.logo_url}
              showText={false}
              size="sm"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute top-1.5 right-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 h-6 w-6"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" collapsed={collapsed} onClick={onNavigate} />

        <div className="py-2">
          {!collapsed && <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Comercial</p>}
          <SidebarItem icon={ShoppingCart} label="Pedidos" href="/comercial/pedidos" collapsed={collapsed} onClick={onNavigate} />
          <SidebarItem icon={Package} label="Produtos" href="/comercial/produtos" collapsed={collapsed} onClick={onNavigate} />
          <SidebarItem icon={Briefcase} label="Oportunidades" href="/comercial/oportunidades" collapsed={collapsed} onClick={onNavigate} />
          <SidebarItem icon={BarChart3} label="Metas" href="/comercial/metas" collapsed={collapsed} onClick={onNavigate} />
          <SidebarItem icon={FileText} label="Comissões" href="/comercial/comissoes" collapsed={collapsed} onClick={onNavigate} />
        </div>

        <div className="py-2">
          {!collapsed && <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Equipe</p>}
          <SidebarItem icon={Contact2} label="Representantes" href="/representantes" collapsed={collapsed} onClick={onNavigate} />
          <SidebarItem icon={MapPinned} label="Regiões" href="/regioes" collapsed={collapsed} onClick={onNavigate} />
        </div>

        <div className="py-2">
          {!collapsed && <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Clientes</p>}
          <SidebarItem icon={UserSquare2} label="Clientes" href="/clientes" collapsed={collapsed} onClick={onNavigate} />
        </div>

        <div className="py-2">
          {!collapsed && <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operação de Campo</p>}
          <SidebarItem icon={Route} label="Roteirização" href="/campo/roteirizacao" collapsed={collapsed} onClick={onNavigate} />
          <SidebarItem icon={MapIcon} label="Minhas Visitas" href="/campo/visitas" collapsed={collapsed} onClick={onNavigate} />
        </div>

        <div className="py-2">
          {!collapsed && <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gestão</p>}
          <SidebarItem icon={BarChart3} label="Relatórios" href="/relatorios" collapsed={collapsed} onClick={onNavigate} />
        </div>
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <SidebarItem icon={Settings} label="Configurações" href="/configuracoes" collapsed={collapsed} onClick={onNavigate} />
      </div>
    </aside>
  );
}
