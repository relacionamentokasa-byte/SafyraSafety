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

      migrationSummary.push({
        target: m.name,
        ordersMoved: updatedOrders?.length || 0,
        orders: updatedOrders
      });
    }

    // 2. Localizar todos os 24 clientes sem CNPJ para remoção
    const { data: allClients, error: errFetch } = await supabase
      .from('clients')
      .select('id, cnpj, name');

    if (errFetch) throw new Error(errFetch.message);

    const withoutCnpjIds = (allClients || [])
      .filter((c: any) => !c.cnpj || !c.cnpj.replace(/\D/g, ''))
      .map((c: any) => c.id);

    // 3. Excluir os 24 clientes duplicados / sem CNPJ
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .in('id', withoutCnpjIds);

    if (deleteError) {
      console.error("Erro ao deletar clientes sem CNPJ:", deleteError);
      throw new Error(deleteError.message);
    }

    // 4. Conferência final
    const { data: remainingClients } = await supabase.from('clients').select('id, name, cnpj');
    const { data: totalOrders } = await supabase.from('orders').select('id, total_amount');
    const totalAmount = (totalOrders || []).reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);

    return {
      success: true,
      migrationSummary,
      totalClientsRemaining: remainingClients?.length,
      totalOrdersRemaining: totalOrders?.length,
      totalOrderAmount: totalAmount
    };
  });

