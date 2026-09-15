import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export interface SpreadsheetClientRow {
  legalName: string;
  tradeName?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  region?: string;
  legacyCode?: number | string;
  confidence?: string;
  ordersCount?: number;
  brands?: string;
  observations?: string;
  sourceUrl?: string;
}

export interface ClientImportError {
  row: number;
  legalName: string;
  message: string;
}

export interface ClientImportResult {
  created: number;
  updated: number;
  errors: number;
  total: number;
  failedRows: ClientImportError[];
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function digitsOnly(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits || null;
}

function normalizedKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeState(value: unknown): string | null {
  const state = normalizedKey(value);
  if (!state) return null;

  const fullStateNames: Record<string, string> = {
    "distrito federal": "DF",
    goias: "GO",
    "minas gerais": "MG",
    para: "PA",
    maranhao: "MA",
    tocantins: "TO",
  };

  return fullStateNames[state] || state.toUpperCase().slice(0, 2);
}

function resolvePurchasePotential(row: SpreadsheetClientRow): "alto" | "medio" | "baixo" {
  const ordersCount = Number(row.ordersCount || 0);
  const confidence = normalizedKey(row.confidence);
  const cnpj = digitsOnly(row.cnpj);

  if (ordersCount >= 2 || (confidence === "alta" && cnpj)) return "alto";
  if (!cnpj || confidence === "baixa") return "baixo";
  return "medio";
}

function buildNotes(row: SpreadsheetClientRow): string | null {
  const notes = [
    row.legacyCode !== undefined && row.legacyCode !== null
      ? `ID Legado Pedidos: ${row.legacyCode}`
      : null,
    asText(row.brands) ? `Marcas de Interesse: ${asText(row.brands)}` : null,
    row.ordersCount ? `Histórico de Pedidos: ${row.ordersCount}` : null,
    asText(row.observations) ? `Observações: ${asText(row.observations)}` : null,
    asText(row.sourceUrl) ? `Fonte: ${asText(row.sourceUrl)}` : null,
  ].filter(Boolean);

  return notes.length ? notes.join(" | ") : null;
}

export async function parseClientsSpreadsheet(
  file: File | ArrayBuffer,
): Promise<SpreadsheetClientRow[]> {
  let workbook: XLSX.WorkBook;

  if (typeof File !== "undefined" && file instanceof File) {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  } else {
    workbook = XLSX.read(file, { type: "array" });
  }

  const clientsSheet = workbook.Sheets["Clientes"] || workbook.Sheets[workbook.SheetNames[0]];
  if (!clientsSheet) throw new Error('Aba "Clientes" não encontrada na planilha.');

  const rawClients: Record<string, unknown>[] = XLSX.utils.sheet_to_json(clientsSheet, {
    defval: null,
  });
  const confSheet = workbook.Sheets["Conferência"];
  const confMap = new Map<string, Record<string, unknown>>();

  if (confSheet) {
    const rawConf: Record<string, unknown>[] = XLSX.utils.sheet_to_json(confSheet, {
      defval: null,
    });

    rawConf.forEach((row) => {
      const nameKey = normalizedKey(
        row["Nome na planilha de pedidos"] || row["Razão Social (Receita)"],
      );
      const cnpjKey = digitsOnly(row.CNPJ);
      if (nameKey) confMap.set(nameKey, row);
      if (cnpjKey) confMap.set(cnpjKey, row);
    });
  }

  return rawClients.flatMap((row) => {
    const legalName = asText(row["Razão Social"] || row.Nome);
    if (!legalName) return [];

    const cnpj = asText(row.CNPJ);
    const conf = confMap.get(digitsOnly(cnpj) || "") || confMap.get(normalizedKey(legalName)) || {};

    return [
      {
        legalName,
        tradeName: asText(row["Nome Fantasia"]) || undefined,
        cnpj: cnpj || undefined,
        email: asText(row.Email) || undefined,
        phone: asText(row.Telefone) || undefined,
        address: asText(row["Endereço"]) || undefined,
        number: asText(row["Número"]) || undefined,
        neighborhood: asText(row.Bairro) || undefined,
        city: asText(row.Cidade) || undefined,
        state: normalizeState(row.Estado) || undefined,
        zipCode: asText(row.CEP) || undefined,
        region: asText(row["Região"]) || undefined,
        legacyCode: conf["Código (IDCliente pedidos)"] as number | string | undefined,
        confidence: asText(conf.Confiança) || undefined,
        ordersCount: conf["Qtd Pedidos"] ? Number(conf["Qtd Pedidos"]) : 0,
        brands: asText(conf.Marcas) || undefined,
        observations: asText(conf.Observações) || undefined,
        sourceUrl: asText(conf.Fonte) || undefined,
      },
    ];
  });
}

export async function importClientsToDatabase(
  rows: SpreadsheetClientRow[],
): Promise<ClientImportResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Usuário não autenticado");

  const { data: representatives, error: representativesError } = await supabase
    .from("representatives")
    .select("id, code, email, name, status")
    .eq("status", "active");
  if (representativesError) throw representativesError;

  const representative =
    representatives?.find((item) => String(item.code || "").toUpperCase() === "REP001") ||
    representatives?.find(
      (item) => normalizedKey(item.email) === "marigleyce@safyrasafety.com.br",
    ) ||
    representatives?.find((item) => normalizedKey(item.name) === "marigleyce albuquerque");

  if (!representative) {
    throw new Error("Representante ativa REP001/Marigleyce não encontrada");
  }

  const { data: regions, error: regionsError } = await supabase
    .from("regions")
    .select("id, name, state, cities")
    .eq("status", "active");
  if (regionsError) throw regionsError;

  const { data: existingClients, error: existingClientsError } = await supabase
    .from("clients")
    .select("id, cnpj, legal_name, name");
  if (existingClientsError) throw existingClientsError;

  const byCnpj = new Map<string, { id: string }>();
  const byLegalName = new Map<string, { id: string }>();
  (existingClients || []).forEach((client) => {
    const id = client.id;
    const cnpj = digitsOnly(client.cnpj);
    const legalName = normalizedKey(client.legal_name || client.name);
    if (cnpj) byCnpj.set(cnpj, { id });
    if (legalName) byLegalName.set(legalName, { id });
  });

  const importedAt = new Date().toISOString();
  const failedRows: ClientImportError[] = [];
  let created = 0;
  let updated = 0;

  for (const [index, row] of rows.entries()) {
    try {
      const legalName = asText(row.legalName);
      if (!legalName) throw new Error("Razão Social não informada");

      const city = asText(row.city);
      const state = normalizeState(row.state);
      if (!city || !state) throw new Error("Cidade e UF são obrigatórios");

      const cityMatches = (regions || []).filter(
        (item) =>
          Array.isArray(item.cities) &&
          item.cities.some((itemCity) => normalizedKey(itemCity) === normalizedKey(city)),
      );
      const stateMatches = cityMatches.filter((item) => normalizeState(item.state) === state);
      const region =
        (stateMatches.length === 1 ? stateMatches[0] : undefined) ||
        (cityMatches.length === 1 ? cityMatches[0] : undefined);
      if (!region) throw new Error(`Região não encontrada para ${city}/${state}`);

      const cnpj = digitsOnly(row.cnpj);
      const displayName = asText(row.tradeName) || legalName;
      const commonPayload = {
        name: displayName,
        legal_name: legalName,
        trade_name: asText(row.tradeName),
        cnpj,
        status: "active",
        segment: "revenda",
        client_type: "PJ",
        phone: digitsOnly(row.phone),
        email: asText(row.email),
        address: asText(row.address),
        address_number: asText(row.number),
        neighborhood: asText(row.neighborhood),
        city,
        state,
        zip_code: digitsOnly(row.zipCode),
        purchase_potential: resolvePurchasePotential(row),
        notes: buildNotes(row),
        representative_id: representative.id,
        region_id: region.id,
        updated_by: user.id,
        updated_at: importedAt,
      };

      const existing = cnpj ? byCnpj.get(cnpj) : byLegalName.get(normalizedKey(legalName));
      if (existing) {
        const { data, error } = await supabase
          .from("clients")
          .update(commonPayload)
          .eq("id", existing.id)
          .select("id")
          .single();
        if (error) throw error;
        if (!data?.id) throw new Error("Atualização não confirmada pelo banco");
        updated++;
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert({ ...commonPayload, created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        if (!data?.id) throw new Error("Inserção não confirmada pelo banco");
        created++;
        const saved = { id: data.id };
        if (cnpj) byCnpj.set(cnpj, saved);
        byLegalName.set(normalizedKey(legalName), saved);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      failedRows.push({ row: index + 2, legalName: row.legalName || "(sem nome)", message });
    }
  }

  return {
    created,
    updated,
    errors: failedRows.length,
    total: rows.length,
    failedRows,
  };
}
