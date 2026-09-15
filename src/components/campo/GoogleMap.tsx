import { useEffect, useRef, useState } from 'react';
import { Card } from "@/components/ui/card";
import { MapPin } from 'lucide-react';

interface GoogleMapProps {
  apiKey: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: Array<{
    id: string;
    position: { lat: number; lng: number };
    title: string;
    label?: string | { text: string; color?: string; fontWeight?: string; fontSize?: string };
    icon?: any;
    isProspect?: boolean;
    category?: string;
  }>;
  routeGeometry?: Array<{ lat: number; lng: number }>; // Curvas reais de rodovia
  onMarkerClick?: (id: string) => void;
  showPolyline?: boolean;
  polylineOptions?: any;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export function GoogleMap({
  apiKey,
  center = { lat: -16.6869, lng: -49.2648 }, // Goiânia Default
  zoom = 12,
  markers = [],
  routeGeometry,
  onMarkerClick,
  showPolyline = false,
  polylineOptions = {
    strokeColor: '#2563eb',
    strokeOpacity: 0.85,
    strokeWeight: 5,
  }
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const activeMarkersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!apiKey) {
      setUseIframeFallback(true);
      setLoading(false);
      return;
    }

    if (window.google?.maps) {
      initMap();
      return;
    }

    const scriptId = 'google-maps-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
      script.async = true;
      script.defer = true;

      window.initMap = () => {
        initMap();
      };

      script.onerror = () => {
        setUseIframeFallback(true);
        setLoading(false);
      };

      document.head.appendChild(script);
    } else {
      const timeout = setTimeout(() => {
        if (!window.google?.maps) {
          setUseIframeFallback(true);
          setLoading(false);
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }

    function initMap() {
      if (!mapRef.current || !window.google?.maps) return;

      try {
        const newMap = new window.google.maps.Map(mapRef.current, {
          center,
          zoom,
          disableDefaultUI: false,
        });

        setMap(newMap);
        setLoading(false);
      } catch (err) {
        setUseIframeFallback(true);
        setLoading(false);
      }
    }
  }, [apiKey]);

  // Gerenciamento de Marcadores e Polylines
  useEffect(() => {
    if (!map || !window.google?.maps) return;

    // Limpar marcadores antigos
    activeMarkersRef.current.forEach(m => m.setMap(null));
    activeMarkersRef.current = [];

    // Limpar polyline antiga
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new window.google.maps.LatLngBounds();

    markers.forEach((markerData) => {
      let icon = markerData.icon;
      if (!icon && markerData.isProspect && window.google?.maps) {
        icon = {
          path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: '#ea580c', // Laranja Safyra para prospects
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
        };
      }

      const marker = new window.google.maps.Marker({
        position: markerData.position,
        map,
        title: markerData.title,
        label: markerData.label,
        icon: icon,
        animation: window.google.maps.Animation.DROP
      });

      if (onMarkerClick) {
        marker.addListener('click', () => onMarkerClick(markerData.id));
      }

      activeMarkersRef.current.push(marker);
      bounds.extend(markerData.position);
    });

    if (markers.length > 1) {
      map.fitBounds(bounds);
    } else if (markers.length === 1) {
      map.setCenter(markers[0].position);
      map.setZoom(15);
    }

    if (showPolyline) {
      const path = routeGeometry && routeGeometry.length > 0
        ? routeGeometry
        : markers.map(m => m.position);

      if (path.length > 1) {
        polylineRef.current = new window.google.maps.Polyline({
          path,
          map,
          ...polylineOptions
        });
      }
    }

  }, [map, markers, routeGeometry, showPolyline]);

  if (useIframeFallback) {
    const lat = markers.length > 0 ? markers[0].position.lat : center.lat;
    const lng = markers.length > 0 ? markers[0].position.lng : center.lng;
    const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.5}%2C${lat - 0.5}%2C${lng + 0.5}%2C${lat + 0.5}&layer=mapnik&marker=${lat}%2C${lng}`;

    return (
      <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border relative bg-muted/20">
        <iframe
          title="Mapa de Roteirização"
          src={osmUrl}
          className="w-full h-full border-0 min-h-[400px]"
        />
        {markers.length > 0 && (
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur p-3 rounded-lg shadow-lg border text-xs space-y-1 z-10 max-w-xs">
            <p className="font-bold flex items-center gap-1.5"><MapPin size={14} className="text-primary"/> Paradas na Rota ({markers.length})</p>
            <div className="max-h-36 overflow-y-auto divide-y text-[11px] text-muted-foreground">
              {markers.map((m, idx) => (
                <div key={m.id} className="py-1 flex justify-between gap-2">
                  <span className="font-medium text-foreground">{idx + 1}. {m.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={mapRef} className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border" />
  );
}

