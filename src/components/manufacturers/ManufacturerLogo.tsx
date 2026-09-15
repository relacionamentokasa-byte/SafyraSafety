import { useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

function getStorageUrl(path: string) {
  return supabase.storage.from('company_assets_v2').getPublicUrl(path).data.publicUrl;
}

interface ManufacturerLogoProps {
  name?: string | null;
  logoPath?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

export function getManufacturerLogoUrl(logoPath?: string | null) {
  if (!logoPath) return null;
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) return logoPath;
  return getStorageUrl(logoPath);
}

export function ManufacturerLogo({ name, logoPath, size = 'md', className }: ManufacturerLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const logoUrl = getManufacturerLogoUrl(logoPath);
  const initials = (name || 'F')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const showLogo = logoUrl && failedUrl !== logoUrl;

  return (
    <div className={cn(sizeClasses[size], 'shrink-0 overflow-hidden rounded-md border bg-white flex items-center justify-center shadow-xs', className)}>
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`Logo ${name || 'do fabricante'}`}
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        <span className="text-xs font-semibold text-muted-foreground" aria-label={`Fabricante ${name || ''}`}>
          {initials || 'F'}
        </span>
      )}
    </div>
  );
}
