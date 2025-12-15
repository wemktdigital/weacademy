-- Migration: Analytics Avançados com IA
-- Criado em: 2025-11-03
-- Descrição: Sistema de analytics avançado com IA para análise de padrões e otimizações

-- Tabela de insights gerados por IA
CREATE TABLE IF NOT EXISTS public.lab_pipeline_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    
    -- Tipo de insight
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'bottleneck',
        'cost_optimization',
        'latency_optimization',
        'model_recommendation',
        'step_order_optimization',
        'anomaly_detection',
        'usage_pattern'
    )),
    
    -- Dados do insight
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Recomendações
    recommendations JSONB, -- Array de recomendações específicas
    estimated_impact JSONB, -- { cost_savings: 0.05, latency_reduction: 200, etc. }
    
    -- Métricas relacionadas
    related_metrics JSONB, -- Métricas que suportam este insight
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'resolved', 'archived')),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Metadados
    generated_by TEXT DEFAULT 'ai_analyzer', -- 'ai_analyzer', 'user', 'system'
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Insights podem expirar após um tempo
    
    -- Contexto
    context JSONB -- Contexto adicional (período analisado, amostra, etc.)
);

-- Tabela de alertas proativos
CREATE TABLE IF NOT EXISTS public.lab_pipeline_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tipo de alerta
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'cost_spike',
        'latency_spike',
        'error_rate_increase',
        'usage_anomaly',
        'performance_degradation',
        'threshold_exceeded'
    )),
    
    -- Dados do alerta
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Métricas
    current_value DECIMAL(10, 6),
    threshold_value DECIMAL(10, 6),
    difference_percent DECIMAL(5, 2),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Metadados
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    context JSONB -- Contexto adicional (período, comparação, etc.)
);

-- Tabela de recomendações de otimização
CREATE TABLE IF NOT EXISTS public.lab_pipeline_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    
    -- Tipo de otimização
    optimization_type TEXT NOT NULL CHECK (optimization_type IN (
        'model_change',
        'step_order_change',
        'provider_change',
        'parameter_tuning',
        'parallelization',
        'caching',
        'retry_strategy',
        'timeout_adjustment'
    )),
    
    -- Recomendação
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    current_config JSONB, -- Configuração atual
    recommended_config JSONB, -- Configuração recomendada
    
    -- Impacto estimado
    estimated_cost_savings_percent DECIMAL(5, 2),
    estimated_latency_reduction_ms INTEGER,
    estimated_quality_impact DECIMAL(5, 2), -- Impacto na qualidade (pode ser negativo)
    confidence_level DECIMAL(3, 2), -- Confiança na recomendação (0-1)
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'testing')),
    applied_at TIMESTAMPTZ,
    applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Resultados (se aplicado)
    actual_cost_savings_percent DECIMAL(5, 2),
    actual_latency_reduction_ms INTEGER,
    actual_quality_impact DECIMAL(5, 2),
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Recomendações podem expirar
);

-- Tabela de padrões detectados
CREATE TABLE IF NOT EXISTS public.lab_pipeline_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    
    -- Tipo de padrão
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'usage_trend',
        'cost_trend',
        'latency_trend',
        'error_pattern',
        'time_of_day',
        'day_of_week',
        'user_segment',
        'input_pattern'
    )),
    
    -- Dados do padrão
    pattern_data JSONB NOT NULL, -- Dados específicos do padrão
    strength DECIMAL(3, 2) DEFAULT 0.5, -- Força do padrão (0-1)
    confidence DECIMAL(3, 2) DEFAULT 0.5, -- Confiança na detecção (0-1)
    
    -- Período analisado
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Metadados
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    sample_size INTEGER -- Tamanho da amostra analisada
);

-- Tabela de análises de gargalos
CREATE TABLE IF NOT EXISTS public.lab_pipeline_bottlenecks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    step_order INTEGER,
    agent_id UUID REFERENCES public.lab_agents(id) ON DELETE SET NULL,
    
    -- Métricas do gargalo
    avg_latency_ms DECIMAL(10, 2),
    avg_cost_usd DECIMAL(10, 6),
    p95_latency_ms DECIMAL(10, 2),
    p99_latency_ms DECIMAL(10, 2),
    
    -- Impacto no pipeline
    impact_on_total_latency_percent DECIMAL(5, 2),
    impact_on_total_cost_percent DECIMAL(5, 2),
    
    -- Recomendações
    recommendations JSONB, -- Recomendações específicas para este gargalo
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
    resolved_at TIMESTAMPTZ,
    
    -- Metadados
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    sample_size INTEGER
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_insights_pipeline_id ON public.lab_pipeline_insights(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_insights_type ON public.lab_pipeline_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_insights_status ON public.lab_pipeline_insights(status);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_insights_generated_at ON public.lab_pipeline_insights(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_pipeline_alerts_pipeline_id ON public.lab_pipeline_alerts(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_alerts_user_id ON public.lab_pipeline_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_alerts_status ON public.lab_pipeline_alerts(status);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_alerts_triggered_at ON public.lab_pipeline_alerts(triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_pipeline_optimizations_pipeline_id ON public.lab_pipeline_optimizations(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_optimizations_status ON public.lab_pipeline_optimizations(status);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_optimizations_type ON public.lab_pipeline_optimizations(optimization_type);

CREATE INDEX IF NOT EXISTS idx_lab_pipeline_patterns_pipeline_id ON public.lab_pipeline_patterns(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_patterns_type ON public.lab_pipeline_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_patterns_detected_at ON public.lab_pipeline_patterns(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_pipeline_bottlenecks_pipeline_id ON public.lab_pipeline_bottlenecks(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_bottlenecks_status ON public.lab_pipeline_bottlenecks(status);

-- Função para detectar gargalos automaticamente
CREATE OR REPLACE FUNCTION detect_pipeline_bottlenecks(
    p_pipeline_id UUID,
    p_period_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    step_order INTEGER,
    agent_id UUID,
    avg_latency_ms DECIMAL,
    avg_cost_usd DECIMAL,
    impact_latency_percent DECIMAL,
    impact_cost_percent DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH step_metrics AS (
        SELECT 
            sm.step_order,
            sm.agent_id,
            AVG(sm.latency_ms)::DECIMAL(10, 2) as avg_latency,
            AVG(sm.cost_usd)::DECIMAL(10, 6) as avg_cost,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY sm.latency_ms)::DECIMAL(10, 2) as p95_latency,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY sm.latency_ms)::DECIMAL(10, 2) as p99_latency
        FROM lab_pipeline_step_metrics sm
        WHERE sm.pipeline_id = p_pipeline_id
          AND sm.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
        GROUP BY sm.step_order, sm.agent_id
    ),
    total_metrics AS (
        SELECT 
            SUM(avg_latency) as total_latency,
            SUM(avg_cost) as total_cost
        FROM step_metrics
    )
    SELECT 
        sm.step_order,
        sm.agent_id,
        sm.avg_latency,
        sm.avg_cost,
        CASE 
            WHEN tm.total_latency > 0 THEN (sm.avg_latency / tm.total_latency * 100)::DECIMAL(5, 2)
            ELSE 0
        END as impact_latency_percent,
        CASE 
            WHEN tm.total_cost > 0 THEN (sm.avg_cost / tm.total_cost * 100)::DECIMAL(5, 2)
            ELSE 0
        END as impact_cost_percent
    FROM step_metrics sm
    CROSS JOIN total_metrics tm
    WHERE sm.avg_latency > tm.total_latency * 0.3 -- Mais de 30% da latência total
       OR sm.avg_cost > tm.total_cost * 0.3 -- Mais de 30% do custo total
    ORDER BY impact_latency_percent DESC, impact_cost_percent DESC;
END;
$$ LANGUAGE plpgsql;

-- Função para detectar anomalias de custo
CREATE OR REPLACE FUNCTION detect_cost_anomalies(
    p_pipeline_id UUID,
    p_period_days INTEGER DEFAULT 7,
    p_threshold_multiplier DECIMAL DEFAULT 2.0
)
RETURNS TABLE (
    anomaly_date DATE,
    avg_cost DECIMAL,
    expected_cost DECIMAL,
    difference_percent DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_costs AS (
        SELECT 
            DATE(pl.created_at) as cost_date,
            AVG(pl.total_cost_usd)::DECIMAL(10, 6) as avg_cost
        FROM lab_pipeline_logs pl
        WHERE pl.pipeline_id = p_pipeline_id
          AND pl.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
        GROUP BY DATE(pl.created_at)
    ),
    historical_avg AS (
        SELECT AVG(avg_cost)::DECIMAL(10, 6) as expected_cost
        FROM daily_costs
    )
    SELECT 
        dc.cost_date,
        dc.avg_cost,
        ha.expected_cost,
        CASE 
            WHEN ha.expected_cost > 0 THEN ((dc.avg_cost - ha.expected_cost) / ha.expected_cost * 100)::DECIMAL(5, 2)
            ELSE 0
        END as difference_percent
    FROM daily_costs dc
    CROSS JOIN historical_avg ha
    WHERE ABS(dc.avg_cost - ha.expected_cost) > ha.expected_cost * (p_threshold_multiplier - 1)
    ORDER BY ABS(difference_percent) DESC;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.lab_pipeline_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_bottlenecks ENABLE ROW LEVEL SECURITY;

-- Políticas para insights
DROP POLICY IF EXISTS "Users can view insights for their pipelines" ON public.lab_pipeline_insights;
CREATE POLICY "Users can view insights for their pipelines"
    ON public.lab_pipeline_insights
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
        OR true -- Permitir acesso para todos (ajustar conforme necessário)
    );

-- Políticas para alertas
DROP POLICY IF EXISTS "Users can view their own alerts" ON public.lab_pipeline_alerts;
CREATE POLICY "Users can view their own alerts"
    ON public.lab_pipeline_alerts
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own alerts" ON public.lab_pipeline_alerts;
CREATE POLICY "Users can manage their own alerts"
    ON public.lab_pipeline_alerts
    FOR ALL
    USING (user_id = auth.uid());

-- Políticas para otimizações
DROP POLICY IF EXISTS "Users can view optimizations for their pipelines" ON public.lab_pipeline_optimizations;
CREATE POLICY "Users can view optimizations for their pipelines"
    ON public.lab_pipeline_optimizations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
        OR true -- Permitir acesso para todos (ajustar conforme necessário)
    );

-- Políticas para padrões
DROP POLICY IF EXISTS "Users can view patterns for their pipelines" ON public.lab_pipeline_patterns;
CREATE POLICY "Users can view patterns for their pipelines"
    ON public.lab_pipeline_patterns
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
        OR true -- Permitir acesso para todos (ajustar conforme necessário)
    );

-- Políticas para gargalos
DROP POLICY IF EXISTS "Users can view bottlenecks for their pipelines" ON public.lab_pipeline_bottlenecks;
CREATE POLICY "Users can view bottlenecks for their pipelines"
    ON public.lab_pipeline_bottlenecks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
        OR true -- Permitir acesso para todos (ajustar conforme necessário)
    );

-- Comentários
COMMENT ON TABLE public.lab_pipeline_insights IS 'Insights gerados por IA sobre pipelines';
COMMENT ON TABLE public.lab_pipeline_alerts IS 'Alertas proativos sobre anomalias e problemas';
COMMENT ON TABLE public.lab_pipeline_optimizations IS 'Recomendações de otimização geradas por IA';
COMMENT ON TABLE public.lab_pipeline_patterns IS 'Padrões detectados em execuções de pipelines';
COMMENT ON TABLE public.lab_pipeline_bottlenecks IS 'Gargalos detectados em pipelines';
COMMENT ON FUNCTION detect_pipeline_bottlenecks IS 'Detecta gargalos automaticamente baseado em métricas';
COMMENT ON FUNCTION detect_cost_anomalies IS 'Detecta anomalias de custo em pipelines';

