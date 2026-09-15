import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as XLSX from 'xlsx';
import * as fs from 'fs';

export const importAllSpreadsheetsDirectly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const xlsx = (XLSX as any).default || XLSX;
    const fsMod = (fs as any).default || fs;

    try {
      console.log('=== INICIANDO CARGA TOTAL DE PRODUTOS, FABRICANTES E TABELAS DE PREÇO ===');

      // Helper para buscar ou criar Fabricante
      async function getOrCreateManufacturer(name: string, tradeName: string, observations: string) {
        const { data: existing } = await supabase
          .from('manufacturers')
          .select('id, name')
          .ilike('name', `%${tradeName}%`)
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          return existing.id;
        }

        const { data: created, error } = await supabase
          .from('manufacturers')
          .insert({
            name,
            trade_name: tradeName,
            status: 'active',
            observations
          } as any)
          .select('id')
          .single();

        if (error) {
          console.warn(`Erro ao criar fabricante ${name}:`, error.message);
          return null;
        }
        return created?.id;
      }

      // 1. Cadastrar ou obter Fabricantes
      console.log('1. Garantindo Fabricantes...');
      const nutriexId = await getOrCreateManufacturer(
        'Nutriex Profissional',
        'Nutriex',
        'Fabricante de cosméticos, proteção solar, química e higiene profissional.'
      );

      const libusId = await getOrCreateManufacturer(
        'LIBUS do Brasil',
        'Libus',
        'Fabricante de EPIs para proteção da cabeça, facial, auditiva, respiratória e ocular.'
      );

      console.log('IDs Fabricantes:', { nutriexId, libusId });

      // 2. Garantir Categorias Base
      console.log('2. Garantindo Categorias de Produtos...');
      const categoriesNames = [
        'Proteção da Cabeça',
        'Proteção Auditiva',
        'Proteção Visual e Facial',
        'Proteção Respiratória',
        'Proteção Química e Pele',
        'Higiene e Desengraxantes',
        'Acessórios e Dispensers',
        'Geral'
      ];

      const { data: existingCats } = await supabase.from('product_categories').select('id, name');
      const catMap = new Map<string, string>();
      existingCats?.forEach(c => catMap.set(c.name.toLowerCase(), c.id));

      for (const catName of categoriesNames) {
        if (!catMap.has(catName.toLowerCase())) {
          const { data: newCat } = await (supabase.from('product_categories') as any)
            .insert({
              name: catName,
              status: 'active'
            })
            .select('id, name')
            .single();

          if (newCat) {
            catMap.set(newCat.name.toLowerCase(), newCat.id);
          }
        }
      }

      // 3. Criar as Tabelas de Preço no Banco
      console.log('3. Garantindo Tabelas de Preço...');
      const tablesToCreate = [
        // Tabelas Nutriex
        { name: 'Nutriex - Tabela Varejo (Padrão)', code: 'NUTRIEX-VAREJO', manufacturer_id: nutriexId, target_audience: 'consumidor_final', is_default: true },
        { name: 'Nutriex - Prata (Especialista)', code: 'NUTRIEX-PRATA', manufacturer_id: nutriexId, target_audience: 'revenda', is_default: false },
        { name: 'Nutriex - Ouro (Intermediária)', code: 'NUTRIEX-OURO', manufacturer_id: nutriexId, target_audience: 'industria', is_default: false },
        { name: 'Nutriex - Diamante (Distribuidor)', code: 'NUTRIEX-DIAMANTE', manufacturer_id: nutriexId, target_audience: 'distribuidor', is_default: false },

        // Tabelas Libus
        { name: 'Libus - Cliente Final GO/CO', code: 'LIBUS-CLIENTE-FINAL', manufacturer_id: libusId, target_audience: 'consumidor_final', is_default: false },
        { name: 'Libus - Revenda GO/CO', code: 'LIBUS-REVENDA', manufacturer_id: libusId, target_audience: 'revenda', is_default: true },
        { name: 'Libus - Distribuidor Autorizado GO/CO', code: 'LIBUS-DIST-AUTORIZADO', manufacturer_id: libusId, target_audience: 'distribuidor', is_default: false },
        { name: 'Libus - Distribuidor Premium GO/CO', code: 'LIBUS-DIST-PREMIUM', manufacturer_id: libusId, target_audience: 'distribuidor', is_default: false },
        { name: 'Libus - Distribuidor Master GO/CO', code: 'LIBUS-DIST-MASTER', manufacturer_id: libusId, target_audience: 'distribuidor', is_default: false },
      ];

      const { data: existingTables } = await (supabase.from('price_tables') as any).select('id, code, name');
      const tableMap = new Map<string, string>();
      existingTables?.forEach((pt: any) => {
        if (pt.code) tableMap.set(pt.code, pt.id);
      });

      for (const t of tablesToCreate) {
        if (!tableMap.has(t.code)) {
          const { data: newTbl, error: tblErr } = await (supabase.from('price_tables') as any)
            .insert({
              name: t.name,
              code: t.code,
              manufacturer_id: t.manufacturer_id,
              target_audience: t.target_audience,
              is_default: t.is_default,
              status: 'active'
            })
            .select('id, code')
            .single();

          if (newTbl) {
            tableMap.set(newTbl.code, newTbl.id);
          } else if (tblErr) {
            console.warn(`Erro ao criar tabela ${t.code}:`, tblErr.message);
          }
        }
      }

      console.log('Tabelas mapeadas:', Array.from(tableMap.keys()));

      // Mapear produtos já existentes no banco para evitar duplicações
      const { data: existingProducts } = await supabase.from('products').select('id, code');
      const productCodeMap = new Map<string, string>();
      existingProducts?.forEach(p => {
        if (p.code) productCodeMap.set(p.code.trim().toUpperCase(), p.id);
      });

      const stats = {
        nutriexProducts: 0,
        libusProducts: 0,
        totalItemsPriced: 0,
        errors: [] as string[]
      };

      const priceTableItemsToInsert: any[] = [];

      // Helper para salvar ou atualizar produto
      async function saveProduct(prod: {
        code: string;
        name: string;
        trade_name: string;
        manufacturer_id: string | null;
        category_id: string | null;
        price: number;
        min_price: number;
        unit: string;
        brand: string;
        technical_specifications?: any;
      }) {
        const codeKey = prod.code.trim().toUpperCase();
        const existingId = productCodeMap.get(codeKey);

        if (existingId) {
          await (supabase.from('products') as any)
            .update({
              name: prod.name,
              trade_name: prod.trade_name,
              manufacturer_id: prod.manufacturer_id,
              category_id: prod.category_id,
              price: prod.price,
              min_price: prod.min_price,
              unit: prod.unit,
              status: 'active',
              brand: prod.brand,
              ...(prod.technical_specifications ? { technical_specifications: prod.technical_specifications } : {})
            })
            .eq('id', existingId);
          return existingId;
        } else {
          const { data: created, error } = await (supabase.from('products') as any)
            .insert({
              code: prod.code,
              sku: prod.code,
              name: prod.name,
              trade_name: prod.trade_name,
              manufacturer_id: prod.manufacturer_id,
              category_id: prod.category_id,
              price: prod.price,
              min_price: prod.min_price,
              unit: prod.unit,
              status: 'active',
              brand: prod.brand,
              technical_specifications: prod.technical_specifications || null
            })
            .select('id')
            .single();

          if (created?.id) {
            productCodeMap.set(codeKey, created.id);
            return created.id;
          }
          if (error) console.warn(`Erro produto ${prod.code}:`, error.message);
          return null;
        }
      }

      // 4. Processar NUTRIEX
      console.log('4. Processando Nutriex...');
      const nutriexPath = 'C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/Nutriex Profissional - TODAS AS TABELAS.xlsx';
      if (fsMod.existsSync(nutriexPath)) {
        const fileBuffer = fsMod.readFileSync(nutriexPath);
        const wb = xlsx.read(fileBuffer, { type: 'buffer' });

        // Processar aba TABELA NUTRIEX PROFISSIONAL
        if (wb.SheetNames.includes('TABELA NUTRIEX PROFISSIONAL')) {
          const rows: any[] = xlsx.utils.sheet_to_json(wb.Sheets['TABELA NUTRIEX PROFISSIONAL'], { header: 1, defval: '' });
          let headerIdx = -1;
          for (let i = 0; i < rows.length; i++) {
            if (rows[i].some((cell: any) => String(cell).toLowerCase().includes('cod') || String(cell).toLowerCase().includes('descri'))) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx !== -1) {
            const headers = rows[headerIdx].map((h: any) => String(h).trim().toUpperCase());
            const codIdx = headers.findIndex((h: string) => h === 'COD' || h.includes('CÓD'));
            const descIdx = headers.findIndex((h: string) => h.includes('DESCRI'));
            const catIdx = headers.findIndex((h: string) => h.includes('CATEG'));
            const tabIdx = headers.findIndex((h: string) => h === 'TABELA');
            const prataIdx = headers.findIndex((h: string) => h === 'PRATA');
            const ouroIdx = headers.findIndex((h: string) => h === 'OURO');
            const diamanteIdx = headers.findIndex((h: string) => h === 'DIAMANTE');

            for (let r = headerIdx + 1; r < rows.length; r++) {
              const row = rows[r];
              const code = String(row[codIdx] || '').trim();
              const name = String(row[descIdx] || '').trim();
              if (code && name) {
                const tabPrice = Number(row[tabIdx] || 0);
                const prataPrice = Number(row[prataIdx] || tabPrice * 0.9);
                const ouroPrice = Number(row[ouroIdx] || prataPrice * 0.9);
                const diamantePrice = Number(row[diamanteIdx] || ouroPrice * 0.9);

                const basePrice = tabPrice || prataPrice || 0;
                const minPrice = diamantePrice || ouroPrice || prataPrice || (basePrice * 0.85);
                const catName = String(row[catIdx] || '').toLowerCase();

                let categoryId = catMap.get('higiene e desengraxantes');
                if (catName.includes('quimica') || catName.includes('pele')) categoryId = catMap.get('proteção química e pele');
                if (catName.includes('acessor')) categoryId = catMap.get('acessórios e dispensers');

                const prodPrices: Record<string, { unit_price: number; min_price: number; max_discount_percent: number }> = {};
                if (tabPrice > 0) prodPrices['NUTRIEX-VAREJO'] = { unit_price: tabPrice, min_price: prataPrice, max_discount_percent: 10 };
                if (prataPrice > 0) prodPrices['NUTRIEX-PRATA'] = { unit_price: prataPrice, min_price: ouroPrice, max_discount_percent: 8 };
                if (ouroPrice > 0) prodPrices['NUTRIEX-OURO'] = { unit_price: ouroPrice, min_price: diamantePrice, max_discount_percent: 6 };
                if (diamantePrice > 0) prodPrices['NUTRIEX-DIAMANTE'] = { unit_price: diamantePrice, min_price: diamantePrice, max_discount_percent: 5 };

                const prodId = await saveProduct({
                  code: code,
                  name: name,
                  trade_name: name,
                  manufacturer_id: nutriexId || null,
                  category_id: categoryId || null,
                  price: basePrice,
                  min_price: minPrice,
                  unit: 'un',
                  brand: 'Nutriex Profissional',
                  technical_specifications: {
                    prices: prodPrices
                  }
                });

                if (prodId) {
                  stats.nutriexProducts++;

                  if (tableMap.get('NUTRIEX-VAREJO') && tabPrice > 0) {
                    priceTableItemsToInsert.push({ price_table_id: tableMap.get('NUTRIEX-VAREJO'), product_id: prodId, unit_price: tabPrice, min_price: prataPrice, max_discount_percent: 10 });
                  }
                  if (tableMap.get('NUTRIEX-PRATA') && prataPrice > 0) {
                    priceTableItemsToInsert.push({ price_table_id: tableMap.get('NUTRIEX-PRATA'), product_id: prodId, unit_price: prataPrice, min_price: ouroPrice, max_discount_percent: 8 });
                  }
                  if (tableMap.get('NUTRIEX-OURO') && ouroPrice > 0) {
                    priceTableItemsToInsert.push({ price_table_id: tableMap.get('NUTRIEX-OURO'), product_id: prodId, unit_price: ouroPrice, min_price: diamantePrice, max_discount_percent: 6 });
                  }
                  if (tableMap.get('NUTRIEX-DIAMANTE') && diamantePrice > 0) {
                    priceTableItemsToInsert.push({ price_table_id: tableMap.get('NUTRIEX-DIAMANTE'), product_id: prodId, unit_price: diamantePrice, min_price: diamantePrice, max_discount_percent: 5 });
                  }
                }
              }
            }
          }
        }

        // Processar aba NUTRIEX PROFISSIONAL 2025
        if (wb.SheetNames.includes('NUTRIEX PROFISSIONAL 2025')) {
          const rows: any[] = xlsx.utils.sheet_to_json(wb.Sheets['NUTRIEX PROFISSIONAL 2025'], { header: 1, defval: '' });
          let headerIdx = -1;
          for (let i = 0; i < rows.length; i++) {
            if (rows[i].some((cell: any) => String(cell).toLowerCase().includes('código') || String(cell).toLowerCase().includes('varejo'))) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx !== -1) {
            const headers = rows[headerIdx].map((h: any) => String(h).trim().toUpperCase());
            const codIdx = headers.findIndex((h: string) => h.includes('CÓD'));
            const descIdx = headers.findIndex((h: string) => h.includes('DESCRI'));
            const varejoIdx = headers.findIndex((h: string) => h.includes('VAREJO'));
            const distIdx = headers.findIndex((h: string) => h.includes('DISTRIB'));

            for (let r = headerIdx + 1; r < rows.length; r++) {
              const row = rows[r];
              const code = String(row[codIdx] || '').trim();
              const name = String(row[descIdx] || '').trim();
              if (code && name) {
                const varejoPrice = Number(row[varejoIdx] || 0);
                const distPrice = Number(row[distIdx] || varejoPrice * 0.85);

                const prodId = await saveProduct({
                  code: code,
                  name: name,
                  trade_name: name,
                  manufacturer_id: nutriexId || null,
                  category_id: catMap.get('proteção química e pele') || null,
                  price: varejoPrice || distPrice,
                  min_price: distPrice,
                  unit: 'un',
                  brand: 'Nutriex Profissional'
                });

                if (prodId) {
                  stats.nutriexProducts++;
                  if (tableMap.get('NUTRIEX-VAREJO') && varejoPrice > 0) {
                    priceTableItemsToInsert.push({ price_table_id: tableMap.get('NUTRIEX-VAREJO'), product_id: prodId, unit_price: varejoPrice, min_price: distPrice, max_discount_percent: 10 });
                  }
                  if (tableMap.get('NUTRIEX-DIAMANTE') && distPrice > 0) {
                    priceTableItemsToInsert.push({ price_table_id: tableMap.get('NUTRIEX-DIAMANTE'), product_id: prodId, unit_price: distPrice, min_price: distPrice, max_discount_percent: 5 });
                  }
                }
              }
            }
          }
        }
      }

      // 5. Processar LIBUS
      console.log('5. Processando Libus (238 produtos e 5 tabelas de preço GO/CO)...');
      const libusAudienceFiles = [
        { file: 'TABELA CLIENTE FINAL V13.xlsx', code: 'LIBUS-CLIENTE-FINAL' },
        { file: 'TABELA REVENDA V13.xlsx', code: 'LIBUS-REVENDA' },
        { file: 'TABELA DISTRIBUIDOR AUTORIZADO V13.xlsx', code: 'LIBUS-DIST-AUTORIZADO' },
        { file: 'TABELA DISTRIBUIDOR PREMIUM V13.xlsx', code: 'LIBUS-DIST-PREMIUM' },
        { file: 'TABELA DISTRIBUIDOR MASTER V13.xlsx', code: 'LIBUS-DIST-MASTER' }
      ];

      const libusMap = new Map<string, {
        code: string;
        name: string;
        ncm: string;
        ca: string;
        categoryName: string;
        pricesByTable: Map<string, number>;
      }>();

      libusAudienceFiles.forEach(({ file, code: tableCode }) => {
        const filePath = 'C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/LIBUS/' + file;
        if (!fsMod.existsSync(filePath)) return;
        const fileBuffer = fsMod.readFileSync(filePath);
        const wb = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = wb.SheetNames.includes('Tabela') ? 'Tabela' : wb.SheetNames[0];
        const data: any[] = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });

        let headerIdx = -1;
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (row.some((cell: any) => String(cell).toLowerCase().includes('código') || String(cell).toLowerCase().includes('codigo'))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx !== -1) {
          const headers = data[headerIdx].map((h: any) => String(h).trim().toLowerCase());
          const codIdx = headers.findIndex(h => h.includes('código') || h.includes('codigo'));
          const descIdx = headers.findIndex(h => h.includes('descri'));
          const ncmIdx = headers.findIndex(h => h === 'ncm');
          const caIdx = headers.findIndex(h => h.includes('c.a') || h === 'ca');
          const coIdx = headers.findIndex(h => h.includes('no/ne/co') || h.includes('centro oeste'));

          for (let r = headerIdx + 1; r < data.length; r++) {
            const row = data[r];
            const code = String(row[codIdx] || '').trim();
            const desc = String(row[descIdx] || '').trim();
            const coPrice = Number(row[coIdx] || 0);

            if (code && desc && !isNaN(Number(code))) {
              if (!libusMap.has(code)) {
                let categoryName = 'Geral';
                const lowerDesc = desc.toLowerCase();
                if (lowerDesc.includes('capacete') || lowerDesc.includes('casco') || lowerDesc.includes('suspensão') || lowerDesc.includes('jugular')) {
                  categoryName = 'Proteção da Cabeça';
                } else if (lowerDesc.includes('oculos') || lowerDesc.includes('óculos') || lowerDesc.includes('visor') || lowerDesc.includes('facial') || lowerDesc.includes('mascara de solda') || lowerDesc.includes('máscara de solda')) {
                  categoryName = 'Proteção Visual e Facial';
                } else if (lowerDesc.includes('protetor auditivo') || lowerDesc.includes('abafador') || lowerDesc.includes('plug')) {
                  categoryName = 'Proteção Auditiva';
                } else if (lowerDesc.includes('respirador') || lowerDesc.includes('filtro') || lowerDesc.includes('cartucho')) {
                  categoryName = 'Proteção Respiratória';
                }

                libusMap.set(code, {
                  code,
                  name: desc,
                  ncm: String(row[ncmIdx] || ''),
                  ca: String(row[caIdx] || ''),
                  categoryName,
                  pricesByTable: new Map()
                });
              }

              const item = libusMap.get(code)!;
              if (coPrice > 0) {
                item.pricesByTable.set(tableCode, coPrice);
              }
            }
          }
        }
      });

      // Gravar produtos Libus e seus preços
      for (const item of libusMap.values()) {
        const finalP = item.pricesByTable.get('LIBUS-CLIENTE-FINAL') || 0;
        const revP = item.pricesByTable.get('LIBUS-REVENDA') || 0;
        const autP = item.pricesByTable.get('LIBUS-DIST-AUTORIZADO') || 0;
        const premP = item.pricesByTable.get('LIBUS-DIST-PREMIUM') || 0;
        const mastP = item.pricesByTable.get('LIBUS-DIST-MASTER') || 0;

        const basePrice = finalP || revP || autP || premP || mastP || 0;
        const minPrice = mastP || premP || autP || revP || (basePrice * 0.85);
        const categoryId = catMap.get(item.categoryName.toLowerCase()) || catMap.get('geral');

        const prodPrices: Record<string, { unit_price: number; min_price: number; max_discount_percent: number }> = {};
        for (const [tblCode, price] of item.pricesByTable.entries()) {
          if (price > 0) {
            prodPrices[tblCode] = {
              unit_price: price,
              min_price: mastP || price * 0.9,
              max_discount_percent: 10
            };
          }
        }

        const prodId = await saveProduct({
          code: item.code,
          name: item.name,
          trade_name: item.name,
          manufacturer_id: libusId || null,
          category_id: categoryId || null,
          price: basePrice,
          min_price: minPrice,
          unit: 'un',
          brand: 'Libus',
          technical_specifications: {
            ca: item.ca,
            ncm: item.ncm,
            prices: prodPrices
          }
        });

        if (prodId) {
          stats.libusProducts++;

          // Registrar preços em cada tabela da Libus
          for (const [tblCode, price] of item.pricesByTable.entries()) {
            const tblId = tableMap.get(tblCode);
            if (tblId && price > 0) {
              priceTableItemsToInsert.push({
                price_table_id: tblId,
                product_id: prodId,
                unit_price: price,
                min_price: mastP || price * 0.9,
                max_discount_percent: 10
              });
            }
          }
        }
      }

      // 6. Inserir todos os itens de tabelas de preço em lotes de 100
      console.log(`6. Gravando ${priceTableItemsToInsert.length} itens nas tabelas de preço...`);

      // Limpar itens antigos das tabelas para reinserir limpo
      for (const tId of tableMap.values()) {
        await (supabase.from('price_table_items') as any).delete().eq('price_table_id', tId);
      }

      const chunkSize = 100;
      for (let i = 0; i < priceTableItemsToInsert.length; i += chunkSize) {
        const chunk = priceTableItemsToInsert.slice(i, i + chunkSize);
        const { error: itemErr } = await (supabase.from('price_table_items') as any)
          .insert(chunk);

        if (!itemErr) {
          stats.totalItemsPriced += chunk.length;
        } else {
          console.warn('Erro ao inserir lote de itens:', itemErr.message);
        }
      }

      const totalProds = stats.nutriexProducts + stats.libusProducts;
      console.log(`=== CARGA CONCLUÍDA COM SUCESSO: ${totalProds} PRODUTOS, ${stats.totalItemsPriced} PREÇOS TABELADOS ===`);

      return {
        success: true,
        stats,
        message: `Importação concluída com sucesso! ${stats.nutriexProducts} produtos Nutriex, ${stats.libusProducts} produtos Libus e ${stats.totalItemsPriced} regras de preço multidimensionais cadastradas para Goiás / Centro-Oeste.`
      };
    } catch (err: any) {
      console.error('ERRO FATAL NA IMPORTAÇÃO:', err);
      return { success: false, message: `Erro na importação: ${err.message}` };
    }
  });

