-- Migration: A/B Testing de Pipelines
-- Criado em: 2025-11-03
-- Descrição: Sistema de A/B testing para comparar diferentes versões de pipelines

-- Tabela de experimentos A/B
CREATE TABLE IF NOT EXISTS public.lab_pipeline_ab_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Configuração do experimento
    variant_a_pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    variant_a_version TEXT, -- Versão específica do pipeline A (opcional)
    variant_b_pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    variant_b_version TEXT, -- Versão específica do pipeline B (opcional)
    
    -- Distribuição de tráfego (percentual)
    traffic_split JSONB NOT NULL DEFAULT '{"a": 50, "b": 50}'::jsonb, -- {a: 50, b: 50} ou {a: 90, b: 10}
    
    -- Status do experimento
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
    
    -- Metadados
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Critérios de conclusão
    min_sample_size INTEGER DEFAULT 100, -- Tamanho mínimo de amostra por variante
    max_duration_days INTEGER DEFAULT 30, -- Duração máxima do experimento em dias
    significance_level DECIMAL(3, 2) DEFAULT 0.05, -- Nível de significância (p-value)
    
    -- Resultado
    winner_variant TEXT CHECK (winner_variant IN ('a', 'b', 'tie', 'none')),
    winner_pipeline_id UUID REFERENCES public.lab_agent_pipelines(id) ON DELETE SET NULL,
    conclusion TEXT, -- Conclusão do experimento
    
    -- Configurações avançadas
    randomization_strategy TEXT DEFAULT 'random' CHECK (randomization_strategy IN ('random', 'user_id_hash', 'session_id')),
    metrics_to_track JSONB DEFAULT '["latency", "cost", "quality", "user_satisfaction"]'::jsonb
);

-- Tabela de execuções do experimento (registro de cada execução)
CREATE TABLE IF NOT EXISTS public.lab_pipeline_ab_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES public.lab_pipeline_ab_experiments(id) ON DELETE CASCADE,
    
    -- Qual variante foi executada
    variant TEXT NOT NULL CHECK (variant IN ('a', 'b')),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    
    -- Métricas da execução
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    input_messages JSONB,
    output_messages JSONB,
    
    -- Métricas
    latency_ms INTEGER,
    cost_usd DECIMAL(10, 6),
    quality_score DECIMAL(5, 2), -- Score de qualidade (0-100, opcional)
    user_satisfaction INTEGER CHECK (user_satisfaction IN (1, 2, 3, 4, 5)), -- Rating 1-5 (opcional)
    
    -- Metadados
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT, -- Para rastrear sessões do mesmo usuário
    randomization_key TEXT -- Chave usada para randomização
);

-- Tabela de métricas agregadas por experimento
CREATE TABLE IF NOT EXISTS public.lab_pipeline_ab_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES public.lab_pipeline_ab_experiments(id) ON DELETE CASCADE,
    variant TEXT NOT NULL CHECK (variant IN ('a', 'b')),
    
    -- Métricas agregadas
    total_executions INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    
    -- Métricas médias
    avg_latency_ms DECIMAL(10, 2),
    avg_cost_usd DECIMAL(10, 6),
    avg_quality_score DECIMAL(5, 2),
    avg_user_satisfaction DECIMAL(3, 2),
    
    -- Métricas totais
    total_cost_usd DECIMAL(10, 6),
    total_latency_ms BIGINT,
    
    -- Métricas de erro
    error_count INTEGER DEFAULT 0,
    error_rate DECIMAL(5, 2), -- Percentual de erros
    
    -- Estatísticas
    min_latency_ms INTEGER,
    max_latency_ms INTEGER,
    min_cost_usd DECIMAL(10, 6),
    max_cost_usd DECIMAL(10, 6),
    
    -- Período de agregação
    period_start TIMESTAMPTZ DEFAULT NOW(),
    period_end TIMESTAMPTZ DEFAULT NOW(),
    
    -- Última atualização
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(experiment_id, variant, period_start)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_experiments_status ON public.lab_pipeline_ab_experiments(status);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_experiments_created_by ON public.lab_pipeline_ab_experiments(created_by);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_experiments_created_at ON public.lab_pipeline_ab_experiments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_executions_experiment_id ON public.lab_pipeline_ab_executions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_executions_variant ON public.lab_pipeline_ab_executions(variant);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_executions_user_id ON public.lab_pipeline_ab_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_executions_executed_at ON public.lab_pipeline_ab_executions(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_metrics_experiment_id ON public.lab_pipeline_ab_metrics(experiment_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_ab_metrics_variant ON public.lab_pipeline_ab_metrics(variant);

-- Função para calcular qual variante usar baseado na distribuição
CREATE OR REPLACE FUNCTION get_ab_variant(
    p_experiment_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_experiment RECORD;
    v_traffic_split JSONB;
    v_random_value DECIMAL;
    v_total INTEGER;
BEGIN
    -- Buscar experimento
    SELECT * INTO v_experiment
    FROM public.lab_pipeline_ab_experiments
    WHERE id = p_experiment_id
      AND status = 'running';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Experimento não encontrado ou não está rodando';
    END IF;
    
    v_traffic_split := v_experiment.traffic_split;
    v_total := (v_traffic_split->>'a')::INTEGER + (v_traffic_split->>'b')::INTEGER;
    
    -- Gerar valor aleatório baseado na estratégia
    CASE v_experiment.randomization_strategy
        WHEN 'user_id_hash' THEN
            IF p_user_id IS NULL THEN
                v_random_value := random() * v_total;
            ELSE
                -- Hash determinístico baseado no user_id
                v_random_value := (hashtext(p_user_id::TEXT) % 100 + 100) % 100;
            END IF;
        WHEN 'session_id' THEN
            IF p_session_id IS NULL THEN
                v_random_value := random() * v_total;
            ELSE
                v_random_value := (hashtext(p_session_id) % 100 + 100) % 100;
            END IF;
        ELSE -- random
            v_random_value := random() * v_total;
    END CASE;
    
    -- Determinar variante baseado na distribuição
    IF v_random_value < (v_traffic_split->>'a')::INTEGER THEN
        RETURN 'a';
    ELSE
        RETURN 'b';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar métricas agregadas
CREATE OR REPLACE FUNCTION update_ab_metrics(p_experiment_id UUID)
RETURNS VOID AS $$
DECLARE
    v_variant RECORD;
    v_metrics RECORD;
BEGIN
    -- Para cada variante (a e b)
    FOR v_variant IN SELECT DISTINCT variant FROM public.lab_pipeline_ab_executions WHERE experiment_id = p_experiment_id
    LOOP
        -- Calcular métricas agregadas
        SELECT 
            COUNT(*) as total_executions,
            COUNT(DISTINCT user_id) as total_users,
            AVG(latency_ms)::DECIMAL(10, 2) as avg_latency,
            AVG(cost_usd)::DECIMAL(10, 6) as avg_cost,
            AVG(quality_score)::DECIMAL(5, 2) as avg_quality,
            AVG(user_satisfaction)::DECIMAL(3, 2) as avg_satisfaction,
            SUM(cost_usd)::DECIMAL(10, 6) as total_cost,
            SUM(latency_ms)::BIGINT as total_latency,
            COUNT(*) FILTER (WHERE latency_ms IS NULL OR cost_usd IS NULL) as error_count,
            MIN(latency_ms) as min_latency,
            MAX(latency_ms) as max_latency,
            MIN(cost_usd) as min_cost,
            MAX(cost_usd) as max_cost
        INTO v_metrics
        FROM public.lab_pipeline_ab_executions
        WHERE experiment_id = p_experiment_id
          AND variant = v_variant.variant;
        
        -- Inserir ou atualizar métricas
        INSERT INTO public.lab_pipeline_ab_metrics (
            experiment_id,
            variant,
            total_executions,
            total_users,
            avg_latency_ms,
            avg_cost_usd,
            avg_quality_score,
            avg_user_satisfaction,
            total_cost_usd,
            total_latency_ms,
            error_count,
            error_rate,
            min_latency_ms,
            max_latency_ms,
            min_cost_usd,
            max_cost_usd,
            period_start,
            period_end
        ) VALUES (
            p_experiment_id,
            v_variant.variant,
            v_metrics.total_executions,
            v_metrics.total_users,
            v_metrics.avg_latency,
            v_metrics.avg_cost,
            v_metrics.avg_quality,
            v_metrics.avg_satisfaction,
            v_metrics.total_cost,
            v_metrics.total_latency,
            v_metrics.error_count,
            CASE 
                WHEN v_metrics.total_executions > 0 THEN (v_metrics.error_count::DECIMAL / v_metrics.total_executions * 100)
                ELSE 0
            END,
            v_metrics.min_latency,
            v_metrics.max_latency,
            v_metrics.min_cost,
            v_metrics.max_cost,
            DATE_TRUNC('hour', NOW()),
            DATE_TRUNC('hour', NOW()) + INTERVAL '1 hour'
        )
        ON CONFLICT (experiment_id, variant, period_start) DO UPDATE SET
            total_executions = EXCLUDED.total_executions,
            total_users = EXCLUDED.total_users,
            avg_latency_ms = EXCLUDED.avg_latency_ms,
            avg_cost_usd = EXCLUDED.avg_cost_usd,
            avg_quality_score = EXCLUDED.avg_quality_score,
            avg_user_satisfaction = EXCLUDED.avg_user_satisfaction,
            total_cost_usd = EXCLUDED.total_cost_usd,
            total_latency_ms = EXCLUDED.total_latency_ms,
            error_count = EXCLUDED.error_count,
            error_rate = EXCLUDED.error_rate,
            min_latency_ms = EXCLUDED.min_latency_ms,
            max_latency_ms = EXCLUDED.max_latency_ms,
            min_cost_usd = EXCLUDED.min_cost_usd,
            max_cost_usd = EXCLUDED.max_cost_usd,
            period_end = EXCLUDED.period_end,
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular estatísticas e recomendar vencedor
CREATE OR REPLACE FUNCTION analyze_ab_experiment(p_experiment_id UUID)
RETURNS TABLE (
    variant_a_stats JSONB,
    variant_b_stats JSONB,
    recommendation TEXT,
    confidence_level DECIMAL(3, 2),
    significant_difference BOOLEAN
) AS $$
DECLARE
    v_a_metrics RECORD;
    v_b_metrics RECORD;
    v_recommendation TEXT;
    v_confidence DECIMAL(3, 2);
    v_significant BOOLEAN;
BEGIN
    -- Buscar métricas mais recentes de cada variante
    SELECT * INTO v_a_metrics
    FROM public.lab_pipeline_ab_metrics
    WHERE experiment_id = p_experiment_id
      AND variant = 'a'
    ORDER BY period_start DESC
    LIMIT 1;
    
    SELECT * INTO v_b_metrics
    FROM public.lab_pipeline_ab_metrics
    WHERE experiment_id = p_experiment_id
      AND variant = 'b'
    ORDER BY period_start DESC
    LIMIT 1;
    
    IF v_a_metrics IS NULL OR v_b_metrics IS NULL THEN
        RETURN QUERY SELECT 
            NULL::JSONB,
            NULL::JSONB,
            'Insufficient data'::TEXT,
            0.0::DECIMAL,
            false::BOOLEAN;
        RETURN;
    END IF;
    
    -- Calcular diferenças (simplificado - em produção, usar testes estatísticos)
    -- Comparar custo, latência e qualidade
    v_recommendation := 'a';
    v_confidence := 0.5;
    v_significant := false;
    
    -- Comparar custo (menor é melhor)
    IF v_a_metrics.avg_cost_usd < v_b_metrics.avg_cost_usd THEN
        v_recommendation := 'a';
    ELSIF v_b_metrics.avg_cost_usd < v_a_metrics.avg_cost_usd THEN
        v_recommendation := 'b';
    END IF;
    
    -- Considerar latência e qualidade também
    -- (em produção, usar análise estatística mais robusta)
    
    -- Calcular confiança (simplificado)
    IF v_a_metrics.total_executions >= 100 AND v_b_metrics.total_executions >= 100 THEN
        v_confidence := 0.8;
        v_significant := true;
    END IF;
    
    RETURN QUERY SELECT
        row_to_json(v_a_metrics)::JSONB,
        row_to_json(v_b_metrics)::JSONB,
        v_recommendation,
        v_confidence,
        v_significant;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_ab_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lab_ab_metrics_updated_at
    BEFORE UPDATE ON public.lab_pipeline_ab_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_ab_metrics_updated_at();

-- RLS Policies
ALTER TABLE public.lab_pipeline_ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_ab_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_ab_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas para experimentos
CREATE POLICY "Users can view their own experiments"
    ON public.lab_pipeline_ab_experiments
    FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can manage their own experiments"
    ON public.lab_pipeline_ab_experiments
    FOR ALL
    USING (created_by = auth.uid());

CREATE POLICY "Admins can view all experiments"
    ON public.lab_pipeline_ab_experiments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para execuções
CREATE POLICY "Users can view their own executions"
    ON public.lab_pipeline_ab_executions
    FOR SELECT
    USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "System can insert executions"
    ON public.lab_pipeline_ab_executions
    FOR INSERT
    WITH CHECK (true);

-- Políticas para métricas
CREATE POLICY "Anyone can view aggregated metrics"
    ON public.lab_pipeline_ab_metrics
    FOR SELECT
    USING (true);

-- Comentários
COMMENT ON TABLE public.lab_pipeline_ab_experiments IS 'Experimentos A/B para comparar pipelines';
COMMENT ON TABLE public.lab_pipeline_ab_executions IS 'Execuções individuais de experimentos A/B';
COMMENT ON TABLE public.lab_pipeline_ab_metrics IS 'Métricas agregadas por variante';
COMMENT ON FUNCTION get_ab_variant IS 'Determina qual variante usar baseado na distribuição de tráfego';
COMMENT ON FUNCTION update_ab_metrics IS 'Atualiza métricas agregadas de um experimento';
COMMENT ON FUNCTION analyze_ab_experiment IS 'Analisa resultados e recomenda vencedor';

