import { differenceInDays } from "date-fns";

export type CommercialStatus = "active" | "warning" | "churn" | "never_bought";

export interface ClientOrderMetrics {
  totalSpent: number;
  ordersCount: number;
  lastOrderDate?: string;
  daysSinceLastOrder?: number;
  commercialStatus: CommercialStatus;
}

/**
 * Calcula o status comercial e recência com base na data da última compra e na data atual (âncora temporal única).
 */
export function calculateClientCommercialStatus(
  lastOrderDate: string | Date | null | undefined,
  referenceDate: Date = new Date()
): { status: CommercialStatus; daysSinceLastOrder?: number } {
  if (!lastOrderDate) {
    return { status: "never_bought", daysSinceLastOrder: undefined };
  }

  const orderDate = typeof lastOrderDate === "string" ? new Date(lastOrderDate) : lastOrderDate;
  if (isNaN(orderDate.getTime())) {
    return { status: "never_bought", daysSinceLastOrder: undefined };
  }

  const diffMs = referenceDate.getTime() - orderDate.getTime();
  const daysSinceLastOrder = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (daysSinceLastOrder <= 60) {
    return { status: "active", daysSinceLastOrder };
  }
  if (daysSinceLastOrder <= 120) {
    return { status: "warning", daysSinceLastOrder };
  }
  return { status: "churn", daysSinceLastOrder };
}

/**
 * Cruza uma lista de clientes com pedidos em memória de forma padronizada.
 */
export function enrichClientsWithOrderMetrics<T extends { id: string }>(
  clients: T[],
  orders: Array<{ id?: string; client_id?: string | null; total_amount?: number | null; created_at?: string | null; status?: string | null }>,
  referenceDate: Date = new Date()
): Array<T & ClientOrderMetrics> {
  const metricsMap = new Map<string, { totalSpent: number; ordersCount: number; lastOrderDate?: string }>();

  orders.forEach((order) => {
    if (!order.client_id || order.status === "cancelled") return;

    const prev = metricsMap.get(order.client_id) || {
      totalSpent: 0,
      ordersCount: 0,
      lastOrderDate: undefined,
    };

    prev.totalSpent += Number(order.total_amount || 0);
    prev.ordersCount += 1;

    if (order.created_at) {
      if (!prev.lastOrderDate || new Date(order.created_at) > new Date(prev.lastOrderDate)) {
        prev.lastOrderDate = order.created_at;
      }
    }

    metricsMap.set(order.client_id, prev);
  });

  return clients.map((client) => {
    const metrics = metricsMap.get(client.id);
    const { status, daysSinceLastOrder } = calculateClientCommercialStatus(metrics?.lastOrderDate, referenceDate);

    return {
      ...client,
      totalSpent: metrics?.totalSpent || 0,
      ordersCount: metrics?.ordersCount || 0,
      lastOrderDate: metrics?.lastOrderDate,
      daysSinceLastOrder,
      commercialStatus: status,
    };
  });
}
