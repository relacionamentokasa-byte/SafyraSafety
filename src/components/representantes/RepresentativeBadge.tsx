import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDisplayName } from "@/lib/format-name";

interface RepresentativeBadgeProps {
  name?: string | null;
  photoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
  nameClassName?: string;
  fallbackText?: string;
}

export function RepresentativeBadge({
  name,
  photoUrl,
  size = "sm",
  showName = true,
  className,
  nameClassName,
  fallbackText,
}: RepresentativeBadgeProps) {
  const displayName = name ? formatDisplayName(name) : (fallbackText || "Não informado");
  const initial = (name || fallbackText || "R").charAt(0).toUpperCase();

  const sizeClasses = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Avatar className={cn(sizeClasses[size], "shrink-0 border border-slate-200/60 shadow-2xs")}>
        {photoUrl && <AvatarImage src={photoUrl} alt={displayName} className="object-cover" />}
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {initial}
        </AvatarFallback>
      </Avatar>
      {showName && (
        <span className={cn("truncate font-medium text-slate-800", nameClassName)}>
          {displayName}
        </span>
      )}
    </div>
  );
}
