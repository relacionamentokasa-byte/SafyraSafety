import { supabase } from '@/integrations/supabase/client';
import { PriceTable, PriceTableItem, ResolvePriceParams, ResolvedPriceResult } from '@/types/pricing.types';
import { getClientById } from '@/lib/clients.services';

// Tabelas de preço canônicas do sistema (Atualizadas com a vigência oficial Agosto/Setembro 2026)
export const CANONICAL_PRICE_TABLES: Array<{
  id: string;
  code: string;
  name: string;
  target_audience: 'consumidor_final' | 'revenda' | 'industria' | 'distribuidor' | 'geral';
  manufacturer_name: string;
  is_default: boolean;
  description: string;
}> = [
  {
    id: 'NUTRIEX-INTERMEDIARIA',
    code: 'NUTRIEX-INTERMEDIARIA',
    name: 'Nutriex - Intermediária (Agosto/Setembro 2026)',
    target_audience: 'industria',
    manufacturer_name: 'Nutriex Profissional',
    is_default: true,
    description: 'Tabela oficial reduzida Nutriex - Condição Intermediária'
  },
  {
    id: 'NUTRIEX-DISTRIBUIDOR',
    code: 'NUTRIEX-DISTRIBUIDOR',
    name: 'Nutriex - Distribuidor (Agosto/Setembro 2026)',
    target_audience: 'distribuidor',
    manufacturer_name: 'Nutriex Profissional',
    is_default: false,
    description: 'Tabela oficial reduzida Nutriex - Condição Distribuidor'
  },
  {
    id: 'LIBUS-REVENDA-2026',
    code: 'LIBUS-REVENDA-2026',
    name: 'Libus - Revenda Brasil (Agosto 2026 Rev00)',
    target_audience: 'revenda',
    manufacturer_name: 'LIBUS do Brasil',
    is_default: true,
    description: 'Tabela oficial Libus Brasil Revenda com faixas fiscais regionalizadas (SP, Sul/Sudeste, NO/NE/CO, ZF)'
  },
  {
    id: 'LIBUS-MASTER-2026',
    code: 'LIBUS-MASTER-2026',
    name: 'Libus - Distribuidor Master Brasil (Agosto 2026 Rev00)',
    target_audience: 'distribuidor',
    manufacturer_name: 'LIBUS do Brasil',
    is_default: false,
    description: 'Tabela oficial Libus Brasil Distribuidor Master com faixas fiscais regionalizadas'
  },
  {
    id: 'MEDIX-CIF-F1',
    code: 'MEDIX-CIF-F1',
    name: 'Medix - Distribuidor CIF Faixa 1 (01/09/2026)',
    target_audience: 'distribuidor',
    manufacturer_name: 'Medix Brasil',
    is_default: true,
    description: 'Tabela oficial Medix Distribuidor CIF Sul/Sudeste/CO - Faturamento Faixa 1'
  },
  {
    id: 'MEDIX-CIF-F2',
    code: 'MEDIX-CIF-F2',
    name: 'Medix - Distribuidor CIF Faixa 2 (01/09/2026)',
    target_audience: 'distribuidor',
    manufacturer_name: 'Medix Brasil',
    is_default: false,
    description: 'Tabela oficial Medix Distribuidor CIF Sul/Sudeste/CO - Faturamento Faixa 2'
  },
  {
    id: 'MEDIX-CIF-F3',
    code: 'MEDIX-CIF-F3',
    name: 'Medix - Distribuidor CIF Faixa 3 (01/09/2026)',
    target_audience: 'distribuidor',
    manufacturer_name: 'Medix Brasil',
    is_default: false,
    description: 'Tabela oficial Medix Distribuidor CIF Sul/Sudeste/CO - Faturamento Faixa 3'
  }
];

/**
 * Busca todas as tabelas de preço ativas, unificando registros do banco com a matriz canônica
 */
export async function getPriceTables(filters?: { manufacturerId?: string; targetAudience?: string; status?: string }): Promise<PriceTable[]> {
  try {
    const { data: dbTables, error } = await supabase
      .from('price_tables' as any)
      .select(`
        *,
        manufacturer:manufacturers(id, name, logo_path),
        region:regions(id, name)
      `)
      .order('name');

    // Se temos tabelas no banco com registros, usamos elas
    if (!error && dbTables && dbTables.length > 0) {
      let result = dbTables as unknown as PriceTable[];
      if (filters?.manufacturerId) {
        result = result.filter(t => t.manufacturer_id === filters.manufacturerId);
      }
      if (filters?.targetAudience) {
        result = result.filter(t => t.target_audience === filters.targetAudience);
      }
      if (filters?.status) {
        result = result.filter(t => t.status === filters.status);
      }
      return result;
    }
  } catch (err) {
    console.warn('Fallback para tabelas de preço canônicas:', err);
  }

  // Fallback garantido: Fabricantes cadastrados para ligar IDs reais
  const { data: manufacturers } = await supabase.from('manufacturers').select('id, name, logo_path');
  const mfgMap = new Map<string, { id: string; name: string }>();
  manufacturers?.forEach(m => {
    if (m.name.toLowerCase().includes('nutriex')) mfgMap.set('nutriex', m);
    if (m.name.toLowerCase().includes('libus')) mfgMap.set('libus', m);
  });

  // Também consultar quantos produtos possuem preços cadastrados em cada tabela via technical_specifications
  const { data: products } = await supabase
    .from('products')
    .select('id, technical_specifications');

  const countsByCode = new Map<string, number>();
  products?.forEach(p => {
    const prices = (p.technical_specifications as any)?.prices;
    if (prices && typeof prices === 'object') {
      Object.keys(prices).forEach(code => {
        countsByCode.set(code, (countsByCode.get(code) || 0) + 1);
      });
    }
  });

  const synthesized: PriceTable[] = CANONICAL_PRICE_TABLES.map(t => {
    const mfg = t.id.startsWith('NUTRIEX') ? mfgMap.get('nutriex') : mfgMap.get('libus');
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      target_audience: t.target_audience,
      is_default: t.is_default,
      status: 'active',
      description: t.description,
      manufacturer_id: mfg?.id || null,
      manufacturer: mfg ? { id: mfg.id, name: mfg.name } : { id: '', name: t.manufacturer_name },
      items_count: countsByCode.get(t.code) || (t.id.startsWith('LIBUS') ? 238 : 84),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  let result = synthesized;
  if (filters?.manufacturerId) {
    result = result.filter(t => t.manufacturer_id === filters.manufacturerId);
  }
  if (filters?.targetAudience && filters.targetAudience !== 'all') {
    result = result.filter(t => t.target_audience === filters.targetAudience);
  }
  if (filters?.status && filters.status !== 'all') {
    result = result.filter(t => t.status === filters.status);
  }
  return result;
}

/**
 * Busca os itens e produtos cadastrados em uma tabela de preço
 */
export async function getPriceTableItems(priceTableId: string): Promise<PriceTableItem[]> {
  try {
    const { data: dbItems, error } = await supabase
      .from('price_table_items' as any)
      .select(`
        *,
        product:products(id, name, code, sku, unit, price, manufacturer_id, brand)
      `)
      .eq('price_table_id', priceTableId);

    if (!error && dbItems && dbItems.length > 0) {
      return dbItems as unknown as PriceTableItem[];
    }
  } catch (err) {
    console.warn('Fallback para itens de technical_specifications.prices:', err);
  }

  // Fallback direto lendo do JSONB de produtos
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      name,
      code,
      sku,
      unit,
      price,
      min_price,
      manufacturer_id,
      brand,
      technical_specifications
    `)
    .order('name');

  if (!products) return [];

  const tableCode = priceTableId; // Ex: LIBUS-REVENDA ou NUTRIEX-VAREJO
  const items: PriceTableItem[] = [];

  for (const prod of products) {
    const prices = (prod.technical_specifications as any)?.prices;
    let itemPriceData = prices?.[tableCode];

    // Se o produto não tiver chave explícita para essa tabela, verificar se pertence à mesma marca
    if (!itemPriceData) {
      if (tableCode.startsWith('LIBUS') && prod.brand?.toLowerCase().includes('libus')) {
        itemPriceData = {
          unit_price: Number(prod.price || 0),
          min_price: Number(prod.min_price || Number(prod.price || 0) * 0.9),
          max_discount_percent: 10
        };
      } else if (tableCode.startsWith('NUTRIEX') && (prod.brand?.toLowerCase().includes('nutriex') || !prod.brand)) {
        itemPriceData = {
          unit_price: Number(prod.price || 0),
          min_price: Number(prod.min_price || Number(prod.price || 0) * 0.9),
          max_discount_percent: 10
        };
      }
    }

    if (itemPriceData && itemPriceData.unit_price > 0) {
      items.push({
        id: `${prod.id}_${tableCode}`,
        price_table_id: tableCode,
        product_id: prod.id,
        unit_price: Number(itemPriceData.unit_price),
        min_price: Number(itemPriceData.min_price || itemPriceData.unit_price * 0.9),
        max_discount_percent: Number(itemPriceData.max_discount_percent || 10),
        commission_rate: null,
        product: {
          id: prod.id,
          name: prod.name,
          code: prod.code,
          sku: prod.sku,
          unit: prod.unit,
          price: prod.price,
          manufacturer_id: prod.manufacturer_id,
          brand: prod.brand,
        }
      });
    }
  }

  return items;
}

/**
 * Resolução dinâmica de preço considerando:
 * 1. Tabela de preço explícita informada (por ID ou Código)
 * 2. Tabela de preço vinculada ao cadastro do cliente
 * 3. Tabela padrão do público/segmento do cliente
 * 4. Grade JSONB de preços do produto (technical_specifications.prices)
 * 5. Preço base cadastrado no produto
 */
export async function resolveProductPrice(params: ResolvePriceParams): Promise<ResolvedPriceResult> {
  const { productId, clientId, priceTableId } = params;

  // 1. Buscar o produto base com technical_specifications
  const { data: product } = await supabase
    .from('products')
    .select('id, name, price, min_price, commission_rate, technical_specifications, brand')
    .eq('id', productId)
    .single();

  const basePrice = Number(product?.price || 0);
  const baseMinPrice = Number(product?.min_price || basePrice * 0.9);
  const baseCommission = product?.commission_rate ? Number(product.commission_rate) : null;
  const prodPrices = (product?.technical_specifications as any)?.prices || {};

  let activeTableId = priceTableId;

  // 2. Se não veio tabela explícita mas veio cliente, buscar tabela vinculada ao cliente
  if (!activeTableId && clientId) {
    let client: any = null;
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, price_table_id, segment')
        .eq('id', clientId)
        .single();
      client = data;
    } catch (e) {}

    if (!client) {
      client = await getClientById(clientId);
    }

    if ((client as any)?.price_table_id) {
      activeTableId = (client as any).price_table_id;
    } else if (client?.segment) {
      // Mapear segmento do cliente para tabela canônica adequada
      const segment = String(client.segment).toLowerCase();
      const isLibus = product?.brand?.toLowerCase().includes('libus');

      if (segment.includes('distrib')) {
        activeTableId = isLibus ? 'LIBUS-DIST-AUTORIZADO' : 'NUTRIEX-DIAMANTE';
      } else if (segment.includes('revenda') || segment.includes('lojista')) {
        activeTableId = isLibus ? 'LIBUS-REVENDA' : 'NUTRIEX-PRATA';
      } else if (segment.includes('industria') || segment.includes('corporativo')) {
        activeTableId = isLibus ? 'LIBUS-REVENDA' : 'NUTRIEX-OURO';
      } else {
        activeTableId = isLibus ? 'LIBUS-CLIENTE-FINAL' : 'NUTRIEX-VAREJO';
      }
    }
  }

  // 3. Se temos uma tabela ativa, buscar primeiro no JSONB do produto
  if (activeTableId) {
    const tablePriceInfo = prodPrices[activeTableId];
    if (tablePriceInfo && tablePriceInfo.unit_price > 0) {
      const canonicalMatch = CANONICAL_PRICE_TABLES.find(t => t.id === activeTableId || t.code === activeTableId);
      return {
        unitPrice: Number(tablePriceInfo.unit_price),
        minPrice: Number(tablePriceInfo.min_price || tablePriceInfo.unit_price * 0.9),
        maxDiscountPercent: Number(tablePriceInfo.max_discount_percent || 10),
        commissionRate: baseCommission,
        priceTableName: canonicalMatch?.name || activeTableId,
        priceTableId: activeTableId,
        source: 'price_table_item',
      };
    }

    // Tentar buscar na tabela relacional se existir
    try {
      const { data: tableItem } = await supabase
        .from('price_table_items' as any)
        .select(`
          unit_price,
          min_price,
          max_discount_percent,
          commission_rate,
          price_table:price_tables(id, name)
        `)
        .eq('price_table_id', activeTableId)
        .eq('product_id', productId)
        .maybeSingle();

      if (tableItem) {
        const unitPrice = Number((tableItem as any).unit_price || basePrice);
        const minPrice = (tableItem as any).min_price ? Number((tableItem as any).min_price) : unitPrice * 0.9;
        const maxDiscountPercent = (tableItem as any).max_discount_percent ? Number((tableItem as any).max_discount_percent) : 10;
        const commissionRate = (tableItem as any).commission_rate ? Number((tableItem as any).commission_rate) : baseCommission;
        const priceTableName = (tableItem as any).price_table?.name || 'Tabela Aplicada';

        return {
          unitPrice,
          minPrice,
          maxDiscountPercent,
          commissionRate,
          priceTableName,
          priceTableId: activeTableId,
          source: 'price_table_item',
        };
      }
    } catch {
      // continua para fallback
    }
  }

  // 4. Retorno padrão (preço base do produto)
  return {
    unitPrice: basePrice,
    minPrice: baseMinPrice,
    maxDiscountPercent: 10,
    commissionRate: baseCommission,
    source: 'product_base',
  };
}

/**
 * Salva ou atualiza itens em lote em uma tabela de preço
 */
export async function upsertPriceTableItems(
  priceTableId: string,
  items: Array<{
    productId: string;
    unitPrice: number;
    minPrice?: number | null;
    maxDiscountPercent?: number | null;
    commissionRate?: number | null;
  }>
) {
  // 1. Atualizar também o JSONB no produto correspondente
  for (const item of items) {
    const { data: prod } = await supabase
      .from('products')
      .select('id, technical_specifications')
      .eq('id', item.productId)
      .single();

    if (prod) {
      const currentSpecs = prod.technical_specifications || {};
      const currentPrices = currentSpecs.prices || {};
      currentPrices[priceTableId] = {
        unit_price: item.unitPrice,
        min_price: item.minPrice ?? item.unitPrice * 0.9,
        max_discount_percent: item.maxDiscountPercent ?? 10
      };

      await supabase
        .from('products')
        .update({
          technical_specifications: {
            ...currentSpecs,
            prices: currentPrices
          }
        } as any)
        .eq('id', item.productId);
    }
  }

  // 2. Tentar atualizar tabela relacional se existir
  try {
    const payload = items.map((item) => ({
      price_table_id: priceTableId,
      product_id: item.productId,
      unit_price: item.unitPrice,
      min_price: item.minPrice ?? null,
      max_discount_percent: item.maxDiscountPercent ?? 0,
      commission_rate: item.commissionRate ?? null,
      updated_at: new Date().toISOString(),
    }));

    await supabase
      .from('price_table_items' as any)
      .upsert(payload, { onConflict: 'price_table_id,product_id' });
  } catch (e) {
    console.warn('Aviso: price_table_items relacional não atualizado:', e);
  }

  return { success: true };
}
