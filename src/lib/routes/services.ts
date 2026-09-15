import { supabase } from "@/integrations/supabase/client";
import { Route, RouteStop } from "@/types/database.types";

export const routesService = {
  async getMyRoutes() {
    const { data, error } = await supabase
      .from('routes')
      .select('*, stops:route_stops(*)')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data as any as Route[];
  },

  async getRouteById(id: string) {
    const { data, error } = await supabase
      .from('routes')
      .select('*, stops:route_stops(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as any as Route;
  },

  async createRoute(route: Omit<Route, 'id' | 'created_at' | 'updated_at'>, stops: Omit<RouteStop, 'id' | 'route_id' | 'created_at' | 'updated_at'>[]) {
    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert(route as any)
      .select()
      .single();
    
    if (routeError) throw routeError;

    const stopsWithRouteId = stops.map((stop, index) => ({
      ...stop,
      route_id: routeData.id,
      sequence_order: index + 1
    }));

    const { error: stopsError } = await supabase
      .from('route_stops')
      .insert(stopsWithRouteId as any);
    
    if (stopsError) throw stopsError;

    return routeData as any as Route;
  },

  async updateRouteStatus(id: string, status: Route['status']) {
    const { error } = await supabase
      .from('routes')
      .update({ status } as any)
      .eq('id', id);
    
    if (error) throw error;
  }
};
