import { z } from "zod";

export const orderItemSchema = z.object({
  product_id: z.string().min(1, "Selecione um produto"),
  manufacturer_id: z.string().uuid().nullable().optional(),
  price_table_item_id: z.string().uuid("Selecione uma tabela de preço").nullable(),
  quantity: z.number().finite().min(0.0001, "Quantidade inválida"),
  requested_discount_percent: z
    .number()
    .finite()
    .min(0, "Desconto inválido")
    .max(100, "Desconto inválido"),
}).refine((item) => Boolean(item.price_table_item_id), {
  message: "Selecione uma tabela de preço para este produto",
  path: ["price_table_item_id"],
});

export const orderFormSchema = z.object({
  client_id: z.string().min(1, "Selecione um cliente"),
  representative_id: z.string().min(1, "Representante obrigatório"),
  opportunity_id: z.string().optional(),

  payment_method_id: z.string().uuid("Selecione o método de pagamento"),
  payment_plan_id: z.string().uuid("Selecione uma condição de pagamento"),

  price_table_id: z.string().optional(),
  idempotency_key: z.string().min(8).optional(),
  expected_delivery_date: z.string().optional(),
  commercial_notes: z.string().optional(),
  internal_notes: z.string().optional(),
  billing_notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "Adicione pelo menos um item"),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export interface PaymentMethodOption {
  id: string;
  code: string;
  name: string;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
}

export interface PaymentPlanInstallmentOption {
  id: string;
  payment_plan_id: string;
  installment_number: number;
  days_after_order: number;
  percentage: number;
}

export interface PaymentPlanOption {
  id: string;
  code: string;
  name: string;
  payment_method_id: string | null;
  status: string;
  version: number;
  valid_from: string | null;
  valid_until: string | null;
  installments: PaymentPlanInstallmentOption[];
}

export const VISIBLE_PAYMENT_PLAN_CODES = [
  "avista",
  "28/35/42",
  "30/45/60",
  "30/60/90",
  "28/35",
  "28/42/56",
] as const;

export function isVisiblePaymentPlanCode(code: string): boolean {
  return (VISIBLE_PAYMENT_PLAN_CODES as readonly string[]).includes(code);
}
