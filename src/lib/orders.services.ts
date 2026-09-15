import { addDays, format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { ensureClientInDatabase, isUuid } from "@/lib/clients.services";
import type { OrderFormValues } from "@/lib/orders.schema";
import { loadPublishedPaymentCatalog } from "@/lib/payment-plans";

type CreateOrderPayload = {
  idempotency_key: string;
  client_id: string;
  representative_id: string;
  opportunity_id?: string;
  payment_plan_id: string;
  price_table_id?: string;
  expected_delivery_date?: string;
  commercial_notes?: string;
  internal_notes?: string;
  billing_notes?: string;
  items: Array<{
    product_id: string;
    price_table_item_id: string | null;
    quantity: number;
    requested_discount_percent: number;
  }>;
};

export type CreatedOrder = {
  id: string;
  order_number?: string;
  status?: string;
  subtotal_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  items?: Json;
  payments?: Json;
  idempotent?: boolean;
};

type RpcError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: Json | null; error: RpcError | null }>;
};

type LegacyOrderInsert = Pick<
  TablesInsert<"orders">,
  | "client_id"
  | "representative_id"
  | "opportunity_id"
  | "status"
  | "subtotal_amount"
  | "discount_amount"
  | "total_amount"
  | "payment_method"
  | "payment_condition"
  | "payment_term"
  | "expected_delivery_date"
  | "commercial_notes"
  | "internal_notes"
  | "billing_notes"
  | "origin"
  | "created_by"
  | "updated_by"
  | "created_at"
>;

type LegacyOrderItemInsert = Pick<
  TablesInsert<"order_items">,
  "order_id" | "product_id" | "quantity" | "unit_price" | "discount_amount" | "subtotal"
>;

type LegacyOrderPaymentInsert = Pick<
  TablesInsert<"order_payments">,
  "order_id" | "installment_number" | "due_date" | "value" | "status"
>;

type LegacyOrderHistoryInsert = Pick<
  TablesInsert<"order_history">,
  "order_id" | "user_id" | "action" | "previous_status" | "new_status" | "details"
>;

type LegacyProduct = Pick<Tables<"products">, "id" | "status" | "price" | "min_price">;
type LegacyClient = Pick<Tables<"clients">, "id" | "status" | "representative_id">;
type LegacyRepresentative = Pick<Tables<"representatives">, "id" | "user_id" | "status">;

type PricedOrderItem = {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
};

type OrderPaymentDraft = LegacyOrderPaymentInsert;

export async function deleteOrderPermanentlyDirect(orderId: string): Promise<void> {
  if (!orderId) throw new Error("ID do pedido é obrigatório.");

  // 1. Tentar executar via RPC segura
  const rpcClient = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  };

  const { data: rpcData, error: rpcError } = await rpcClient.rpc('delete_order_permanently', {
    p_order_id: orderId,
  });

  if (!rpcError) {
    return;
  }

  console.warn("[deleteOrderPermanentlyDirect] RPC falhou ou não encontrada, tentando cascata direta:", rpcError);

  // 2. Limpeza em cascata no cliente autenticado
  const { data: payments } = await supabase
    .from('order_payments')
    .select('id')
    .eq('order_id', orderId);

  if (payments && payments.length > 0) {
    const paymentIds = payments.map((p) => p.id);
    await supabase
      .from('commissions')
      .delete()
      .in('order_payment_id', paymentIds);
  }

  await supabase
    .from('commissions')
    .delete()
    .eq('order_id', orderId);

  await supabase
    .from('order_payments')
    .delete()
    .eq('order_id', orderId);

  await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId);

  await supabase
    .from('order_history')
    .delete()
    .eq('order_id', orderId);

  const { error: orderDeleteError } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (orderDeleteError) {
    throw new Error(orderDeleteError.message || "Não foi possível excluir o pedido.");
  }
}

class OrderServiceError extends Error {
  code: string;
  cause?: unknown;

  constructor(code: string, message = code, cause?: unknown) {
    super(message);
    this.name = "OrderServiceError";
    this.code = code;
    this.cause = cause;
  }
}

export function createOrderIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function isCreatedOrder(value: Json | null): value is CreatedOrder {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.id === "string"
  );
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return typeof error === "string" ? error : "Erro desconhecido";
}

function isMissingCreateOrderRpcError(error: unknown): boolean {
  const code = getErrorCode(error);
  const text = getErrorText(error).toLowerCase();

  return (
    code === "PGRST202" ||
    code === "42883" ||
    (text.includes("could not find the function") && text.includes("create_order")) ||
    text.includes("function public.create_order")
  );
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getOptionalDate(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed) || !isValid(parseISO(trimmed))) {
    throw new OrderServiceError("EXPECTED_DELIVERY_DATE_INVALID");
  }

  return trimmed;
}

async function resolvePublishedPaymentPlan(paymentPlanId: string) {
  if (!isUuid(paymentPlanId)) {
    throw new OrderServiceError("PAYMENT_PLAN_REQUIRED");
  }

  const catalog = await loadPublishedPaymentCatalog();
  const plan = catalog.plans.find((candidate) => candidate.id === paymentPlanId);
  if (!plan) {
    throw new OrderServiceError("PAYMENT_PLAN_NOT_AVAILABLE");
  }

  const method = catalog.methods.find(
    (candidate) => candidate.id === plan.payment_method_id,
  );
  if (!method) {
    throw new OrderServiceError("PAYMENT_PLAN_NOT_AVAILABLE");
  }

  return { plan, method };
}

function buildPublishedOrderPayments(
  orderId: string,
  totalAmount: number,
  createdAt: Date,
  installments: Awaited<ReturnType<typeof resolvePublishedPaymentPlan>>["plan"]["installments"],
): OrderPaymentDraft[] {
  const sortedInstallments = installments
    .slice()
    .sort((a, b) => a.installment_number - b.installment_number);
  const payments: OrderPaymentDraft[] = [];
  let allocated = 0;

  sortedInstallments.forEach((installment, index) => {
    const isLast = index === sortedInstallments.length - 1;
    const calculated = roundCurrency(
      totalAmount * (Number(installment.percentage) / 100),
    );
    const value = isLast ? roundCurrency(totalAmount - allocated) : calculated;
    allocated = roundCurrency(allocated + value);

    payments.push({
      order_id: orderId,
      installment_number: installment.installment_number,
      due_date: format(addDays(createdAt, installment.days_after_order), "yyyy-MM-dd"),
      value,
      status: "pending",
    });
  });

  if (payments.length === 0 || roundCurrency(allocated) !== roundCurrency(totalAmount)) {
    throw new OrderServiceError("PAYMENT_TOTAL_MISMATCH");
  }

  return payments;
}

async function requireAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new OrderServiceError("NOT_AUTHENTICATED");
  return user;
}

async function hasRole(
  userId: string,
  role: "admin" | "gestor_comercial" | "supervisor" | "representante",
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: role,
  });

  if (error) throw error;
  return data === true;
}

async function validateLegacyAccess(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  const profileStatus = String(profile?.status ?? "").toLowerCase();
  if (!profile || !["active", "ativo"].includes(profileStatus)) {
    throw new OrderServiceError("USER_PROFILE_NOT_ACTIVE");
  }

  const roleResults = await Promise.all([
    hasRole(userId, "admin"),
    hasRole(userId, "gestor_comercial"),
    hasRole(userId, "supervisor"),
    hasRole(userId, "representante"),
  ]);

  return {
    isAdmin: roleResults[0],
    isManager: roleResults[1],
    isSupervisor: roleResults[2],
    isRepresentative: roleResults[3],
  };
}

async function validateLegacyReferences(
  values: OrderFormValues,
  userId: string,
  clientId: string,
) {
  const access = await validateLegacyAccess(userId);

  if (!isUuid(clientId)) {
    throw new OrderServiceError("CLIENT_ID_INVALID");
  }
  if (!isUuid(values.representative_id)) {
    throw new OrderServiceError("REPRESENTATIVE_ID_INVALID");
  }
  if (
    !access.isAdmin &&
    !access.isManager &&
    !access.isSupervisor &&
    !access.isRepresentative
  ) {
    throw new OrderServiceError("ROLE_NOT_AUTHORIZED");
  }

  const { data: representative, error: representativeError } = await supabase
    .from("representatives")
    .select("id, user_id, status")
    .eq("id", values.representative_id)
    .maybeSingle();

  if (representativeError) throw representativeError;
  if (!representative) throw new OrderServiceError("REPRESENTATIVE_NOT_FOUND");
  if (String(representative.status ?? "active").toLowerCase() !== "active") {
    throw new OrderServiceError("REPRESENTATIVE_NOT_ACTIVE");
  }
  if (access.isRepresentative && representative.user_id !== userId) {
    throw new OrderServiceError("REPRESENTATIVE_NOT_ALLOWED");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, status, representative_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!client) throw new OrderServiceError("CLIENT_NOT_FOUND");

  const clientStatus = String(client.status ?? "active").toLowerCase();
  if (["inactive", "blocked"].includes(clientStatus)) {
    throw new OrderServiceError("CLIENT_NOT_ACTIVE");
  }
  if (
    access.isRepresentative &&
    client.representative_id &&
    client.representative_id !== values.representative_id
  ) {
    throw new OrderServiceError("REPRESENTATIVE_NOT_ALLOWED");
  }

  if (values.opportunity_id?.trim()) {
    if (!isUuid(values.opportunity_id)) {
      throw new OrderServiceError("OPPORTUNITY_ID_INVALID");
    }

    const { data: opportunity, error: opportunityError } = await supabase
      .from("opportunities")
      .select("id, client_id, representative_id")
      .eq("id", values.opportunity_id)
      .maybeSingle();

    if (opportunityError) throw opportunityError;
    if (!opportunity) throw new OrderServiceError("OPPORTUNITY_NOT_FOUND");
    if (opportunity.client_id && opportunity.client_id !== clientId) {
      throw new OrderServiceError("OPPORTUNITY_CLIENT_MISMATCH");
    }
    if (
      opportunity.representative_id &&
      opportunity.representative_id !== values.representative_id
    ) {
      throw new OrderServiceError("OPPORTUNITY_REPRESENTATIVE_MISMATCH");
    }
  }

  return { access, client: client as LegacyClient, representative: representative as LegacyRepresentative };
}

async function resolveLegacyItems(values: OrderFormValues): Promise<{
  items: PricedOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
}> {
  if (values.items.length === 0) {
    throw new OrderServiceError("ITEMS_REQUIRED");
  }

  const productIds = values.items.map((item) => item.product_id);
  if (productIds.some((productId) => !isUuid(productId))) {
    throw new OrderServiceError("PRODUCT_ID_INVALID");
  }
  if (new Set(productIds).size !== productIds.length) {
    throw new OrderServiceError("DUPLICATE_PRODUCT");
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("id, status, price, min_price")
    .in("id", productIds);

  if (error) throw error;

  const productMap = new Map(
    ((products ?? []) as LegacyProduct[]).map((product) => [product.id, product]),
  );
  if (productMap.size !== productIds.length) {
    throw new OrderServiceError("PRODUCT_NOT_FOUND");
  }

  let subtotal = 0;
  let discount = 0;
  const items: PricedOrderItem[] = [];

  for (const item of values.items) {
    const product = productMap.get(item.product_id);
    if (!product) throw new OrderServiceError("PRODUCT_NOT_FOUND");
    if (String(product.status ?? "active").toLowerCase() !== "active") {
      throw new OrderServiceError("PRODUCT_NOT_ACTIVE");
    }

    const quantity = Number(item.quantity);
    const requestedDiscount = Number(item.requested_discount_percent);
    const basePrice = Number(product.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new OrderServiceError("QUANTITY_INVALID");
    }
    if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0 || requestedDiscount > 100) {
      throw new OrderServiceError("DISCOUNT_INVALID");
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      throw new OrderServiceError("PRODUCT_HAS_NO_VALID_PRICE");
    }

    const unitPrice = roundCurrency(basePrice * (1 - requestedDiscount / 100));
    const minimumPrice = Number(product.min_price);
    if (Number.isFinite(minimumPrice) && minimumPrice > 0 && unitPrice < minimumPrice) {
      throw new OrderServiceError("PRICE_BELOW_MINIMUM");
    }

    const lineGross = roundCurrency(quantity * basePrice);
    const lineSubtotal = roundCurrency(quantity * unitPrice);
    const lineDiscount = roundCurrency(lineGross - lineSubtotal);

    subtotal = roundCurrency(subtotal + lineGross);
    discount = roundCurrency(discount + lineDiscount);
    items.push({
      product_id: item.product_id,
      quantity,
      unit_price: unitPrice,
      discount_amount: lineDiscount,
      subtotal: lineSubtotal,
    });
  }

  const total = roundCurrency(subtotal - discount);
  if (total < 0) throw new OrderServiceError("ORDER_TOTAL_INVALID");

  return { items, subtotal, discount, total };
}

function getFriendlyInsertError(code: string, error: unknown): OrderServiceError {
  return new OrderServiceError(code, code, error);
}

async function cleanupLegacyOrder(orderId: string): Promise<void> {
  const failures: unknown[] = [];

  const paymentCleanup = await supabase.from("order_payments").delete().eq("order_id", orderId);
  if (paymentCleanup.error) failures.push(paymentCleanup.error);

  const historyCleanup = await supabase.from("order_history").delete().eq("order_id", orderId);
  if (historyCleanup.error) failures.push(historyCleanup.error);

  const itemCleanup = await supabase.from("order_items").delete().eq("order_id", orderId);
  if (itemCleanup.error) failures.push(itemCleanup.error);

  const orderCleanup = await supabase.from("orders").delete().eq("id", orderId);
  if (orderCleanup.error) failures.push(orderCleanup.error);

  if (failures.length > 0) {
    console.error("[createOrderWithLegacySchema] cleanup failed", { orderId, failures });
  }
}

/**
 * Caminho futuro: usa a RPC transacional quando ela estiver publicada.
 * A chamada é mantida separada para que erros de negócio nunca caiam no legado.
 */
export const createOrderWithRpc = async (
  values: OrderFormValues,
  resolvedClientId?: string,
): Promise<CreatedOrder> => {
  const clientId =
    resolvedClientId ?? (await ensureClientInDatabase(values.client_id, values.representative_id));
  const payload: CreateOrderPayload = {
    idempotency_key: values.idempotency_key || createOrderIdempotencyKey(),
    client_id: clientId,
    representative_id: values.representative_id,
    opportunity_id: values.opportunity_id || undefined,
    payment_plan_id: values.payment_plan_id,
    price_table_id: values.price_table_id || undefined,
    expected_delivery_date: values.expected_delivery_date || undefined,
    commercial_notes: values.commercial_notes?.trim() || undefined,
    internal_notes: values.internal_notes?.trim() || undefined,
    billing_notes: values.billing_notes?.trim() || undefined,
    items: values.items.map((item) => ({
      product_id: item.product_id,
      price_table_item_id: item.price_table_item_id,
      quantity: item.quantity,
      requested_discount_percent: item.requested_discount_percent,
    })),
  };

  if (!values.payment_plan_id) {
    throw new OrderServiceError("PAYMENT_PLAN_REQUIRED");
  }

  const rpcClient = supabase as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc("create_order", {
    p_payload: payload as unknown as Json,
  });

  if (error) throw error;
  if (!isCreatedOrder(data)) {
    throw new OrderServiceError("ORDER_NOT_CONFIRMED");
  }

  return data;
};

/**
 * Compatibilidade temporária com o schema legado remoto.
 * Estas chamadas são sequenciais, não constituem uma transação PostgreSQL.
 * Em falhas posteriores, uma limpeza compensatória é tentada antes de relançar
 * o erro original. A atomicidade real depende da futura publicação da RPC.
 */
export const createOrderWithLegacySchema = async (
  values: OrderFormValues,
  resolvedClientId?: string,
  authenticatedUserId?: string,
): Promise<CreatedOrder> => {
  const user = authenticatedUserId
    ? { id: authenticatedUserId }
    : await requireAuthenticatedUser();
  const clientId =
    resolvedClientId ?? (await ensureClientInDatabase(values.client_id, values.representative_id));

  await validateLegacyReferences(values, user.id, clientId);

  const { plan: paymentPlan, method: paymentMethod } =
    await resolvePublishedPaymentPlan(values.payment_plan_id);
  const expectedDeliveryDate = getOptionalDate(values.expected_delivery_date);
  const pricing = await resolveLegacyItems(values);
  const createdAt = new Date();
  const idempotencyKey = values.idempotency_key?.trim() || createOrderIdempotencyKey();

  let orderId: string | null = null;

  try {
    const orderInsert: LegacyOrderInsert = {
      client_id: clientId,
      representative_id: values.representative_id,
      opportunity_id: values.opportunity_id?.trim() || null,
      status: "draft",
      subtotal_amount: pricing.subtotal,
      discount_amount: pricing.discount,
      total_amount: pricing.total,
      payment_method: paymentMethod.name,
      payment_condition: paymentPlan.name,
      payment_term: null,
      expected_delivery_date: expectedDeliveryDate ?? null,
      commercial_notes: values.commercial_notes?.trim() || null,
      internal_notes: values.internal_notes?.trim() || null,
      billing_notes: values.billing_notes?.trim() || null,
      origin: "Web",
      created_by: user.id,
      updated_by: user.id,
      created_at: createdAt.toISOString(),
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderInsert)
      .select("id, order_number, status, subtotal_amount, discount_amount, total_amount")
      .single();

    if (orderError) throw getFriendlyInsertError("ORDER_INSERT_FAILED", orderError);
    if (!order?.id || !order.order_number) {
      throw new OrderServiceError("ORDER_NOT_CONFIRMED");
    }
    orderId = order.id;

    const itemRows: LegacyOrderItemInsert[] = pricing.items.map((item) => ({
      order_id: orderId as string,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount,
      subtotal: item.subtotal,
    }));
    const { data: insertedItems, error: itemsError } = await supabase
      .from("order_items")
      .insert(itemRows)
      .select("id");

    if (itemsError) throw getFriendlyInsertError("ORDER_ITEMS_INSERT_FAILED", itemsError);
    if (!insertedItems || insertedItems.length !== itemRows.length) {
      throw new OrderServiceError("ORDER_ITEMS_NOT_CONFIRMED");
    }

    const paymentRows = buildPublishedOrderPayments(
      orderId,
      pricing.total,
      createdAt,
      paymentPlan.installments,
    );
    const { data: insertedPayments, error: paymentsError } = await supabase
      .from("order_payments")
      .insert(paymentRows)
      .select("id");

    if (paymentsError) throw getFriendlyInsertError("ORDER_PAYMENTS_INSERT_FAILED", paymentsError);
    if (!insertedPayments || insertedPayments.length !== paymentRows.length) {
      throw new OrderServiceError("ORDER_PAYMENTS_NOT_CONFIRMED");
    }

    const history: LegacyOrderHistoryInsert = {
      order_id: orderId,
      user_id: user.id,
      action: "created",
      previous_status: null,
      new_status: "draft",
      details: {
        compatibility_mode: "legacy_schema",
        idempotency_key: idempotencyKey,
        payment_method: paymentMethod.name,
        payment_condition: paymentPlan.name,
        payment_plan_id: paymentPlan.id,
      },
    };
    const { data: insertedHistory, error: historyError } = await supabase
      .from("order_history")
      .insert(history)
      .select("id")
      .single();

    if (historyError) throw getFriendlyInsertError("ORDER_HISTORY_INSERT_FAILED", historyError);
    if (!insertedHistory?.id) throw new OrderServiceError("ORDER_HISTORY_NOT_CONFIRMED");

    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      subtotal_amount: Number(order.subtotal_amount),
      discount_amount: Number(order.discount_amount),
      total_amount: Number(order.total_amount),
      items: insertedItems as unknown as Json,
      payments: insertedPayments as unknown as Json,
    };
  } catch (error) {
    if (orderId) {
      await cleanupLegacyOrder(orderId);
    }
    throw error;
  }
};

/**
 * Prefere a RPC transacional. O fallback só ocorre quando o PostgREST confirma
 * que a função ainda não existe; erros de negócio, autorização e rede sobem.
 */
export const createOrder = async (values: OrderFormValues): Promise<CreatedOrder> => {
  await requireAuthenticatedUser();
  const clientId = await ensureClientInDatabase(values.client_id, values.representative_id);
  return createOrderWithRpc(values, clientId);
};

/**
 * Converte erros técnicos da API/RPC em mensagens que orientam o usuário.
 * O erro original continua disponível no console para diagnóstico.
 */
export function getOrderErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  const text = getErrorText(error);
  const normalized = text.toLowerCase();

  if (isMissingCreateOrderRpcError(error)) {
    return "A finalização segura de pedidos ainda não está publicada neste ambiente. Nenhum pedido foi criado.";
  }

  if (code === "42703" && normalized.includes("goals.period")) {
    return "O pedido não foi criado porque o banco precisa de uma correção interna no cálculo de metas. Tente novamente após a atualização do banco.";
  }

  const messages: Record<string, string> = {
    NOT_AUTHENTICATED: "Sua sessão expirou. Entre novamente para finalizar o pedido.",
    USER_PROFILE_NOT_ACTIVE: "Seu usuário não está ativo para criar pedidos.",
    ROLE_NOT_AUTHORIZED: "Seu perfil não tem permissão para criar pedidos.",
    REPRESENTATIVE_REQUIRED: "Informe um representante antes de finalizar o pedido.",
    REPRESENTATIVE_ID_INVALID: "O representante selecionado não possui um identificador válido.",
    REPRESENTATIVE_NOT_FOUND: "O representante selecionado não foi encontrado no banco de dados.",
    REPRESENTATIVE_NOT_ACTIVE: "O representante selecionado está inativo.",
    REPRESENTATIVE_NOT_ALLOWED:
      "O representante selecionado não tem permissão para atender este cliente.",
    CLIENT_ID_INVALID: "O cliente selecionado não possui um identificador válido.",
    CLIENT_NOT_FOUND: "O cliente selecionado não foi encontrado no banco de dados.",
    CLIENT_NOT_ACTIVE: "O cliente selecionado não está ativo para novos pedidos.",
    OPPORTUNITY_ID_INVALID: "A oportunidade selecionada possui um identificador inválido.",
    OPPORTUNITY_NOT_FOUND: "A oportunidade selecionada não foi encontrada.",
    OPPORTUNITY_CLIENT_MISMATCH: "A oportunidade não pertence ao cliente selecionado.",
    OPPORTUNITY_REPRESENTATIVE_MISMATCH:
      "A oportunidade não pertence ao representante selecionado.",
    ITEMS_REQUIRED: "Adicione pelo menos um produto antes de finalizar o pedido.",
    PRICE_SELECTION_REQUIRED: "Selecione uma tabela de preço para cada produto antes de finalizar o pedido.",
    INVALID_PRICE_SELECTION: "A seleção de preço é inválida. Escolha novamente uma tabela disponível.",
    PRICE_TABLE_ITEM_NOT_AVAILABLE: "A tabela escolhida não está mais disponível para este produto. Atualize a seleção e tente novamente.",
    PRICE_TABLE_ITEM_INVALID_LIMITS: "A tabela escolhida possui limites comerciais inválidos.",
    INVALID_ITEM_VALUES: "Revise a quantidade e o desconto informados para cada produto.",
    PRODUCT_REQUIRED: "Selecione um produto válido para cada item.",
    PRODUCT_NOT_FOUND_OR_INACTIVE: "Um dos produtos selecionados não está disponível para venda.",
    PRODUCT_ID_INVALID: "Um dos produtos selecionados possui um identificador inválido.",
    DUPLICATE_PRODUCT: "Remova produtos repetidos antes de finalizar o pedido.",
    PRODUCT_NOT_FOUND: "Um dos produtos selecionados não foi encontrado no banco de dados.",
    PRODUCT_NOT_ACTIVE: "Um dos produtos selecionados não está ativo para venda.",
    PRODUCT_HAS_NO_VALID_PRICE: "Um dos produtos não possui preço válido para venda.",
    QUANTITY_INVALID: "Informe uma quantidade válida para todos os produtos.",
    DISCOUNT_INVALID: "Informe descontos entre 0% e 100%.",
    DISCOUNT_EXCEEDS_LIMIT:
      "O desconto solicitado excede o limite comercial permitido para um dos itens.",
    PRICE_BELOW_MINIMUM: "O preço calculado ficou abaixo do mínimo comercial permitido.",
    ORDER_TOTAL_INVALID: "O total calculado para o pedido é inválido.",
    PAYMENT_METHOD_REQUIRED: "Informe o método de pagamento antes de finalizar o pedido.",
    PAYMENT_CONDITION_REQUIRED: "Informe a condição de pagamento antes de finalizar o pedido.",
    PAYMENT_TERM_UNINTERPRETABLE:
      "Informe uma condição com prazo interpretável, como à vista ou 30/60/90. Não use apenas 3x.",
    PAYMENT_TOTAL_MISMATCH: "Não foi possível distribuir o total entre as parcelas.",
    EXPECTED_DELIVERY_DATE_INVALID: "Informe uma data de entrega válida.",
    ORDER_INSERT_FAILED: "Não foi possível salvar o cabeçalho do pedido.",
    ORDER_ITEMS_INSERT_FAILED: "Não foi possível salvar os itens do pedido.",
    ORDER_ITEMS_NOT_CONFIRMED: "O banco não confirmou todos os itens do pedido.",
    ORDER_PAYMENTS_INSERT_FAILED: "Não foi possível salvar as parcelas do pedido.",
    ORDER_PAYMENTS_NOT_CONFIRMED: "O banco não confirmou todas as parcelas do pedido.",
    ORDER_HISTORY_INSERT_FAILED: "Não foi possível registrar o histórico do pedido.",
    ORDER_HISTORY_NOT_CONFIRMED: "O banco não confirmou o histórico do pedido.",
    ORDER_NOT_CONFIRMED: "O banco não confirmou a criação do pedido.",
    PAYMENT_PLAN_NOT_AVAILABLE:
      "A condição de pagamento selecionada não está disponível. Escolha uma condição publicada e tente novamente.",
    PAYMENT_PLAN_REQUIRED: "Selecione uma condição de pagamento publicada.",
    IDEMPOTENCY_KEY_REUSED:
      "Esta tentativa já foi usada com outros dados. Atualize a tentativa e envie novamente.",
    ORDER_NOT_FOUND: "O pedido não foi encontrado.",
    ORDER_NOT_IN_SCOPE: "Você não tem permissão para alterar este pedido.",
    CANCELLATION_REASON_REQUIRED: "Informe o motivo do cancelamento.",
    INVALID_ORDER_TRANSITION: "O pedido foi atualizado e esta ação não é mais permitida. Recarregue a página.",
    STATUS_TRANSITION_NOT_AUTHORIZED: "Seu perfil não tem permissão para realizar esta alteração.",
    ORDER_HAS_SETTLED_PAYMENTS: "Este pedido possui pagamento baixado e não pode ser cancelado sem uma operação de estorno.",
    ORDER_STATUS_NOT_SETTLEABLE: "A baixa só pode ser feita depois que o pedido for aprovado.",
    PAYMENT_STATUS_NOT_SETTLEABLE: "Esta parcela foi cancelada e não pode receber baixa.",
    PAYMENT_UPDATE_NOT_AUTHORIZED: "Somente administradores e gestores comerciais podem registrar recebimentos.",
    ORDER_REPRESENTATIVE_REQUIRED_FOR_COMMISSION: "O pedido não possui representante para calcular a comissão.",
    ORDER_HAS_NO_COMMISSIONABLE_ITEMS: "O pedido não possui itens com fabricante para calcular a comissão.",
    PAYMENT_ALREADY_SETTLED_VALUE_MISMATCH: "Esta parcela já foi baixada com outro valor recebido.",
    PAYMENT_NOT_FOUND: "A parcela não foi encontrada.",
    INVALID_RECEIVED_VALUE: "O valor recebido deve ser maior que zero e não pode superar o valor da parcela.",
  };

  if (code && messages[code]) return messages[code];
  const businessError = Object.keys(messages).find((key) => normalized.includes(key.toLowerCase()));
  if (businessError) return messages[businessError];
  if (normalized.includes("representante inválido")) return messages.REPRESENTATIVE_ID_INVALID;
  if (normalized.includes("cliente inválido")) return messages.CLIENT_ID_INVALID;
  return "Não foi possível concluir esta ação no pedido. Verifique os dados e tente novamente.";
}

/**
 * Mantido somente para compatibilidade com pedidos legados que ainda não usam
 * payment_plan_id. Pedidos novos devem receber parcelas dentro de create_order.
 */
export const generateOrderPayments = async (
  orderId: string,
  totalAmount: number,
  condition: string,
) => {
  let installments = 1;
  const conditionLower = (condition || "1x").toLowerCase();

  if (conditionLower.includes("x")) {
    const parts = conditionLower.split("x");
    installments = parseInt(parts[0], 10) || 1;
  } else if (conditionLower.includes("/")) {
    installments = conditionLower.split("/").length;
  }

  const valuePerInstallment = Math.round((totalAmount / installments) * 100) / 100;
  const payments = [];

  for (let i = 1; i <= installments; i++) {
    const dueDate = new Date();
    let days = i * 30;
    if (conditionLower.includes("/")) {
      const dayParts = conditionLower.split("/");
      if (dayParts[i - 1]) {
        const parsedDays = parseInt(dayParts[i - 1].replace(/\D/g, ""), 10);
        if (!Number.isNaN(parsedDays)) days = parsedDays;
      }
    }

    dueDate.setDate(dueDate.getDate() + days);
    payments.push({
      order_id: orderId,
      installment_number: i,
      value: valuePerInstallment,
      due_date: dueDate.toISOString(),
      status: "pending",
    });
  }

  if (payments.length > 0) {
    const totalCalculated = payments.reduce((acc, payment) => acc + payment.value, 0);
    const diff = totalAmount - totalCalculated;
    if (Math.abs(diff) > 0.001) {
      payments[payments.length - 1].value =
        Math.round((payments[payments.length - 1].value + diff) * 100) / 100;
    }
  }

  const { error } = await supabase.from("order_payments").insert(payments);
  if (error) throw error;
  return payments;
};

export const generateOrderWhatsAppText = (order: any) => {
  if (!order) return "";

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    sent: "Enviado",
    analysis: "Em Análise",
    approved: "Aprovado",
    invoiced: "Faturado",
    delivered: "Entregue",
    cancelled: "Cancelado",
  };

  const header = `*ESPELHO DO PEDIDO - ${order.order_number}*\n`;
  const status = `*Status:* ${statusLabels[order.status] || order.status}\n`;
  const date = `*Data:* ${format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}\n\n`;

  const clientInfo = `*CLIENTE*\n${order.client?.name || "Não informado"}\n`;
  const representativeName =
    order.representative?.name ||
    (order.representative_snapshot as { name?: string } | null)?.name ||
    "Não informado";
  const repInfo = `*REPRESENTANTE:* ${representativeName}\n\n`;

  let itemsInfo = "*ITENS DO PEDIDO*\n";
  order.items?.forEach((item: any) => {
    itemsInfo += `- ${item.product?.name || item.product_name_snapshot || "Produto"} (${item.product?.code || item.product_code_snapshot || "-"})\n`;
    itemsInfo += `  ${item.quantity} ${item.product?.unit || item.unit_snapshot || "UN"} x R$ ${Number(item.resolved_unit_price ?? item.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
    if (Number(item.discount_amount) > 0) {
      itemsInfo += `  Desc: R$ ${Number(item.discount_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
    }
    itemsInfo += `  Subtotal: *R$ ${Number(item.subtotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\n`;
  });

  const totals = "*TOTAIS*\n";
  const subtotal = `Subtotal: R$ ${Number(order.subtotal_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
  const discount = `Desconto: R$ ${Number(order.discount_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
  const total = `*TOTAL GERAL: R$ ${Number(order.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\n`;

  const commercial = "*CONDIÇÕES*\n";
  const payment = `Pagamento: ${order.payment_method || "-"} / ${order.payment_condition || "-"}\n`;
  const delivery = `Previsão: ${order.expected_delivery_date ? format(new Date(order.expected_delivery_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}\n\n`;

  const footer = "_Gerado por Safyra Safety_";

  return encodeURIComponent(
    header + status + date + clientInfo + repInfo + itemsInfo + totals + subtotal + discount + total + commercial + payment + delivery + footer,
  );
};

export const getOrderWhatsAppUrl = (order: any): string | null => {
  const rawPhone = order?.client?.whatsapp || order?.client?.phone || "";
  const digits = String(rawPhone).replace(/\D/g, "");
  if (!digits) return null;

  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${phone}?text=${generateOrderWhatsAppText(order)}`;
};
