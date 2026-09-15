import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hxogosqpcewvtwdyerru.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_rYjSijG2jpE9_ys5EZIUJA_36mbvyi5';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const excelPath = 'C:\\Users\\Ariel Matos\\Desktop\\Planilha sistema 10 9.xlsx';

async function run() {
  console.log('Lendo planilha Excel...');
  const workbook = XLSX.readFile(excelPath);
  console.log(`Abas encontradas: ${workbook.SheetNames.length}`);

  // 1. Buscar produtos do banco para vincular ID
  const { data: dbProducts } = await supabase
    .from('products')
    .select('id, name, sku, price, manufacturer_id');

  const productMap = new Map();
  (dbProducts || []).forEach(p => {
    if (p.sku) productMap.set(String(p.sku).trim(), p);
    if (p.name) productMap.set(String(p.name).trim().toLowerCase(), p);
  });

  // 2. Buscar clientes cadastrados no banco
  const { data: dbClients } = await supabase
    .from('clients')
    .select('id, name, trade_name, cnpj');

  const clientMap = new Map();
  (dbClients || []).forEach(c => {
    if (c.name) clientMap.set(String(c.name).trim().toLowerCase(), c);
    if (c.trade_name) clientMap.set(String(c.trade_name).trim().toLowerCase(), c);
  });

  // 3. Buscar fabricante Nutriex
  const { data: dbMfgs } = await supabase
    .from('manufacturers')
    .select('id, name');
  const nutriexMfg = (dbMfgs || []).find(m => m.name.toLowerCase().includes('nutriex')) || dbMfgs?.[0];

  // 4. Buscar usuário / vendedor padrão
  const { data: dbUsers } = await supabase
    .from('profiles')
    .select('id, full_name');
  const defaultUserId = dbUsers?.[0]?.id || null;

  console.log(`Clientes no banco: ${dbClients?.length || 0}`);
  console.log(`Produtos no banco: ${dbProducts?.length || 0}`);

  let totalOrdersCreated = 0;
  let totalItemsInserted = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    if (!rows || rows.length === 0) continue;

    // Identificar cliente da aba
    const clientNameRaw = String(sheetName).trim();
    let client = clientMap.get(clientNameRaw.toLowerCase());

    if (!client) {
      // Tentar match parcial
      for (const [name, c] of clientMap.entries()) {
        if (name.includes(clientNameRaw.toLowerCase()) || clientNameRaw.toLowerCase().includes(name)) {
          client = c;
          break;
        }
      }
    }

    if (!client) {
      // Criar cliente caso não exista
      const { data: newClient, error: clientErr } = await supabase
        .from('clients')
        .insert({
          name: clientNameRaw,
          trade_name: clientNameRaw,
          status: 'active'
        })
        .select('id, name, trade_name')
        .single();

      if (newClient) {
        client = newClient;
        clientMap.set(clientNameRaw.toLowerCase(), client);
        console.log(`+ Novo cliente criado: ${clientNameRaw}`);
      } else {
        console.error(`Erro ao criar cliente ${clientNameRaw}:`, clientErr?.message);
        continue;
      }
    }

    // Processar itens da aba
    const validItems = [];
    let orderTotalAmount = 0;

    for (const row of rows) {
      const code = String(row['Codigo'] || row['Código'] || row['codigo'] || '').trim();
      const productName = String(row['Produto'] || row['produto'] || row['Nome'] || '').trim();
      const quantity = Math.abs(Number(row['Quantidade'] || row['quantidade'] || row['Qtd'] || 0));
      const unitPrice = Math.abs(Number(row['Valor'] || row['valor'] || row['Preco'] || row['Preço'] || 0));

      if (!productName && !code) continue;
      if (quantity <= 0) continue;

      const subtotal = quantity * unitPrice;
      orderTotalAmount += subtotal;

      // Localizar produto correspondente
      let matchedProduct = productMap.get(code) || productMap.get(productName.toLowerCase());

      if (!matchedProduct && productName) {
        // Criar produto caso não exista
        const { data: newProd } = await supabase
          .from('products')
          .insert({
            name: productName,
            sku: code || undefined,
            price: unitPrice || 10,
            manufacturer_id: nutriexMfg?.id,
            status: 'active'
          })
          .select('id, name, sku, price, manufacturer_id')
          .single();

        if (newProd) {
          matchedProduct = newProd;
          if (code) productMap.set(code, newProd);
          productMap.set(productName.toLowerCase(), newProd);
        }
      }

      validItems.push({
        product_id: matchedProduct?.id || null,
        product_name_snapshot: productName || matchedProduct?.name || 'Item de Faturamento',
        product_sku_snapshot: code || matchedProduct?.sku || null,
        quantity: quantity,
        unit_price: unitPrice,
        subtotal: subtotal
      });
    }

    if (validItems.length === 0) continue;

    // Criar pedido para o cliente com a soma real de itens
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert({
        client_id: client.id,
        total_amount: orderTotalAmount,
        status: 'delivered',
        created_at: new Date('2024-09-10T12:00:00Z').toISOString(),
        user_id: defaultUserId
      })
      .select('id')
      .single();

    if (orderErr || !newOrder) {
      console.error(`Erro ao criar pedido para ${clientNameRaw}:`, orderErr?.message);
      continue;
    }

    totalOrdersCreated++;

    // Inserir todos os itens vinculados ao pedido
    const itemsToInsert = validItems.map(it => ({
      order_id: newOrder.id,
      ...it
    }));

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsErr) {
      console.error(`Erro ao inserir itens para ${clientNameRaw}:`, itemsErr.message);
    } else {
      totalItemsInserted += validItems.length;
      console.log(`✓ ${clientNameRaw}: Pedido R$ ${orderTotalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com ${validItems.length} itens.`);
    }
  }

  console.log('\n--- CONCILIAÇÃO CONCLUÍDA COM SUCESSO ---');
  console.log(`Total de Pedidos Gerados: ${totalOrdersCreated}`);
  console.log(`Total de Itens Inseridos: ${totalItemsInserted}`);
}

run().catch(console.error);
