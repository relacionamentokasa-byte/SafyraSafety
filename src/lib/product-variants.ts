/**
 * Utilitário de detecção e agrupamento de variantes (cores) de produtos.
 */

export interface ColorDefinition {
  name: string;
  hex: string;
  borderHex?: string;
  textDark?: boolean;
}

export const KNOWN_COLORS: Record<string, ColorDefinition> = {
  branco: { name: 'Branco', hex: '#FFFFFF', borderHex: '#CBD5E1', textDark: true },
  amarelo: { name: 'Amarelo', hex: '#EAB308', textDark: true },
  'amarelo fluo': { name: 'Amarelo Fluo', hex: '#CCFF00', borderHex: '#A3E635', textDark: true },
  azul: { name: 'Azul', hex: '#2563EB' },
  'azul celeste': { name: 'Azul Celeste', hex: '#38BDF8', textDark: true },
  celeste: { name: 'Celeste', hex: '#38BDF8', textDark: true },
  verde: { name: 'Verde', hex: '#16A34A' },
  'verde fluo': { name: 'Verde Fluo', hex: '#22C55E', textDark: true },
  vermelho: { name: 'Vermelho', hex: '#DC2626' },
  laranja: { name: 'Laranja', hex: '#EA580C' },
  'laranja fluo': { name: 'Laranja Fluo', hex: '#FF5722' },
  cinza: { name: 'Cinza', hex: '#64748B' },
  preto: { name: 'Preto', hex: '#1E293B' },
  marrom: { name: 'Marrom', hex: '#78350F' },
  rosa: { name: 'Rosa', hex: '#EC4899' },
  incolor: { name: 'Incolor', hex: '#F8FAFC', borderHex: '#94A3B8', textDark: true },
  fume: { name: 'Fumê', hex: '#475569' },
  fumê: { name: 'Fumê', hex: '#475569' },
  espelhado: { name: 'Espelhado', hex: '#94A3B8' },
};

export interface ProductVariantItem<T = any> {
  product: T;
  colorName: string;
  colorDef: ColorDefinition;
  isDefault: boolean;
}

export interface ProductGroup<T = any> {
  groupId: string;
  baseName: string;
  brand?: string | null;
  unit?: string | null;
  manufacturer_id?: string | null;
  manufacturer?: any;
  category_id?: string | null;
  category?: any;
  minPrice: number;
  maxPrice: number;
  defaultProduct: T;
  variants: ProductVariantItem<T>[];
  hasMultipleVariants: boolean;
}

const COLOR_REGEX = /\b(amarelo\s*fluo|amar\s*fluo|laranja\s*fluo|lar\s*fluo|amarel[oa]|azul\s*celeste|celeste|azul|vermelh[oa]|verm\b|verde\s*fluo|verde|laranja|cinza|marrom|ros[aa]|pret[oa]|branc[oa]|bran\b|incolor|fumê|fume|espelhad[oa])\b/i;

/**
 * Normaliza o nome da cor detectada
 */
export function normalizeColorName(rawColor: string): { key: string; name: string } {
  const lower = rawColor.toLowerCase().trim();
  if (/amarelo\s*fluo|amar\s*fluo/i.test(lower)) return { key: 'amarelo fluo', name: 'Amarelo Fluo' };
  if (/laranja\s*fluo|lar\s*fluo/i.test(lower)) return { key: 'laranja fluo', name: 'Laranja Fluo' };
  if (/azul\s*celeste|celeste/i.test(lower)) return { key: 'celeste', name: 'Celeste' };
  if (/amarel[oa]/i.test(lower)) return { key: 'amarelo', name: 'Amarelo' };
  if (/azul/i.test(lower)) return { key: 'azul', name: 'Azul' };
  if (/vermelh[oa]|verm\b/i.test(lower)) return { key: 'vermelho', name: 'Vermelho' };
  if (/verde\s*fluo/i.test(lower)) return { key: 'verde fluo', name: 'Verde Fluo' };
  if (/verde/i.test(lower)) return { key: 'verde', name: 'Verde' };
  if (/laranja/i.test(lower)) return { key: 'laranja', name: 'Laranja' };
  if (/cinza/i.test(lower)) return { key: 'cinza', name: 'Cinza' };
  if (/marrom/i.test(lower)) return { key: 'marrom', name: 'Marrom' };
  if (/ros[aa]/i.test(lower)) return { key: 'rosa', name: 'Rosa' };
  if (/pret[oa]/i.test(lower)) return { key: 'preto', name: 'Preto' };
  if (/branc[oa]|bran\b/i.test(lower)) return { key: 'branco', name: 'Branco' };
  if (/incolor/i.test(lower)) return { key: 'incolor', name: 'Incolor' };
  if (/fum[eê]/i.test(lower)) return { key: 'fume', name: 'Fumê' };
  if (/espelhad[oa]/i.test(lower)) return { key: 'espelhado', name: 'Espelhado' };
  return { key: lower, name: rawColor.charAt(0).toUpperCase() + rawColor.slice(1).toLowerCase() };
}

/**
 * Extrai o nome base e a cor de um produto
 */
export function extractProductColorInfo(name: string): { baseName: string; colorKey: string | null; colorName: string | null } {
  if (!name) return { baseName: '', colorKey: null, colorName: null };

  const match = name.match(COLOR_REGEX);
  if (!match) {
    return { baseName: name.trim(), colorKey: null, colorName: null };
  }

  const rawColor = match[0];
  const { key, name: colorName } = normalizeColorName(rawColor);

  // Remove a cor do nome do produto para obter o nome base limpo
  const baseName = name
    .replace(new RegExp(`\\b${rawColor}\\b`, 'gi'), '')
    .replace(/\s+/g, ' ')
    .replace(/[-–—/,\s]+$/, '')
    .trim();

  return { baseName, colorKey: key, colorName };
}

/**
 * Agrupa uma lista de produtos em grupos por produto base e variações de cores
 */
export function groupProductsIntoVariants<T extends {
  id: string;
  name: string;
  sku?: string | null;
  code?: string | null;
  price?: number | null;
  min_price?: number | null;
  brand?: string | null;
  unit?: string | null;
  manufacturer_id?: string | null;
  manufacturer?: any;
  category_id?: string | null;
  category?: any;
  main_image_url?: string | null;
}>(products: T[]): ProductGroup<T>[] {
  const groupsMap = new Map<string, {
    baseName: string;
    sample: T;
    variants: Map<string, T>;
    fallbackList: T[];
  }>();

  for (const prod of products) {
    const { baseName, colorKey, colorName } = extractProductColorInfo(prod.name);
    const mfgId = prod.manufacturer_id || (prod.manufacturer && prod.manufacturer.id) || prod.brand || 'general';
    const groupKey = `${mfgId}::${baseName.toLowerCase().replace(/\s+/g, ' ').trim()}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        baseName: baseName || prod.name,
        sample: prod,
        variants: new Map(),
        fallbackList: []
      });
    }

    const grp = groupsMap.get(groupKey)!;
    if (colorKey && colorName) {
      grp.variants.set(colorKey, prod);
    } else {
      grp.fallbackList.push(prod);
    }
  }

  const result: ProductGroup<T>[] = [];

  for (const [groupId, entry] of groupsMap.entries()) {
    const { baseName, sample, variants, fallbackList } = entry;
    const variantItems: ProductVariantItem<T>[] = [];

    if (variants.size > 0) {
      let isFirst = true;
      for (const [cKey, prod] of variants.entries()) {
        const cDef = KNOWN_COLORS[cKey] || {
          name: cKey.charAt(0).toUpperCase() + cKey.slice(1),
          hex: '#94A3B8'
        };
        variantItems.push({
          product: prod,
          colorName: cDef.name,
          colorDef: cDef,
          isDefault: isFirst || cKey === 'branco'
        });
        isFirst = false;
      }
    }

    // Se houver itens sem cor identificada nesse grupo
    for (const prod of fallbackList) {
      variantItems.push({
        product: prod,
        colorName: 'Padrão',
        colorDef: { name: 'Padrão', hex: '#64748B', textDark: false },
        isDefault: variantItems.length === 0
      });
    }

    const allPrices = variantItems.map(v => Number(v.product.price || 0)).filter(p => p > 0);
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : Number(sample.price || 0);
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : Number(sample.price || 0);

    const defaultVar = variantItems.find(v => v.colorDef.name === 'Branco') || variantItems[0];

    result.push({
      groupId,
      baseName,
      brand: sample.brand,
      unit: sample.unit,
      manufacturer_id: sample.manufacturer_id,
      manufacturer: sample.manufacturer,
      category_id: sample.category_id,
      category: sample.category,
      minPrice,
      maxPrice,
      defaultProduct: defaultVar?.product || sample,
      variants: variantItems,
      hasMultipleVariants: variantItems.length > 1
    });
  }

  return result;
}
