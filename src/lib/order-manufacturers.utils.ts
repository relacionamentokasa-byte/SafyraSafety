export interface ManufacturerRef {
  id: string;
  name: string;
  logo_path?: string | null;
  default_commission_rate?: number | null;
}

export interface OrderRef {
  id?: string;
  order_number?: string | null;
  billing_notes?: string | null;
  manufacturer_id?: string | null;
  items?: Array<{
    product?: {
      manufacturer_id?: string | null;
      manufacturer?: {
        id?: string;
        name?: string;
        logo_path?: string | null;
        default_commission_rate?: number | null;
      } | null;
    } | null;
  }> | null;
  commissions?: Array<{
    manufacturer_id?: string | null;
    manufacturer?: {
      id?: string;
      name?: string;
      logo_path?: string | null;
      default_commission_rate?: number | null;
    } | null;
  }> | null;
}

/**
 * Resolução determinística e unificada do fabricante de qualquer pedido (histórico ou novo).
 */
export function resolveOrderManufacturer(
  order: OrderRef,
  manufacturers: ManufacturerRef[] = []
): ManufacturerRef {
  // 1. Tentar resolver via item do pedido
  if (order.items && order.items.length > 0) {
    const itemMfg = order.items[0]?.product?.manufacturer;
    if (itemMfg?.name) {
      return {
        id: itemMfg.id || order.items[0]?.product?.manufacturer_id || '',
        name: itemMfg.name,
        logo_path: itemMfg.logo_path || null,
        default_commission_rate: itemMfg.default_commission_rate ?? 4.0,
      };
    }
  }

  // 2. Tentar resolver via comissão associada
  if (order.commissions && order.commissions.length > 0) {
    const commMfg = order.commissions[0]?.manufacturer;
    if (commMfg?.name) {
      return {
        id: commMfg.id || order.commissions[0]?.manufacturer_id || '',
        name: commMfg.name,
        logo_path: commMfg.logo_path || null,
        default_commission_rate: commMfg.default_commission_rate ?? 4.0,
      };
    }
  }

  // 3. Tentar resolver via ID direto de fabricante
  if (order.manufacturer_id && manufacturers.length > 0) {
    const found = manufacturers.find((m) => m.id === order.manufacturer_id);
    if (found) return found;
  }

  // 4. Analisar notas de faturamento e número do pedido
  const searchStr = `${order.billing_notes || ''} ${order.order_number || ''}`.toUpperCase();

  const isLibus =
    searchStr.includes('LIBUS') ||
    searchStr.includes('LIB-') ||
    searchStr.includes('S202') ||
    searchStr.includes('S26') ||
    searchStr.includes('PED-1');

  const isNutriex =
    searchStr.includes('NUTRIEX') ||
    searchStr.includes('NUT-') ||
    searchStr.includes('PED-2') ||
    searchStr.includes('SAI INSETO') ||
    searchStr.includes('SOLAR');

  const isMedix = searchStr.includes('MEDIX') || searchStr.includes('MED-');
  const isVolk = searchStr.includes('VOLK') || searchStr.includes('VOL-');

  let targetName = 'NUTRIEX PROFISSIONAL';
  let defaultRate = 4.0;

  if (isLibus) {
    targetName = 'LIBUS DO BRASIL';
    defaultRate = 4.0;
  } else if (isMedix) {
    targetName = 'MEDIX BRASIL';
    defaultRate = 4.0;
  } else if (isVolk) {
    targetName = 'VOLK DO BRASIL';
    defaultRate = 4.0;
  } else if (isNutriex) {
    targetName = 'NUTRIEX PROFISSIONAL';
    defaultRate = 4.0;
  }

  const matched = manufacturers.find((m) =>
    m.name.toUpperCase().includes(targetName) || targetName.includes(m.name.toUpperCase())
  );

  if (matched) {
    return matched;
  }

  return {
    id: `mfg_${targetName.toLowerCase().replace(/\s+/g, '_')}`,
    name: targetName,
    logo_path: null,
    default_commission_rate: defaultRate,
  };
}
