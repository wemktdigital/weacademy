-- Migration: Pipeline Scheduling
-- Criado em: 2025-11-03
-- Descrição: Sistema de agendamento de pipelines

-- Tabela de agendamentos de pipelines
CREATE TABLE IF NOT EXISTS public.lab_pipeline_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Configuração de agendamento
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'interval', 'webhook', 'event')),
    schedule_config JSONB NOT NULL, -- { cron: "0 9 * * *" } ou { interval: "daily" } ou { webhook_path: "/webhook/xxx" } ou { event_type: "user.created" }
    
    -- Configuração de execução
    input_data JSONB, -- Dados de input para o pipeline (pode incluir mensagens iniciais)
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_schedule_config CHECK (
        (schedule_type = 'cron' AND schedule_config ? 'cron') OR
        (schedule_type = 'interval' AND schedule_config ? 'interval') OR
        (schedule_type = 'webhook' AND schedule_config ? 'webhook_path') OR
        (schedule_type = 'event' AND schedule_config ? 'event_type')
    )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedules_pipeline_id ON public.lab_pipeline_schedules(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedules_user_id ON public.lab_pipeline_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedules_enabled ON public.lab_pipeline_schedules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedules_next_run_at ON public.lab_pipeline_schedules(next_run_at) WHERE enabled = true AND next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedules_schedule_type ON public.lab_pipeline_schedules(schedule_type);

-- Tabela de histórico de execuções agendadas
CREATE TABLE IF NOT EXISTS public.lab_pipeline_schedule_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.lab_pipeline_schedules(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Detalhes da execução
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Resultados
    input_messages JSONB,
    output_messages JSONB,
    total_cost_usd DECIMAL(10, 6),
    error_message TEXT,
    
    -- Trigger info (para webhooks e eventos)
    trigger_type TEXT, -- 'schedule', 'webhook', 'event'
    trigger_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para histórico
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedule_runs_schedule_id ON public.lab_pipeline_schedule_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedule_runs_pipeline_id ON public.lab_pipeline_schedule_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedule_runs_user_id ON public.lab_pipeline_schedule_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedule_runs_status ON public.lab_pipeline_schedule_runs(status);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_schedule_runs_started_at ON public.lab_pipeline_schedule_runs(started_at DESC);

-- Tabela de webhooks (para triggers externos)
CREATE TABLE IF NOT EXISTS public.lab_pipeline_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.lab_pipeline_schedules(id) ON DELETE CASCADE,
    webhook_path TEXT NOT NULL UNIQUE, -- ex: "/webhook/pipeline-xxx"
    secret_token TEXT, -- Para validação do webhook
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para webhooks
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_webhooks_schedule_id ON public.lab_pipeline_webhooks(schedule_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_webhooks_webhook_path ON public.lab_pipeline_webhooks(webhook_path);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_webhooks_enabled ON public.lab_pipeline_webhooks(enabled) WHERE enabled = true;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_pipeline_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lab_pipeline_schedules_updated_at ON public.lab_pipeline_schedules;
CREATE TRIGGER update_lab_pipeline_schedules_updated_at
    BEFORE UPDATE ON public.lab_pipeline_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_pipeline_schedules_updated_at();

DROP TRIGGER IF EXISTS update_lab_pipeline_webhooks_updated_at ON public.lab_pipeline_webhooks;
CREATE TRIGGER update_lab_pipeline_webhooks_updated_at
    BEFORE UPDATE ON public.lab_pipeline_webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_pipeline_schedules_updated_at();

-- RLS Policies
ALTER TABLE public.lab_pipeline_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_webhooks ENABLE ROW LEVEL SECURITY;

-- Políticas para lab_pipeline_schedules
-- Usuários podem ver seus próprios agendamentos
DROP POLICY IF EXISTS "Users can view their own schedules" ON public.lab_pipeline_schedules;
CREATE POLICY "Users can view their own schedules"
    ON public.lab_pipeline_schedules
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins podem ver todos os agendamentos
DROP POLICY IF EXISTS "Admins can view all schedules" ON public.lab_pipeline_schedules;
CREATE POLICY "Admins can view all schedules"
    ON public.lab_pipeline_schedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Usuários podem criar seus próprios agendamentos
DROP POLICY IF EXISTS "Users can create their own schedules" ON public.lab_pipeline_schedules;
CREATE POLICY "Users can create their own schedules"
    ON public.lab_pipeline_schedules
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios agendamentos
DROP POLICY IF EXISTS "Users can update their own schedules" ON public.lab_pipeline_schedules;
CREATE POLICY "Users can update their own schedules"
    ON public.lab_pipeline_schedules
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Usuários podem deletar seus próprios agendamentos
DROP POLICY IF EXISTS "Users can delete their own schedules" ON public.lab_pipeline_schedules;
CREATE POLICY "Users can delete their own schedules"
    ON public.lab_pipeline_schedules
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins podem gerenciar todos os agendamentos
DROP POLICY IF EXISTS "Admins can manage all schedules" ON public.lab_pipeline_schedules;
CREATE POLICY "Admins can manage all schedules"
    ON public.lab_pipeline_schedules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_pipeline_schedule_runs
-- Usuários podem ver execuções de seus próprios agendamentos
DROP POLICY IF EXISTS "Users can view their own schedule runs" ON public.lab_pipeline_schedule_runs;
CREATE POLICY "Users can view their own schedule runs"
    ON public.lab_pipeline_schedule_runs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins podem ver todas as execuções
DROP POLICY IF EXISTS "Admins can view all schedule runs" ON public.lab_pipeline_schedule_runs;
CREATE POLICY "Admins can view all schedule runs"
    ON public.lab_pipeline_schedule_runs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_pipeline_webhooks
-- Usuários podem ver webhooks de seus próprios agendamentos
DROP POLICY IF EXISTS "Users can view their own webhooks" ON public.lab_pipeline_webhooks;
CREATE POLICY "Users can view their own webhooks"
    ON public.lab_pipeline_webhooks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.lab_pipeline_schedules
            WHERE lab_pipeline_schedules.id = lab_pipeline_webhooks.schedule_id
            AND lab_pipeline_schedules.user_id = auth.uid()
        )
    );

-- Admins podem ver todos os webhooks
DROP POLICY IF EXISTS "Admins can view all webhooks" ON public.lab_pipeline_webhooks;
CREATE POLICY "Admins can view all webhooks"
    ON public.lab_pipeline_webhooks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Usuários podem criar webhooks para seus próprios agendamentos
DROP POLICY IF EXISTS "Users can create webhooks for their schedules" ON public.lab_pipeline_webhooks;
CREATE POLICY "Users can create webhooks for their schedules"
    ON public.lab_pipeline_webhooks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lab_pipeline_schedules
            WHERE lab_pipeline_schedules.id = lab_pipeline_webhooks.schedule_id
            AND lab_pipeline_schedules.user_id = auth.uid()
        )
    );

-- Usuários podem atualizar webhooks de seus próprios agendamentos
DROP POLICY IF EXISTS "Users can update their own webhooks" ON public.lab_pipeline_webhooks;
CREATE POLICY "Users can update their own webhooks"
    ON public.lab_pipeline_webhooks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.lab_pipeline_schedules
            WHERE lab_pipeline_schedules.id = lab_pipeline_webhooks.schedule_id
            AND lab_pipeline_schedules.user_id = auth.uid()
        )
    );

-- Usuários podem deletar webhooks de seus próprios agendamentos
DROP POLICY IF EXISTS "Users can delete their own webhooks" ON public.lab_pipeline_webhooks;
CREATE POLICY "Users can delete their own webhooks"
    ON public.lab_pipeline_webhooks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.lab_pipeline_schedules
            WHERE lab_pipeline_schedules.id = lab_pipeline_webhooks.schedule_id
            AND lab_pipeline_schedules.user_id = auth.uid()
        )
    );

-- Admins podem gerenciar todos os webhooks
DROP POLICY IF EXISTS "Admins can manage all webhooks" ON public.lab_pipeline_webhooks;
CREATE POLICY "Admins can manage all webhooks"
    ON public.lab_pipeline_webhooks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Comentários nas tabelas
COMMENT ON TABLE public.lab_pipeline_schedules IS 'Agendamentos de execução de pipelines';
COMMENT ON TABLE public.lab_pipeline_schedule_runs IS 'Histórico de execuções de pipelines agendados';
COMMENT ON TABLE public.lab_pipeline_webhooks IS 'Webhooks para trigger de pipelines agendados';

COMMENT ON COLUMN public.lab_pipeline_schedules.schedule_type IS 'Tipo de agendamento: cron, interval, webhook, event';
COMMENT ON COLUMN public.lab_pipeline_schedules.schedule_config IS 'Configuração específica do tipo de agendamento (JSON)';
COMMENT ON COLUMN public.lab_pipeline_schedules.next_run_at IS 'Próxima execução calculada baseada no schedule';
COMMENT ON COLUMN public.lab_pipeline_schedule_runs.trigger_type IS 'Tipo de trigger: schedule, webhook, event';

