/**
 * Utilitários para ações rápidas de campo (Field Operations)
 * WhatsApp, Ligação Telefônica, Waze e Google Maps
 */

export interface ClientLocationInfo {
  address?: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function formatFullAddress(info?: ClientLocationInfo | null): string {
  if (!info) return '';
  const parts: string[] = [];

  if (info.address) {
    let street = info.address;
    if (info.address_number) {
      street += `, ${info.address_number}`;
    }
    parts.push(street);
  }

  if (info.neighborhood) {
    parts.push(info.neighborhood);
  }

  if (info.city) {
    let cityState = info.city;
    if (info.state) {
      cityState += ` - ${info.state}`;
    }
    parts.push(cityState);
  } else if (info.state) {
    parts.push(info.state);
  }

  return parts.join(', ');
}

export function getCleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export function getWhatsAppUrl(phone?: string | null, customMessage?: string): string | null {
  const clean = getCleanPhoneNumber(phone);
  if (!clean) return null;

  // Garante DDI 55 do Brasil se tiver 10 ou 11 dígitos
  const formatted = clean.startsWith('55') ? clean : clean.length >= 10 ? `55${clean}` : clean;
  const baseUrl = `https://wa.me/${formatted}`;

  if (customMessage) {
    return `${baseUrl}?text=${encodeURIComponent(customMessage)}`;
  }
  return baseUrl;
}

export function getPhoneCallUrl(phone?: string | null): string | null {
  const clean = getCleanPhoneNumber(phone);
  if (!clean) return null;
  return `tel:${clean}`;
}

export function getWazeUrl(info?: ClientLocationInfo | null): string | null {
  if (!info) return null;

  if (info.latitude && info.longitude) {
    return `https://waze.com/ul?ll=${info.latitude},${info.longitude}&navigate=yes`;
  }

  const fullAddress = formatFullAddress(info);
  if (!fullAddress) return null;

  return `https://waze.com/ul?q=${encodeURIComponent(fullAddress)}&navigate=yes`;
}

export function getGoogleMapsUrl(info?: ClientLocationInfo | null): string | null {
  if (!info) return null;

  if (info.latitude && info.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${info.latitude},${info.longitude}`;
  }

  const fullAddress = formatFullAddress(info);
  if (!fullAddress) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}
