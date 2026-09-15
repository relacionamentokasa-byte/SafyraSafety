import { GripVertical, MapPin, Clock, X, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldQuickActions } from "@/components/common/FieldQuickActions";
import { cn } from "@/lib/utils";

interface RouteStopItemProps {
  index: number;
  label: string;
  address?: string;
  phone?: string | null;
  whatsapp?: string | null;
  timeToNext?: string;
  distanceToNext?: string;
  isFirst?: boolean;
  isLast?: boolean;
  onRemove?: () => void;
  status?: string;
}

export function RouteStopItem({
  index,
  label,
  address,
  phone,
  whatsapp,
  timeToNext,
  distanceToNext,
  isFirst,
  isLast,
  onRemove,
  status
}: RouteStopItemProps) {
  return (
    <div className="relative group">
      {/* Linha Conectora */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-muted-foreground/20 z-0" />
      )}

      <div className={cn(
        "flex items-start gap-3 p-3 rounded-lg border bg-card relative z-10 transition-all hover:border-primary/50",
        isFirst && "border-l-4 border-l-blue-500",
        isLast && "border-l-4 border-l-orange-500"
      )}>
        {/* Drag Handle & Number */}
        <div className="flex flex-col items-center gap-2 mt-1">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
            {index + 1}
          </div>
          <GripVertical size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 py-1">
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-bold text-sm truncate pr-6">{label}</h4>
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onRemove}
              >
                <X size={14} />
              </Button>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <MapPin size={10} /> {address || 'Endereço não informado'}
          </p>

          {/* Ações Rápidas de Campo & Deslocamento */}
          <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-slate-100">
            <FieldQuickActions
              phone={phone}
              whatsapp={whatsapp}
              location={{ address }}
              clientName={label}
              variant="compact"
            />

            {(timeToNext || distanceToNext) && !isLast && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono ml-auto">
                <Navigation size={11} className="text-slate-400" />
                <span>{distanceToNext}</span>
                <span className="text-slate-300">/</span>
                <Clock size={11} className="text-slate-400" />
                <span>{timeToNext}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
