-- Migration: Cost Analytics e Previsão
-- Criado em: 2025-11-03
-- Descrição: Sistema de análise de custos e previsão para pipelines

-- Tabela de métricas de execução para análise
CREATE TABLE IF NOT EXISTS public.lab_pipeline_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    pipeline_execution_id UUID, -- Referência ao log de execução (se disponível)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Métricas de execução
    total_cost_usd DECIMAL(10, 6) NOT NULL,
    total_latency_ms INTEGER NOT NULL,
    steps_executed INTEGER NOT NULL,
    tokens_input INTEGER,
    tokens_output INTEGER,
    
    -- Detalhes por step
    steps_metrics JSONB, -- [{ agent_id, cost, latency, tokens_input, tokens_output }]
    
    -- Metadados
    input_message_count INTEGER,
    output_message_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de métricas de agentes (para análise individual)
CREATE TABLE IF NOT EXISTS public.lab_agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.lab_agents(id) ON DELETE CASCADE,
    execution_id UUID, -- Referência ao log de execução
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Métricas
    cost_usd DECIMAL(10, 6) NOT NULL,
    latency_ms INTEGER NOT NULL,
    tokens_input INTEGER,
    tokens_output INTEGER,
    model_used TEXT,
    provider_used TEXT,
    
    -- Metadados
    success BOOLEAN DEFAULT true,
    error_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de estimativas e comparações
CREATE TABLE IF NOT EXISTS public.lab_cost_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Configuração estimada
    estimated_input_tokens INTEGER,
    estimated_output_tokens INTEGER,
    configuration JSONB, -- Configuração do pipeline (steps, modelos, etc.)
    
    -- Estimativas
    estimated_cost_usd DECIMAL(10, 6) NOT NULL,
    estimated_latency_ms INTEGER NOT NULL,
    confidence_level DECIMAL(3, 2), -- 0.00 a 1.00 (baseado em histórico)
    
    -- Métricas reais (preenchido após execução)
    actual_cost_usd DECIMAL(10, 6),
    actual_latency_ms INTEGER,
    accuracy DECIMAL(5, 4), -- Diferença entre estimado e real
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ -- Quando foi executado (se foi)
);

-- Tabela de limites de custo por usuário/pipeline
CREATE TABLE IF NOT EXISTS public.lab_cost_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pipeline_id UUID REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE, -- NULL = limite global
    
    -- Limites
    max_cost_per_execution DECIMAL(10, 6),
    max_cost_per_day DECIMAL(10, 6),
    max_cost_per_month DECIMAL(10, 6),
    alert_threshold_percent DECIMAL(5, 2) DEFAULT 80.00, -- Alerta quando atingir 80% do limite
    
    -- Notificações
    email_alerts BOOLEAN DEFAULT true,
    
    -- Metadados
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_pipeline_limit UNIQUE (user_id, pipeline_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_metrics_pipeline_id ON public.lab_pipeline_metrics(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_metrics_user_id ON public.lab_pipeline_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_metrics_created_at ON public.lab_pipeline_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_metrics_cost ON public.lab_pipeline_metrics(total_cost_usd);

CREATE INDEX IF NOT EXISTS idx_lab_agent_metrics_agent_id ON public.lab_agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_lab_agent_metrics_user_id ON public.lab_agent_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_agent_metrics_created_at ON public.lab_agent_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_agent_metrics_model ON public.lab_agent_metrics(model_used);

CREATE INDEX IF NOT EXISTS idx_lab_cost_estimates_pipeline_id ON public.lab_cost_estimates(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_cost_estimates_user_id ON public.lab_cost_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_cost_estimates_created_at ON public.lab_cost_estimates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_cost_limits_user_id ON public.lab_cost_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_cost_limits_pipeline_id ON public.lab_cost_limits(pipeline_id) WHERE pipeline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lab_cost_limits_enabled ON public.lab_cost_limits(enabled) WHERE enabled = true;

-- Função para calcular estatísticas de custo de um pipeline
CREATE OR REPLACE FUNCTION get_pipeline_cost_stats(
    p_pipeline_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    avg_cost_usd DECIMAL(10, 6),
    min_cost_usd DECIMAL(10, 6),
    max_cost_usd DECIMAL(10, 6),
    median_cost_usd DECIMAL(10, 6),
    total_executions BIGINT,
    total_cost_usd DECIMAL(10, 6),
    avg_latency_ms NUMERIC,
    avg_tokens_input NUMERIC,
    avg_tokens_output NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        AVG(total_cost_usd)::DECIMAL(10, 6) AS avg_cost_usd,
        MIN(total_cost_usd)::DECIMAL(10, 6) AS min_cost_usd,
        MAX(total_cost_usd)::DECIMAL(10, 6) AS max_cost_usd,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_cost_usd)::DECIMAL(10, 6) AS median_cost_usd,
        COUNT(*)::BIGINT AS total_executions,
        SUM(total_cost_usd)::DECIMAL(10, 6) AS total_cost_usd,
        AVG(total_latency_ms)::NUMERIC AS avg_latency_ms,
        AVG(tokens_input)::NUMERIC AS avg_tokens_input,
        AVG(tokens_output)::NUMERIC AS avg_tokens_output
    FROM public.lab_pipeline_metrics
    WHERE pipeline_id = p_pipeline_id
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular estatísticas de custo de um agente
CREATE OR REPLACE FUNCTION get_agent_cost_stats(
    p_agent_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    avg_cost_usd DECIMAL(10, 6),
    min_cost_usd DECIMAL(10, 6),
    max_cost_usd DECIMAL(10, 6),
    median_cost_usd DECIMAL(10, 6),
    total_executions BIGINT,
    total_cost_usd DECIMAL(10, 6),
    avg_latency_ms NUMERIC,
    avg_tokens_input NUMERIC,
    avg_tokens_output NUMERIC,
    most_used_model TEXT,
    most_used_provider TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        AVG(cost_usd)::DECIMAL(10, 6) AS avg_cost_usd,
        MIN(cost_usd)::DECIMAL(10, 6) AS min_cost_usd,
        MAX(cost_usd)::DECIMAL(10, 6) AS max_cost_usd,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_usd)::DECIMAL(10, 6) AS median_cost_usd,
        COUNT(*)::BIGINT AS total_executions,
        SUM(cost_usd)::DECIMAL(10, 6) AS total_cost_usd,
        AVG(latency_ms)::NUMERIC AS avg_latency_ms,
        AVG(tokens_input)::NUMERIC AS avg_tokens_input,
        AVG(tokens_output)::NUMERIC AS avg_tokens_output,
        MODE() WITHIN GROUP (ORDER BY model_used) AS most_used_model,
        MODE() WITHIN GROUP (ORDER BY provider_used) AS most_used_provider
    FROM public.lab_agent_metrics
    WHERE agent_id = p_agent_id
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_cost_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lab_cost_limits_updated_at ON public.lab_cost_limits;
CREATE TRIGGER update_lab_cost_limits_updated_at
    BEFORE UPDATE ON public.lab_cost_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_cost_limits_updated_at();

-- RLS Policies
ALTER TABLE public.lab_pipeline_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_cost_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_cost_limits ENABLE ROW LEVEL SECURITY;

-- Políticas para lab_pipeline_metrics
DROP POLICY IF EXISTS "Users can view their own pipeline metrics" ON public.lab_pipeline_metrics;
CREATE POLICY "Users can view their own pipeline metrics"
    ON public.lab_pipeline_metrics
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all pipeline metrics" ON public.lab_pipeline_metrics;
CREATE POLICY "Admins can view all pipeline metrics"
    ON public.lab_pipeline_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_agent_metrics (similar)
DROP POLICY IF EXISTS "Users can view their own agent metrics" ON public.lab_agent_metrics;
CREATE POLICY "Users can view their own agent metrics"
    ON public.lab_agent_metrics
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all agent metrics" ON public.lab_agent_metrics;
CREATE POLICY "Admins can view all agent metrics"
    ON public.lab_agent_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_cost_estimates
DROP POLICY IF EXISTS "Users can manage their own cost estimates" ON public.lab_cost_estimates;
CREATE POLICY "Users can manage their own cost estimates"
    ON public.lab_cost_estimates
    FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all cost estimates" ON public.lab_cost_estimates;
CREATE POLICY "Admins can view all cost estimates"
    ON public.lab_cost_estimates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_cost_limits
DROP POLICY IF EXISTS "Users can manage their own cost limits" ON public.lab_cost_limits;
CREATE POLICY "Users can manage their own cost limits"
    ON public.lab_cost_limits
    FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all cost limits" ON public.lab_cost_limits;
CREATE POLICY "Admins can manage all cost limits"
    ON public.lab_cost_limits
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Comentários nas tabelas
COMMENT ON TABLE public.lab_pipeline_metrics IS 'Métricas históricas de execução de pipelines para análise de custos';
COMMENT ON TABLE public.lab_agent_metrics IS 'Métricas históricas de execução de agentes individuais';
COMMENT ON TABLE public.lab_cost_estimates IS 'Estimativas de custo antes de executar pipelines';
COMMENT ON TABLE public.lab_cost_limits IS 'Limites de custo configurados por usuário/pipeline';

COMMENT ON FUNCTION get_pipeline_cost_stats IS 'Calcula estatísticas de custo de um pipeline baseado em histórico';
COMMENT ON FUNCTION get_agent_cost_stats IS 'Calcula estatísticas de custo de um agente baseado em histórico';

