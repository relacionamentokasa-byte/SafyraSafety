import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

async function run() {
  const xlsxMod: any = (XLSX as any).default || XLSX;
  const SUPABASE_URL = "https://hxogosqpcewvtwdyerru.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rYjSijG2jpE9_ys5EZIUJA_36mbvyi5";
  const token = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjQ0OGNmNzYzLTUyNWItNGI4NC05Zjk3LTcwZGJhOGJiM2U0ZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2h4b2dvc3FwY2V3dnR3ZHllcnJ1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzODM3OTJjOS1jYzFiLTRlYzMtYjliZS04MzA0NmYxMTZjOWMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzg5NDA5MTk5LCJpYXQiOjE3ODk0MDU1OTksImVtYWlsIjoicmVsYWNpb25hbWVudG9rYXNhQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzg5MDkxMzUxfV0sInNlc3Npb25faWQiOiI2OTMyNWJmNy01ZTMwLTQwMjMtOTU3NC00MDNmYjk0ZTVkMzciLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.2QbD722hxXaatyCZ0FjFfteyM9T_Tct6T1La7cv4ebE_-8qlkAosVqAOVwPacAlnwUhlGYzkSOSHZJPma_QJuA";

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const excelPath = "C:/Users/Ariel Matos/Desktop/Planilha sistema 10 9.xlsx";
  const workbook = xlsxMod.readFile(excelPath);
  console.log(`=== PROCESSANDO ${workbook.SheetNames.length} ABAS COM VALORES EXATOS DA PLANILHA ===`);

  // 1. Limpeza de pedidos anteriores para recarga limpa
  const { data: existingOrders } = await supabase.from("orders").select("id");
  if (existingOrders && existingOrders.length > 0) {
    console.log(`Limpando ${existingOrders.length} pedidos existentes...`);
    for (const ord of existingOrders) {
      await (supabase as any).rpc("delete_order_permanently", { p_order_id: ord.id });
    }
  }

  // 2. Carregar produtos
  let allProducts: any[] = [];
  let fromP = 0;
  while (true) {
    const { data: pBatch } = await supabase
      .from("products")
      .select("id, name, sku, code, price, manufacturer_id")
      .range(fromP, fromP + 999);
    if (!pBatch || pBatch.length === 0) break;
    allProducts = allProducts.concat(pBatch);
    if (pBatch.length < 1000) break;
    fromP += 1000;
  }

  const productMap = new Map();
  allProducts.forEach(p => {
    if (p.sku) {
      productMap.set(String(p.sku).trim().toUpperCase(), p);
      productMap.set(String(p.sku).trim().replace(/^0+/, "").toUpperCase(), p);
    }
    if (p.code) {
      productMap.set(String(p.code).trim().toUpperCase(), p);
      productMap.set(String(p.code).trim().replace(/^0+/, "").toUpperCase(), p);
    }
    if (p.name) productMap.set(String(p.name).trim().toLowerCase(), p);
  });

  // 3. Carregar clientes
  let allClients: any[] = [];
  let fromC = 0;
  while (true) {
    const { data: cBatch } = await supabase
      .from("clients")
      .select("id, name, trade_name, cnpj")
      .range(fromC, fromC + 999);
    if (!cBatch || cBatch.length === 0) break;
    allClients = allClients.concat(cBatch);
    if (cBatch.length < 1000) break;
    fromC += 1000;
  }

  const clientMap = new Map();
  allClients.forEach((c: any) => {
    if (c.name) clientMap.set(String(c.name).trim().toLowerCase(), c);
    if (c.trade_name) clientMap.set(String(c.trade_name).trim().toLowerCase(), c);
  });

  // 4. Fabricante Nutriex
  const { data: dbMfgs } = await supabase.from("manufacturers").select("id, name");
  const nutriexMfg = (dbMfgs || []).find((m: any) => m.name.toLowerCase().includes("nutriex")) || dbMfgs?.[0];

  // 5. Representante Marigleyce
  const { data: dbReps } = await supabase.from("representatives").select("id, name, user_id").limit(1);
  const repId = dbReps?.[0]?.id || null;

  // 6. Regra de comissão Nutriex
  const { data: dbRules } = await supabase.from("commission_rules").select("id, name").eq("status", "active");
  const nutriexRule = (dbRules || []).find((r: any) => r.name.toLowerCase().includes("nutriex")) || dbRules?.[0];

  let totalOrdersCreated = 0;
  let totalItemsInserted = 0;
  let totalFaturamentoGeral = 0;
  let totalComissoesGeral = 0;

  for (let sIdx = 0; sIdx < workbook.SheetNames.length; sIdx++) {
    const sheetName = workbook.SheetNames[sIdx];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsxMod.utils.sheet_to_json(sheet);
    if (!rows || rows.length === 0) {
      console.log(`[${sIdx+1}/53] Aba vazia: ${sheetName}`);
      continue;
    }

    const clientNameRaw = String(sheetName).trim().replace(/^[\t\s]+|[\t\s]+$/g, "").replace(/^"/, "").replace(/"$/, "");
    let client = clientMap.get(clientNameRaw.toLowerCase());

    if (!client) {
      for (const [name, c] of clientMap.entries()) {
        if (name.includes(clientNameRaw.toLowerCase()) || clientNameRaw.toLowerCase().includes(name)) {
          client = c;
          break;
        }
      }
    }

    if (!client) {
      const { data: newClient } = await (supabase.from("clients") as any)
        .insert({
          name: clientNameRaw,
          trade_name: clientNameRaw,
          status: "active",
          representative_id: repId,
          state: "GO",
          city: "Goiânia"
        })
        .select("id, name, trade_name")
        .single();
      if (newClient) {
        client = newClient;
        clientMap.set(clientNameRaw.toLowerCase(), client);
      } else {
        console.warn(`Não foi possível obter/criar cliente para ${clientNameRaw}`);
        continue;
      }
    }

    const validItems: any[] = [];
    let orderTotalAmount = 0;

    for (const row of rows) {
      let code = "";
      let productName = "";
      let quantity = 0;
      let unitPrice = 0;

      for (const [rawKey, rawVal] of Object.entries(row)) {
        const k = rawKey.trim().toLowerCase();
        if (k === "codigo" || k === "código" || k === "coluna2") {
          code = String(rawVal).trim();
        } else if (k === "produto" || k === "coluna3") {
          productName = String(rawVal).trim();
        } else if (k === "quantidade" || k === "qtd" || k === "coluna4") {
          quantity = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal).replace(/\t/g, "").replace(/\s/g, "").replace(",", "."));
        } else if (k === "valor" || k === "preço" || k === "preco" || k.includes("coluna5")) {
          unitPrice = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal).replace(/\t/g, "").replace(/\s/g, "").replace(",", "."));
        }
      }

      if (isNaN(quantity) || quantity <= 0) continue;
      if (isNaN(unitPrice) || unitPrice <= 0) continue;
      if (!code && !productName) continue;

      let matchedProduct = productMap.get(code.toUpperCase()) ||
                           productMap.get(code.replace(/^0+/, "").toUpperCase()) ||
                           productMap.get(productName.toLowerCase());

      if (!matchedProduct && (productName || code)) {
        const prodNameFinal = productName || `Produto Código ${code}`;
        const { data: newProd } = await (supabase.from("products") as any)
          .insert({
            name: prodNameFinal,
            sku: code || undefined,
            code: code || undefined,
            price: unitPrice,
            manufacturer_id: nutriexMfg?.id || null,
            status: "active"
          })
          .select("id, name, sku, code, price, manufacturer_id")
          .single();

        if (newProd) {
          matchedProduct = newProd;
          if (code) {
            productMap.set(code.toUpperCase(), matchedProduct);
            productMap.set(code.replace(/^0+/, "").toUpperCase(), matchedProduct);
          }
          if (productName) productMap.set(productName.toLowerCase(), matchedProduct);
        }
      }

      if (!matchedProduct) continue;

      const subtotal = Number((quantity * unitPrice).toFixed(2));
      orderTotalAmount += subtotal;

      validItems.push({
        product_id: matchedProduct.id,
        quantity: quantity,
        unit_price: unitPrice,
        subtotal: subtotal,
        product_name_snapshot: productName || matchedProduct.name,
        product_sku_snapshot: code || matchedProduct.sku,
        unit_snapshot: "UN",
        list_unit_price: unitPrice,
        resolved_unit_price: unitPrice,
        min_unit_price: unitPrice,
        max_discount_percent: 0,
        discount_amount: 0,
        pricing_source: "spreadsheet_negotiated"
      });
    }

    if (validItems.length === 0) {
      console.warn(`[${sIdx+1}/53] Nenhum item válido encontrado na aba ${sheetName}`);
      continue;
    }

    orderTotalAmount = Number(orderTotalAmount.toFixed(2));
    totalFaturamentoGeral += orderTotalAmount;

    // Criar o pedido com os valores e data
    const orderNumber = `PED-${String(sIdx + 1).padStart(4, "0")}`;
    const { data: newOrder, error: orderErr } = await (supabase.from("orders") as any)
      .insert({
        order_number: orderNumber,
        client_id: client.id,
        representative_id: repId,
        total_amount: orderTotalAmount,
        subtotal: orderTotalAmount,
        discount_amount: 0,
        status: "delivered",
        created_at: "2026-09-10T12:00:00.000Z",
        updated_at: "2026-09-10T12:00:00.000Z"
      })
      .select("id, order_number, total_amount")
      .single();

    if (orderErr || !newOrder) {
      console.error(`Erro ao criar pedido para ${clientNameRaw}:`, orderErr?.message);
      continue;
    }

    totalOrdersCreated++;

    // Inserir os itens
    const itemsToInsert = validItems.map(it => ({
      order_id: newOrder.id,
      ...it
    }));

    const { error: itemsErr } = await (supabase.from("order_items") as any).insert(itemsToInsert);
    if (itemsErr) {
      console.error(`Erro ao inserir itens no pedido ${orderNumber}:`, itemsErr.message);
    } else {
      totalItemsInserted += validItems.length;
    }

    // Criar parcela
    const { data: paymentRecord } = await (supabase.from("order_payments") as any)
      .insert({
        order_id: newOrder.id,
        payment_number: 1,
        value: orderTotalAmount,
        status: "paid",
        due_date: "2026-09-10",
        paid_at: "2026-09-10T12:00:00.000Z"
      })
      .select("id")
      .single();

    // Criar comissão de 4%
    const commissionValue = Number((orderTotalAmount * 0.04).toFixed(2));
    totalComissoesGeral += commissionValue;

    await (supabase.from("commissions") as any).insert({
      representative_id: repId,
      order_id: newOrder.id,
      order_payment_id: paymentRecord?.id || null,
      manufacturer_id: nutriexMfg?.id || null,
      rule_id: nutriexRule?.id || null,
      base_value: orderTotalAmount,
      commission_rate: 4.0,
      commission_value: commissionValue,
      value: commissionValue,
      status: "approved",
      paid: false,
      settlement_key: `${newOrder.id}:${repId}:nutriex`
    });

    console.log(`[${sIdx + 1}/53] ✓ ${clientNameRaw}: Pedido R$ ${orderTotalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${validItems.length} itens) | Comissão 4%: R$ ${commissionValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  }

  console.log("\n=======================================================");
  console.log("=== CARGA OFICIAL CONCLUÍDA COM VALORES EXATOS ===");
  console.log(`Total de Pedidos Oficiais: ${totalOrdersCreated}`);
  console.log(`Total de Itens Discriminados: ${totalItemsInserted}`);
  console.log(`Faturamento Total Oficial: R$ ${totalFaturamentoGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  console.log(`Comissões Comerciais (4,0%): R$ ${totalComissoesGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  console.log("=======================================================\n");
}

run().catch(console.error);
