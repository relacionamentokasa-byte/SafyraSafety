/**
 * Seed: price_tables + price_table_items
 *
 * LIBUS (5 tabelas) — preço = coluna São Paulo (índice 7 nas sheets com header na linha 3)
 *   Cliente Final, Distribuidor Autorizado, Distribuidor Master, Distribuidor Premium, Revenda
 *
 * Nutriex (7 tabelas)
 *   Sheet 1 "TABELA NUTRIEX PROFISSIONAL": PRATA=col7, OURO=col8, DIAMANTE=col9
 *   Sheet 2 "NUTRIEX PROFISSIONAL 2025": VAREJO=col4, ESPECIALISTA=col5, INTERMEDIÁRIA=col6, DISTRIBUIDOR=col7
 *
 * Lógica:
 * 1. Inserir/atualizar registros em price_tables (identificados pelo name)
 * 2. Buscar UUID de cada produto pelo SKU (já inseridos)
 * 3. Inserir price_table_items com ON CONFLICT (price_table_id, product_id) DO UPDATE
 */

import XLSX from 'xlsx';
import { execSync } from 'child_process';
import fs from 'fs';

const PROJECT_DIR = 'C:/Users/Ariel Matos/Projetos Ariel/safyra-safety';
const TOKEN = 'sbp_1b354c12b90c74f8dd7bda87a1a4157a32ccc1f2';
const TEMP_SQL = 'C:/Users/Ariel Matos/Desktop/seed_price_tables.sql';

function esc(s) { return String(s || '').replace(/'/g, "''"); }
function num(v) { return (typeof v === 'number' && isFinite(v) && v > 0) ? v : null; }

function runQuery(sql) {
  const tmpFile = TEMP_SQL + '.tmp';
  fs.writeFileSync(tmpFile, sql, 'utf8');
  const result = execSync(
    `npx supabase db query --linked --file "${tmpFile}"`,
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, cwd: PROJECT_DIR, env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN } }
  );
  fs.unlinkSync(tmpFile);
  return result;
}

function runQueryText(sql) {
  const tmpFile = TEMP_SQL + '.q.tmp';
  fs.writeFileSync(tmpFile, sql, 'utf8');
  const result = execSync(
    `npx supabase db query --linked --file "${tmpFile}"`,
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, cwd: PROJECT_DIR, env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN } }
  );
  fs.unlinkSync(tmpFile);
  return JSON.parse(result);
}

// ============================================================
// 1. Definir tabelas
// ============================================================

const LIBUS_FILE_MAP = {
  'LIBUS - Cliente Final':          { path: 'C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/LIBUS/TABELA CLIENTE FINAL V13.xlsx',            headerRow: 0, priceCol: 2 },
  'LIBUS - Distribuidor Autorizado':{ path: 'C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/LIBUS/TABELA DISTRIBUIDOR AUTORIZADO V13.xlsx',  headerRow: 3, priceCol: 7 },
  'LIBUS - Distribuidor Master':    { path: 'C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/LIBUS/TABELA DISTRIBUIDOR MASTER V13.xlsx',      headerRow: 3, priceCol: 7 },
  'LIBUS - Distribuidor Premium':   { path: 'C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/LIBUS/TABELA DISTRIBUIDOR PREMIUM V13.xlsx',     headerRow: 3, priceCol: 7 },
  'LIBUS - Revenda':                { path: 'C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/LIBUS/TABELA REVENDA V13.xlsx',                  headerRow: 3, priceCol: 7 },
};

// Nutriex sheet 1 columns: COD, DESCRIÇÃO, MARCA, CATEGORIA, NCM, CEST, TABELA, PRATA, OURO, DIAMANTE, IPI, ICMS
const NUTRIEX_SHEET1_TABLES = {
  'Nutriex - PRATA':    7,
  'Nutriex - OURO':     8,
  'Nutriex - DIAMANTE': 9,
};

// Nutriex sheet 2 columns: CÓDIGO, DESCRIÇÃO, C.A., Qtd por Cx, VAREJO, ESPECIALISTA, INTERMEDIARIA, DISTRIBUIDOR, IPI, NCM
const NUTRIEX_SHEET2_TABLES = {
  'Nutriex 2025 - Varejo':        4,
  'Nutriex 2025 - Especialista':  5,
  'Nutriex 2025 - Intermediária': 6,
  'Nutriex 2025 - Distribuidor':  7,
};

const NUTRIEX_FILE = 'C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/Nutriex Profissional - TODAS AS TABELAS.xlsx';

// ============================================================
// 2. Criar price_tables
// ============================================================

const allTableNames = [
  ...Object.keys(LIBUS_FILE_MAP),
  ...Object.keys(NUTRIEX_SHEET1_TABLES),
  ...Object.keys(NUTRIEX_SHEET2_TABLES),
];

console.log('Criando', allTableNames.length, 'registros em price_tables...');

const createTablesSql = allTableNames.map(name => {
  const manufacturer = name.startsWith('LIBUS') ? 'LIBUS' : 'Nutriex';
  const audience = name.includes('Cliente Final') ? 'consumidor_final'
    : name.includes('Revenda') ? 'revenda'
    : name.includes('Distribuidor') ? 'distribuidor'
    : 'geral';
  const isDefault = name === 'LIBUS - Distribuidor Master' || name === 'Nutriex - PRATA';
  return `INSERT INTO public.price_tables (name, description, target_audience, is_default, status, created_at, updated_at)
  VALUES ('${esc(name)}', '${esc(manufacturer + ' — ' + name)}', '${audience}', ${isDefault}, 'active', now(), now())
  ON CONFLICT DO NOTHING;`;
}).join('\n');

runQuery(createTablesSql);
console.log('price_tables criadas.');

// ============================================================
// 3. Buscar UUIDs das tabelas e produtos
// ============================================================

console.log('Buscando UUIDs das tabelas...');
const tablesResult = runQueryText(`SELECT id, name FROM public.price_tables WHERE name IN (${allTableNames.map(n => `'${esc(n)}'`).join(',')});`);
const tableIdMap = {};
(tablesResult.rows || []).forEach(r => { tableIdMap[r.name] = r.id; });
console.log('Tabelas encontradas:', Object.keys(tableIdMap).length);

console.log('Buscando UUIDs dos produtos...');
const productsResult = runQueryText(`SELECT id, sku FROM public.products;`);
const skuToId = {};
(productsResult.rows || []).forEach(r => { skuToId[r.sku] = r.id; });
console.log('Produtos encontrados:', Object.keys(skuToId).length);

// ============================================================
// 4. Montar price_table_items
// ============================================================

const itemLines = [];
let totalItems = 0;

// LIBUS
for (const [tableName, cfg] of Object.entries(LIBUS_FILE_MAP)) {
  const tableId = tableIdMap[tableName];
  if (!tableId) { console.warn('Tabela não encontrada:', tableName); continue; }

  const wb = XLSX.readFile(cfg.path);
  const ws = wb.Sheets['Tabela'] || wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const rows = data.slice(cfg.headerRow + 1).filter(r => r[0] && typeof r[0] === 'number');

  let count = 0;
  rows.forEach(r => {
    const sku = String(r[0]);
    const productId = skuToId[sku];
    const price = num(r[cfg.priceCol]);
    if (!productId || !price) return;
    itemLines.push(
      `INSERT INTO public.price_table_items (price_table_id, product_id, unit_price, created_at, updated_at) ` +
      `VALUES ('${tableId}', '${productId}', ${price.toFixed(2)}, now(), now()) ` +
      `ON CONFLICT (price_table_id, product_id) DO UPDATE SET unit_price = EXCLUDED.unit_price, updated_at = now();`
    );
    count++;
    totalItems++;
  });
  console.log(`  ${tableName}: ${count} itens`);
}

// Nutriex sheet 1
const nutriexWb = XLSX.readFile(NUTRIEX_FILE);
const ws1 = nutriexWb.Sheets['TABELA NUTRIEX PROFISSIONAL'];
const d1 = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });
const n1rows = d1.slice(2).filter(r => r[0] && typeof r[0] === 'number');

for (const [tableName, priceCol] of Object.entries(NUTRIEX_SHEET1_TABLES)) {
  const tableId = tableIdMap[tableName];
  if (!tableId) { console.warn('Tabela não encontrada:', tableName); continue; }
  let count = 0;
  n1rows.forEach(r => {
    const sku = String(r[0]);
    const productId = skuToId[sku];
    const price = num(r[priceCol]);
    if (!productId || !price) return;
    itemLines.push(
      `INSERT INTO public.price_table_items (price_table_id, product_id, unit_price, created_at, updated_at) ` +
      `VALUES ('${tableId}', '${productId}', ${price.toFixed(2)}, now(), now()) ` +
      `ON CONFLICT (price_table_id, product_id) DO UPDATE SET unit_price = EXCLUDED.unit_price, updated_at = now();`
    );
    count++;
    totalItems++;
  });
  console.log(`  ${tableName}: ${count} itens`);
}

// Nutriex sheet 2
const ws2 = nutriexWb.Sheets['NUTRIEX PROFISSIONAL 2025'];
const d2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
const n2rows = d2.slice(5).filter(r => r[0] && typeof r[0] === 'number');

for (const [tableName, priceCol] of Object.entries(NUTRIEX_SHEET2_TABLES)) {
  const tableId = tableIdMap[tableName];
  if (!tableId) { console.warn('Tabela não encontrada:', tableName); continue; }
  let count = 0;
  n2rows.forEach(r => {
    const sku = String(r[0]);
    const productId = skuToId[sku];
    const price = num(r[priceCol]);
    if (!productId || !price) return;
    itemLines.push(
      `INSERT INTO public.price_table_items (price_table_id, product_id, unit_price, created_at, updated_at) ` +
      `VALUES ('${tableId}', '${productId}', ${price.toFixed(2)}, now(), now()) ` +
      `ON CONFLICT (price_table_id, product_id) DO UPDATE SET unit_price = EXCLUDED.unit_price, updated_at = now();`
    );
    count++;
    totalItems++;
  });
  console.log(`  ${tableName}: ${count} itens`);
}

// ============================================================
// 5. Executar em lotes de 200 inserts
// ============================================================

const BATCH = 200;
console.log(`\nInserindo ${totalItems} itens em lotes de ${BATCH}...`);
for (let i = 0; i < itemLines.length; i += BATCH) {
  const batch = itemLines.slice(i, i + BATCH);
  runQuery('BEGIN;\n' + batch.join('\n') + '\nCOMMIT;');
  process.stdout.write(`  ${Math.min(i + BATCH, itemLines.length)}/${itemLines.length}\r`);
}

console.log('\nConcluído! Verificando...');
const verifyResult = runQueryText(
  `SELECT pt.name, COUNT(pti.id) as total_itens
   FROM public.price_tables pt
   LEFT JOIN public.price_table_items pti ON pt.id = pti.price_table_id
   GROUP BY pt.name ORDER BY pt.name;`
);
console.log('\nResumo:');
(verifyResult.rows || []).forEach(r => {
  console.log(`  ${r.name}: ${r.total_itens} itens`);
});
