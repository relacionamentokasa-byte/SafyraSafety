import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  UserSquare2,
  MapIcon,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onOpenMenu: () => void;
}

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const location = useLocation();
  const pathname = location.pathname;

  const navItems = [
    {
      label: "Início",
      href: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/" || pathname === "/dashboard",
    },
    {
      label: "Pedidos",
      href: "/comercial/pedidos",
      icon: ShoppingCart,
      isActive: pathname.startsWith("/comercial/pedidos"),
    },
    {
      label: "Clientes",
      href: "/clientes",
      icon: UserSquare2,
      isActive: pathname.startsWith("/clientes"),
    },
    {
      label: "Visitas",
      href: "/campo/visitas",
      icon: MapIcon,
      isActive: pathname.startsWith("/campo"),
    },
  ];

  return (
    <nav
      aria-label="Navegação mobile rápida"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar/95 backdrop-blur-md border-t border-sidebar-border shadow-[0_-4px_25px_rgba(0,0,0,0.25)] px-2 py-1.5 flex items-center justify-around select-none"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 active:scale-95",
              item.isActive
                ? "text-white font-bold"
                : "text-slate-400 hover:text-slate-200 font-medium"
            )}
          >
            <div
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                item.isActive ? "bg-slate-800 text-white shadow-xs border border-slate-700/60" : "bg-transparent text-slate-400"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
            </div>
            <span className={cn("text-[11px] mt-0.5 tracking-tight", item.isActive ? "text-white font-semibold" : "text-slate-400")}>
              {item.label}
            </span>
          </Link>
        );
      })}

      {/* Botão Mais para abrir a gaveta com todos os módulos */}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-400 hover:text-slate-200 font-medium transition-all duration-150 active:scale-95"
      >
        <div className="p-1.5 rounded-lg bg-transparent text-slate-400">
          <Menu className="h-5 w-5 shrink-0" />
        </div>
        <span className="text-[11px] mt-0.5 tracking-tight text-slate-400">Mais</span>
      </button>
    </nav>
  );
}
