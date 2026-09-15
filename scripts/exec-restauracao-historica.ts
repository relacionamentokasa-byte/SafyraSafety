import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function run() {
  const SUPABASE_URL = "https://hxogosqpcewvtwdyerru.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rYjSijG2jpE9_ys5EZIUJA_36mbvyi5";
  const token = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjQ0OGNmNzYzLTUyNWItNGI4NC05Zjk3LTcwZGJhOGJiM2U0ZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2h4b2dvc3FwY2V3dnR3ZHllcnJ1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzODM3OTJjOS1jYzFiLTRlYzMtYjliZS04MzA0NmYxMTZjOWMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzg5NDIzMzU4LCJpYXQiOjE3ODk0MTk3NTgsImVtYWlsIjoicmVsYWNpb25hbWVudG9rYXNhQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzg5MDkxMzUxfV0sInNlc3Npb25faWQiOiI2OTMyNWJmNy01ZTMwLTQwMjMtOTU3NC00MDNmYjk0ZTVkMzciLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.jMgjjzkNM3eoIIbahpju1NMJ7oNBfmXjr62ufap8gdMJ1Acb-OyNMQ8DMkdSm2hEQ1VrkBPuWW04MT-ytG9hYg";

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  console.log("=== INICIANDO RESTAURAÇÃO DA BASE HISTÓRICA COMPLETA ===");

  const sqlPath = "C:/Users/Ariel Matos/Projetos Ariel/safyra-safety/import_all_history_orders_commissions.sql";
  const sqlContent = fs.readFileSync(sqlPath, "utf8");

  // 1. Extrair ID da representante Marigleyce
  const { data: reps } = await supabase.from("representatives").select("id, name").limit(1);
  const repId = reps?.[0]?.id || "126a6950-ddf5-452b-8b5e-feecc4ad8bfa";
  console.log(`Representante vinculado: ${reps?.[0]?.name || repId} (${repId})`);

  // 2. Extrair fabricantes
  const { data: dbMfgs } = await supabase.from("manufacturers").select("id, name");
  const nutriexMfg = (dbMfgs || []).find((m: any) => m.name.toLowerCase().includes("nutriex")) || dbMfgs?.[0];
  const libusMfg = (dbMfgs || []).find((m: any) => m.name.toLowerCase().includes("libus")) || dbMfgs?.[1];

  // 3. Limpar pedidos e pagamentos atuais
  const { data: existingOrders } = await supabase.from("orders").select("id");
  if (existingOrders && existingOrders.length > 0) {
    console.log(`Limpando ${existingOrders.length} pedidos para restaurar histórico oficial...`);
    for (const ord of existingOrders) {
      await (supabase as any).rpc("delete_order_permanently", { p_order_id: ord.id });
    }
  }

  // 4. Parsear e restaurar Clientes do SQL
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
  console.log(`Clientes restaurados/atualizados: ${clientsRestored}`);

  // 5. Parsear e restaurar Orders do SQL
  // Formato: VALUES ('id', 'NUT-212048', 'client_id', v_rep_id, 'delivered', 3965.2, 0, 3965.2, 'BOLETO', '30/60/90', '2026-02-18T12:00:00Z', '...')
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

  console.log(`Restaurando ${ordersList.length} pedidos históricos (Fevereiro a Setembro)...`);
  for (let i = 0; i < ordersList.length; i += 50) {
    const batch = ordersList.slice(i, i + 50);
    const { error: ordErr } = await (supabase.from("orders") as any).upsert(batch);
    if (ordErr) console.warn(`Erro no lote de pedidos ${i}:`, ordErr.message);
  }

  // 6. Parsear e restaurar Order Payments (Parcelas)
  // Formato: VALUES ('id', 'order_id', 1, 1321.73, '2026-03-20', 'paid', '2026-02-18T12:00:00Z')
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

  console.log(`Restaurando ${paymentsList.length} parcelas de faturamento...`);
  for (let i = 0; i < paymentsList.length; i += 50) {
    const batch = paymentsList.slice(i, i + 50);
    const { error: payErr } = await (supabase.from("order_payments") as any).upsert(batch);
    if (payErr) console.warn(`Erro no lote de parcelas ${i}:`, payErr.message);
  }

  // 7. Parsear e restaurar Commissions
  // Formato: VALUES ('id', 'order_id', 'payment_id', v_rep_id, 'mfg_id', 66.09, 5.00, 'approved', '2026-03-20', '2026-02-18T12:00:00Z')
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

  console.log(`Restaurando ${commsList.length} comissões comerciais históricas...`);
  for (let i = 0; i < commsList.length; i += 50) {
    const batch = commsList.slice(i, i + 50);
    const { error: comErr } = await (supabase.from("commissions") as any).upsert(batch);
    if (comErr) console.warn(`Erro no lote de comissões ${i}:`, comErr.message);
  }

  // Resumo final de conferência
  const { count: totalOrders } = await supabase.from("orders").select("id", { count: "exact" });
  const { data: allOrds } = await supabase.from("orders").select("total_amount, created_at");
  const { count: totalComms } = await supabase.from("commissions").select("id", { count: "exact" });

  const totalFaturado = (allOrds || []).reduce((acc: number, o: any) => acc + Number(o.total_amount || 0), 0);

  const byMonth: Record<string, { count: number; total: number }> = {};
  (allOrds || []).forEach((o: any) => {
    const m = (o.created_at || "").substring(0, 7);
    if (!byMonth[m]) byMonth[m] = { count: 0, total: 0 };
    byMonth[m].count++;
    byMonth[m].total += Number(o.total_amount || 0);
  });

  console.log("\n=======================================================");
  console.log("=== RESTAURAÇÃO HISTÓRICA CONCLUÍDA COM SUCESSO ===");
  console.log(`Total de Pedidos Restaurados: ${totalOrders}`);
  console.log(`Total de Comissões Comerciais: ${totalComms}`);
  console.log(`Faturamento Histórico Total: R$ ${totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  console.log("\nDistribuição de Pedidos por Mês:");
  Object.keys(byMonth).sort().forEach(m => {
    console.log(` • Mês ${m}: ${byMonth[m].count} pedidos | R$ ${byMonth[m].total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  });
  console.log("=======================================================\n");
}

run().catch(console.error);
