/**
 * Extrai o número da Ordem de Compra (OC) de um pedido,
 * checando os campos estruturados e observações de faturamento/comerciais.
 */
export function extractPurchaseOrderNumber(order: {
  purchase_order_number?: string | null;
  billing_notes?: string | null;
  commercial_notes?: string | null;
  internal_notes?: string | null;
} | null | undefined): string | null {
  if (!order) return null;

  if (order.purchase_order_number && String(order.purchase_order_number).trim()) {
    return String(order.purchase_order_number).trim();
  }

  // Tentar extrair do billing_notes (padrão: "OC: 32653", "Ordem de Compra: 32653", "OC 32653")
  const textFields = [order.billing_notes, order.commercial_notes, order.internal_notes];
  for (const text of textFields) {
    if (!text) continue;
    const match = /(?:OC|Ordem de Compra|O\.C\.|PO|P\.O\.)\s*[:#\-]?\s*([A-Za-z0-9\-_./]+)/i.exec(text);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}
