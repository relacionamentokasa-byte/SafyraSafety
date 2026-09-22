import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatDisplayName } from "@/lib/format";
import { formatClientDisplayName } from "@/lib/format-name";
import { formatPaymentPlanSchedule } from "@/lib/payment-plans";
import { OrderStatus } from "@/types/database.types";

interface OrderPrintTemplateProps {
  order: any;
  companySettings?: any;
}

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  analysis: "Em Análise",
  approved: "Aprovado",
  invoiced: "Faturado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export function OrderPrintTemplate({ order, companySettings }: OrderPrintTemplateProps) {
  if (!order) return null;

  const client = order.client;
  const representative = order.representative;
  const items = order.items || [];
  const payments = (order.payments || []).sort(
    (a: any, b: any) => a.installment_number - b.installment_number
  );

  const paymentSnapshot = order.payment_plan_snapshot as {
    method_name?: string;
    name?: string;
    code?: string;
    terms?: Array<{ days_after_order?: number; percentage?: number }>;
  } | null;

  const snapshotPlan = paymentSnapshot?.terms
    ? {
        id: order.payment_plan_id,
        code: paymentSnapshot.code || "",
        name: paymentSnapshot.name || "",
        payment_method_id: null,
        status: "active",
        version: 1,
        valid_from: null,
        valid_until: null,
        installments: paymentSnapshot.terms.map((term, index) => ({
          id: `${order.id}-term-${index}`,
          payment_plan_id: order.payment_plan_id,
          installment_number: index + 1,
          days_after_order: Number(term.days_after_order || 0),
          percentage: Number(term.percentage || 0),
        })),
      }
    : undefined;

  const logoUrl = companySettings?.logo_url || "/safyra-logo.png";
  const companyName = companySettings?.trade_name || companySettings?.company_name || "SAFYRA SAFETY";
  const companyLegalName = companySettings?.legal_name || "Safyra Safety Representações Comerciais";
  const companyCnpj = companySettings?.cnpj || "";
  const companyPhone = companySettings?.phone || companySettings?.whatsapp || "";
  const companyEmail = companySettings?.email || "";
  const companyAddress = [
    companySettings?.address,
    companySettings?.address_number,
    companySettings?.neighborhood,
    companySettings?.city && companySettings?.state ? `${companySettings.city}/${companySettings.state}` : "",
  ].filter(Boolean).join(", ");

  return (
    <div className="hidden print:block w-full bg-white text-slate-900 text-[11px] leading-tight font-sans p-2 select-text">
      {/* CABEÇALHO PRINCIPAL DA EMPRESA E DO PEDIDO */}
      <header className="border-b-2 border-slate-900 pb-3 mb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={companyName}
              className="h-12 max-w-[140px] object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div>
              <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-900">{companyName}</h1>
              <p className="text-[10px] text-slate-600 font-medium">{companyLegalName}</p>
              {companyCnpj && <p className="text-[10px] text-slate-600">CNPJ: {companyCnpj}</p>}
              {companyAddress && <p className="text-[9px] text-slate-500">{companyAddress}</p>}
              {(companyPhone || companyEmail) && (
                <p className="text-[9px] text-slate-500">
                  {companyPhone && `Tel: ${companyPhone}`} {companyEmail && `• E-mail: ${companyEmail}`}
                </p>
              )}
            </div>
          </div>

          <div className="text-right border border-slate-300 bg-slate-50 rounded-lg p-2.5 min-w-[200px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pedido de Venda</span>
            <span className="font-mono text-xl font-black text-slate-900 block my-0.5">{order.order_number}</span>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                {statusLabels[order.status] || order.status}
              </span>
            </div>
            <p className="text-[9px] text-slate-500 mt-1">
              Emissão: {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      </header>

      {/* BLOCO 1: DADOS DO CLIENTE & REPRESENTANTE */}
      <section className="grid grid-cols-12 gap-2 mb-3">
        <div className="col-span-8 border border-slate-300 rounded-md p-2 bg-slate-50/50">
          <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
            <span>Dados do Cliente / Faturamento</span>
            {client?.segment && <span className="text-[9px] font-normal text-slate-500">Ramo: {client.segment}</span>}
          </h2>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
            <div className="col-span-2">
              <span className="font-bold text-slate-600">Razão Social: </span>
              <span className="font-semibold text-slate-900">{client?.legal_name || client?.name || "Não informado"}</span>
            </div>
            {client?.trade_name && client.trade_name !== client.legal_name && (
              <div className="col-span-2">
                <span className="font-bold text-slate-600">Nome Fantasia: </span>
                <span>{client.trade_name}</span>
              </div>
            )}
            <div>
              <span className="font-bold text-slate-600">CNPJ/CPF: </span>
              <span className="font-mono">{client?.cnpj || "-"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Inscrição Estadual: </span>
              <span>{client?.state_registration || "ISENTO / NÃO INFORMADO"}</span>
            </div>
            <div className="col-span-2">
              <span className="font-bold text-slate-600">Endereço: </span>
              <span>
                {[
                  client?.address,
                  client?.address_number && `Nº ${client.address_number}`,
                  client?.address_complement,
                  client?.neighborhood,
                  client?.city && client?.state ? `${client.city} - ${client.state}` : "",
                  client?.zip_code && `CEP: ${client.zip_code}`,
                ]
                  .filter(Boolean)
                  .join(", ") || "Endereço não cadastrado"}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Contato: </span>
              <span>{client?.contact_name || "-"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Telefone / WhatsApp: </span>
              <span>{client?.phone || client?.whatsapp || "-"}</span>
            </div>
          </div>
        </div>

        <div className="col-span-4 border border-slate-300 rounded-md p-2 bg-slate-50/50 flex flex-col justify-between">
          <div>
            <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1.5">
              Representação Comercial
            </h2>
            <div className="space-y-1 text-[10px]">
              <div>
                <span className="font-bold text-slate-600">Representante: </span>
                <span className="font-semibold text-slate-900">{representative?.name || "Direto / Safyra"}</span>
              </div>
              {representative?.phone && (
                <div>
                  <span className="font-bold text-slate-600">Telefone: </span>
                  <span>{representative.phone}</span>
                </div>
              )}
              {representative?.email && (
                <div>
                  <span className="font-bold text-slate-600">E-mail: </span>
                  <span className="break-all">{representative.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-1.5 mt-1">
            <span className="font-bold text-slate-600 text-[10px]">Previsão de Entrega: </span>
            <span className="font-extrabold text-slate-900 text-[11px]">
              {order.expected_delivery_date
                ? format(new Date(order.expected_delivery_date), "dd/MM/yyyy", { locale: ptBR })
                : "A combinar"}
            </span>
          </div>
        </div>
      </section>

      {/* BLOCO 2: CONDIÇÕES COMERCIAIS & PAGAMENTO */}
      <section className="border border-slate-300 rounded-md p-2 mb-3 bg-slate-50/50">
        <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1.5">
          Condições Comerciais & Pagamento
        </h2>
        <div className="grid grid-cols-4 gap-2 text-[10px]">
          <div>
            <span className="font-bold text-slate-600 block">Forma de Pagamento</span>
            <span className="font-semibold text-slate-900">
              {paymentSnapshot?.method_name || order.payment_method || "Boleto Bancário"}
            </span>
          </div>
          <div>
            <span className="font-bold text-slate-600 block">Condição Comercial</span>
            <span className="font-semibold text-slate-900">
              {paymentSnapshot?.name || paymentSnapshot?.code || order.payment_condition || "À Vista"}
            </span>
          </div>
          <div className="col-span-2">
            <span className="font-bold text-slate-600 block">Cronograma / Prazos de Vencimento</span>
            <span className="font-medium text-slate-900">
              {snapshotPlan ? formatPaymentPlanSchedule(snapshotPlan) : order.payment_term || "Conforme faturamento"}
            </span>
          </div>
        </div>

        {payments && payments.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-slate-200">
            <span className="text-[9px] font-bold text-slate-600 uppercase block mb-1">Parcelamento Previsto:</span>
            <div className="flex flex-wrap gap-2">
              {payments.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[9px] flex items-center gap-1.5 font-mono"
                >
                  <span className="font-bold text-slate-700">{p.installment_number}ª:</span>
                  <span className="text-slate-900 font-bold">{formatCurrency(Number(p.value))}</span>
                  <span className="text-slate-500">({formatDate(p.due_date)})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* BLOCO 3: ITENS DO PEDIDO (TABELA) */}
      <section className="mb-3">
        <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
          Itens e Produtos Solicitados ({items.length} {items.length === 1 ? "item" : "itens"})
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-[10px]">
          <thead>
            <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase text-[9px]">
              <th className="border-r border-slate-300 p-1.5 text-center w-8">Item</th>
              <th className="border-r border-slate-300 p-1.5 text-left w-20">Código</th>
              <th className="border-r border-slate-300 p-1.5 text-left">Descrição do Produto</th>
              <th className="border-r border-slate-300 p-1.5 text-center w-10">UN</th>
              <th className="border-r border-slate-300 p-1.5 text-center w-12">Qtd</th>
              <th className="border-r border-slate-300 p-1.5 text-right w-20">Preço Tab.</th>
              <th className="border-r border-slate-300 p-1.5 text-right w-16">Desc.</th>
              <th className="border-r border-slate-300 p-1.5 text-right w-20">Preço Líq.</th>
              <th className="p-1.5 text-right w-24">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item: any, index: number) => {
              const pricingSnapshot = item.pricing_snapshot as {
                price_table_name?: string;
                price_table_code?: string | null;
              } | null;
              const unitPrice = Number(item.unit_price || 0);
              const discount = Number(item.discount_amount || 0);
              const qty = Number(item.quantity || 0);
              const netPrice = qty > 0 ? (Number(item.subtotal || 0)) / qty : unitPrice;

              return (
                <tr key={item.id} className={index % 2 === 1 ? "bg-slate-50/60" : "bg-white"}>
                  <td className="border-r border-slate-300 p-1.5 text-center font-mono text-slate-500 font-bold">
                    {String(index + 1).padStart(2, "0")}
                  </td>
                  <td className="border-r border-slate-300 p-1.5 font-mono font-bold text-slate-700">
                    {item.product?.code || item.product?.sku || "-"}
                  </td>
                  <td className="border-r border-slate-300 p-1.5">
                    <p className="font-bold text-slate-900 leading-tight">{formatDisplayName(item.product?.name)}</p>
                    {pricingSnapshot?.price_table_name && (
                      <span className="text-[8.5px] text-slate-500 italic block">
                        Tabela: {pricingSnapshot.price_table_name}
                      </span>
                    )}
                  </td>
                  <td className="border-r border-slate-300 p-1.5 text-center uppercase font-semibold text-slate-600">
                    {item.product?.unit || "UN"}
                  </td>
                  <td className="border-r border-slate-300 p-1.5 text-center font-extrabold text-slate-900 font-mono">
                    {qty}
                  </td>
                  <td className="border-r border-slate-300 p-1.5 text-right font-mono text-slate-600">
                    {formatCurrency(unitPrice)}
                  </td>
                  <td className="border-r border-slate-300 p-1.5 text-right font-mono text-slate-600">
                    {discount > 0 ? `- ${formatCurrency(discount)}` : "-"}
                  </td>
                  <td className="border-r border-slate-300 p-1.5 text-right font-mono font-semibold text-slate-800">
                    {formatCurrency(netPrice)}
                  </td>
                  <td className="p-1.5 text-right font-mono font-black text-slate-900">
                    {formatCurrency(Number(item.subtotal || 0))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* BLOCO 4: TOTALIZADORES & OBSERVAÇÕES */}
      <section className="grid grid-cols-12 gap-2 mb-4">
        <div className="col-span-7 border border-slate-300 rounded-md p-2 bg-slate-50/40 flex flex-col justify-between">
          <div>
            <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1">
              Observações Gerais do Pedido
            </h2>
            {order.commercial_notes ? (
              <p className="text-[9.5px] text-slate-800 whitespace-pre-wrap">{order.commercial_notes}</p>
            ) : (
              <p className="text-[9px] text-slate-400 italic">Nenhuma observação comercial informada.</p>
            )}

            {order.billing_notes && (
              <div className="mt-2 pt-1 border-t border-slate-200">
                <span className="text-[9px] font-bold text-slate-700 block">Instruções de Faturamento:</span>
                <p className="text-[9px] text-slate-700 whitespace-pre-wrap">{order.billing_notes}</p>
              </div>
            )}
          </div>

          <div className="mt-2 pt-1 border-t border-slate-200 text-[8.5px] text-slate-500">
            * Pedido sujeito à confirmação cadastral, disponibilidade de estoque e faturamento da representada.
          </div>
        </div>

        <div className="col-span-5 border-2 border-slate-900 rounded-md p-2.5 bg-slate-100 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] text-slate-600">
              <span className="uppercase font-bold">Subtotal Bruto:</span>
              <span className="font-mono font-bold">{formatCurrency(Number(order.subtotal_amount || 0))}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-600">
              <span className="uppercase font-bold">Descontos Aplicados:</span>
              <span className="font-mono font-bold text-rose-700">
                - {formatCurrency(Number(order.discount_amount || 0))}
              </span>
            </div>
            <div className="border-t-2 border-slate-900 pt-1.5 flex justify-between items-center">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 block">
                  Total Líquido
                </span>
                <span className="text-[8px] text-slate-500 uppercase font-semibold">Valor final faturado</span>
              </div>
              <span className="font-mono text-lg font-black text-slate-900">
                {formatCurrency(Number(order.total_amount || 0))}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* BLOCO 5: TERMO DE ACEITE & ASSINATURAS */}
      <footer className="border-t border-slate-300 pt-3 mt-4">
        <p className="text-[8.5px] text-slate-500 text-center mb-6">
          Declaramos estar de acordo com os produtos, quantidades, valores e prazos estipulados neste Pedido de Venda.
        </p>

        <div className="grid grid-cols-2 gap-8 px-4">
          <div className="text-center">
            <div className="border-b border-slate-400 pb-1 mb-1"></div>
            <p className="font-bold text-[9.5px] text-slate-800 uppercase">
              {client?.legal_name || client?.name || "Assinatura do Cliente / Comprador"}
            </p>
            <p className="text-[8.5px] text-slate-500">Responsável / Compras</p>
          </div>

          <div className="text-center">
            <div className="border-b border-slate-400 pb-1 mb-1"></div>
            <p className="font-bold text-[9.5px] text-slate-800 uppercase">
              {representative?.name || "Safyra Safety Representações"}
            </p>
            <p className="text-[8.5px] text-slate-500">Representante Comercial</p>
          </div>
        </div>

        <div className="text-center text-[8px] text-slate-400 mt-4 border-t border-slate-200 pt-1 flex justify-between items-center">
          <span>Sistema Safyra Safety • Gestão Comercial & Representação</span>
          <span>{order.order_number} • Impresso em {format(new Date(), "dd/MM/yyyy HH:mm")}</span>
        </div>
      </footer>
    </div>
  );
}
