import XLSX from 'xlsx';
import fs from 'fs';

function esc(s) { return String(s || '').replace(/'/g, "''"); }
function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

const lines = [];
lines.push('-- ============================================================');
lines.push('-- SEED: Produtos (LIBUS + Nutriex)');
lines.push('-- ============================================================');
lines.push('');
lines.push('BEGIN;');
lines.push('');

// ================================================================
// PRODUTOS LIBUS
// ================================================================
lines.push('-- -------------------------------------------------------');
lines.push('-- PRODUTOS LIBUS (base: Distribuidor Master, preço SP)');
lines.push('-- -------------------------------------------------------');

const masterWb = XLSX.readFile('C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/LIBUS/TABELA DISTRIBUIDOR MASTER V13.xlsx');
const masterWs = masterWb.Sheets['Tabela'];
const masterData = XLSX.utils.sheet_to_json(masterWs, { header: 1, defval: '' });
const masterRows = masterData.slice(4).filter(r => r[0] && typeof r[0] === 'number');

masterRows.forEach(r => {
  const cod = String(r[0]);
  const desc = esc(r[1]);
  const mult = num(r[6]) || 1;
  const spPrice = num(r[7]);
  if (!spPrice || spPrice <= 0) return;
  lines.push(`INSERT INTO public.products (sku, code, name, description, brand, unit, price, created_at)`);
  lines.push(`  VALUES ('${cod}', '${cod}', '${desc}', '${desc}', 'LIBUS', 'UN', ${spPrice.toFixed(2)}, now())`);
  lines.push(`  ON CONFLICT (sku) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, price = EXCLUDED.price;`);
});

lines.push('');
lines.push('-- -------------------------------------------------------');
lines.push('-- PRODUTOS NUTRIEX - Sheet 1 (TABELA NUTRIEX PROFISSIONAL)');
lines.push('-- Preço base = coluna TABELA (antes de PRATA/OURO/DIAMANTE)');
lines.push('-- -------------------------------------------------------');

const nutriexWb = XLSX.readFile('C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/Nutriex Profissional - TODAS AS TABELAS.xlsx');

const ws1 = nutriexWb.Sheets['TABELA NUTRIEX PROFISSIONAL'];
const d1 = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });
const n1rows = d1.slice(2).filter(r => r[0] && typeof r[0] === 'number');

n1rows.forEach(r => {
  const cod = String(r[0]);
  const desc = esc(r[1]);
  const basePrice = num(r[6]);
  if (!basePrice || basePrice <= 0) return;
  lines.push(`INSERT INTO public.products (sku, code, name, description, brand, unit, price, created_at)`);
  lines.push(`  VALUES ('${cod}', '${cod}', '${desc}', '${desc}', 'Nutriex', 'UN', ${basePrice.toFixed(2)}, now())`);
  lines.push(`  ON CONFLICT (sku) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, price = EXCLUDED.price;`);
});

lines.push('');
lines.push('-- -------------------------------------------------------');
lines.push('-- PRODUTOS NUTRIEX - Sheet 2 (NUTRIEX PROFISSIONAL 2025)');
lines.push('-- Preço base = VAREJO');
lines.push('-- -------------------------------------------------------');

const ws2 = nutriexWb.Sheets['NUTRIEX PROFISSIONAL 2025'];
const d2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
const n2rows = d2.slice(5).filter(r => r[0] && typeof r[0] === 'number');

const existingCodes = new Set(n1rows.map(r => String(r[0])));

n2rows.forEach(r => {
  const cod = String(r[0]);
  if (existingCodes.has(cod)) return; // already inserted from sheet1
  const desc = esc(r[1]);
  const qtdCx = num(r[3]) || 1;
  const varejo = num(r[4]);
  if (!varejo || varejo <= 0) return;
  lines.push(`INSERT INTO public.products (sku, code, name, description, brand, unit, price, created_at)`);
  lines.push(`  VALUES ('${cod}', '${cod}', '${desc}', '${desc}', 'Nutriex', 'UN', ${varejo.toFixed(2)}, now())`);
  lines.push(`  ON CONFLICT (sku) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, price = EXCLUDED.price;`);
});

lines.push('');
lines.push('COMMIT;');
lines.push('');
lines.push(`-- LIBUS: ${masterRows.length} produtos`);
lines.push(`-- Nutriex sheet1: ${n1rows.length} produtos`);
lines.push(`-- Nutriex sheet2: ${n2rows.length} produtos (sem duplicatas de sheet1)`);

const sql = lines.join('\n');
fs.writeFileSync('C:/Users/Ariel Matos/Desktop/seed_produtos.sql', sql, 'utf8');
console.log('Arquivo gerado: C:/Users/Ariel Matos/Desktop/seed_produtos.sql');
console.log('LIBUS:', masterRows.length, 'produtos');
console.log('Nutriex sheet1:', n1rows.length, 'produtos');
console.log('Nutriex sheet2 (sem dup):', n2rows.filter(r => !existingCodes.has(String(r[0]))).length, 'produtos');
