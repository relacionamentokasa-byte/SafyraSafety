import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clientSchema = z.object({
  legalName: z.string().min(1, "Razão Social é obrigatória"),
  tradeName: z.string().min(1, "Nome Fantasia é obrigatório"),
  cnpj: z.string().optional().nullable().refine(
    (val) => !val || val.replace(/\D/g, "").length === 14,
    { message: "CNPJ deve conter 14 dígitos" }
  ),
  stateRegistration: z.string().optional().nullable(),
  segment: z.string().optional().nullable(),
  clientType: z.string().optional().nullable(),
  status: z.enum(["prospect", "active", "inactive", "blocked"]).default("active"),

  // Contato (Opcionais)
  contactName: z.string().optional().nullable(),
  contactRole: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().optional().nullable().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: "E-mail inválido" }
  ),

  // Endereço (Opcionais)
  cep: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),

  // Localização
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),

  // Comercial
  representativeId: z.string().optional().nullable(),
  regionId: z.string().optional().nullable(),
  priceTableId: z.string().optional().nullable(),
  purchasePotential: z.enum(["alto", "medio", "baixo"]),
  notes: z.string().optional().nullable(),
});

/**
 * Função de servidor para buscar clientes e métricas via Service Role / Auth
 */
export const fetchClientsServer = createServerFn({ method: "GET" })
  .inputValidator((data: any) => data || {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: clients, error: errClients } = await supabaseAdmin
      .from('clients')
      .select('*, representatives(id, name, photo_url)');

    if (errClients) {
      console.error("Erro ao buscar clientes via server:", errClients);
      return { clients: [], orders: [] };
    }

    const { data: orders, error: errOrders } = await supabaseAdmin
      .from('orders')
      .select('id, client_id, total_amount, created_at, status')
      .not('client_id', 'is', null);

    return {
      clients: clients || [],
      orders: orders || [],
    };
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: inserted } = await context.supabase
      .from('clients')
      .insert([{
        name: data.tradeName || data.legalName,
        legal_name: data.legalName,
        trade_name: data.tradeName,
        cnpj: data.cnpj,
        state_registration: data.stateRegistration,
        segment: data.segment,
        client_type: data.clientType,
        status: data.status,
        contact_name: data.contactName,
        contact_role: data.contactRole,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        zip_code: data.cep,
        address: data.address,
        address_number: data.number,
        address_complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        latitude: data.latitude,
        longitude: data.longitude,
        representative_id: data.representativeId || null,
        region_id: data.regionId || null,
        price_table_id: data.priceTableId === 'none' || !data.priceTableId ? null : data.priceTableId,
        purchase_potential: data.purchasePotential,
        notes: data.notes,
        created_by: context.userId,
      }])
      .select('id')
      .single();

    if (error) {
      console.error("Erro ao criar cliente:", error);
      throw new Error(error.message);
    }

    return { success: true, id: inserted?.id };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    id: z.string().uuid(),
    ...clientSchema.shape,
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...clientData } = data;
    const { error } = await context.supabase
      .from('clients')
      .update({
        name: clientData.tradeName || clientData.legalName,
        legal_name: clientData.legalName,
        trade_name: clientData.tradeName,
        cnpj: clientData.cnpj,
        state_registration: clientData.stateRegistration,
        segment: clientData.segment,
        client_type: clientData.clientType,
        status: clientData.status,
        contact_name: clientData.contactName,
        contact_role: clientData.contactRole,
        phone: clientData.phone,
        whatsapp: clientData.whatsapp,
        email: clientData.email,
        zip_code: clientData.cep,
        address: clientData.address,
        address_number: clientData.number,
        address_complement: clientData.complement,
        neighborhood: clientData.neighborhood,
        city: clientData.city,
        state: clientData.state,
        latitude: clientData.latitude,
        longitude: clientData.longitude,
        representative_id: clientData.representativeId || null,
        region_id: clientData.regionId || null,
        price_table_id: clientData.priceTableId === 'none' || !clientData.priceTableId ? null : clientData.priceTableId,
        purchase_potential: clientData.purchasePotential,
        notes: clientData.notes,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq('id', id);

    if (error) {
      console.error("Erro ao atualizar cliente:", error);
      throw new Error(error.message);
    }

    return { success: true };
  });

export const cleanupAndMergeClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    // 1. Mapeamento de migração segura de pedidos dos 4 clientes sem CNPJ para clientes oficiais
    const migrations = [
      {
        fromId: '52ed874d-5c4b-4379-8f11-28a882440358', // PROTEMAX sem CNPJ
        toId: '1d9f2cc0-1edd-4279-8dfa-6493fc2d1a4b',   // PROTEMAX com CNPJ 12.268.125/0001-86
        name: 'PROTEMAX COMERCIO DE EPI\'S LTDA'
      },
      {
        fromId: '13e4aa39-0d51-4995-8a1e-73a256e48ec2', // FERRAGISTA AZFER sem CNPJ
        toId: 'b353a3a8-5e58-47a6-ace9-89aacff06d2a',   // AZ FERRAGISTA LTDA com CNPJ 27.466.939/0001-00
        name: 'AZ FERRAGISTA LTDA'
      },
      {
        fromId: 'c609f74e-7b40-4356-8c17-455660bf9ebf', // K M DOS SANTOS sem CNPJ
        toId: '58c27bff-28d0-45f2-95e0-d439cfaf1482',   // SK EPIs com CNPJ 39.510.487/0001-98
        name: 'SK EPIs'
      },
      {
        fromId: '01ffd34d-636d-40fc-84b8-7c0c0e1b25c5', // G A SILVA sem CNPJ
        toId: '662c2460-a888-48b9-92fe-293d97641408',   // G.A. SILVA PARAFUSOS com CNPJ 02.532.281/0001-59
        name: 'G.A. SILVA PARAFUSOS'
      }
    ];

    const migrationSummary: any[] = [];
    for (const m of migrations) {
      const { data: updatedOrders, error: errOrders } = await supabase
        .from('orders')
        .update({ client_id: m.toId })
        .eq('client_id', m.fromId)
        .select('id, order_number, total_amount');

      if (errOrders) {
        console.error(`Erro ao migrar pedidos de ${m.name}:`, errOrders);
      }

      await supabase
        .from('commissions')
        .update({ client_id: m.toId })
        .eq('client_id', m.fromId);

      // 3. Excluir o cliente duplicado/sem CNPJ
      await supabase
        .from('clients')
        .delete()
        .eq('id', m.fromId);

      migrationSummary.push({
        from: m.name,
        ordersMoved: updatedOrders?.length || 0,
      });
    }

    return {
      success: true,
      message: 'Base higienizada com sucesso!',
      summary: migrationSummary,
    };
  });

/**
 * Função de servidor para enriquecimento em massa de Latitude e Longitude dos clientes
 */
export const enrichAllClientsGeocoding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    // 1. Buscar todos os clientes
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, name, legal_name, cnpj, zip_code, address, address_number, neighborhood, city, state, latitude, longitude");

    if (error) {
      throw new Error(`Erro ao buscar clientes: ${error.message}`);
    }

    const validClients = (clients || []).filter((c: any) => Boolean(c.cnpj && c.cnpj.replace(/\D/g, "").length === 14));

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results: Array<{ name: string; city?: string; state?: string; lat?: number; lng?: number; status: string }> = [];

    for (const client of validClients) {
      try {
        const cleanCnpj = client.cnpj.replace(/\D/g, "");
        let address = client.address || "";
        let number = client.address_number || "";
        let neighborhood = client.neighborhood || "";
        let city = client.city || "";
        let state = client.state || "";
        let zipCode = (client.zip_code || "").replace(/\D/g, "");
        let latitude = client.latitude;
        let longitude = client.longitude;

        // Se faltar endereço ou CEP completo, busca via BrasilAPI/Minha Receita
        if (!city || !state || !zipCode || !address) {
          try {
            let res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (!res.ok) {
              res = await fetch(`https://minhareceita.org/${cleanCnpj}`);
            }
            if (res.ok) {
              const data = await res.json();
              city = city || data.municipio || data.city || "";
              state = state || data.uf || data.state || "";
              address = address || data.logradouro || data.address || "";
              number = number || data.numero || data.address_number || "";
              neighborhood = neighborhood || data.bairro || data.neighborhood || "";
              zipCode = zipCode || (data.cep || "").replace(/\D/g, "");
            }
          } catch (e) {
            // Segue com o que já tem
          }
        }

        // Se ainda não tiver latitude/longitude, geocodifica
        if (!latitude || !longitude) {
          // Tentativa 1: Endereço completo + Cidade + UF
          if (address && city && state) {
            try {
              const q1 = encodeURIComponent(`${address}${number ? ' ' + number : ''}, ${city}, ${state}, Brasil`);
              const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${q1}&format=json&limit=1`, {
                headers: { 'User-Agent': 'SafyraSafety/1.0 (comercial@safyrasafety.com.br)' }
              });
              if (geoRes.ok) {
                const geo = await geoRes.json();
                if (geo && geo.length > 0) {
                  latitude = parseFloat(geo[0].lat);
                  longitude = parseFloat(geo[0].lon);
                }
              }
            } catch (e) {
              // Segue
            }
          }

          // Tentativa 2: CEP via BrasilAPI v2 (traz coordenadas de alta precisão)
          if ((!latitude || !longitude) && zipCode && zipCode.length === 8) {
            try {
              const cepRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${zipCode}`);
              if (cepRes.ok) {
                const cepJson = await cepRes.json();
                if (cepJson.location?.coordinates?.latitude && cepJson.location?.coordinates?.longitude) {
                  latitude = Number(cepJson.location.coordinates.latitude);
                  longitude = Number(cepJson.location.coordinates.longitude);
                }
              }
            } catch (e) {
              // Segue
            }
          }

          // Tentativa 3: Cidade + UF
          if ((!latitude || !longitude) && city && state) {
            try {
              const qCity = encodeURIComponent(`${city}, ${state}, Brasil`);
              const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${qCity}&format=json&limit=1`, {
                headers: { 'User-Agent': 'SafyraSafety/1.0 (comercial@safyrasafety.com.br)' }
              });
              if (geoRes.ok) {
                const geo = await geoRes.json();
                if (geo && geo.length > 0) {
                  latitude = parseFloat(geo[0].lat);
                  longitude = parseFloat(geo[0].lon);
                }
              }
            } catch (e) {
              // Segue
            }
          }
        }

        // Salvar alterações no Supabase
        if (latitude != null && longitude != null) {
          const updatePayload: any = {
            latitude,
            longitude,
          };
          if (address && !client.address) updatePayload.address = address;
          if (number && !client.address_number) updatePayload.address_number = number;
          if (neighborhood && !client.neighborhood) updatePayload.neighborhood = neighborhood;
          if (city && !client.city) updatePayload.city = city;
          if (state && !client.state) updatePayload.state = state;
          if (zipCode && !client.zip_code) updatePayload.zip_code = zipCode;

          const { error: updateError } = await supabase
            .from("clients")
            .update(updatePayload)
            .eq("id", client.id);

          if (updateError) {
            failedCount++;
            results.push({ name: client.name || client.legal_name, status: "error" });
          } else {
            updatedCount++;
            results.push({ name: client.name || client.legal_name, city, state, lat: latitude, lng: longitude, status: "updated" });
          }
        } else {
          skippedCount++;
          results.push({ name: client.name || client.legal_name, status: "no_coords_found" });
        }

        // Pequena pausa para respeitar o rate-limit das APIs públicas (150ms)
        await new Promise((r) => setTimeout(r, 150));
      } catch (err) {
        failedCount++;
        results.push({ name: client.name || client.legal_name, status: "failed" });
      }
    }

    return {
      success: true,
      total: validClients.length,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    };
  });

/**
 * Mover cliente para a Lixeira (Soft Delete)
 */
export const moveToTrashClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { id } = data;

    const { data: client, error: fetchErr } = await supabase
      .from("clients")
      .select("id, notes, status")
      .eq("id", id)
      .single();

    if (fetchErr || !client) {
      throw new Error("Cliente não encontrado.");
    }

    const currentNotes = client.notes || "";
    const trashMarker = `[TRASH:${new Date().toISOString()}]`;
    const updatedNotes = currentNotes.includes("[TRASH:")
      ? currentNotes
      : `${trashMarker} ${currentNotes}`.trim();

    const { error: updateErr } = await supabase
      .from("clients")
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", id);

    if (updateErr) {
      throw new Error(`Erro ao mover cliente para a lixeira: ${updateErr.message}`);
    }

    return { success: true, message: "Cliente movido para a lixeira com sucesso." };
  });

/**
 * Restaurar cliente da Lixeira
 */
export const restoreFromTrashClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { id } = data;

    const { data: client, error: fetchErr } = await supabase
      .from("clients")
      .select("id, notes")
      .eq("id", id)
      .single();

    if (fetchErr || !client) {
      throw new Error("Cliente não encontrado.");
    }

    const cleanedNotes = (client.notes || "").replace(/\[TRASH:[^\]]+\]\s*/g, "").trim();

    const { error: updateErr } = await supabase
      .from("clients")
      .update({
        notes: cleanedNotes || null,
        status: "active",
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", id);

    if (updateErr) {
      throw new Error(`Erro ao restaurar cliente: ${updateErr.message}`);
    }

    return { success: true, message: "Cliente restaurado com sucesso." };
  });

/**
 * Excluir cliente permanentemente (Hard Delete seguro)
 */
export const deleteClientPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { id } = data;

    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("client_id", id);

    if (orders && orders.length > 0) {
      for (const ord of orders) {
        await supabase.from("order_items").delete().eq("order_id", ord.id);
        await supabase.from("commissions").delete().eq("order_id", ord.id);
        await supabase.from("order_payments").delete().eq("order_id", ord.id);
        await supabase.from("orders").delete().eq("id", ord.id);
      }
    }

    await supabase.from("visits").delete().eq("client_id", id);
    await supabase.from("client_contacts").delete().eq("client_id", id);
    await supabase.from("follow_ups").delete().eq("client_id", id);
    await supabase.from("opportunities").delete().eq("client_id", id);

    const { error: delErr } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

    if (delErr) {
      throw new Error(`Erro ao excluir cliente permanentemente: ${delErr.message}`);
    }

    return { success: true, message: "Cliente excluído permanentemente." };
  });

/**
 * Esvaziar lixeira
 */
export const emptyClientTrash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    const { data: trashedClients, error: fetchErr } = await supabase
      .from("clients")
      .select("id, notes");

    if (fetchErr) throw fetchErr;

    const inTrash = (trashedClients || []).filter((c: any) => (c.notes || "").includes("[TRASH:"));
    let deletedCount = 0;

    for (const c of inTrash) {
      const { data: orders } = await supabase.from("orders").select("id").eq("client_id", c.id);
      if (orders && orders.length > 0) {
        for (const ord of orders) {
          await supabase.from("order_items").delete().eq("order_id", ord.id);
          await supabase.from("commissions").delete().eq("order_id", ord.id);
          await supabase.from("order_payments").delete().eq("order_id", ord.id);
          await supabase.from("orders").delete().eq("id", ord.id);
        }
      }
      await supabase.from("visits").delete().eq("client_id", c.id);
      await supabase.from("client_contacts").delete().eq("client_id", c.id);
      await supabase.from("follow_ups").delete().eq("client_id", c.id);
      await supabase.from("opportunities").delete().eq("client_id", c.id);
      await supabase.from("clients").delete().eq("id", c.id);
      deletedCount++;
    }

    return { success: true, count: deletedCount, message: `${deletedCount} clientes excluídos permanentemente.` };
  });


