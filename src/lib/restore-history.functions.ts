import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as fs from "fs";

export const restoreCompleteHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const fsMod = (fs as any).default || fs;

    try {
      console.log("=== INICIANDO RESTAURAÇÃO HISTÓRICA COMPLETA VIA SERVER FUNCTION ===");
      const sqlPath = "C:/Users/Ariel Matos/Projetos Ariel/safyra-safety/import_all_history_orders_commissions.sql";

      if (!fsMod.existsSync(sqlPath)) {
        return { success: false, message: `Arquivo SQL não encontrado em ${sqlPath}` };
      }

      const sqlContent = fsMod.readFileSync(sqlPath, "utf8");

      // 1. Obter representante ativo
      const { data: reps } = await supabase.from("representatives").select("id, name").limit(1);
      const repId = reps?.[0]?.id || "126a6950-ddf5-452b-8b5e-feecc4ad8bfa";

      // 2. Obter fabricantes
      const { data: dbMfgs } = await supabase.from("manufacturers").select("id, name");
      const nutriexMfg = (dbMfgs || []).find((m: any) => m.name.toLowerCase().includes("nutriex")) || dbMfgs?.[0];
      const libusMfg = (dbMfgs || []).find((m: any) => m.name.toLowerCase().includes("libus")) || dbMfgs?.[1];

      // 3. Limpar pedidos anteriores
      const { data: existingOrders } = await supabase.from("orders").select("id");
      if (existingOrders && existingOrders.length > 0) {
        console.log(`Limpando ${existingOrders.length} pedidos existentes...`);
        for (const ord of existingOrders) {
          await (supabase as any).rpc("delete_order_permanently", { p_order_id: ord.id });
        }
      }

      // 4. Clientes
      const clientRegex = /INSERT INTO public\.clients \(([^)]+)\)\s+VALUES \('([a-f0-9-]+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', v_rep_id\)/g;
      let cMatch;
      let clientsRestored = 0;

      while ((cMatch = clientRegex.exec(sqlContent)) !== null) {
        const id = cMatch[2];
        const name = cMatch[3];
        const tradeName = cMatch[4];
        const legalName = cMatch[5];
        const cnpj = cMatch[6];
        const city = cMatch[7];
        const state = cMatch[8];
        const status = cMatch[9];

        await (supabase.from("clients") as any).upsert({
          id: id,
          name: name,
          trade_name: tradeName,
          legal_name: legalName,
          cnpj: cnpj,
          city: city,
          state: state,
          status: status,
          representative_id: repId
        });
        clientsRestored++;
      }

      // 5. Orders
      const orderRegex = /INSERT INTO public\.orders \([^)]+\)\s+VALUES \('([a-f0-9-]+)', '([^']+)', '([a-f0-9-]+)', v_rep_id, '([^']+)', ([0-9.]+), ([0-9.]+), ([0-9.]+), '([^']*)', '([^']*)', '([^']+)'/g;
      let oMatch;
      const ordersList: any[] = [];

      while ((oMatch = orderRegex.exec(sqlContent)) !== null) {
        ordersList.push({
          id: oMatch[1],
          order_number: oMatch[2],
          client_id: oMatch[3],
          representative_id: repId,
          status: oMatch[4],
          subtotal_amount: parseFloat(oMatch[5]),
          discount_amount: parseFloat(oMatch[6]),
          total_amount: parseFloat(oMatch[7]),
          payment_condition: oMatch[8],
          payment_term: oMatch[9],
          created_at: oMatch[10],
          updated_at: oMatch[10]
        });
      }

      for (let i = 0; i < ordersList.length; i += 50) {
        const batch = ordersList.slice(i, i + 50);
        await (supabase.from("orders") as any).upsert(batch);
      }

      // 6. Parcelas
      const paymentRegex = /INSERT INTO public\.order_payments \([^)]+\)\s+VALUES \('([a-f0-9-]+)', '([a-f0-9-]+)', ([0-9]+), ([0-9.]+), '([^']+)', '([^']+)', '([^']+)'\)/g;
      let pMatch;
      const paymentsList: any[] = [];

      while ((pMatch = paymentRegex.exec(sqlContent)) !== null) {
        paymentsList.push({
          id: pMatch[1],
          order_id: pMatch[2],
          installment_number: parseInt(pMatch[3]),
          value: parseFloat(pMatch[4]),
          due_date: pMatch[5],
          status: pMatch[6],
          received_at: pMatch[7],
          created_at: pMatch[7]
        });
      }

      for (let i = 0; i < paymentsList.length; i += 50) {
        const batch = paymentsList.slice(i, i + 50);
        await (supabase.from("order_payments") as any).upsert(batch);
      }

      // 7. Comissões
      const commRegex = /INSERT INTO public\.commissions \([^)]+\)\s+VALUES \('([a-f0-9-]+)', '([a-f0-9-]+)', '([a-f0-9-]+)', v_rep_id, '([^']+)', ([0-9.]+), ([0-9.]+), '([^']+)', '([^']+)', '([^']+)'\)/g;
      let comMatch;
      const commsList: any[] = [];

      while ((comMatch = commRegex.exec(sqlContent)) !== null) {
        const isLibus = comMatch[4] === '00000000-0000-0000-0000-000000000002';
        const mfgId = isLibus ? (libusMfg?.id || nutriexMfg?.id) : nutriexMfg?.id;
        const commVal = parseFloat(comMatch[5]);
        const rateVal = parseFloat(comMatch[6]);
        const baseVal = Number((commVal / (rateVal / 100)).toFixed(2));

        commsList.push({
          id: comMatch[1],
          order_id: comMatch[2],
          order_payment_id: comMatch[3],
          representative_id: repId,
          manufacturer_id: mfgId,
          commission_value: commVal,
          value: commVal,
          commission_rate: rateVal,
          base_value: baseVal,
          status: comMatch[7],
          paid: true,
          created_at: comMatch[9],
          settlement_key: `${comMatch[2]}:${comMatch[3]}:${repId}`
        });
      }

      for (let i = 0; i < commsList.length; i += 50) {
        const batch = commsList.slice(i, i + 50);
        await (supabase.from("commissions") as any).upsert(batch);
      }

      const { count: totalOrders } = await supabase.from("orders").select("id", { count: "exact" });
      const { data: allOrds } = await supabase.from("orders").select("total_amount, created_at");
      const { count: totalComms } = await supabase.from("commissions").select("id", { count: "exact" });

      const totalFaturado = (allOrds || []).reduce((acc: number, o: any) => acc + Number(o.total_amount || 0), 0);

      return {
        success: true,
        ordersCount: totalOrders,
        commissionsCount: totalComms,
        totalAmount: totalFaturado,
        message: `Restauração concluída: ${totalOrders} pedidos e ${totalComms} comissões comerciais restaurados com sucesso!`
      };
    } catch (err: any) {
      console.error("ERRO NA RESTAURAÇÃO HISTÓRICA:", err);
      return { success: false, message: `Erro na restauração: ${err.message}` };
    }
  });
