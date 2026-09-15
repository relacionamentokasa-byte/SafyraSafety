/**
 * Utilitário de formatação de nomes para apresentação.
 *
 * Converte nomes em CAIXA ALTA vindos da base de dados para "Primeira Maiúscula"
 * preservando siglas conhecidas e preposições/artigos em minúsculo.
 *
 * ⚠  Somente para EXIBIÇÃO — os valores armazenados no banco permanecem intactos.
 */

/** Siglas que devem permanecer em CAIXA ALTA */
const UPPERCASE_TOKENS = new Set([
  // Documentos e tipos jurídicos
  "CNPJ",
  "CPF",
  "RG",
  "IE",
  "IM",
  "LTDA",
  "EIRELI",
  "MEI",
  "ME",
  "EPP",
  "SA",
  "S/A",
  "S.A.",
  "SS",
  // Segurança do trabalho / EPIs
  "EPI",
  "EPIS",
  "EPC",
  "NR",
  "CA",
  "PPE",
  // Estados brasileiros (2 letras)
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
  // Marcas e termos de produtos conhecidos mantidos em caixa alta
  "3M",
  "MSA",
  "PVC",
  "ABS",
  "UV",
  "LED",
  "NBR",
  "ISO",
  "ABNT",
  "DDS",
  "FPS",
  "FPS30",
  "FPS60",
  "FPS70",
  "UND",
  "UN",
  "CX",
  "PCT",
  "ML",
  "L",
  "KG",
  "G",
  "LIBUS",
  "NUTRIEX",
  "EPI",
  "EPIS",
  "CA",
]);

/** Preposições e artigos que ficam em minúsculo (exceto no início) */
const LOWERCASE_TOKENS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "com",
  "para",
  "por",
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "no",
  "na",
  "nos",
  "nas",
  "ao",
  "à",
  "pelo",
  "pela",
]);

/**
 * Capitaliza um token individual respeitando siglas e preposições.
 */
function capitalizeToken(token: string, isFirst: boolean): string {
  const upper = token.toUpperCase();

  // Preservar siglas conhecidas
  if (UPPERCASE_TOKENS.has(upper)) {
    return upper;
  }

  // Token alfanumérico começando com dígito → manter original (ex: "24-A")
  if (/^\d/.test(token)) {
    return token;
  }

  const lower = token.toLowerCase();

  // Preposições em minúsculo, exceto se for a primeira palavra
  if (!isFirst && LOWERCASE_TOKENS.has(lower)) {
    return lower;
  }

  // Capitalizar: primeira letra maiúscula, resto minúsculo
  if (lower.length === 0) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Formata um nome para apresentação em "Primeira Maiúscula", preservando siglas.
 *
 * @example
 * formatDisplayName("ABSOLUTA EQUIPAMENTOS DE SEGURANCA E SERVICOS LTDA")
 * // → "Absoluta Equipamentos de Segurança e Serviços Ltda"
 *
 * formatDisplayName("3M DO BRASIL LTDA")
 * // → "3M do Brasil LTDA"
 *
 * formatDisplayName("AÇÃO SEGURA")
 * // → "Ação Segura"
 *
 * @param name — o nome original (pode estar em CAIXA ALTA ou misto)
 * @returns nome formatado para exibição
 */
export function formatDisplayName(name: string | null | undefined): string {
  if (!name) return "";

  const trimmed = name.trim();
  if (trimmed.length === 0) return "";

  // Se o nome já parece estar em capitalização mista (não é tudo maiúsculo),
  // respeitar a escrita original
  const hasLowerCase = /[a-záàãâéêíóôõúüç]/.test(trimmed);
  const hasUpperCase = /[A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ]/.test(trimmed);
  if (hasLowerCase && hasUpperCase) {
    return trimmed;
  }

  // Dividir por espaço, processar cada token
  const tokens = trimmed.split(/\s+/);
  return tokens.map((token, index) => capitalizeToken(token, index === 0)).join(" ");
}

/**
 * Retorna o melhor nome de exibição para um cliente, priorizando:
 * 1. trade_name (Nome Fantasia) — se diferente do legal_name
 * 2. name — campo principal
 * 3. legal_name (Razão Social) — fallback
 *
 * Aplica formatDisplayName automaticamente.
 */
export function formatClientDisplayName(client: {
  name?: string | null;
  trade_name?: string | null;
  legal_name?: string | null;
}): string {
  const tradeName = client.trade_name?.trim();
  const name = client.name?.trim();
  const legalName = client.legal_name?.trim();

  // Preferir trade_name quando é diferente e mais curto que legal_name
  if (tradeName && legalName && tradeName !== legalName) {
    return formatDisplayName(tradeName);
  }

  return formatDisplayName(name || tradeName || legalName || "");
}
