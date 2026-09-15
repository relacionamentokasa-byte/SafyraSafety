import { cn } from "@/lib/utils";

interface SafyraLogoProps {
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  textColor?: string;
  size?: "sm" | "md" | "lg";
}

export function SafyraLogo({
  logoUrl,
  className,
  imageClassName,
  showText = true,
  size = "md",
}: SafyraLogoProps) {
  // Se houver logo personalizada vinda das configurações, usamos ela; caso contrário, a logo oficial
  const imageSrc = logoUrl || "/safyra-logo.png";

  const sizeClasses = {
    sm: showText ? "h-14 max-w-[140px]" : "h-9 w-9",
    md: showText ? "h-28 w-auto max-w-[200px]" : "h-12 w-12",
    lg: showText ? "h-40 max-w-[280px]" : "h-20 w-20",
  };

  return (
    <div className={cn("inline-flex items-center justify-center select-none", className)}>
      <img
        src={imageSrc}
        alt="Safyra Safety Representações"
        className={cn(
          "w-auto object-contain transition-transform duration-200 hover:scale-[1.02]",
          sizeClasses[size],
          imageClassName
        )}
      />
    </div>
  );
}
