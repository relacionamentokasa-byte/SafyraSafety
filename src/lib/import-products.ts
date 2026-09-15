import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { SpreadsheetProductRow } from '@/types/pricing.types';

/**
 * Lê e analisa um arquivo de planilha (XLSX ou CSV)
 */
export async function parseProductsSpreadsheet(file: File): Promise<SpreadsheetProductRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Pega a primeira aba da planilha
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Converte para JSON bruto
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return rawRows.map((row) => {
    // Normaliza nomes de colunas comuns em planilhas de fornecedores/fabricantes
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
        if (found && row[found] !== undefined && row[found] !== '') {
          return row[found];
        }
      }
      return undefined;
    };

    const parseMoney = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const clean = val.replace(/[^\d,-]/g, '').replace(',', '.');
        const num = parseFloat(clean);
        return isNaN(num) ? undefined : num;
      }
      return undefined;
    };

    const code = getVal('codigo', 'código', 'cod', 'sku', 'referencia', 'referência', 'ref');
    const name = getVal('nome', 'descricao', 'descrição', 'produto', 'item', 'titulo', 'título') || 'Produto sem nome';
    const category = getVal('categoria', 'grupo', 'departamento');
    const manufacturer = getVal('fabricante', 'fornecedor', 'marca');
    const brand = getVal('marca', 'fabricante');
    const unit = getVal('unidade', 'un', 'und', 'medida') || 'un';

    const basePrice = parseMoney(getVal('preco base', 'preço base', 'preco custo', 'preço custo', 'custo', 'preco', 'preço'));
    const tablePrice = parseMoney(getVal('preco tabela', 'preço tabela', 'preco venda', 'preço venda', 'valor', 'tabela'));
    const minPrice = parseMoney(getVal('preco minimo', 'preço mínimo', 'minimo', 'mínimo'));
    const maxDiscount = parseMoney(getVal('desconto max', 'desconto maximo', 'desconto máximo', '% desconto', 'desc max'));
    const commissionRate = parseMoney(getVal('comissao', 'comissão', '% comissao', '% comissão'));

    return {
      code: code ? String(code).trim() : undefined,
      sku: code ? String(code).trim() : undefined,
      name: String(name).trim(),
      category: category ? String(category).trim() : undefined,
      manufacturer: manufacturer ? String(manufacturer).trim() : undefined,
      brand: brand ? String(brand).trim() : undefined,
      unit: String(unit).trim().toLowerCase(),
      basePrice: basePrice ?? tablePrice ?? 0,
      tablePrice: tablePrice ?? basePrice ?? 0,
      minPrice: minPrice ?? (tablePrice ? tablePrice * 0.9 : 0),
      maxDiscount: maxDiscount ?? 10,
      commissionRate: commissionRate,
      status: 'active',
    };
  });
}

/**
 * Importa a lista de produtos processados para o catálogo de produtos
 * e opcionalmente insere os preços na tabela de preços selecionada
 */
export async function importProductsToDatabase(options: {
  rows: SpreadsheetProductRow[];
  manufacturerId?: string;
  priceTableId?: string;
  createMissingProducts?: boolean;
}) {
  const { rows, manufacturerId, priceTableId, createMissingProducts = true } = options;

  const results = {
    total: rows.length,
    productsCreated: 0,
    productsUpdated: 0,
    priceTableItemsLinked: 0,
    errors: [] as string[],
  };

  for (const row of rows) {
    try {
      let productId: string | undefined;

      // 1. Verificar se o produto já existe pelo código/SKU ou pelo nome
      let existingProductQuery = supabase.from('products').select('id, code, name');
      if (row.code) {
        existingProductQuery = existingProductQuery.eq('code', row.code);
      } else {
        existingProductQuery = existingProductQuery.eq('name', row.name);
      }

      const { data: existing } = await existingProductQuery.maybeSingle();

      if (existing) {
        productId = existing.id;
        // Atualizar preço base se necessário
        await supabase
          .from('products')
          .update({
            price: row.basePrice || row.tablePrice,
            min_price: row.minPrice,
            brand: row.brand || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId);

        results.productsUpdated++;
      } else if (createMissingProducts) {
        // Criar produto novo
        const { data: newProd, error: prodErr } = await supabase
          .from('products')
          .insert({
            name: row.name,
            code: row.code || `SKU-${Date.now().toString().slice(-6)}`,
            sku: row.sku || row.code,
            brand: row.brand,
            unit: row.unit || 'un',
            price: row.basePrice || row.tablePrice || 0,
            min_price: row.minPrice || 0,
            manufacturer_id: manufacturerId || null,
            status: 'active',
          })
          .select('id')
          .single();

        if (prodErr) throw prodErr;
        productId = newProd.id;
        results.productsCreated++;
      }

      // 2. Se temos uma tabela de preços selecionada e o ID do produto, vincula o preço
      if (productId && priceTableId) {
        const { error: itemErr } = await supabase
          .from('price_table_items' as any)
          .upsert(
            {
              price_table_id: priceTableId,
              product_id: productId,
              unit_price: row.tablePrice || row.basePrice || 0,
              min_price: row.minPrice,
              max_discount_percent: row.maxDiscount || 10,
              commission_rate: row.commissionRate || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'price_table_id,product_id' }
          );

        if (itemErr) throw itemErr;
        results.priceTableItemsLinked++;
      }
    } catch (err: any) {
      console.error(`Erro ao importar produto "${row.name}":`, err);
      results.errors.push(`Erro no item "${row.name}": ${err.message || 'Falha ao processar'}`);
    }
  }

  return results;
}
