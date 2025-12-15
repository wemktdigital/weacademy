-- Migration: Cost Estimation e Analytics
-- Criado em: 2025-11-03
-- Descrição: Sistema de previsão de custo e otimização

-- Tabela de métricas históricas por step (para cálculos de estimativa)
CREATE TABLE IF NOT EXISTS public.lab_pipeline_step_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.lab_agents(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    
    -- Métricas médias baseadas em histórico
    avg_cost_usd DECIMAL(10, 6),
    avg_latency_ms INTEGER,
    avg_input_tokens INTEGER,
    avg_output_tokens INTEGER,
    
    -- Métricas agregadas
    min_cost_usd DECIMAL(10, 6),
    max_cost_usd DECIMAL(10, 6),
    min_latency_ms INTEGER,
    max_latency_ms INTEGER,
    
    -- Estatísticas
    execution_count INTEGER DEFAULT 0,
    last_execution_at TIMESTAMPTZ,
    
    -- Configuração usada
    provider TEXT,
    model TEXT,
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(pipeline_id, agent_id, step_order, provider, model)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_step_metrics_pipeline_id ON public.lab_pipeline_step_metrics(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_step_metrics_agent_id ON public.lab_pipeline_step_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_step_metrics_last_execution_at ON public.lab_pipeline_step_metrics(last_execution_at DESC);

-- Tabela de estimativas de custo (para comparação com execuções reais)
CREATE TABLE IF NOT EXISTS public.lab_pipeline_cost_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Estimativas
    estimated_cost_usd DECIMAL(10, 6),
    estimated_latency_ms INTEGER,
    estimated_total_tokens INTEGER,
    
    -- Configuração estimada
    input_message_length INTEGER, -- Tamanho aproximado do input
    configuration_snapshot JSONB, -- Snapshot da configuração do pipeline
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Se foi vinculado a uma execução real, armazenar referência
    actual_execution_log_id BIGINT REFERENCES public.lab_pipeline_logs(id) ON DELETE SET NULL,
    actual_cost_usd DECIMAL(10, 6),
    actual_latency_ms INTEGER,
    
    -- Diferença (para análise de precisão)
    cost_difference_usd DECIMAL(10, 6), -- actual - estimated
    cost_difference_percent DECIMAL(5, 2), -- ((actual - estimated) / estimated) * 100
    latency_difference_ms INTEGER,
    latency_difference_percent DECIMAL(5, 2)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_cost_estimates_pipeline_id ON public.lab_pipeline_cost_estimates(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_cost_estimates_user_id ON public.lab_pipeline_cost_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_cost_estimates_created_at ON public.lab_pipeline_cost_estimates(created_at DESC);

-- Tabela de alertas de custo
CREATE TABLE IF NOT EXISTS public.lab_pipeline_cost_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Configuração do alerta
    alert_type TEXT NOT NULL CHECK (alert_type IN ('cost_limit', 'cost_spike', 'daily_limit', 'weekly_limit')),
    threshold_usd DECIMAL(10, 6), -- Limite em USD
    threshold_percent DECIMAL(5, 2), -- Limite em percentual (para spikes)
    
    -- Status
    enabled BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    
    -- Notificações
    notification_email BOOLEAN DEFAULT false,
    notification_in_app BOOLEAN DEFAULT true,
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_cost_alerts_pipeline_id ON public.lab_pipeline_cost_alerts(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_cost_alerts_user_id ON public.lab_pipeline_cost_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_cost_alerts_enabled ON public.lab_pipeline_cost_alerts(enabled) WHERE enabled = true;

-- Função para atualizar métricas históricas após execução
CREATE OR REPLACE FUNCTION update_pipeline_step_metrics(
    p_pipeline_id UUID,
    p_agent_id UUID,
    p_step_order INTEGER,
    p_cost_usd DECIMAL,
    p_latency_ms INTEGER,
    p_input_tokens INTEGER DEFAULT NULL,
    p_output_tokens INTEGER DEFAULT NULL,
    p_provider TEXT DEFAULT NULL,
    p_model TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_execution_count INTEGER;
    v_old_avg_cost DECIMAL;
    v_old_avg_latency INTEGER;
BEGIN
    -- Buscar métricas existentes
    SELECT execution_count, avg_cost_usd, avg_latency_ms
    INTO v_execution_count, v_old_avg_cost, v_old_avg_latency
    FROM public.lab_pipeline_step_metrics
    WHERE pipeline_id = p_pipeline_id
      AND agent_id = p_agent_id
      AND step_order = p_step_order
      AND (p_provider IS NULL OR provider = p_provider)
      AND (p_model IS NULL OR model = p_model)
    LIMIT 1;
    
    IF v_execution_count IS NULL OR v_execution_count = 0 THEN
        -- Primeira execução: criar registro
        INSERT INTO public.lab_pipeline_step_metrics (
            pipeline_id, agent_id, step_order,
            avg_cost_usd, avg_latency_ms, avg_input_tokens, avg_output_tokens,
            min_cost_usd, max_cost_usd, min_latency_ms, max_latency_ms,
            execution_count, last_execution_at, provider, model
        ) VALUES (
            p_pipeline_id, p_agent_id, p_step_order,
            p_cost_usd, p_latency_ms, p_input_tokens, p_output_tokens,
            p_cost_usd, p_cost_usd, p_latency_ms, p_latency_ms,
            1, NOW(), p_provider, p_model
        );
    ELSE
        -- Atualizar média incremental (média móvel com fator de esquecimento)
        UPDATE public.lab_pipeline_step_metrics
        SET
            avg_cost_usd = (avg_cost_usd * 0.9 + p_cost_usd * 0.1), -- Média móvel ponderada
            avg_latency_ms = (avg_latency_ms * 0.9 + p_latency_ms * 0.1),
            avg_input_tokens = CASE 
                WHEN avg_input_tokens IS NULL THEN p_input_tokens
                WHEN p_input_tokens IS NOT NULL THEN (avg_input_tokens * 0.9 + p_input_tokens * 0.1)
                ELSE avg_input_tokens
            END,
            avg_output_tokens = CASE
                WHEN avg_output_tokens IS NULL THEN p_output_tokens
                WHEN p_output_tokens IS NOT NULL THEN (avg_output_tokens * 0.9 + p_output_tokens * 0.1)
                ELSE avg_output_tokens
            END,
            min_cost_usd = LEAST(min_cost_usd, p_cost_usd),
            max_cost_usd = GREATEST(max_cost_usd, p_cost_usd),
            min_latency_ms = LEAST(min_latency_ms, p_latency_ms),
            max_latency_ms = GREATEST(max_latency_ms, p_latency_ms),
            execution_count = execution_count + 1,
            last_execution_at = NOW(),
            updated_at = NOW()
        WHERE pipeline_id = p_pipeline_id
          AND agent_id = p_agent_id
          AND step_order = p_step_order
          AND (p_provider IS NULL OR provider = p_provider)
          AND (p_model IS NULL OR model = p_model);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular estimativa de custo para um pipeline
CREATE OR REPLACE FUNCTION estimate_pipeline_cost(
    p_pipeline_id UUID,
    p_input_length INTEGER DEFAULT 1000 -- Tamanho aproximado do input em caracteres
)
RETURNS TABLE (
    estimated_cost_usd DECIMAL(10, 6),
    estimated_latency_ms INTEGER,
    estimated_total_tokens INTEGER,
    steps_count INTEGER
) AS $$
DECLARE
    v_steps JSONB;
    v_total_cost DECIMAL := 0;
    v_total_latency INTEGER := 0;
    v_total_tokens INTEGER := 0;
    v_step_count INTEGER := 0;
    v_step JSONB;
    v_metric RECORD;
BEGIN
    -- Buscar steps do pipeline
    SELECT steps INTO v_steps
    FROM public.lab_agent_pipelines
    WHERE id = p_pipeline_id;
    
    IF v_steps IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::INTEGER, 0::INTEGER, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Iterar sobre cada step
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_steps)
    LOOP
        v_step_count := v_step_count + 1;
        
        -- Buscar métricas históricas para este step
        SELECT avg_cost_usd, avg_latency_ms, avg_input_tokens, avg_output_tokens
        INTO v_metric
        FROM public.lab_pipeline_step_metrics
        WHERE pipeline_id = p_pipeline_id
          AND agent_id = (v_step->>'agent_id')::UUID
          AND step_order = (v_step->>'order')::INTEGER
        ORDER BY last_execution_at DESC
        LIMIT 1;
        
        IF v_metric IS NOT NULL THEN
            -- Usar média histórica
            v_total_cost := v_total_cost + COALESCE(v_metric.avg_cost_usd, 0);
            v_total_latency := v_total_latency + COALESCE(v_metric.avg_latency_ms, 0);
            v_total_tokens := v_total_tokens + COALESCE(v_metric.avg_input_tokens, 0) + COALESCE(v_metric.avg_output_tokens, 0);
        ELSE
            -- Sem histórico: usar estimativa baseada em tamanho de input
            -- Estimativa conservadora: ~500 tokens de input, ~200 tokens de output por step
            v_total_cost := v_total_cost + 0.001; -- Estimativa conservadora de $0.001 por step
            v_total_latency := v_total_latency + 2000; -- 2 segundos por step
            v_total_tokens := v_total_tokens + 700; -- ~700 tokens por step
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_total_cost::DECIMAL(10, 6),
        v_total_latency::INTEGER,
        v_total_tokens::INTEGER,
        v_step_count::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_cost_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lab_cost_alerts_updated_at
    BEFORE UPDATE ON public.lab_pipeline_cost_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_cost_alerts_updated_at();

-- RLS Policies
ALTER TABLE public.lab_pipeline_step_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_cost_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_cost_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas para lab_pipeline_step_metrics (acesso público para leitura, apenas sistema escreve)
CREATE POLICY "Anyone can view step metrics"
    ON public.lab_pipeline_step_metrics
    FOR SELECT
    USING (true);

-- Políticas para lab_pipeline_cost_estimates
CREATE POLICY "Users can view their own estimates"
    ON public.lab_pipeline_cost_estimates
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        user_id IS NULL -- Estimativas públicas
    );

CREATE POLICY "Users can create their own estimates"
    ON public.lab_pipeline_cost_estimates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins podem ver todas as estimativas
CREATE POLICY "Admins can view all estimates"
    ON public.lab_pipeline_cost_estimates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_pipeline_cost_alerts
CREATE POLICY "Users can manage their own alerts"
    ON public.lab_pipeline_cost_alerts
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all alerts"
    ON public.lab_pipeline_cost_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Comentários
COMMENT ON TABLE public.lab_pipeline_step_metrics IS 'Métricas históricas por step para cálculo de estimativas';
COMMENT ON TABLE public.lab_pipeline_cost_estimates IS 'Estimativas de custo antes de execução e comparação com resultados reais';
COMMENT ON TABLE public.lab_pipeline_cost_alerts IS 'Alertas configuráveis para limites de custo';

COMMENT ON FUNCTION estimate_pipeline_cost IS 'Calcula estimativa de custo e latência baseada em histórico';
COMMENT ON FUNCTION update_pipeline_step_metrics IS 'Atualiza métricas históricas após execução de step';

