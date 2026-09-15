import { supabase } from "@/integrations/supabase/client";
import {
  isVisiblePaymentPlanCode,
  type PaymentMethodOption,
  type PaymentPlanInstallmentOption,
  type PaymentPlanOption,
} from "@/lib/orders.schema";

export type PublishedPaymentCatalog = {
  methods: PaymentMethodOption[];
  plans: PaymentPlanOption[];
};

function isValidAt(value: string | null, now: number, isStart: boolean): boolean {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return isStart ? timestamp <= now : timestamp >= now;
}

function isPublished(row: {
  status: string;
  valid_from: string | null;
  valid_until: string | null;
}, now: number): boolean {
  return (
    row.status === "active" &&
    isValidAt(row.valid_from, now, true) &&
    isValidAt(row.valid_until, now, false)
  );
}

export async function loadPublishedPaymentCatalog(): Promise<PublishedPaymentCatalog> {
  const [methodsResult, plansResult, installmentsResult] = await Promise.all([
    supabase
      .from("payment_methods")
      .select("id, code, name, status, valid_from, valid_until")
      .eq("status", "active"),
    supabase
      .from("payment_plans")
      .select("id, code, name, payment_method_id, status, version, valid_from, valid_until")
      .eq("status", "active"),
    supabase
      .from("payment_plan_installments")
      .select("id, payment_plan_id, installment_number, days_after_order, percentage")
      .order("installment_number", { ascending: true }),
  ]);

  if (methodsResult.error) throw methodsResult.error;
  if (plansResult.error) throw plansResult.error;
  if (installmentsResult.error) throw installmentsResult.error;

  const now = Date.now();
  const methods = (methodsResult.data ?? []) as PaymentMethodOption[];
  const methodMap = new Map(methods.map((method) => [method.id, method]));
  const installmentsByPlan = new Map<string, PaymentPlanInstallmentOption[]>();

  for (const installment of (installmentsResult.data ?? []) as PaymentPlanInstallmentOption[]) {
    const current = installmentsByPlan.get(installment.payment_plan_id) ?? [];
    current.push(installment);
    installmentsByPlan.set(installment.payment_plan_id, current);
  }

  const plans = ((plansResult.data ?? []) as PaymentPlanOption[])
    .filter((plan) => isVisiblePaymentPlanCode(plan.code))
    .filter((plan) => isPublished(plan, now))
    .map((plan) => ({
      ...plan,
      installments: installmentsByPlan.get(plan.id) ?? [],
    }))
    .filter((plan) => {
      const method = plan.payment_method_id ? methodMap.get(plan.payment_method_id) : undefined;
      const totalPercentage = plan.installments.reduce(
        (total, installment) => total + Number(installment.percentage),
        0,
      );
      return (
        method !== undefined &&
        isPublished(method, now) &&
        plan.installments.length > 0 &&
        Math.abs(totalPercentage - 100) <= 0.01
      );
    });

  const usedMethodIds = new Set(
    plans.map((plan) => plan.payment_method_id).filter((id): id is string => Boolean(id)),
  );

  return {
    methods: methods.filter((method) => usedMethodIds.has(method.id)),
    plans,
  };
}

export function getPaymentMethodForPlan(
  plan: PaymentPlanOption | undefined,
  methods: PaymentMethodOption[],
): PaymentMethodOption | undefined {
  if (!plan?.payment_method_id) return undefined;
  return methods.find((method) => method.id === plan.payment_method_id);
}

export function isLibusManufacturer(name: string | null | undefined): boolean {
  return /libus/i.test(name ?? "");
}

export function formatPaymentPlanSchedule(plan: PaymentPlanOption): string {
  if (plan.code === "avista") return "No ato";
  return plan.installments
    .slice()
    .sort((a, b) => a.installment_number - b.installment_number)
    .map((installment) => `${installment.days_after_order} dias`)
    .join(" / ");
}
