import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const releaseCommissionByPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ paymentId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: result, error } = await supabase.rpc(
      "settle_order_payment_and_commissions",
      {
        p_payment_id: data.paymentId,
        p_received_value: null,
      },
    );

    if (error) throw error;
    return result;
  });
