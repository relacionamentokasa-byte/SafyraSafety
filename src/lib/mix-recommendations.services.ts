import { supabase } from '@/integrations/supabase/client';

export interface ClientMixDiagnostic {
  clientId: string;
  clientName: string;
  tradeName?: string;
  cnpj?: string;
  city?: string;
  state?: string;
  totalSpent: number;
  ordersCount: number;
  lastOrderDate?: string;
  daysSinceLastOrder?: number;

  // Fabricantes que o cliente compra vs lacunas
  manufacturerPenetration: Array<{
    manufacturerId: string;
    manufacturerName: string;
    logoPath?: string;
    isBuying: boolean;
    totalSpent: number;
    itemsCount: number;
    lastOrderDate?: string;
    topCategory?: string;
  }>;

  // Curva A do Cliente (O que ele mais compra habitualmente)
  frequentProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    manufacturerName: string;
    totalQuantity: number;
    totalSpent: number;
    lastPurchasedPrice: number;
    lastOrderDate?: string;
    repurchaseAlert?: string; // Ex: "Ciclo provável de reposição atingido"
  }>;

  // Oportunidades de Mix e Cross-Selling (O que outros compram e ele ainda não)
  mixOpportunities: Array<{
    productId: string;
    productName: string;
    sku: string;
    manufacturerName: string;
    category: string;
    reason: string; // Ex: "Top 1 em vendas na região", "Linha Libus não atendida"
    estimatedTicket: number;
    potentialPitch: string;
  }>;
}

/**
 * Obtém o diagnóstico completo de penetração de mix e oportunidades de venda para um cliente específico.
 */
export async function getClientMixDiagnostic(clientId: string): Promise<ClientMixDiagnostic | null> {
  if (!clientId) return null;

  // 1. Buscar dados do cliente
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, trade_name, legal_name, cnpj, city, state')
    .eq('id', clientId)
    .single();

  if (clientErr || !client) return null;

  // 2. Buscar fabricantes cadastrados
  const { data: allManufacturers } = await supabase
    .from('manufacturers')
    .select('id, name, logo_path')
    .order('name');

  const manufacturersList = allManufacturers || [];

  // 3. Buscar histórico de itens comprados pelo cliente
  const { data: clientOrderItems } = await supabase
    .from('order_items')
    .select(`
      id,
      order_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      product_name_snapshot,
      product_sku_snapshot,
      product:products (
        id,
        name,
        sku,
        manufacturer_id,
        category_id,
        category:product_categories(name),
        manufacturer:manufacturers (id, name, logo_path)
      ),
      order:orders!inner (
        id,
        created_at,
        status,
        client_id,
        total_amount
      )
    `)
    .eq('order.client_id', clientId);

  const validItems = (clientOrderItems || []).filter((it: any) => it.order?.status !== 'cancelled');

  // Calcular total e pedidos
  const ordersMap = new Map<string, string>();
  let totalSpent = 0;
  let latestOrderTimestamp = 0;

  validItems.forEach((it: any) => {
    totalSpent += Number(it.subtotal || 0);
    const orderCreatedAt = it.order?.created_at;
    if (orderCreatedAt) {
      ordersMap.set(it.order_id, orderCreatedAt);
      const ts = new Date(orderCreatedAt).getTime();
      if (ts > latestOrderTimestamp) latestOrderTimestamp = ts;
    }
  });

  const lastOrderDate = latestOrderTimestamp > 0 ? new Date(latestOrderTimestamp).toISOString() : undefined;
  const daysSinceLastOrder = latestOrderTimestamp > 0
    ? Math.floor((Date.now() - latestOrderTimestamp) / (1000 * 60 * 60 * 24))
    : undefined;

  // 4. Mapear Penetração por Fabricante
  const mfgStats = new Map<string, { totalSpent: number; itemsCount: number; lastDate?: string; categoryCount: Map<string, number> }>();

  const inferMixCategory = (name: string, mfgName?: string): string => {
    const n = (name || '').toLowerCase();
    const m = (mfgName || '').toLowerCase();

    // LINHAS NUTRIEX PROFISSIONAL
    if (m.includes('nutriex') || n.includes('nutriex') || n.includes('solar') || n.includes('repelente') || n.includes('luvex') || n.includes('desengraxante')) {
      // Protetor solar (inclui com repelente, ex: FPS 30 c/ repelente)
      if (n.includes('solar') || n.includes('bloqueador') || n.includes('fps') || (n.includes('protetor') && !n.includes('auricular') && !n.includes('facial'))) {
        return 'Proteção Solar';
      }
      // Repelente puro
      if (n.includes('repelente') || n.includes('inseto') || n.includes('deet') || n.includes('icaridina')) {
        return 'Repelentes';
      }
      if (n.includes('creme') || n.includes('pele') || n.includes('luva quimica') || n.includes('luva química') || n.includes('dermo') || n.includes('quimic') || n.includes('químic')) {
        return 'Proteção Química e Pele';
      }
      if (n.includes('desengraxante') || n.includes('sabonete') || n.includes('álcool') || n.includes('alcool') || n.includes('espuma') || n.includes('higiene') || n.includes('assepsia')) {
        return 'Higiene e Desengraxantes';
      }
      if (n.includes('dispenser') || n.includes('dosador') || n.includes('suporte') || n.includes('válvula') || n.includes('valvula') || n.includes('bico')) {
        return 'Dispensers e Suportes';
      }
      return 'Proteção Solar';
    }

    // LINHAS LIBUS DO BRASIL
    if (n.includes('capacete') || n.includes('casco') || n.includes('suspens') || n.includes('jugular') || n.includes('milennium') || n.includes('genesis')) {
      return 'Proteção da Cabeça';
    }
    if (n.includes('oculos') || n.includes('óculos') || n.includes('visor') || n.includes('facial') || n.includes('solda') || n.includes('lente') || n.includes('argon') || n.includes('neon') || n.includes('eco')) {
      return 'Proteção Visual e Facial';
    }
    if (n.includes('auditivo') || n.includes('abafador') || n.includes('plug') || n.includes('auricular') || n.includes('quantum') || n.includes('l-320') || n.includes('l-340') || n.includes('l-360')) {
      return 'Proteção Auditiva';
    }
    if (n.includes('respirador') || n.includes('filtro') || n.includes('cartucho') || n.includes('máscara') || n.includes('mascara') || n.includes('pff') || n.includes('9920') || n.includes('1730')) {
      return 'Proteção Respiratória';
    }
    if (n.includes('luva') || n.includes('manopla') || n.includes('punho') || n.includes('nitrilica') || n.includes('nitrílica') || n.includes('vaqueta')) {
      return 'Proteção das Mãos';
    }
    if (n.includes('bota') || n.includes('calçado') || n.includes('calcado') || n.includes('sapato') || n.includes('botina') || n.includes('marluvas') || n.includes('bompel')) {
      return 'Calçados de Segurança';
    }

    if (n.includes('carneira') || n.includes('suspens') || n.includes('jugular') || n.includes('almofada') || n.includes('adaptador') || n.includes('peça') || n.includes('reposi')) {
      return 'Peças e Acessórios de EPI';
    }

    return 'Peças e Acessórios de EPI';
  };

  validItems.forEach((it: any) => {
    const mfgId = it.product?.manufacturer_id || 'other';
    const prev = mfgStats.get(mfgId) || { totalSpent: 0, itemsCount: 0, categoryCount: new Map() };
    prev.totalSpent += Number(it.subtotal || 0);
    prev.itemsCount += Number(it.quantity || 1);

    const explicitCat = it.product?.category?.name || it.product?.product_categories?.name;
    const catName = explicitCat && explicitCat !== 'Geral' && explicitCat !== 'Geral / Outros'
      ? explicitCat
      : inferMixCategory(it.product_name_snapshot || it.product?.name || '', it.product?.manufacturer?.name || '');

    prev.categoryCount.set(catName, (prev.categoryCount.get(catName) || 0) + Number(it.quantity || 1));

    const itemOrderDate = it.order?.created_at;
    if (itemOrderDate && (!prev.lastDate || new Date(itemOrderDate) > new Date(prev.lastDate))) {
      prev.lastDate = itemOrderDate;
    }

    mfgStats.set(mfgId, prev);
  });

  const manufacturerPenetration = manufacturersList.map(m => {
    const stats = mfgStats.get(m.id);
    const isBuying = !!stats && stats.totalSpent > 0;

    let topCategory: string | undefined;
    if (stats?.categoryCount) {
      let maxQty = 0;
      stats.categoryCount.forEach((qty, cat) => {
        if (qty > maxQty) {
          maxQty = qty;
          topCategory = cat;
        }
      });
    }

    return {
      manufacturerId: m.id,
      manufacturerName: m.name,
      logoPath: m.logo_path,
      isBuying,
      totalSpent: stats?.totalSpent || 0,
      itemsCount: stats?.itemsCount || 0,
      lastOrderDate: stats?.lastDate,
      topCategory
    };
  });

  // 5. Mapear Produtos Frequentes do Cliente (Curva A do Cliente)
  const productUsageMap = new Map<string, {
    productId: string;
    productName: string;
    sku: string;
    manufacturerName: string;
    totalQuantity: number;
    totalSpent: number;
    lastPrice: number;
    lastDate?: string;
  }>();

  validItems.forEach((it: any) => {
    const pId = it.product_id || it.product_sku_snapshot || it.product_name_snapshot;
    const pName = it.product_name_snapshot || it.product?.name || 'Produto';
    const sku = it.product_sku_snapshot || it.product?.sku || '-';
    const mfgName = it.product?.manufacturer?.name || 'Indústria';

    const prev = productUsageMap.get(pId) || {
      productId: it.product_id,
      productName: pName,
      sku,
      manufacturerName: mfgName,
      totalQuantity: 0,
      totalSpent: 0,
      lastPrice: Number(it.unit_price || 0)
    };

    prev.totalQuantity += Number(it.quantity || 1);
    prev.totalSpent += Number(it.subtotal || 0);

    const orderDate = it.order?.created_at;
    if (orderDate && (!prev.lastDate || new Date(orderDate) > new Date(prev.lastDate))) {
      prev.lastDate = orderDate;
      prev.lastPrice = Number(it.unit_price || 0);
    }

    productUsageMap.set(pId, prev);
  });

  const frequentProducts = Array.from(productUsageMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5)
    .map(p => {
      let repurchaseAlert: string | undefined;
      if (p.lastDate) {
        const days = Math.floor((Date.now() - new Date(p.lastDate).getTime()) / (1000 * 60 * 60 * 24));
        if (days > 45) {
          repurchaseAlert = `Última compra há ${days} dias (ponto de reposição)`;
        }
      }
      return {
        productId: p.productId,
        productName: p.productName,
        sku: p.sku,
        manufacturerName: p.manufacturerName,
        totalQuantity: p.totalQuantity,
        totalSpent: p.totalSpent,
        lastPurchasedPrice: p.lastPrice,
        lastOrderDate: p.lastDate,
        repurchaseAlert
      };
    });

  // 6. Gerar Oportunidades de Mix (Cross-Selling e Lacunas)
  // Buscar os produtos mais vendidos globalmente no sistema para sugerir gaps
  const { data: topGlobalItems } = await supabase
    .from('order_items')
    .select(`
      product_id,
      quantity,
      subtotal,
      product:products (
        id,
        name,
        sku,
        manufacturer_id,
        price,
        category:product_categories(name),
        manufacturer:manufacturers(id, name)
      )
    `)
    .limit(200);

  const globalPopularity = new Map<string, { product: any; totalRevenue: number; totalQty: number }>();
  (topGlobalItems || []).forEach((it: any) => {
    if (!it.product?.id) return;
    const pId = it.product.id;
    const prev = globalPopularity.get(pId) || { product: it.product, totalRevenue: 0, totalQty: 0 };
    prev.totalRevenue += Number(it.subtotal || 0);
    prev.totalQty += Number(it.quantity || 1);
    globalPopularity.set(pId, prev);
  });

  const boughtProductIds = new Set(validItems.map((it: any) => it.product_id).filter(Boolean));
  const nonBuyingMfgIds = new Set(
    manufacturerPenetration.filter(m => !m.isBuying).map(m => m.manufacturerId)
  );

  const mixOpportunities: ClientMixDiagnostic['mixOpportunities'] = [];

  // 1ª Prioridade: Produtos campeões de fabricantes que o cliente AINDA NÃO COMPRA
  Array.from(globalPopularity.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .forEach(({ product, totalRevenue }) => {
      if (mixOpportunities.length >= 4) return;
      if (boughtProductIds.has(product.id)) return;

      const isNonBuyingMfg = nonBuyingMfgIds.has(product.manufacturer_id);
      if (isNonBuyingMfg) {
        mixOpportunities.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          manufacturerName: product.manufacturer?.name || 'Parceiro',
          category: product.category?.name || 'Linha de Entrada',
          reason: `Cliente ainda não compra ${product.manufacturer?.name || 'este fabricante'}`,
          estimatedTicket: Number(product.price || 0),
          potentialPitch: `Ofertar como linha de expansão: item com alta liquidez em clientes com perfil similar.`
        });
      }
    });

  // 2ª Prioridade: Produtos mais vendidos que o cliente ainda não testou
  if (mixOpportunities.length < 4) {
    Array.from(globalPopularity.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .forEach(({ product }) => {
        if (mixOpportunities.length >= 4) return;
        if (boughtProductIds.has(product.id)) return;
        if (mixOpportunities.some(m => m.productId === product.id)) return;

        mixOpportunities.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          manufacturerName: product.manufacturer?.name || 'Parceiro',
          category: product.category?.name || 'Linha Complementar',
          reason: `Mais vendido da categoria na região`,
          estimatedTicket: Number(product.price || 0),
          potentialPitch: `Produto com alta taxa de recompra na região. Excelente oportunidade de ampliar mix.`
        });
      });
  }

  return {
    clientId: client.id,
    clientName: client.name || client.trade_name || 'Cliente',
    tradeName: client.trade_name,
    cnpj: client.cnpj,
    city: client.city,
    state: client.state,
    totalSpent,
    ordersCount: ordersMap.size,
    lastOrderDate,
    daysSinceLastOrder,
    manufacturerPenetration,
    frequentProducts,
    mixOpportunities
  };
}
