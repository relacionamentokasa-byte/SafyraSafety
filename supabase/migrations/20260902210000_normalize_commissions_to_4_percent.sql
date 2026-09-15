-- Migration: Normalização das taxas de comissão para 4.0% e recálculo do histórico de lançamentos

-- 1. Garantir que as taxas padrão de fabricantes sejam 4.0%
UPDATE public.manufacturers
SET default_commission_rate = 4.0
WHERE default_commission_rate IS NULL OR default_commission_rate <> 4.0;

-- 2. Garantir que as regras de comissão ativas utilizem 4.0%
UPDATE public.commission_rules
SET commission_rate = 4.0
WHERE commission_rate IS NULL OR commission_rate <> 4.0;

-- 3. Atualizar itens de tabelas de preços para 4.0%
UPDATE public.price_table_items
SET commission_rate = 4.0
WHERE commission_rate IS NULL OR commission_rate <> 4.0;

-- 4. Recalcular e fixar todas as comissões apuradas com alíquota de 4% sobre a base líquida
UPDATE public.commissions
SET commission_rate = 4.0,
    commission_value = ROUND((COALESCE(base_value, 0) * 0.04)::NUMERIC, 2)
WHERE commission_rate <> 4.0 OR commission_value <> ROUND((COALESCE(base_value, 0) * 0.04)::NUMERIC, 2);
