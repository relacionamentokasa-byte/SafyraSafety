import { useQuery } from "@tanstack/react-query";
import { Controller, useFormContext } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, TriangleAlert } from "lucide-react";
import type { OrderFormValues } from "@/lib/orders.schema";
import {
  formatPaymentPlanSchedule,
  getPaymentMethodForPlan,
  loadPublishedPaymentCatalog,
} from "@/lib/payment-plans";

function getErrorMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

export function ReviewStep() {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>();
  const paymentMethodId = watch("payment_method_id");
  const paymentPlanId = watch("payment_plan_id");
  const paymentMethodError = getErrorMessage(errors.payment_method_id);
  const paymentPlanError = getErrorMessage(errors.payment_plan_id);

  const {
    data: paymentCatalog,
    isLoading,
    error: paymentCatalogError,
  } = useQuery({
    queryKey: ["payment-catalog"],
    queryFn: loadPublishedPaymentCatalog,
  });

  const methods = paymentCatalog?.methods ?? [];
  const plans = paymentCatalog?.plans ?? [];
  const selectedPlan = plans.find((plan) => plan.id === paymentPlanId);
  const selectedMethod = getPaymentMethodForPlan(selectedPlan, methods);
  const availablePlans = plans.filter(
    (plan) => plan.payment_method_id === paymentMethodId,
  );

  const handleMethodChange = (value: string) => {
    setValue("payment_method_id", value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    if (selectedPlan?.payment_method_id !== value) {
      setValue("payment_plan_id", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  };

  const handlePlanChange = (value: string) => {
    const plan = plans.find((item) => item.id === value);
    if (!plan) return;

    setValue("payment_plan_id", value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    if (plan.payment_method_id && plan.payment_method_id !== paymentMethodId) {
      setValue("payment_method_id", plan.payment_method_id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  };

  return (
    <div className="space-y-8">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Condições comerciais publicadas</AlertTitle>
        <AlertDescription>
          Escolha uma condição cadastrada para que o banco gere automaticamente as parcelas,
          os vencimentos e os valores de cada parcela. A condição sugerida para produtos Libus
          continua editável.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="payment-method">Método de pagamento *</Label>
            <Controller
              control={control}
              name="payment_method_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={handleMethodChange}>
                  <SelectTrigger
                    id="payment-method"
                    data-order-payment-method
                    aria-invalid={Boolean(paymentMethodError)}
                    aria-describedby={paymentMethodError ? "payment-method-error" : undefined}
                  >
                    <SelectValue placeholder={isLoading ? "Carregando métodos..." : "Selecione o método"} />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {paymentMethodError && (
              <p id="payment-method-error" className="text-sm text-destructive">
                {paymentMethodError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              O método é vinculado à condição publicada escolhida.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-condition">Condição de pagamento *</Label>
            <Controller
              control={control}
              name="payment_plan_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={handlePlanChange}
                  disabled={!paymentMethodId || isLoading || availablePlans.length === 0}
                >
                  <SelectTrigger
                    id="payment-condition"
                    data-order-payment-condition
                    aria-invalid={Boolean(paymentPlanError)}
                    aria-describedby={paymentPlanError ? "payment-condition-error" : undefined}
                  >
                    <SelectValue
                      placeholder={
                        !paymentMethodId
                          ? "Selecione primeiro o método"
                          : isLoading
                            ? "Carregando condições..."
                            : "Selecione a condição"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {paymentPlanError && (
              <p id="payment-condition-error" className="text-sm text-destructive">
                {paymentPlanError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              A seleção representa os vencimentos reais, como 28/35/42 ou 30/60/90.
            </p>
          </div>

          {paymentCatalogError && (
            <p className="text-sm text-destructive">
              Não foi possível carregar as condições publicadas. Atualize a página e tente novamente.
            </p>
          )}

          {!isLoading && !paymentCatalogError && methods.length === 0 && (
            <p className="text-sm text-destructive">
              Nenhum método com condição publicada está disponível para novos pedidos.
            </p>
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="purchase-order-number" className="flex items-center gap-1.5 font-semibold text-slate-800">
              <span>Nº da Ordem de Compra (OC / Indústria)</span>
              <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>
            </Label>
            <input
              id="purchase-order-number"
              type="text"
              placeholder="Ex: 32653, OC-9842..."
              className="flex h-9.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring font-mono"
              {...register("purchase_order_number")}
            />
            <p className="text-[11px] text-muted-foreground">
              Número da Ordem de Compra fornecido pelo cliente ou pela indústria para faturamento.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected-delivery-date">Data de entrega estimada</Label>
            <input
              id="expected-delivery-date"
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              {...register("expected_delivery_date")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commercial-notes">Observações comerciais (saem no pedido)</Label>
            <Textarea
              id="commercial-notes"
              placeholder="Ex.: Entrega após as 14h, falar com João..."
              className="h-20"
              {...register("commercial_notes")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal-notes">Notas internas (uso administrativo)</Label>
            <Textarea
              id="internal-notes"
              placeholder="Observações que não aparecem para o cliente..."
              className="h-20"
              {...register("internal_notes")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing-notes">Notas de faturamento</Label>
            <Textarea
              id="billing-notes"
              placeholder="Informações para faturamento e emissão..."
              className="h-20"
              {...register("billing_notes")}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p>
              O preço, o desconto, os totais e a disponibilidade da condição serão confirmados
              pelo banco no momento da finalização.
            </p>
            <p>
              As parcelas serão criadas automaticamente a partir dos percentuais e vencimentos
              publicados para a condição selecionada.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed p-4">
        <div className="mb-2 flex items-center gap-2">
          <h4 className="text-sm font-bold text-primary">Resumo da condição selecionada</h4>
          {(selectedMethod || selectedPlan) && (
            <span className="text-xs text-muted-foreground">(prévia)</span>
          )}
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Método</dt>
            <dd className="font-medium">{selectedMethod?.name || "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Condição</dt>
            <dd className="font-medium">{selectedPlan?.name || "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Vencimentos</dt>
            <dd className="font-medium">
              {selectedPlan ? formatPaymentPlanSchedule(selectedPlan) : "Não informado"}
            </dd>
          </div>
        </dl>
      </div>

      {(paymentMethodError || paymentPlanError) && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Preencha as condições obrigatórias</AlertTitle>
          <AlertDescription>
            Selecione o método e a condição de pagamento antes de finalizar o pedido.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-bold text-primary">Resumo final</h4>
        <p className="text-sm text-muted-foreground">
          Ao confirmar, o pedido será salvo como <span className="font-bold">rascunho</span> somente
          depois que o banco validar cliente, representante, produtos, preços, descontos e a
          condição publicada selecionada.
        </p>
      </div>
    </div>
  );
}
