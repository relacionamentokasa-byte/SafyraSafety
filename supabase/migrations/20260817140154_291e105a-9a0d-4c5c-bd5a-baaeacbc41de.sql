-- Criar crm_stages se não existir
CREATE TABLE IF NOT EXISTS public.crm_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#94a3b8',
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserindo as etapas padrão se a tabela estiver vazia
INSERT INTO public.crm_stages (name, description, sort_order, color)
SELECT * FROM (VALUES
    ('Lead', 'Cliente identificado ou oportunidade ainda não qualificada.', 10, '#94a3b8'),
    ('Qualificação', 'Entendendo a necessidade e o potencial do cliente.', 20, '#60a5fa'),
    ('Apresentação', 'Produtos ou solução apresentados ao cliente.', 30, '#818cf8'),
    ('Proposta', 'Proposta ou cotação em andamento.', 40, '#a78bfa'),
    ('Negociação', 'Cliente avaliando condições comerciais.', 50, '#f472b6'),
    ('Fechamento', 'Oportunidade pronta para ser ganha ou perdida.', 60, '#fbbf24'),
    ('Ganha', 'Venda concretizada.', 70, '#4ad395'),
    ('Perdida', 'Oportunidade encerrada sem venda.', 80, '#f87171')
) AS v(name, description, sort_order, color)
WHERE NOT EXISTS (SELECT 1 FROM public.crm_stages);

-- Atualizar opportunities para suportar CRM
-- Adicionando colunas novas se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='stage_id') THEN
        ALTER TABLE public.opportunities ADD COLUMN stage_id UUID REFERENCES public.crm_stages(id);
        -- Definir um stage padrão para as existentes
        UPDATE public.opportunities SET stage_id = (SELECT id FROM public.crm_stages ORDER BY sort_order LIMIT 1) WHERE stage_id IS NULL;
        ALTER TABLE public.opportunities ALTER COLUMN stage_id SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='probability') THEN
        ALTER TABLE public.opportunities ADD COLUMN probability INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='origin') THEN
        ALTER TABLE public.opportunities ADD COLUMN origin TEXT DEFAULT 'Outro' CHECK (origin IN ('Prospecção', 'Indicação', 'Visita', 'WhatsApp', 'Telefone', 'Site', 'Cliente atual', 'Outro'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='expected_closing_date') THEN
        ALTER TABLE public.opportunities ADD COLUMN expected_closing_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='actual_closing_date') THEN
        ALTER TABLE public.opportunities ADD COLUMN actual_closing_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='loss_reason') THEN
        ALTER TABLE public.opportunities ADD COLUMN loss_reason TEXT CHECK (loss_reason IN ('Preço', 'Concorrência', 'Prazo', 'Cliente desistiu', 'Produto inadequado', 'Sem orçamento', 'Sem retorno', 'Outro'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='loss_notes') THEN
        ALTER TABLE public.opportunities ADD COLUMN loss_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='next_action_description') THEN
        ALTER TABLE public.opportunities ADD COLUMN next_action_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='next_action_date') THEN
        ALTER TABLE public.opportunities ADD COLUMN next_action_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='created_by') THEN
        ALTER TABLE public.opportunities ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='updated_by') THEN
        ALTER TABLE public.opportunities ADD COLUMN updated_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Renomear 'value' para 'estimated_value' se existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='value') THEN
        ALTER TABLE public.opportunities RENAME COLUMN "value" TO estimated_value;
    END IF;
END $$;

-- Criar tabelas auxiliares
CREATE TABLE IF NOT EXISTS public.opportunity_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    estimated_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    total_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opportunity_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    representative_id UUID NOT NULL REFERENCES public.representatives(id),
    type TEXT NOT NULL CHECK (type IN ('Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Visita', 'Follow-up', 'Tarefa')),
    description TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'overdue')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opportunity_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    previous_stage_id UUID REFERENCES public.crm_stages(id),
    new_stage_id UUID REFERENCES public.crm_stages(id),
    previous_value DECIMAL(12, 2),
    new_value DECIMAL(12, 2),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_history TO authenticated;

GRANT ALL ON public.crm_stages TO service_role;
GRANT ALL ON public.opportunities TO service_role;
GRANT ALL ON public.opportunity_items TO service_role;
GRANT ALL ON public.opportunity_activities TO service_role;
GRANT ALL ON public.opportunity_history TO service_role;

-- RLS
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_history ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS (tentar dropar se já existirem para garantir atualização)
DROP POLICY IF EXISTS "Admins have full access to opportunities" ON public.opportunities;
CREATE POLICY "Admins have full access to opportunities"
ON public.opportunities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Gestores can view and manage all opportunities" ON public.opportunities;
CREATE POLICY "Gestores can view and manage all opportunities"
ON public.opportunities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor_comercial'));

DROP POLICY IF EXISTS "Representantes can view/manage their own opportunities" ON public.opportunities;
CREATE POLICY "Representantes can view/manage their own opportunities"
ON public.opportunities FOR ALL TO authenticated
USING (
    representative_id IN (
        SELECT id FROM public.representatives WHERE user_id = auth.uid()
    )
);

-- Políticas para Itens e Atividades seguem o acesso da oportunidade pai
DROP POLICY IF EXISTS "Access opportunity items based on opportunity" ON public.opportunity_items;
CREATE POLICY "Access opportunity items based on opportunity"
ON public.opportunity_items FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_id
    )
);

DROP POLICY IF EXISTS "Access opportunity activities based on opportunity" ON public.opportunity_activities;
CREATE POLICY "Access opportunity activities based on opportunity"
ON public.opportunity_activities FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_id
    )
);

DROP POLICY IF EXISTS "Access opportunity history based on opportunity" ON public.opportunity_history;
CREATE POLICY "Access opportunity history based on opportunity"
ON public.opportunity_history FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_id
    )
);
