import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight, Check, ShoppingCart, TriangleAlert } from "lucide-react";
import {
  FormProvider,
  useForm,
  type FieldErrors,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderFormSchema, type OrderFormValues } from "@/lib/orders.schema";
import { useEffect, useState } from "react";
import { ClientStep } from "@/components/pedidos/ClientStep";
import { ProductStep } from "@/components/pedidos/ProductStep";
import { ReviewStep } from "@/components/pedidos/ReviewStep";
import {
  createOrder,
  createOrderIdempotencyKey,
  getOrderErrorMessage,
} from "@/lib/orders.services";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OrderPDFImportModal } from "@/components/pedidos/OrderPDFImportModal";
import { UploadCloud } from "lucide-react";

export const Route = createFileRoute("/comercial/pedidos/novo")({
  head: () => ({
    meta: [{ title: "Safyra Safety | Novo Pedido" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    opportunity_id: (search.opportunity_id as string) || "",
    client_id: (search.client_id as string) || (search.clientId as string) || "",
  }),
  component: NewOrderPage,
});

const steps = [
  { id: "client", title: "Cliente", description: "Seleção do cliente" },
  { id: "products", title: "Produtos", description: "Itens do pedido" },
  { id: "review", title: "Fechamento", description: "Condições e notas" },
];

type OpportunityPrefill = {
  client_id: string | null;
  representative_id: string | null;
  items: Array<{
    product_id: string | null;
    quantity: number | null;
    discount_percent: number | null;
    product?: { manufacturer_id: string | null } | null;
  }>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "erro desconhecido";
}

function getValidationMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

type OrderValidationField =
  | "client_id"
  | "representative_id"
  | "items"
  | "payment_method_id"
  | "payment_plan_id";

function getFirstInvalidField(
  errors: FieldErrors<OrderFormValues>,
): OrderValidationField | null {
  if (errors.client_id) return "client_id";
  if (errors.representative_id) return "representative_id";
  if (errors.items) return "items";
  if (errors.payment_method_id) return "payment_method_id";
  if (errors.payment_plan_id) return "payment_plan_id";
  return null;
}

function getValidationSummary(errors: FieldErrors<OrderFormValues>): string {
  const firstField = getFirstInvalidField(errors);
  const fieldMessage = firstField ? getValidationMessage(errors[firstField]) : undefined;

  if (fieldMessage) return fieldMessage;
  if (firstField === "client_id") return "Selecione um cliente antes de finalizar o pedido.";
  if (firstField === "representative_id") {
    return "O cliente precisa ter um representante válido na carteira para finalizar o pedido.";
  }
  if (firstField === "items") return "Adicione produtos, informe quantidades válidas e selecione uma tabela de preço para cada item.";
  if (firstField === "payment_method_id") {
    return "Selecione o método de pagamento antes de finalizar o pedido.";
  }
  if (firstField === "payment_plan_id") {
    return "Selecione uma condição de pagamento antes de finalizar o pedido.";
  }
  return "Revise os dados obrigatórios antes de finalizar o pedido.";
}

function focusInvalidField(field: OrderValidationField) {
  const selectors: Record<OrderValidationField, string> = {
    client_id: "[data-order-client-search]",
    representative_id: "[data-representative-warning]",
    items: '[data-order-price-selection], [data-order-add-product], [name="items.0.quantity"]',
    payment_method_id: "#payment-method, [data-order-payment-method]",
    payment_plan_id: "#payment-condition, [data-order-payment-condition]",
  };
  const element = document.querySelector<HTMLElement>(selectors[field]);
  const target = element ?? document.querySelector<HTMLElement>("[data-order-validation-summary]");

  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof target.focus === "function") target.focus({ preventScroll: true });
  }
}

function NewOrderPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/comercial/pedidos/novo" });
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      client_id: search.client_id || "",
      representative_id: "",
      opportunity_id: search.opportunity_id || "",
      payment_method_id: "",
      payment_plan_id: "",
      price_table_id: "",
      idempotency_key: "",
      expected_delivery_date: "",
      commercial_notes: "",
      internal_notes: "",
      billing_notes: "",
      items: [],
    },
  });

  const { getValues, setValue } = methods;

  useEffect(() => {
    if (search.client_id) {
      setValue("client_id", search.client_id);
    }
  }, [search.client_id, setValue]);

  useEffect(() => {
    if (!getValues("idempotency_key")) {
      setValue("idempotency_key", createOrderIdempotencyKey());
    }
  }, [getValues, setValue]);

  useEffect(() => {
    if (!submissionMessage) return;

    const alert = document.querySelector<HTMLElement>("[data-order-submission-message]");
    alert?.scrollIntoView({ behavior: "smooth", block: "center" });
    alert?.focus({ preventScroll: true });
  }, [submissionMessage]);

  const { error: opportunityError } = useQuery<OpportunityPrefill, Error>({
    queryKey: ["opportunity-fill", search.opportunity_id],
    enabled: Boolean(search.opportunity_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "client_id, representative_id, items:opportunity_items(product_id, quantity, discount_percent, product:products(manufacturer_id))",
        )
        .eq("id", search.opportunity_id!)
        .single();

      if (error) throw error;

      const opportunity = data as unknown as OpportunityPrefill;
      setValue("client_id", opportunity.client_id || "");
      setValue("representative_id", opportunity.representative_id || "");
      setValue(
        "items",
        (opportunity.items || [])
          .filter((item) => item.product_id && Number(item.quantity) > 0)
          .map((item) => ({
            product_id: item.product_id as string,
            manufacturer_id: item.product?.manufacturer_id ?? null,
            price_table_item_id: null,
            quantity: Number(item.quantity),
            requested_discount_percent: Number(item.discount_percent || 0),
          })),
      );

      return opportunity;
    },
  });

  const onSubmit = async (data: OrderFormValues) => {
    setValidationMessage(null);
    setSubmissionMessage(null);
    setIsSubmitting(true);

    try {
      const order = await createOrder({
        ...data,
        idempotency_key: data.idempotency_key || createOrderIdempotencyKey(),
      });

      if (!order.id) {
        throw new Error("O banco não retornou o identificador do pedido");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["orders-all-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["client-orders", data.client_id] }),
      ]);

      toast.success("Pedido criado com sucesso!");
      await navigate({
        to: "/comercial/pedidos/$id",
        params: { id: order.id },
      });
    } catch (error: unknown) {
      const friendlyMessage = getOrderErrorMessage(error);
      setSubmissionMessage(friendlyMessage);
      toast.error(friendlyMessage);
      console.error("[createOrder]", error);

      // Regenerate idempotency key so the user can retry without
      // hitting IDEMPOTENCY_KEY_REUSED on the same payload.
      setValue("idempotency_key", createOrderIdempotencyKey());
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errors: FieldErrors<OrderFormValues>) => {
    setSubmissionMessage(null);

    const firstField = getFirstInvalidField(errors);
    const summary = getValidationSummary(errors);

    setValidationMessage(summary);

    // Navigate to the step that contains the first invalid field
    if (firstField === "client_id" || firstField === "representative_id") {
      setCurrentStep(0);
    } else if (firstField === "items") {
      setCurrentStep(1);
    } else if (firstField === "payment_method_id" || firstField === "payment_plan_id") {
      setCurrentStep(2);
    }

    // Defer focus so the step re-render settles first
    if (firstField) {
      requestAnimationFrame(() => focusInvalidField(firstField));
    }
  };

  const nextStep = async () => {
    const fields: FieldPath<OrderFormValues>[] =
      currentStep === 0 ? ["client_id"] : currentStep === 1 ? ["items"] : [];
    const isValid = await methods.trigger(fields);

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/comercial/pedidos" })}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold">Novo Pedido</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPdfModalOpen(true)}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5 shadow-xs font-semibold"
            >
              <UploadCloud className="h-4 w-4" />
              Importar via PDF da Fábrica
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              <span>
                Passo {currentStep + 1} de {steps.length}
              </span>
            </div>
          </div>
        </div>

        <div className="relative flex justify-between">
          <div className="absolute left-0 top-5 -z-10 h-0.5 w-full bg-muted" />
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background transition-colors",
                  index <= currentStep
                    ? "border-primary font-bold text-primary"
                    : "border-muted text-muted-foreground",
                  index < currentStep && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {index < currentStep ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    index <= currentStep ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
              </div>
            </div>
          ))}
        </div>

        {opportunityError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Não foi possível carregar os dados da oportunidade: {getErrorMessage(opportunityError)}
          </p>
        )}

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
            {validationMessage && (
              <Alert
                variant="destructive"
                data-order-validation-summary
                tabIndex={-1}
              >
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Revise os dados do pedido</AlertTitle>
                <AlertDescription>{validationMessage}</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardContent className="p-6">
                {currentStep === 0 && <ClientStep />}
                {currentStep === 1 && <ProductStep />}
                {currentStep === 2 && <ReviewStep />}
              </CardContent>
            </Card>

            {submissionMessage && (
              <Alert
                variant="destructive"
                data-order-submission-message
                tabIndex={-1}
              >
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Pedido não foi criado</AlertTitle>
                <AlertDescription>{submissionMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0 || isSubmitting}
              >
                Anterior
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button type="button" onClick={nextStep} disabled={isSubmitting}>
                  Próximo
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Finalizar Pedido"}
                  {!isSubmitting && <Check className="ml-2 h-4 w-4" />}
                </Button>
              )}
            </div>
          </form>
        </FormProvider>

        <OrderPDFImportModal
          open={isPdfModalOpen}
          onOpenChange={setIsPdfModalOpen}
        />
      </div>
    </AppLayout>
  );
}
