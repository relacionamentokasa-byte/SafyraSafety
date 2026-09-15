import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as XLSX from 'xlsx';
import * as fs from 'fs';

export const importBillingSpreadsheetItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const xlsx = (XLSX as any).default || XLSX;
    const fsMod = (fs as any).default || fs;

    try {
      console.log('=== INICIANDO CONCILIAÇÃO OFICIAL DE FATURAMENTO E COMISSÕES ===');
      const excelPath = 'C:\\Users\\Ariel Matos\\Desktop\\Planilha sistema 10 9.xlsx';

      if (!fsMod.existsSync(excelPath)) {
        return { success: false, message: `Planilha não encontrada em ${excelPath}` };
      }

      const fileBuffer = fsMod.readFileSync(excelPath);
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      console.log(`Abas encontradas: ${workbook.SheetNames.length}`);

      // 1. Limpeza preventiva de quaisquer pedidos e comissões anteriores
      const { data: existingOrders } = await supabase.from("orders").select("id");
      if (existingOrders && existingOrders.length > 0) {
        for (const ord of existingOrders) {
          await (supabase as any).rpc("delete_order_permanently", { p_order_id: ord.id });
        }
      }

      // 2. Buscar produtos do banco (paginado para garantir totalidade)
      let allProducts: any[] = [];
      let fromP = 0;
      while (true) {
        const { data: pBatch } = await supabase
          .from('products')
          .select('id, name, sku, code, price, manufacturer_id')
          .range(fromP, fromP + 999);
        if (!pBatch || pBatch.length === 0) break;
        allProducts = allProducts.concat(pBatch);
        if (pBatch.length < 1000) break;
        fromP += 1000;
      }

      const productMap = new Map();
      allProducts.forEach((p: any) => {
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

      // 3. Buscar todos os itens de tabela de preços paginados
      let allPriceTableItems: any[] = [];
      let fromPti = 0;
      while (true) {
        const { data: ptiBatch } = await (supabase.from('price_table_items') as any)
          .select('id, price_table_id, product_id, unit_price, min_price, max_discount_percent, commission_rate')
          .range(fromPti, fromPti + 999);
        if (!ptiBatch || ptiBatch.length === 0) break;
        allPriceTableItems = allPriceTableItems.concat(ptiBatch);
        if (ptiBatch.length < 1000) break;
        fromPti += 1000;
      }

      const ptiByProductMap = new Map<string, any>();
      allPriceTableItems.forEach((pti: any) => {
        if (!ptiByProductMap.has(pti.product_id)) {
          ptiByProductMap.set(pti.product_id, pti);
        }
      });

      // 4. Buscar plano de pagamento padrão (À vista)
      const { data: dbPaymentPlans } = await (supabase.from('payment_plans') as any)
        .select('id, code, name')
        .eq('status', 'active');
      const defaultPaymentPlan = (dbPaymentPlans || []).find((pp: any) => pp.code === 'avista') || dbPaymentPlans?.[0];

      // 5. Buscar tabela de preços padrão (Nutriex)
      const { data: dbPriceTables } = await (supabase.from('price_tables') as any)
        .select('id, name')
        .eq('status', 'active');
      const defaultPriceTable = (dbPriceTables || []).find((pt: any) => pt.name.toLowerCase().includes('nutriex')) || dbPriceTables?.[0];

      // 6. Buscar clientes cadastrados (paginado)
      let allClients: any[] = [];
      let fromC = 0;
      while (true) {
        const { data: cBatch } = await supabase
          .from('clients')
          .select('id, name, trade_name, cnpj')
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

      // 7. Buscar fabricante Nutriex
      const { data: dbMfgs } = await supabase
        .from('manufacturers')
        .select('id, name');
      const nutriexMfg = (dbMfgs || []).find((m: any) => m.name.toLowerCase().includes('nutriex')) || dbMfgs?.[0];

      // 8. Buscar representante ativo
      const { data: dbReps } = await supabase
        .from('representatives')
        .select('id, name, user_id')
        .limit(1);
      const defaultRepId = dbReps?.[0]?.id || null;

      let totalOrdersCreated = 0;
      let totalItemsInserted = 0;
      let totalCommissionsSettled = 0;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = xlsx.utils.sheet_to_json(sheet);
        if (!rows || rows.length === 0) continue;

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
          const { data: newClient, error: clientErr } = await (supabase.from('clients') as any)
            .insert({
              name: clientNameRaw,
              trade_name: clientNameRaw,
              status: 'active',
              representative_id: defaultRepId,
              state: 'GO',
              city: 'Goiânia'
            })
            .select('id, name, trade_name')
            .single();

          if (newClient) {
            client = newClient;
            clientMap.set(clientNameRaw.toLowerCase(), client);
          } else {
            console.warn(`Erro ao criar cliente ${clientNameRaw}:`, clientErr?.message);
            continue;
          }
        }

        const validOrderPayloadItems: any[] = [];

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

            const { data: existingProd } = await supabase
              .from("products")
              .select("id, name, sku, code, price, manufacturer_id")
              .or(`sku.eq.${code},code.eq.${code}`)
              .maybeSingle();

            if (existingProd) {
              matchedProduct = existingProd;
            } else {
              const { data: newProd } = await (supabase.from('products') as any)
                .insert({
                  name: prodNameFinal,
                  sku: code || undefined,
                  code: code || undefined,
                  price: unitPrice || 10,
                  manufacturer_id: nutriexMfg?.id || null,
                  status: 'active'
                })
                .select('id, name, sku, code, price, manufacturer_id')
                .single();

              if (newProd) {
                matchedProduct = newProd;
              }
            }

            if (matchedProduct) {
              if (code) {
                productMap.set(code.toUpperCase(), matchedProduct);
                productMap.set(code.replace(/^0+/, "").toUpperCase(), matchedProduct);
              }
              if (productName) productMap.set(productName.toLowerCase(), matchedProduct);
            }
          }

          if (!matchedProduct) continue;

          let pti = ptiByProductMap.get(matchedProduct.id);
          if (!pti && defaultPriceTable) {
            const { data: existingPti } = await (supabase.from("price_table_items") as any)
              .select("id, price_table_id, product_id, unit_price, min_price, max_discount_percent, commission_rate")
              .eq("price_table_id", defaultPriceTable.id)
              .eq("product_id", matchedProduct.id)
              .maybeSingle();

            if (existingPti) {
              pti = existingPti;
            } else {
              const { data: newPti } = await (supabase.from('price_table_items') as any)
                .insert({
                  price_table_id: defaultPriceTable.id,
                  product_id: matchedProduct.id,
                  unit_price: unitPrice || matchedProduct.price || 10,
                  min_price: unitPrice || matchedProduct.price || 10,
                  max_discount_percent: 0,
                  commission_rate: 4.0
                })
                .select('id, price_table_id, product_id, unit_price, min_price, max_discount_percent, commission_rate')
                .single();

              if (newPti) {
                pti = newPti;
              }
            }

            if (pti) {
              ptiByProductMap.set(matchedProduct.id, pti);
            }
          }

          if (matchedProduct && pti) {
            validOrderPayloadItems.push({
              product_id: matchedProduct.id,
              price_table_item_id: pti.id,
              quantity: quantity,
              requested_discount_percent: 0,
              unit_price: unitPrice
            });
          }
        }

        if (validOrderPayloadItems.length === 0) continue;

        // Disparar criação via RPC create_order
        const idempotencyKey = `concil_${client.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const orderPayload = {
          idempotency_key: idempotencyKey,
          client_id: client.id,
          representative_id: defaultRepId,
          payment_plan_id: defaultPaymentPlan?.id,
          items: validOrderPayloadItems.map(it => ({
            product_id: it.product_id,
            price_table_item_id: it.price_table_item_id,
            quantity: it.quantity,
            requested_discount_percent: it.requested_discount_percent
          }))
        };

        const { data: createdOrderData, error: orderErr } = await (supabase as any)
          .rpc('create_order', { p_payload: orderPayload });

        if (orderErr || !createdOrderData?.id) {
          console.warn(`Erro ao criar pedido via RPC para ${clientNameRaw}:`, orderErr?.message);
          continue;
        }

        const orderId = createdOrderData.id;
        totalOrdersCreated++;
        totalItemsInserted += validOrderPayloadItems.length;

        // Transicionar status para delivered
        await (supabase as any).rpc('transition_order', { p_order_id: orderId, p_to_status: 'sent' });
        await (supabase as any).rpc('transition_order', { p_order_id: orderId, p_to_status: 'approved' });
        await (supabase as any).rpc('transition_order', { p_order_id: orderId, p_to_status: 'invoiced' });
        await (supabase as any).rpc('transition_order', { p_order_id: orderId, p_to_status: 'delivered' });

        // Liquidar pagamento e gerar comissões comerciais
        const { data: payments } = await (supabase.from('order_payments') as any)
          .select('id, value')
          .eq('order_id', orderId);

        if (payments && payments.length > 0) {
          for (const pay of payments) {
            const { data: settleRes } = await (supabase as any).rpc('settle_order_payment_and_commissions', {
              p_payment_id: pay.id,
              p_received_value: pay.value
            });
            if (settleRes?.status === 'paid') {
              totalCommissionsSettled += (settleRes.commissions_created || 1);
            }
          }
        }
      }

      console.log(`=== CONCILIAÇÃO FINALIZADA COM SUCESSO: ${totalOrdersCreated} PEDIDOS, ${totalItemsInserted} ITENS, ${totalCommissionsSettled} COMISSÕES LIQUIDADAS ===`);

      return {
        success: true,
        ordersCount: totalOrdersCreated,
        itemsCount: totalItemsInserted,
        commissionsCount: totalCommissionsSettled,
        message: `${totalOrdersCreated} pedidos faturados conciliados com ${totalItemsInserted} itens discriminados e ${totalCommissionsSettled} comissões comerciais vinculadas com sucesso!`
      };
    } catch (err: any) {
      console.error('ERRO NA CONCILIAÇÃO DE ITENS:', err);
      return { success: false, message: `Erro na conciliação: ${err.message}` };
    }
  });
