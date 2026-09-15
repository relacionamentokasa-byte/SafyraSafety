import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export type ImportDataType =
  | "representantes"
  | "clientes"
  | "contatos"
  | "produtos"
  | "regioes"
  | "metas"
  | "pedidos"
  | "historico_vendas";

export interface ColumnMapping {
  sheetColumn: string;
  systemField: string;
}

export const importService = {
  /**
   * Lê o arquivo e retorna os dados brutos e cabeçalhos
   */
  async parseFile(file: File): Promise<{ headers: string[]; rows: any[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const headers = json[0] as string[];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          resolve({ headers, rows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Sugere mapeamento automático
   */
  suggestMapping(headers: string[], dataType: ImportDataType): ColumnMapping[] {
    const suggestions: ColumnMapping[] = [];

    const fieldMap: Record<string, string[]> = {
      name: ["nome", "nome fantasia", "razao social", "cliente", "full name", "razao"],
      cnpj: ["cnpj", "cpf", "cnpj/cpf", "documento"],
      email: ["email", "e-mail", "mail"],
      phone: ["telefone", "tel", "celular", "phone", "contato"],
      city: ["cidade", "city", "municipio"],
      state: ["estado", "uf", "state"],
      code: ["codigo", "code", "sku", "id", "referencia"],
      price: ["preco", "valor", "price", "custo"],
      category: ["categoria", "category", "grupo"],
    };

    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().trim();

      for (const [field, synonyms] of Object.entries(fieldMap)) {
        if (synonyms.some((s) => normalizedHeader.includes(s))) {
          suggestions.push({ sheetColumn: header, systemField: field });
          break;
        }
      }
    });

    return suggestions;
  },

  /**
   * Normaliza dados específicos
   */
  normalizeData(value: any, field: string): any {
    if (!value) return null;
    const str = String(value).trim();

    switch (field) {
      case "cnpj":
      case "cpf":
      case "cep":
        return str.replace(/\D/g, "");

      case "phone":
        return str.replace(/[^\d+]/g, "");

      case "price":
      case "value":
        if (typeof value === "number") return value;
        return parseFloat(str.replace(/[R$\s.]/g, "").replace(",", "."));

      case "state":
        const states: Record<string, string> = {
          goias: "GO",
          goiania: "GO",
          "sao paulo": "SP",
          "minas gerais": "MG",
          // ... adicione outros mapeamentos
        };
        return states[str.toLowerCase()] || str.toUpperCase().slice(0, 2);

      default:
        return value;
    }
  },

  /**
   * Registra a importação no banco
   */
  async createImportRecord(data: {
    fileName: string;
    fileSize: number;
    dataType: ImportDataType;
    mapping: ColumnMapping[];
    status?: "pending" | "processing" | "completed" | "completed_with_errors" | "cancelled";
    summary?: Record<string, unknown>;
    errorsLog?: unknown[];
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data: record, error } = await supabase
      .from("data_imports")
      .insert({
        user_id: user.id,
        file_name: data.fileName,
        file_size: data.fileSize,
        data_type: data.dataType,
        mapping: data.mapping as any,
        status: data.status || "pending",
        summary: data.summary as any,
        errors_log: data.errorsLog as any,
      })
      .select()
      .single();

    if (error) throw error;
    return record;
  },
};
