import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const deleteOrderPermanently = createServerFn({ method: "POST" })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    const { orderId } = data;
    if (!orderId) throw new Error("ID do pedido é obrigatório.");

    // Tentar primeiro via RPC transacional (SECURITY DEFINER)
    const rpcClient = supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
    };

    const { data: rpcData, error: rpcError } = await rpcClient.rpc('delete_order_permanently', {
      p_order_id: orderId,
    });

    if (!rpcError) {
      return { success: true, data: rpcData };
    }

    // Fallback: caso a RPC ainda não esteja aplicada, executar a limpeza em cascata direta
    console.warn("[deleteOrderPermanently] RPC indisponível ou falhou, tentando limpeza direta:", rpcError);

    // 1. Obter pagamentos para limpar comissões vinculadas
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

    // 2. Limpar comissões diretas do pedido
    await supabase
      .from('commissions')
      .delete()
      .eq('order_id', orderId);

    // 3. Limpar order_payments
    await supabase
      .from('order_payments')
      .delete()
      .eq('order_id', orderId);

    // 4. Limpar order_items
    await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    // 5. Limpar order_history (se as permissões permitirem)
    await supabase
      .from('order_history')
      .delete()
      .eq('order_id', orderId);

    // 6. Excluir o pedido da tabela orders
    const { error: orderDeleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (orderDeleteError) {
      throw new Error(orderDeleteError.message || "Erro ao excluir o pedido no banco de dados.");
    }

    return { success: true };
  });
