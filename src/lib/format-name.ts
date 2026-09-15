/**
 * Formata nomes para apresentação na UI sem alterar os valores no banco.
 *
 * Regras:
 *  1. Palavras de até 3 letras (preposições/artigos): minúsculas — de, da, do, e, em, …
 *  2. Siglas reconhecidas: mantidas em CAIXA ALTA — CNPJ, CPF, EPI, EPIs, LTDA, ME, SA, GO, SP, MG, 3M, etc.
 *  3. Demais palavras: Primeira Maiúscula.
 *  4. A primeira palavra do resultado é sempre capitalizada, mesmo que seja preposição.
 */

/** Siglas e abreviações que devem ficar em caixa alta. */
const UPPER_SIGLAS = new Set([
  // Documentos / jurídico
  "CNPJ",
  "CPF",
  "RG",
  "LTDA",
  "ME",
  "SA",
  "EIRELI",
  "EPP",
  "SS",
  "SLU",
  // Segurança / EPI
  "EPI",
  "EPIS",
  "EPC",
  "CA",
  "NR",
  "NRS",
  // Estados brasileiros (2 letras)
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
  // Marcas que são siglas
  "3M",
  "MSA",
  "DPI",
  "PVC",
  "UV",
  "LED",
  "ISO",
]);

/** Preposições e artigos curtos que ficam em minúscula (exceto no início). */
const LOWER_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "com",
  "por",
  "para",
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
]);

function capitalizeWord(word: string): string {
  const upper = word.toUpperCase();

  // Sigla reconhecida → caixa alta
  if (UPPER_SIGLAS.has(upper)) return upper;

  // Preposição / artigo → minúscula (o chamador cuida da primeira posição)
  if (LOWER_WORDS.has(word.toLowerCase())) return word.toLowerCase();

  // Padrão → Primeira Maiúscula
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Formata um nome para apresentação.
 *
 * @example
 * formatDisplayName("ABSOLUTA EQUIPAMENTOS DE SEGURANCA E SERVICOS LTDA")
 * // → "Absoluta Equipamentos de Seguranca e Servicos LTDA"
 *
 * formatDisplayName("3M DO BRASIL")
 * // → "3M do Brasil"
 */
export function formatDisplayName(raw: string | null | undefined): string {
  if (!raw) return "";

  const words = raw.trim().split(/\s+/);
  if (words.length === 0) return "";

  const formatted = words.map((w, i) => {
    const result = capitalizeWord(w);
    // Primeira palavra sempre capitalizada
    if (i === 0 && LOWER_WORDS.has(result)) {
      return result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
  });

  return formatted.join(" ");
}

/**
 * Para exibição de clientes, escolhe o melhor nome disponível:
 *  trade_name → name → legal_name
 */
export function formatClientDisplayName(client: {
  name?: string | null;
  trade_name?: string | null;
  legal_name?: string | null;
}): string {
  const raw = client.trade_name || client.name || client.legal_name;
  return formatDisplayName(raw);
}
