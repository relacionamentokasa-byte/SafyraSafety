import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const getCompanySettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  });

export const saveCompanySettings = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const { settingsId, values, userId } = data;
    const payload = {
      ...values,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (settingsId) {
      const { data: updated, error } = await supabase
        .from('company_settings')
        .update(payload as any)
        .eq('id', settingsId)
        .select('*')
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('company_settings')
        .insert([payload] as any)
        .select('*')
        .single();
      if (error) throw error;
      return inserted;
    }
  });
