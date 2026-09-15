import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  Plus,
  ShoppingCart,
  MapPin,
  UserPlus,
  X,
  FileSpreadsheet
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  description: string;
  icon: typeof Plus;
  onClick: () => void;
  colorClass: string;
}

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o menu flutuante quando o usuário navega ou clica fora
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Se já estiver na página de criação de pedido ou visita, não sobrecarrega a tela
  const isCreationPage =
    location.pathname.includes("/pedidos/novo") ||
    location.pathname.includes("/visitas/novo");

  if (isCreationPage) {
    return null;
  }

  const actions: QuickAction[] = [
    {
      label: "Novo Pedido",
      description: "Abrir emissor de pedido comercial",
      icon: ShoppingCart,
      colorClass: "bg-slate-900 text-white hover:bg-slate-800",
      onClick: () => {
        setIsOpen(false);
        navigate({ to: "/comercial/pedidos/novo" as any });
      },
    },
    {
      label: "Check-in / Nova Visita",
      description: "Registrar visita de campo em cliente",
      icon: MapPin,
      colorClass: "bg-slate-900 text-white hover:bg-slate-800",
      onClick: () => {
        setIsOpen(false);
        navigate({ to: "/campo/visitas/novo" as any });
      },
    },
    {
      label: "Novo Cliente",
      description: "Cadastrar nova empresa na carteira",
      icon: UserPlus,
      colorClass: "bg-slate-800 text-white hover:bg-slate-700",
      onClick: () => {
        setIsOpen(false);
        navigate({ to: "/clientes" as any });
      },
    },
  ];

  return (
    <>
      {/* Backdrop suave quando aberto */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
        />
      )}

      <div
        ref={containerRef}
        className="fixed z-40 right-4 md:right-8 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-8 flex flex-col items-end gap-2.5 select-none"
      >
        {/* Menu de Ações Secundárias */}
        <div
          className={cn(
            "flex flex-col items-end gap-2 transition-all duration-200 origin-bottom-right",
            isOpen
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 translate-y-3 pointer-events-none"
          )}
        >
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                style={{
                  transitionDelay: isOpen ? `${index * 35}ms` : "0ms",
                }}
                className="group flex items-center gap-2.5 pr-1 pl-3 py-1.5 rounded-full bg-white shadow-lg border border-slate-200/80 hover:border-slate-300 hover:shadow-xl transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <div className="text-right">
                  <span className="block text-xs font-semibold text-slate-900 group-hover:text-primary transition-colors">
                    {action.label}
                  </span>
                  <span className="hidden sm:block text-[10px] text-slate-500 font-normal">
                    {action.description}
                  </span>
                </div>
                <div className={cn("p-2 rounded-full shadow-xs transition-transform group-hover:scale-105", action.colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Botão Gatilho Principal (FAB) */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Fechar menu de ações rápidas" : "Abrir menu de ações rápidas (Novo Pedido / Visita)"}
          aria-expanded={isOpen}
          className={cn(
            "h-13 w-13 rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(15,23,42,0.25)] border border-slate-700/50 transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900",
            isOpen
              ? "bg-slate-900 text-white rotate-90 shadow-slate-900/30"
              : "bg-slate-900 hover:bg-slate-800 text-white hover:scale-105"
          )}
        >
          {isOpen ? (
            <X className="h-5 w-5 transition-transform" />
          ) : (
            <Plus className="h-6 w-6 transition-transform" />
          )}
        </button>
      </div>
    </>
  );
}
