import fs from 'fs';
import XLSX from 'xlsx';

const wb = XLSX.readFile("C:/Users/Ariel Matos/Desktop/Implantação Safyra/Tabelas/LIBUS/TABELA DISTRIBUIDOR MASTER V13.xlsx", { bookFiles: true });
const ws = wb.Sheets["Tabela"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

const entry = wb.files["xl/drawings/drawing2.xml"];
const text = new TextDecoder().decode(entry.content || entry);
const relsEntry = wb.files["xl/drawings/_rels/drawing2.xml.rels"];
const relsText = new TextDecoder().decode(relsEntry.content || relsEntry);

const rIdMap = {};
const relRegex = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
let m;
while ((m = relRegex.exec(relsText)) !== null) {
  rIdMap[m[1]] = m[2].replace("../media/", "");
}

const picRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
const mappings = [];
while ((m = picRegex.exec(text)) !== null) {
  const block = m[0];
  const rowMatch = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/m.exec(block);
  const embedMatch = /r:embed="(rId\d+)"/.exec(block);

  if (rowMatch && embedMatch) {
    mappings.push({
      row: Number(rowMatch[1]),
      file: rIdMap[embedMatch[1]]
    });
  }
}

mappings.sort((a, b) => a.row - b.row);

const lines = [];
lines.push("BEGIN;");
data.forEach((r, idx) => {
  if (r && typeof r[0] === "number" && r[0] > 1000) {
    const code = String(r[0]);
    const matchingImg = mappings.filter(img => img.row <= idx).pop();
    if (matchingImg && matchingImg.file) {
      const file = matchingImg.file;
      lines.push(`UPDATE public.products SET main_image_url = '/products/libus/${file}' WHERE code = '${code}' OR sku = '${code}';`);
    }
  }
});
lines.push("COMMIT;");

fs.writeFileSync("update_product_images.sql", lines.join("\n"));
console.log(`Generated ${lines.length} lines in update_product_images.sql`);
