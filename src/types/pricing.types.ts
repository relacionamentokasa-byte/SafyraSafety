export type TargetAudience = 'consumidor_final' | 'revenda' | 'industria' | 'distribuidor' | 'geral';

export interface PriceTable {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  manufacturer_id?: string | null;
  target_audience: TargetAudience;
  region_id?: string | null;
  is_default: boolean;
  status: 'active' | 'inactive';
  valid_from?: string | null;
  valid_until?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  manufacturer?: {
    id: string;
    name: string;
    logo_path?: string | null;
  } | null;
  region?: {
    id: string;
    name: string;
  } | null;
  items_count?: number;
}

export interface PriceTableItem {
  id: string;
  price_table_id: string;
  product_id: string;
  unit_price: number;
  min_price?: number | null;
  max_discount_percent?: number | null;
  commission_rate?: number | null;
  created_at?: string;
  updated_at?: string;
  product?: {
    id: string;
    name: string;
    code?: string | null;
    sku?: string | null;
    unit?: string | null;
    price?: number | null;
    manufacturer_id?: string | null;
    brand?: string | null;
  } | null;
}

export interface ResolvePriceParams {
  productId: string;
  clientId?: string;
  priceTableId?: string;
  manufacturerId?: string;
}

export interface ResolvedPriceResult {
  unitPrice: number;
  minPrice: number;
  maxDiscountPercent: number;
  commissionRate?: number | null;
  priceTableName?: string;
  priceTableId?: string;
  source: 'price_table_item' | 'client_custom' | 'product_base';
}

export interface SpreadsheetProductRow {
  code?: string;
  sku?: string;
  name: string;
  category?: string;
  manufacturer?: string;
  brand?: string;
  unit?: string;
  basePrice?: number;
  tablePrice?: number;
  minPrice?: number;
  maxDiscount?: number;
  commissionRate?: number;
  status?: string;
}
