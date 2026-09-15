import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Phone, Navigation, MessageCircle, MapPin } from 'lucide-react';
import {
  ClientLocationInfo,
  getWhatsAppUrl,
  getPhoneCallUrl,
  getWazeUrl,
  getGoogleMapsUrl,
} from '@/lib/field-actions';
import { cn } from '@/lib/utils';

interface FieldQuickActionsProps {
  phone?: string | null;
  whatsapp?: string | null;
  location?: ClientLocationInfo | null;
  clientName?: string | null;
  className?: string;
  variant?: 'compact' | 'full' | 'buttons';
}

export function FieldQuickActions({
  phone,
  whatsapp,
  location,
  clientName,
  className,
  variant = 'compact',
}: FieldQuickActionsProps) {
  const targetPhone = whatsapp || phone;
  const whatsappUrl = getWhatsAppUrl(
    targetPhone,
    clientName ? `Olá! Sou da Safyra Safety e estou em contato a respeito da ${clientName}.` : undefined
  );
  const callPhone = phone || whatsapp;
  const callUrl = getPhoneCallUrl(callPhone);
  const wazeUrl = getWazeUrl(location);
  const mapsUrl = getGoogleMapsUrl(location);

  const hasNavigation = !!wazeUrl || !!mapsUrl;

  if (variant === 'buttons') {
    return (
      <div className={cn("flex items-center gap-1.5 flex-1 min-w-0", className)}>
        {/* WhatsApp Direto */}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="h-7.5 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all hover:bg-emerald-100/70 shrink-0"
            title="Abrir WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5 fill-emerald-600/20 text-emerald-600" />
            <span>WhatsApp</span>
          </a>
        )}

        {/* Ligar Rápido */}
        {callUrl && (
          <a
            href={callUrl}
            className="h-7.5 px-2 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all hover:bg-slate-100 shrink-0"
            title="Ligar para o cliente"
          >
            <Phone className="h-3.5 w-3.5 text-slate-600" />
            <span>Ligar</span>
          </a>
        )}

        {/* Navegação GPS (Waze / Google Maps) */}
        {hasNavigation && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7.5 px-2 rounded-lg border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 active:scale-95 shrink-0"
              >
                <Navigation className="h-3.5 w-3.5 text-blue-600" />
                <span>GPS / Rota</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {wazeUrl && (
                <DropdownMenuItem asChild>
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Navigation className="h-4 w-4 text-cyan-600" />
                    Abrir no Waze
                  </a>
                </DropdownMenuItem>
              )}
              {mapsUrl && (
                <DropdownMenuItem asChild>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <MapPin className="h-4 w-4 text-red-500" />
                    Abrir no Google Maps
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 shrink-0", className)}>
      {/* WhatsApp */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center active:scale-95 transition-all hover:bg-emerald-100"
          title="WhatsApp Direto"
        >
          <MessageCircle className="h-4 w-4 fill-emerald-600/20 text-emerald-600" />
        </a>
      )}

      {/* Ligar */}
      {callUrl && (
        <a
          href={callUrl}
          className="h-8 w-8 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center active:scale-95 transition-all hover:bg-slate-100"
          title="Discar Rápido"
        >
          <Phone className="h-4 w-4 text-slate-600" />
        </a>
      )}

      {/* GPS */}
      {hasNavigation && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-slate-200 text-slate-700 active:scale-95"
              title="Abrir GPS / Rotas"
            >
              <Navigation className="h-4 w-4 text-blue-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {wazeUrl && (
              <DropdownMenuItem asChild>
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer flex items-center gap-2 font-medium"
                >
                  <Navigation className="h-4 w-4 text-cyan-600" />
                  Navegar com Waze
                </a>
              </DropdownMenuItem>
            )}
            {mapsUrl && (
              <DropdownMenuItem asChild>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer flex items-center gap-2 font-medium"
                >
                  <MapPin className="h-4 w-4 text-red-500" />
                  Abrir no Google Maps
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
