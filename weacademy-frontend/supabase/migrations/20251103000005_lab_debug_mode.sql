-- Migration: Debug Mode para Pipelines
-- Criado em: 2025-11-03
-- Descrição: Sistema de debug mode para execução passo a passo de pipelines

-- Tabela de sessões de debug
CREATE TABLE IF NOT EXISTS public.lab_pipeline_debug_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Estado da sessão
    status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'stopped', 'completed', 'error')),
    current_step_order INTEGER NOT NULL DEFAULT 0,
    
    -- Contexto da execução
    input_messages JSONB NOT NULL,
    context_state JSONB NOT NULL DEFAULT '{}'::jsonb, -- Estado acumulado do contexto
    variable_context JSONB NOT NULL DEFAULT '{}'::jsonb, -- Variáveis acumuladas
    
    -- Histórico de steps executados
    executed_steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{order, agent_id, input, output, context_before, context_after}]
    
    -- Configuração
    breakpoints JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{step_order, enabled, condition}]
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Resultado final (se completado)
    final_output TEXT,
    total_latency_ms INTEGER,
    total_cost_usd DECIMAL(10, 6)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_debug_sessions_pipeline_id ON public.lab_pipeline_debug_sessions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_debug_sessions_user_id ON public.lab_pipeline_debug_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_debug_sessions_status ON public.lab_pipeline_debug_sessions(status);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_debug_sessions_created_at ON public.lab_pipeline_debug_sessions(created_at DESC);

-- Tabela de snapshots de estado
CREATE TABLE IF NOT EXISTS public.lab_pipeline_debug_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debug_session_id UUID NOT NULL REFERENCES public.lab_pipeline_debug_sessions(id) ON DELETE CASCADE,
    
    -- Estado do snapshot
    step_order INTEGER NOT NULL,
    context_state JSONB NOT NULL,
    variable_context JSONB NOT NULL,
    executed_steps JSONB NOT NULL,
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT -- Notas do usuário sobre este snapshot
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_debug_snapshots_session_id ON public.lab_pipeline_debug_snapshots(debug_session_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_debug_snapshots_step_order ON public.lab_pipeline_debug_snapshots(step_order);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_debug_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lab_debug_sessions_updated_at
    BEFORE UPDATE ON public.lab_pipeline_debug_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_debug_sessions_updated_at();

-- Função para criar snapshot
CREATE OR REPLACE FUNCTION create_debug_snapshot(
    p_session_id UUID,
    p_step_order INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_session RECORD;
    v_snapshot_id UUID;
BEGIN
    -- Buscar estado atual da sessão
    SELECT context_state, variable_context, executed_steps
    INTO v_session
    FROM public.lab_pipeline_debug_sessions
    WHERE id = p_session_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Debug session not found';
    END IF;
    
    -- Criar snapshot
    INSERT INTO public.lab_pipeline_debug_snapshots (
        debug_session_id,
        step_order,
        context_state,
        variable_context,
        executed_steps,
        notes
    ) VALUES (
        p_session_id,
        p_step_order,
        v_session.context_state,
        v_session.variable_context,
        v_session.executed_steps,
        p_notes
    ) RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.lab_pipeline_debug_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_debug_snapshots ENABLE ROW LEVEL SECURITY;

-- Políticas para debug sessions
CREATE POLICY "Users can manage their own debug sessions"
    ON public.lab_pipeline_debug_sessions
    FOR ALL
    USING (auth.uid() = user_id);

-- Admins podem ver todas as sessões
CREATE POLICY "Admins can view all debug sessions"
    ON public.lab_pipeline_debug_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para snapshots
CREATE POLICY "Users can manage snapshots of their sessions"
    ON public.lab_pipeline_debug_snapshots
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.lab_pipeline_debug_sessions
            WHERE lab_pipeline_debug_sessions.id = lab_pipeline_debug_snapshots.debug_session_id
            AND lab_pipeline_debug_sessions.user_id = auth.uid()
        )
    );

-- Comentários
COMMENT ON TABLE public.lab_pipeline_debug_sessions IS 'Sessões de debug mode para execução passo a passo de pipelines';
COMMENT ON TABLE public.lab_pipeline_debug_snapshots IS 'Snapshots de estado para rollback em debug mode';
COMMENT ON FUNCTION create_debug_snapshot IS 'Cria snapshot do estado atual de uma sessão de debug';

