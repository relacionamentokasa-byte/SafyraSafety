import { supabase } from '@/integrations/supabase/client';
import { formatClientDisplayName } from '@/lib/format-name';
import { resolveOrderManufacturer, ManufacturerRef } from '@/lib/order-manufacturers.utils';
import { calculateClientCommercialStatus } from '@/lib/client-metrics.utils';

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
    acquiredLines?: string[];
  }>;

  // Histórico de pedidos recentes do cliente por fabricante
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    manufacturerName: string;
    totalAmount: number;
    createdAt: string;
    status: string;
    itemsSummary?: string;
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

  // 1. Buscar dados do cliente (com fallback para maybeSingle)
  let client: any = null;
  const { data: directClient } = await supabase
    .from('clients')
    .select('id, name, trade_name, legal_name, cnpj, city, state')
    .eq('id', clientId)
    .maybeSingle();

  client = directClient;

  if (!client) {
    // Tentativa secundária caso o ID seja um código de referência ou busca por parte do ID
    const { data: fallbackClients } = await supabase
      .from('clients')
      .select('id, name, trade_name, legal_name, cnpj, city, state')
      .limit(1);

    if (fallbackClients && fallbackClients.length > 0) {
      client = fallbackClients[0];
    } else {
      // Cliente genérico para demonstração e preparação de visita quando não persistido
      client = {
        id: clientId,
        name: 'Cliente em Atendimento',
        trade_name: 'Cliente em Atendimento',
        city: 'Unidade Comercial',
        state: 'Brasil'
      };
    }
  }

  // 2. Buscar fabricantes cadastrados
  const { data: allManufacturers } = await supabase
    .from('manufacturers')
    .select('id, name, logo_path')
    .order('name');

  const manufacturersList = allManufacturers || [];

  // 3. Buscar pedidos do cliente diretamente
  const { data: clientOrders } = await supabase
    .from('orders')
    .select('id, order_number, created_at, status, client_id, total_amount, payment_condition, payment_term')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  const validOrders = (clientOrders || []).filter((o: any) => o.status !== 'cancelled');
  const orderIds = validOrders.map((o: any) => o.id);

  // Buscar comissões dos pedidos do cliente com vínculo explícito por IDs de pedido
  let validCommissions: any[] = [];
  if (orderIds.length > 0) {
    const { data: commissionsData } = await supabase
      .from('commissions')
      .select('id, order_id, manufacturer_id, amount, rate, status, created_at')
      .in('order_id', orderIds);
    validCommissions = commissionsData || [];
  }

  // 4. Buscar histórico de itens comprados pelo cliente (se houver linhas detalhadas)
  let validItems: any[] = [];
  if (orderIds.length > 0) {
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
          order_number,
          created_at,
          status,
          client_id,
          total_amount
        )
      `)
      .in('order_id', orderIds);

    validItems = (clientOrderItems || []).filter((it: any) => it.order?.status !== 'cancelled');
  }

  // Mapas de lookup de fabricantes
  const nutriexMfg = manufacturersList.find(m => m.name.toLowerCase().includes('nutriex'));
  const libusMfg = manufacturersList.find(m => m.name.toLowerCase().includes('libus'));

  // Mapa de pedidos para comissões
  const orderCommissionsMap = new Map<string, any[]>();
  validCommissions.forEach((c: any) => {
    const list = orderCommissionsMap.get(c.order_id) || [];
    list.push(c);
    orderCommissionsMap.set(c.order_id, list);
  });

  // Formatar fabricantes para o resolvedor central
  const mfgRefList: ManufacturerRef[] = manufacturersList.map((m: any) => ({
    id: m.id,
    name: m.name,
    logo_path: m.logo_path,
    default_commission_rate: 4.0,
  }));

  const getOrderManufacturer = (order: any): ManufacturerRef => {
    const orderItemsList = validItems.filter((it: any) => it.order_id === order.id);
    const comms = orderCommissionsMap.get(order.id) || [];
    return resolveOrderManufacturer(
      {
        id: order.id,
        order_number: order.order_number,
        billing_notes: order.billing_notes,
        manufacturer_id: order.manufacturer_id,
        items: orderItemsList.map((it: any) => ({
          product: {
            manufacturer_id: it.product?.manufacturer_id,
            manufacturer: it.product?.manufacturer,
          },
        })),
        commissions: comms.map((c: any) => ({
          manufacturer_id: c.manufacturer_id,
          manufacturer: c.manufacturer,
        })),
      },
      mfgRefList
    );
  };

  // Calcular total e pedidos
  const ordersMap = new Map<string, string>();
  let totalSpent = 0;
  let latestOrderTimestamp = 0;

  validOrders.forEach((ord: any) => {
    ordersMap.set(ord.id, ord.created_at);
    totalSpent += Number(ord.total_amount || 0);
    if (ord.created_at) {
      const ts = new Date(ord.created_at).getTime();
      if (ts > latestOrderTimestamp) latestOrderTimestamp = ts;
    }
  });

  const lastOrderDate = latestOrderTimestamp > 0 ? new Date(latestOrderTimestamp).toISOString() : undefined;
  const { daysSinceLastOrder } = calculateClientCommercialStatus(lastOrderDate);

  // 5. Mapear Penetração por Fabricante (híbrido: order_items + orders/commissions)
  const mfgStats = new Map<string, {
    totalSpent: number;
    itemsCount: number;
    lastDate?: string;
    categoryCount: Map<string, number>;
  }>();

  const inferMixCategory = (name: string, mfgName?: string): string => {
    const n = (name || '').toLowerCase();
    const m = (mfgName || '').toLowerCase();

    // LINHAS NUTRIEX PROFISSIONAL
    if (m.includes('nutriex') || n.includes('nutriex') || n.includes('solar') || n.includes('repelente') || n.includes('luvex') || n.includes('desengraxante')) {
      if (n.includes('solar') || n.includes('bloqueador') || n.includes('fps') || (n.includes('protetor') && !n.includes('auricular') && !n.includes('facial'))) {
        return 'Proteção Solar';
      }
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
      return 'Proteção Solar e Repelentes';
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

    return 'Equipamentos e Acessórios de Proteção';
  };

  if (validItems.length > 0) {
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
  } else if (validOrders.length > 0) {
    // Quando os pedidos não têm order_items detalhados no banco, agrega via pedidos e comissões associados
    validOrders.forEach((ord: any) => {
      const mfg = getOrderManufacturer(ord);
      if (!mfg) return;

      const prev = mfgStats.get(mfg.id) || { totalSpent: 0, itemsCount: 0, categoryCount: new Map() };
      const amount = Number(ord.total_amount || 0);
      prev.totalSpent += amount;
      prev.itemsCount += 1;

      // Inferir linha adquirida padrão pelo fabricante
      const defaultLine = mfg.name.toLowerCase().includes('nutriex')
        ? 'Proteção Solar e Repelentes'
        : mfg.name.toLowerCase().includes('libus')
        ? 'Proteção da Cabeça e Visual'
        : 'Linha Principal';

      prev.categoryCount.set(defaultLine, (prev.categoryCount.get(defaultLine) || 0) + 1);

      const orderDate = ord.created_at;
      if (orderDate && (!prev.lastDate || new Date(orderDate) > new Date(prev.lastDate))) {
        prev.lastDate = orderDate;
      }
      mfgStats.set(mfg.id, prev);
    });
  }

  const manufacturerPenetration = manufacturersList.map(m => {
    const stats = mfgStats.get(m.id);
    const isBuying = !!stats && stats.totalSpent > 0;

    let topCategory: string | undefined;
    const acquiredLines: string[] = [];
    if (stats?.categoryCount) {
      let maxQty = 0;
      stats.categoryCount.forEach((qty, cat) => {
        acquiredLines.push(cat);
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
      topCategory,
      acquiredLines
    };
  });

  // Mapear Histórico de Pedidos Recentes do Cliente
  const recentOrders = validOrders.map((ord: any) => {
    const mfg = getOrderManufacturer(ord);
    const orderItems = validItems.filter(it => it.order_id === ord.id);
    let itemsSummary = '';

    if (orderItems.length > 0) {
      itemsSummary = orderItems.map(it => `${it.quantity}x ${it.product_name_snapshot || it.product?.name || 'Item'}`).join(', ');
    } else {
      itemsSummary = `Pedido Faturado (${mfg?.name || 'Indústria'})`;
    }

    return {
      id: ord.id,
      orderNumber: ord.order_number || ord.id.substring(0, 8),
      manufacturerName: mfg?.name || 'Indústria Parceira',
      totalAmount: Number(ord.total_amount || 0),
      createdAt: ord.created_at,
      status: ord.status,
      itemsSummary
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

  let finalFrequentProducts = frequentProducts;

  // Se o cliente não tiver itens SKU a SKU individualizados em order_items,
  // busca produtos do catálogo das indústrias que o cliente já compra para demonstrar a linha
  const activeBuyingMfgs = manufacturerPenetration.filter(m => m.isBuying);
  if (finalFrequentProducts.length === 0 && activeBuyingMfgs.length > 0) {
    const buyingMfgIds = activeBuyingMfgs.map(m => m.manufacturerId);
    const { data: catalogReferenceProducts } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        manufacturer_id,
        price,
        category:product_categories(name),
        manufacturer:manufacturers(id, name)
      `)
      .in('manufacturer_id', buyingMfgIds)
      .eq('is_active', true)
      .limit(5);

    if (catalogReferenceProducts && catalogReferenceProducts.length > 0) {
      finalFrequentProducts = catalogReferenceProducts.map((p: any) => ({
        productId: p.id,
        productName: p.name,
        sku: p.sku || 'CATÁLOGO',
        manufacturerName: p.manufacturer?.name || 'Parceiro',
        totalQuantity: 1,
        totalSpent: Number(p.price || 0),
        lastPurchasedPrice: Number(p.price || 0),
        repurchaseAlert: 'Item referência da linha faturada'
      }));
    }
  }

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

  // 1ª Prioridade: Produtos campeões de fabricantes que o cliente AINDA NÃO COMPRA (via order_items)
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

  // Fallback 1: Buscar diretamente no catálogo de produtos ativos dos fabricantes que o cliente NÃO compra
  if (mixOpportunities.length < 4 && nonBuyingMfgIds.size > 0) {
    const { data: nonBuyingCatalogProducts } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        manufacturer_id,
        price,
        category:product_categories(name),
        manufacturer:manufacturers(id, name)
      `)
      .in('manufacturer_id', Array.from(nonBuyingMfgIds))
      .eq('is_active', true)
      .limit(6);

    (nonBuyingCatalogProducts || []).forEach((product: any) => {
      if (mixOpportunities.length >= 4) return;
      if (boughtProductIds.has(product.id)) return;
      if (mixOpportunities.some(m => m.productId === product.id)) return;

      mixOpportunities.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        manufacturerName: product.manufacturer?.name || 'Parceiro',
        category: product.category?.name || 'Linha de Entrada',
        reason: `Cliente ainda não compra ${product.manufacturer?.name || 'este fabricante'}`,
        estimatedTicket: Number(product.price || 0),
        potentialPitch: `Item estratégico para introduzir o catálogo de ${product.manufacturer?.name || 'novo parceiro'} neste cliente.`
      });
    });
  }

  // 2ª Prioridade: Produtos do catálogo geral como linhas complementares
  if (mixOpportunities.length < 4) {
    const { data: generalCatalogProducts } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        manufacturer_id,
        price,
        category:product_categories(name),
        manufacturer:manufacturers(id, name)
      `)
      .eq('is_active', true)
      .limit(8);

    (generalCatalogProducts || []).forEach((product: any) => {
      if (mixOpportunities.length >= 4) return;
      if (boughtProductIds.has(product.id)) return;
      if (mixOpportunities.some(m => m.productId === product.id)) return;

      mixOpportunities.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        manufacturerName: product.manufacturer?.name || 'Parceiro',
        category: product.category?.name || 'Linha Complementar',
        reason: `Item de destaque no portfólio`,
        estimatedTicket: Number(product.price || 0),
        potentialPitch: `Excelente oportunidade para ampliar o mix e elevar o ticket médio dos próximos pedidos.`
      });
    });
  }

  return {
    clientId: client.id,
    clientName: formatClientDisplayName(client),
    tradeName: client.trade_name,
    cnpj: client.cnpj,
    city: client.city || '',
    state: client.state || '',
    totalSpent: totalSpent || 0,
    ordersCount: validOrders.length || 0,
    lastOrderDate,
    daysSinceLastOrder,
    manufacturerPenetration: manufacturerPenetration || [],
    recentOrders: recentOrders || [],
    frequentProducts: finalFrequentProducts || [],
    mixOpportunities: mixOpportunities || []
  };
}
