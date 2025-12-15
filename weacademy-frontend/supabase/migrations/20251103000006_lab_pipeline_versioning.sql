-- Migration: Versionamento de Pipelines
-- Criado em: 2025-11-03
-- Descrição: Sistema de versionamento semântico para pipelines, similar ao Git

-- Tabela de versões de pipelines
CREATE TABLE IF NOT EXISTS public.lab_pipeline_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    
    -- Versionamento semântico (v1.0.0, v1.1.0, v2.0.0)
    version TEXT NOT NULL, -- formato: "v1.0.0", "v1.1.0", "v2.0.0"
    major INTEGER NOT NULL,
    minor INTEGER NOT NULL,
    patch INTEGER NOT NULL,
    
    -- Dados da versão
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL, -- Snapshot completo dos steps
    draft BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    
    -- Metadados
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Changelog e notas
    changelog TEXT, -- Descrição das mudanças nesta versão
    release_notes TEXT, -- Notas de release (para releases importantes)
    
    -- Tags e releases
    is_release BOOLEAN DEFAULT false, -- Se é uma release oficial
    release_tag TEXT, -- Tag da release (ex: "v1.0.0", "stable")
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    
    -- Referência à versão anterior (para histórico)
    previous_version_id UUID REFERENCES public.lab_pipeline_versions(id) ON DELETE SET NULL,
    
    -- Snapshot completo do pipeline (para rollback)
    pipeline_snapshot JSONB NOT NULL, -- Snapshot completo do pipeline nesta versão
    
    -- Constraints
    UNIQUE(pipeline_id, version),
    UNIQUE(pipeline_id, major, minor, patch)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_versions_pipeline_id ON public.lab_pipeline_versions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_versions_version ON public.lab_pipeline_versions(version);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_versions_created_at ON public.lab_pipeline_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_versions_status ON public.lab_pipeline_versions(status);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_versions_is_release ON public.lab_pipeline_versions(is_release) WHERE is_release = true;

-- Tabela de tags de releases
CREATE TABLE IF NOT EXISTS public.lab_pipeline_release_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.lab_pipeline_versions(id) ON DELETE CASCADE,
    
    -- Tag
    tag_name TEXT NOT NULL, -- ex: "v1.0.0", "stable", "beta", "latest"
    tag_type TEXT DEFAULT 'version' CHECK (tag_type IN ('version', 'release', 'custom')),
    
    -- Metadados
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    description TEXT,
    
    -- Constraints
    UNIQUE(pipeline_id, tag_name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_release_tags_pipeline_id ON public.lab_pipeline_release_tags(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_release_tags_version_id ON public.lab_pipeline_release_tags(version_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_release_tags_tag_name ON public.lab_pipeline_release_tags(tag_name);

-- Tabela de histórico de mudanças (audit trail de versões)
CREATE TABLE IF NOT EXISTS public.lab_pipeline_version_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    from_version_id UUID REFERENCES public.lab_pipeline_versions(id) ON DELETE SET NULL,
    to_version_id UUID NOT NULL REFERENCES public.lab_pipeline_versions(id) ON DELETE CASCADE,
    
    -- Tipo de mudança
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'step_added', 'step_removed', 'step_modified', 'rollback')),
    
    -- Detalhes da mudança
    change_description TEXT NOT NULL,
    change_details JSONB, -- Detalhes específicos da mudança
    
    -- Quem fez a mudança
    changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_version_changes_pipeline_id ON public.lab_pipeline_version_changes(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_version_changes_to_version_id ON public.lab_pipeline_version_changes(to_version_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_version_changes_changed_at ON public.lab_pipeline_version_changes(changed_at DESC);

-- Função para validar formato de versão semântica
CREATE OR REPLACE FUNCTION validate_semantic_version(version_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validar formato: v1.0.0, 1.0.0, etc.
    RETURN version_text ~ '^v?(\d+)\.(\d+)\.(\d+)$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para extrair componentes de versão
CREATE OR REPLACE FUNCTION parse_semantic_version(version_text TEXT)
RETURNS TABLE (major INTEGER, minor INTEGER, patch INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CAST(SUBSTRING(version_text FROM '^v?(\d+)') AS INTEGER) as major,
        CAST(SUBSTRING(version_text FROM '\.(\d+)\.') AS INTEGER) as minor,
        CAST(SUBSTRING(version_text FROM '\.(\d+)$') AS INTEGER) as patch;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para obter próxima versão baseada no tipo de mudança
CREATE OR REPLACE FUNCTION get_next_version(
    p_pipeline_id UUID,
    p_change_type TEXT -- 'major', 'minor', 'patch'
)
RETURNS TABLE (major INTEGER, minor INTEGER, patch INTEGER, version TEXT) AS $$
DECLARE
    v_current_version RECORD;
BEGIN
    -- Buscar versão mais recente
    SELECT major, minor, patch
    INTO v_current_version
    FROM public.lab_pipeline_versions
    WHERE pipeline_id = p_pipeline_id
    ORDER BY major DESC, minor DESC, patch DESC
    LIMIT 1;
    
    -- Se não há versão anterior, retornar v1.0.0
    IF v_current_version IS NULL THEN
        RETURN QUERY SELECT 1::INTEGER, 0::INTEGER, 0::INTEGER, 'v1.0.0'::TEXT;
        RETURN;
    END IF;
    
    -- Calcular próxima versão baseado no tipo de mudança
    CASE p_change_type
        WHEN 'major' THEN
            RETURN QUERY SELECT 
                (v_current_version.major + 1)::INTEGER,
                0::INTEGER,
                0::INTEGER,
                ('v' || (v_current_version.major + 1) || '.0.0')::TEXT;
        WHEN 'minor' THEN
            RETURN QUERY SELECT 
                v_current_version.major::INTEGER,
                (v_current_version.minor + 1)::INTEGER,
                0::INTEGER,
                ('v' || v_current_version.major || '.' || (v_current_version.minor + 1) || '.0')::TEXT;
        ELSE -- patch
            RETURN QUERY SELECT 
                v_current_version.major::INTEGER,
                v_current_version.minor::INTEGER,
                (v_current_version.patch + 1)::INTEGER,
                ('v' || v_current_version.major || '.' || v_current_version.minor || '.' || (v_current_version.patch + 1))::TEXT;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Função para criar nova versão
CREATE OR REPLACE FUNCTION create_pipeline_version(
    p_pipeline_id UUID,
    p_version TEXT,
    p_created_by UUID,
    p_changelog TEXT DEFAULT NULL,
    p_release_notes TEXT DEFAULT NULL,
    p_is_release BOOLEAN DEFAULT false,
    p_release_tag TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_version_parts RECORD;
    v_pipeline RECORD;
    v_previous_version_id UUID;
    v_version_id UUID;
BEGIN
    -- Validar formato de versão
    IF NOT validate_semantic_version(p_version) THEN
        RAISE EXCEPTION 'Formato de versão inválido. Use formato semântico (ex: v1.0.0)';
    END IF;
    
    -- Parse versão
    SELECT * INTO v_version_parts FROM parse_semantic_version(p_version);
    
    -- Buscar pipeline atual
    SELECT * INTO v_pipeline
    FROM public.lab_agent_pipelines
    WHERE id = p_pipeline_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pipeline não encontrado';
    END IF;
    
    -- Buscar versão anterior
    SELECT id INTO v_previous_version_id
    FROM public.lab_pipeline_versions
    WHERE pipeline_id = p_pipeline_id
    ORDER BY major DESC, minor DESC, patch DESC
    LIMIT 1;
    
    -- Criar snapshot do pipeline
    -- Criar versão
    INSERT INTO public.lab_pipeline_versions (
        pipeline_id,
        version,
        major,
        minor,
        patch,
        name,
        description,
        steps,
        draft,
        active,
        created_by,
        changelog,
        release_notes,
        is_release,
        release_tag,
        previous_version_id,
        pipeline_snapshot
    ) VALUES (
        p_pipeline_id,
        p_version,
        v_version_parts.major,
        v_version_parts.minor,
        v_version_parts.patch,
        v_pipeline.name,
        v_pipeline.description,
        v_pipeline.steps,
        v_pipeline.draft,
        v_pipeline.active,
        p_created_by,
        p_changelog,
        p_release_notes,
        p_is_release,
        p_release_tag,
        v_previous_version_id,
        row_to_json(v_pipeline)::jsonb
    ) RETURNING id INTO v_version_id;
    
    -- Se é uma release, criar tag
    IF p_is_release AND p_release_tag IS NOT NULL THEN
        INSERT INTO public.lab_pipeline_release_tags (
            pipeline_id,
            version_id,
            tag_name,
            tag_type,
            created_by,
            description
        ) VALUES (
            p_pipeline_id,
            v_version_id,
            p_release_tag,
            'release',
            p_created_by,
            p_release_notes
        ) ON CONFLICT (pipeline_id, tag_name) DO UPDATE SET
            version_id = v_version_id,
            description = p_release_notes;
    END IF;
    
    -- Registrar mudança no histórico
    INSERT INTO public.lab_pipeline_version_changes (
        pipeline_id,
        from_version_id,
        to_version_id,
        change_type,
        change_description,
        changed_by
    ) VALUES (
        p_pipeline_id,
        v_previous_version_id,
        v_version_id,
        'created',
        COALESCE(p_changelog, 'Nova versão ' || p_version),
        p_created_by
    );
    
    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular diff entre versões
CREATE OR REPLACE FUNCTION get_version_diff(
    p_pipeline_id UUID,
    p_from_version TEXT,
    p_to_version TEXT
)
RETURNS TABLE (
    change_type TEXT,
    change_description TEXT,
    change_details JSONB
) AS $$
DECLARE
    v_from_version RECORD;
    v_to_version RECORD;
BEGIN
    -- Buscar versões
    SELECT * INTO v_from_version
    FROM public.lab_pipeline_versions
    WHERE pipeline_id = p_pipeline_id AND version = p_from_version;
    
    SELECT * INTO v_to_version
    FROM public.lab_pipeline_versions
    WHERE pipeline_id = p_pipeline_id AND version = p_to_version;
    
    IF v_from_version IS NULL OR v_to_version IS NULL THEN
        RAISE EXCEPTION 'Uma ou ambas as versões não foram encontradas';
    END IF;
    
    -- Comparar steps (simplificado - em produção, fazer diff mais detalhado)
    -- Por enquanto, retornar diferenças básicas
    RETURN QUERY
    SELECT 
        'steps_changed'::TEXT as change_type,
        'Steps foram modificados'::TEXT as change_description,
        jsonb_build_object(
            'from_steps_count', jsonb_array_length(v_from_version.steps),
            'to_steps_count', jsonb_array_length(v_to_version.steps)
        ) as change_details;
    
    -- Adicionar mais comparações conforme necessário
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_pipeline_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Versões são imutáveis, não atualizamos updated_at
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.lab_pipeline_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_release_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_version_changes ENABLE ROW LEVEL SECURITY;

-- Políticas para versões
DROP POLICY IF EXISTS "Anyone can view published versions" ON public.lab_pipeline_versions;
CREATE POLICY "Anyone can view published versions"
    ON public.lab_pipeline_versions
    FOR SELECT
    USING (status = 'published');

DROP POLICY IF EXISTS "Users can view their own versions" ON public.lab_pipeline_versions;
CREATE POLICY "Users can view their own versions"
    ON public.lab_pipeline_versions
    FOR SELECT
    USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Admins can view all versions" ON public.lab_pipeline_versions;
CREATE POLICY "Admins can view all versions"
    ON public.lab_pipeline_versions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

DROP POLICY IF EXISTS "Users can create versions" ON public.lab_pipeline_versions;
CREATE POLICY "Users can create versions"
    ON public.lab_pipeline_versions
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Políticas para tags
DROP POLICY IF EXISTS "Anyone can view release tags" ON public.lab_pipeline_release_tags;
CREATE POLICY "Anyone can view release tags"
    ON public.lab_pipeline_release_tags
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage release tags" ON public.lab_pipeline_release_tags;
CREATE POLICY "Admins can manage release tags"
    ON public.lab_pipeline_release_tags
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para histórico de mudanças
DROP POLICY IF EXISTS "Anyone can view version changes" ON public.lab_pipeline_version_changes;
CREATE POLICY "Anyone can view version changes"
    ON public.lab_pipeline_version_changes
    FOR SELECT
    USING (true);

-- Comentários
COMMENT ON TABLE public.lab_pipeline_versions IS 'Versões de pipelines com versionamento semântico';
COMMENT ON TABLE public.lab_pipeline_release_tags IS 'Tags de releases para pipelines';
COMMENT ON TABLE public.lab_pipeline_version_changes IS 'Histórico de mudanças entre versões';
COMMENT ON FUNCTION create_pipeline_version IS 'Cria uma nova versão de pipeline com versionamento semântico';
COMMENT ON FUNCTION get_version_diff IS 'Calcula diferenças entre duas versões de pipeline';

