import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ParsedPDFOrder {
  budgetNumber: string;
  token: string;
  emissionDate: string;
  paymentCondition: string;
  shippingType: string;
  seller: string;
  client: {
    code: string;
    legalName: string;
    tradeName: string;
    cnpj: string;
    ie: string;
    phone: string;
    address: {
      type: string;
      zip: string;
      street: string;
      neighborhood: string;
      city: string;
      state: string;
    };
  };
  items: Array<{
    code: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totals: {
    units: number;
    totalAmount: number;
    discount: number;
  };
}

export interface MatchedPDFOrderData {
  parsed: ParsedPDFOrder;
  matchedClient: {
    id: string;
    name: string;
    cnpj: string;
    isNew: boolean;
  } | null;
  matchedRepresentative: {
    id: string;
    name: string;
  } | null;
  matchedItems: Array<{
    pdfCode: string;
    pdfDescription: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    product: {
      id: string;
      name: string;
      sku: string;
      manufacturer_id: string | null;
      manufacturer_name?: string;
    } | null;
    priceTableItemId: string | null;
    status: 'matched' | 'not_found';
  }>;
}

/**
 * Server function para salvar o pedido de forma transacional e com permissões seguras
 */
export const saveImportedOrderServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { matchedData: MatchedPDFOrderData }) => data)
  .handler(async ({ data, context }): Promise<{ orderId: string; orderNumber: string }> => {
    const { matchedData } = data;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    let clientId = matchedData.matchedClient?.id;

    // Se cliente não tem ID ou é novo, buscar ou criar
    if (!clientId) {
      const cleanClientCnpj = cleanCnpj(matchedData.parsed.client.cnpj);
      if (cleanClientCnpj) {
        const { data: dbClients } = await context.supabase
          .from('clients')
          .select('id, cnpj');
        const found = dbClients?.find(c => cleanCnpj(c.cnpj || '') === cleanClientCnpj);
        if (found) {
          clientId = found.id;
        }
      }

      if (!clientId) {
        // Criar novo cliente usando o client autenticado (context.supabase) com created_by
        const clientPayload = {
          name: matchedData.parsed.client.tradeName || matchedData.parsed.client.legalName || 'Cliente Importado',
          trade_name: matchedData.parsed.client.tradeName,
          legal_name: matchedData.parsed.client.legalName,
          cnpj: matchedData.parsed.client.cnpj,
          state_registration: matchedData.parsed.client.ie,
          phone: matchedData.parsed.client.phone,
          address: matchedData.parsed.client.address.street,
          neighborhood: matchedData.parsed.client.address.neighborhood,
          city: matchedData.parsed.client.address.city,
          state: matchedData.parsed.client.address.state,
          zip_code: matchedData.parsed.client.address.zip,
          representative_id: matchedData.matchedRepresentative?.id || '126a6950-ddf5-452b-8b5e-feecc4ad8bfa',
          status: 'active',
          created_by: context.userId
        };

        const { data: newClient, error: clientErr } = await context.supabase
          .from('clients')
          .insert(clientPayload as any)
          .select('id')
          .single();

        if (clientErr) {
          // Fallback para supabaseAdmin se houver restrição
          const { data: adminClient, error: adminErr } = await supabaseAdmin
            .from('clients')
            .insert(clientPayload as any)
            .select('id')
            .single();

          if (adminErr) throw new Error(`Falha ao cadastrar cliente: ${clientErr.message || adminErr.message}`);
          clientId = adminClient?.id;
        } else {
          clientId = newClient?.id;
        }
      }
    }

    if (!clientId) {
      throw new Error('Não foi possível definir o cliente para este pedido.');
    }

    // Preparar itens com match ou cadastrar produtos automaticamente se não existirem
    const validItems: Array<{
      productId: string;
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    // Descobrir fabricante padrão se houver (Nutriex, Libus, etc.)
    let defaultManufacturerId: string | null = null;
    const { data: mfs } = await supabaseAdmin.from('manufacturers').select('id, name');
    if (mfs && mfs.length > 0) {
      defaultManufacturerId = mfs[0].id;
    }

    for (const item of matchedData.matchedItems) {
      if (item.quantity <= 0) continue;

      if (item.product?.id) {
        validItems.push({
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku || item.pdfCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        });
      } else {
        // Criar produto sob demanda caso seja novo no catálogo
        const newProductPayload = {
          name: item.pdfDescription || `Item SKU ${item.pdfCode}`,
          sku: item.pdfCode,
          code: item.pdfCode,
          unit: 'UN',
          base_price: item.unitPrice,
          manufacturer_id: defaultManufacturerId,
          status: 'active'
        };

        const { data: newProd, error: prodErr } = await supabaseAdmin
          .from('products')
          .insert(newProductPayload as any)
          .select('id, name, sku')
          .single();

        if (newProd) {
          validItems.push({
            productId: newProd.id,
            productName: newProd.name,
            productSku: newProd.sku || item.pdfCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          });
        }
      }
    }

    if (validItems.length === 0) {
      throw new Error('Nenhum item com quantidade válida encontrado no PDF para importação.');
    }

    const orderNumber = matchedData.parsed.budgetNumber || String(Math.floor(100000 + Math.random() * 900000));
    const totalAmount = matchedData.parsed.totals.totalAmount || validItems.reduce((s, i) => s + i.totalPrice, 0);

    const orderPayload = {
      order_number: orderNumber,
      client_id: clientId,
      representative_id: matchedData.matchedRepresentative?.id || '126a6950-ddf5-452b-8b5e-feecc4ad8bfa',
      status: 'delivered', // "delivered" / "invoiced" são os status aceitos pelo enum order_status
      subtotal_amount: totalAmount,
      total_amount: totalAmount,
      discount_amount: matchedData.parsed.totals.discount || 0,
      payment_condition: matchedData.parsed.paymentCondition || '28/35/42',
      payment_term: matchedData.parsed.shippingType ? `${matchedData.parsed.shippingType}` : 'CIF',
      billing_notes: `Importado automaticamente via PDF da Indústria (Token: ${matchedData.parsed.token || '-'})`,
      created_by: context.userId,
      created_at: new Date().toISOString()
    };

    let createdOrder: { id: string; order_number: string } | null = null;

    const { data: userOrder, error: orderErr } = await context.supabase
      .from('orders')
      .insert(orderPayload as any)
      .select('id, order_number')
      .single();

    if (orderErr) {
      // Fallback para supabaseAdmin
      const { data: adminOrder, error: adminOrderErr } = await supabaseAdmin
        .from('orders')
        .insert(orderPayload as any)
        .select('id, order_number')
        .single();

      if (adminOrderErr) throw new Error(`Falha ao criar pedido: ${orderErr.message || adminOrderErr.message}`);
      createdOrder = adminOrder;
    } else {
      createdOrder = userOrder;
    }

    if (!createdOrder) {
      throw new Error('Falha ao obter ID do pedido criado.');
    }

    const itemsPayload = validItems.map(item => ({
      order_id: createdOrder!.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.totalPrice,
      product_name_snapshot: item.productName,
      product_sku_snapshot: item.productSku
    }));

    const { error: itemsErr } = await context.supabase.from('order_items').insert(itemsPayload as any);
    if (itemsErr) {
      const { error: adminItemsErr } = await supabaseAdmin.from('order_items').insert(itemsPayload as any);
      if (adminItemsErr) throw new Error(`Falha ao salvar itens do pedido: ${itemsErr.message || adminItemsErr.message}`);
    }

    // Criar parcelas
    const fp = matchedData.parsed.paymentCondition || '28/35/42';
    const days = fp.split('/').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    const instDays = days.length > 0 ? days : [28, 35, 42];
    const instVal = Number((totalAmount / instDays.length).toFixed(2));
    const now = new Date();

    const paymentsPayload = instDays.map((offset, idx) => {
      const d = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
      return {
        order_id: createdOrder!.id,
        installment_number: idx + 1,
        value: instVal,
        received_value: 0,
        status: 'pending',
        due_date: d.toISOString().split('T')[0]
      };
    });

    const { error: payErr } = await context.supabase.from('order_payments').insert(paymentsPayload as any);
    if (payErr) {
      const { error: adminPayErr } = await supabaseAdmin.from('order_payments').insert(paymentsPayload as any);
      if (adminPayErr) throw new Error(`Falha ao gerar parcelas do pedido: ${payErr.message || adminPayErr.message}`);
    }

    return {
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number
    };
  });

function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Parser de texto do PDF de Orçamento / Pedido da Indústria
 */
export function extractOrderFromText(text: string): ParsedPDFOrder {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const data: ParsedPDFOrder = {
    budgetNumber: '',
    token: '',
    emissionDate: '',
    paymentCondition: '',
    shippingType: '',
    seller: '',
    client: {
      code: '',
      legalName: '',
      tradeName: '',
      cnpj: '',
      ie: '',
      phone: '',
      address: {
        type: '',
        zip: '',
        street: '',
        neighborhood: '',
        city: '',
        state: ''
      }
    },
    items: [],
    totals: {
      units: 0,
      totalAmount: 0,
      discount: 0
    }
  };

  // 1. Número do Orçamento
  const numMatch = text.match(/ORÇAMENTO DE VENDA\s*(\d+)/i) || text.match(/Número\s+Token.*?\n(\d+)/is);
  if (numMatch) data.budgetNumber = numMatch[1];

  // 2. Cliente (Procurar linha do CNPJ de 14 dígitos ou com formatação)
  const cnpjLineIdx = lines.findIndex(l => /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(l));
  if (cnpjLineIdx !== -1) {
    data.client.cnpj = lines[cnpjLineIdx];
    if (cnpjLineIdx >= 3) {
      data.client.code = lines[cnpjLineIdx - 3];
      data.client.legalName = lines[cnpjLineIdx - 2];
      data.client.tradeName = lines[cnpjLineIdx - 1];
    }
    if (lines[cnpjLineIdx + 1]) data.client.ie = lines[cnpjLineIdx + 1];
    if (lines[cnpjLineIdx + 2]) data.client.phone = lines[cnpjLineIdx + 2];
  }

  // 3. Endereço
  const endIdx = lines.findIndex(l => l.includes('Tipo End') || l.includes('ENDEREÇO'));
  if (endIdx !== -1) {
    const cepIdx = lines.findIndex((l, idx) => idx > endIdx && /\d{5}-\d{3}/.test(l));
    if (cepIdx !== -1) {
      data.client.address.type = lines[cepIdx - 1] || 'Comercial';
      data.client.address.zip = lines[cepIdx];
      data.client.address.street = lines[cepIdx + 1] || '';

      // O bairro pode ser composto por mais de uma linha (ex: JARDIM GOIAS)
      const ufIdx = lines.findIndex((l, idx) => idx > cepIdx && /^[A-Z]{2}$/.test(l));
      if (ufIdx !== -1) {
        data.client.address.state = lines[ufIdx];
        data.client.address.city = lines[ufIdx - 1] || '';
        // Tudo entre street e city é o bairro
        const neighborhoodParts = lines.slice(cepIdx + 2, ufIdx - 1);
        data.client.address.neighborhood = neighborhoodParts.join(' ');
      }
    }
  }

  // 4. Orçamento e Condição
  const orcIdx = lines.findIndex(l => l === 'ORÇAMENTO' || (l.includes('Número') && l.includes('Token')));
  if (orcIdx !== -1) {
    const emissionIdx = lines.findIndex((l, idx) => idx >= orcIdx && /\d{2}\/\d{2}\/\d{2,4}/.test(l));
    if (emissionIdx !== -1) {
      data.budgetNumber = lines[emissionIdx - 2] || data.budgetNumber;
      data.token = lines[emissionIdx - 1] || '';
      data.emissionDate = lines[emissionIdx];
      data.paymentCondition = lines[emissionIdx + 1] || '28/35/42';
      data.shippingType = lines[emissionIdx + 2] || 'CIF';
      data.seller = [lines[emissionIdx + 3], lines[emissionIdx + 4]].filter(Boolean).join(' ');
    }
  }

  // 5. Itens
  const itemsStartIdx = lines.findIndex(l => l === 'ITENS' || (l.includes('Código') && l.includes('Qtde')) || l.includes('Itens do Pedido'));
  const totalsIdx = lines.findIndex(l => l.includes('Total de Unidades') || l.includes('TOTAL'));

  if (itemsStartIdx !== -1) {
    const endIdx = totalsIdx !== -1 ? totalsIdx : lines.length;
    // Buscar linhas de itens entre itemsStartIdx e endIdx
    // Linha com unidades: UN / CX / PC / PAR / KG / L / PCT / RL / FD / CJ
    for (let i = itemsStartIdx + 1; i < endIdx; i++) {
      const line = lines[i]?.toUpperCase()?.trim();
      if (line === 'UN' || line === 'CX' || line === 'PC' || line === 'PAR' || line === 'KG' || line === 'L' || line === 'PCT' || line === 'RL' || line === 'FD' || line === 'CJ' || line === 'PÇ') {
        const unit = line;
        const quantity = parseInt((lines[i + 1] || '0').replace(/\D/g, ''), 10) || 1;
        const unitPrice = parseFloat((lines[i + 2] || '0').replace(/\./g, '').replace(',', '.')) || 0;
        const totalPrice = parseFloat((lines[i + 4] || lines[i + 3] || '0').replace(/\./g, '').replace(',', '.')) || (quantity * unitPrice);

        // As linhas anteriores a i sao a descricao e o codigo
        let code = '';
        let descParts: string[] = [];

        // Subir até achar o código numérico ou alfanumérico do produto
        for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
          const prevLine = lines[j]?.trim();
          if (/^(\d{3,8}|[A-Z0-9-]{4,10})$/i.test(prevLine)) {
            code = prevLine;
            break;
          } else {
            descParts.unshift(prevLine);
          }
        }

        // Se não achou código explícito, gerar baseado no hash da descrição
        if (!code && descParts.length > 0) {
          code = `ITEM-${i}`;
        }

        if (quantity > 0) {
          data.items.push({
            code: code || `SKU-${data.items.length + 1}`,
            description: descParts.join(' ').trim() || `Item ${data.items.length + 1}`,
            unit,
            quantity,
            unitPrice,
            totalPrice: totalPrice || (quantity * unitPrice)
          });
        }
      }
    }
  }

  // Fallback: se nenhum item foi capturado pelo formato de tabela padrão, varrer linhas com padrão de quantidade e preço
  if (data.items.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detectar linhas com valores monetários no formato R$ ou 0,00
      const priceMatch = line.match(/R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
      if (priceMatch) {
        const val = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
        if (val > 0) {
          data.items.push({
            code: `ITEM-${data.items.length + 1}`,
            description: lines[Math.max(0, i - 1)] || `Item Importado ${data.items.length + 1}`,
            unit: 'UN',
            quantity: 1,
            unitPrice: val,
            totalPrice: val
          });
        }
      }
    }
  }

  // 6. Totais
  if (totalsIdx !== -1) {
    const totLines = lines.slice(totalsIdx);
    const lastNumIdx = totLines.length - 1;
    data.totals.totalAmount = parseFloat((totLines[lastNumIdx] || '0').replace(/\./g, '').replace(',', '.')) || 0;
    if (data.items.length > 0) {
      data.totals.units = data.items.reduce((s, it) => s + it.quantity, 0);
    }
  }

  return data;
}

/**
 * Server Function: Processa o PDF em Base64 ou Texto e cruza com Clientes, Produtos e Representantes
 */
export const processOrderPDFServer = createServerFn({ method: "POST" })
  .validator((data: { base64Pdf?: string; rawText?: string }) => data)
  .handler(async ({ data }): Promise<MatchedPDFOrderData> => {
    let extractedText = (data.rawText || '').trim();

    if (!extractedText && data.base64Pdf) {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const buffer = Buffer.from(data.base64Pdf, 'base64');
        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data: uint8 });
        const pdfDoc = await loadingTask.promise;

        let fullText = '';
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const page = await pdfDoc.getPage(p);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join('\n');
          fullText += pageText + '\n';
        }
        extractedText = fullText.trim();
      } catch (e) {
        console.warn('Fallback server PDF parse falhou:', e);
      }
    }

    if (!extractedText) {
      throw new Error('Não foi possível extrair o conteúdo do arquivo PDF.');
    }

    const parsed = extractOrderFromText(extractedText);

    // Conectar ao Supabase para cruzar dados
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // 1. Cruzar Cliente por CNPJ
    let matchedClient: MatchedPDFOrderData['matchedClient'] = null;
    const cleanClientCnpj = cleanCnpj(parsed.client.cnpj);

    if (cleanClientCnpj) {
      const { data: dbClients } = await supabaseAdmin
        .from('clients')
        .select('id, name, trade_name, legal_name, cnpj');

      const found = dbClients?.find(c => cleanCnpj(c.cnpj || '') === cleanClientCnpj);
      if (found) {
        matchedClient = {
          id: found.id,
          name: found.name || found.trade_name || found.legal_name || parsed.client.tradeName,
          cnpj: found.cnpj,
          isNew: false
        };
      } else {
        matchedClient = {
          id: '',
          name: parsed.client.tradeName || parsed.client.legalName,
          cnpj: parsed.client.cnpj,
          isNew: true
        };
      }
    }

    // 2. Cruzar Representante Padrão (Mary Albuquerque / Antonia)
    const { data: reps } = await supabaseAdmin.from('representatives').select('id, name');
    const defaultRep = reps?.find(r => r.name.toLowerCase().includes('mary') || r.name.toLowerCase().includes('antonia')) || reps?.[0];
    const matchedRepresentative = defaultRep ? { id: defaultRep.id, name: defaultRep.name } : null;

    // 3. Cruzar Produtos por Código / SKU / Nome ou Criar sob Demanda
    const { data: allProducts } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, manufacturer_id, manufacturer:manufacturers(name)');

    // Buscar tabelas de preço ativas
    const { data: priceItems } = await supabaseAdmin
      .from('price_table_items')
      .select('id, product_id, base_price');

    const matchedItems: MatchedPDFOrderData['matchedItems'] = parsed.items.map(item => {
      const cleanCode = item.code.trim();
      const cleanDesc = (item.description || '').toLowerCase();

      let prod = allProducts?.find(p => {
        const skuClean = (p.sku || '').trim();
        const pName = (p.name || '').toLowerCase();

        // Match exato ou parcial por código/SKU
        if (cleanCode && (
          skuClean === cleanCode ||
          skuClean.endsWith(cleanCode) ||
          skuClean === `00${cleanCode}` ||
          (p.name || '').includes(`(${cleanCode})`) ||
          (p.name || '').includes(`(00${cleanCode})`) ||
          (p.name || '').includes(cleanCode)
        )) {
          return true;
        }

        // Match por similaridade na descrição se for longa o suficiente
        if (cleanDesc.length > 8 && (pName.includes(cleanDesc) || cleanDesc.includes(pName))) {
          return true;
        }

        return false;
      });

      const ptItem = prod ? priceItems?.find(pti => pti.product_id === prod.id) : null;

      return {
        pdfCode: item.code,
        pdfDescription: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        product: prod ? {
          id: prod.id,
          name: prod.name,
          sku: prod.sku,
          manufacturer_id: prod.manufacturer_id,
          manufacturer_name: (prod.manufacturer as any)?.name
        } : null,
        priceTableItemId: ptItem?.id || null,
        status: prod ? 'matched' : 'not_found'
      };
    });

    return {
      parsed,
      matchedClient,
      matchedRepresentative,
      matchedItems
    };
  });
