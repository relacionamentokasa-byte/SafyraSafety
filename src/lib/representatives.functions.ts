import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveRepresentative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    fullName: z.string(),
    cpf: z.string(),
    birthDate: z.string(),
    phone: z.string(),
    whatsapp: z.string(),
    email: z.string(),
    code: z.string(),
    regionId: z.string(),
    state: z.string(),
    commissionRate: z.number(),
    monthlyGoal: z.number(),
    status: z.enum(["active", "inactive"]),
    photoUrl: z.string().optional(),
    cep: z.string(),
    address: z.string(),
    number: z.string(),
    complement: z.string().optional(),
    neighborhood: z.string(),
    city: z.string(),
    userId: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('representatives')
      .upsert({
        name: data.fullName,
        cpf: data.cpf,
        birth_date: data.birthDate,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        code: data.code,
        region_id: data.regionId,
        state: data.state,
        commission_rate: data.commissionRate,
        monthly_goal: data.monthlyGoal,
        status: data.status,
        photo_url: data.photoUrl,
        cep: data.cep,
        address: data.address,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        user_id: data.userId ?? context.userId,
      } as any);

    if (error) throw error;
    return { success: true };
  });
