-- Migration: Pipeline API Keys
-- Criado em: 2025-11-03
-- Descrição: Sistema de API keys para acesso público aos pipelines

-- Tabela de API keys
CREATE TABLE IF NOT EXISTS public.lab_pipeline_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    
    -- Informações da API key
    name TEXT NOT NULL, -- Nome descritivo da API key
    key_hash TEXT NOT NULL UNIQUE, -- Hash da API key (SHA-256)
    api_key TEXT NOT NULL UNIQUE, -- API key completa (formato: wak_xxx) - apenas no momento da criação
    prefix TEXT NOT NULL, -- Prefixo da key (wak_) para identificação
    
    -- Configurações de rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60, -- Requests por minuto
    rate_limit_per_hour INTEGER DEFAULT 1000, -- Requests por hora
    rate_limit_per_day INTEGER DEFAULT 10000, -- Requests por dia
    
    -- Status
    enabled BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ, -- Data de expiração (opcional)
    
    -- Metadados
    last_used_at TIMESTAMPTZ,
    total_requests INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_rate_limits CHECK (
        rate_limit_per_minute > 0 AND
        rate_limit_per_hour > 0 AND
        rate_limit_per_day > 0 AND
        rate_limit_per_minute <= rate_limit_per_hour AND
        rate_limit_per_hour <= rate_limit_per_day
    )
);

-- Tabela de uso de API (para rate limiting e métricas)
CREATE TABLE IF NOT EXISTS public.lab_pipeline_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES public.lab_pipeline_api_keys(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES public.lab_agent_pipelines(id) ON DELETE CASCADE,
    
    -- Detalhes da requisição
    request_method TEXT NOT NULL,
    request_path TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_time_ms INTEGER,
    tokens_used INTEGER, -- Tokens consumidos (se disponível)
    cost_usd DECIMAL(10, 6), -- Custo da execução
    
    -- Informações do cliente
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_api_keys_user_id ON public.lab_pipeline_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_api_keys_pipeline_id ON public.lab_pipeline_api_keys(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_api_keys_key_hash ON public.lab_pipeline_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_api_keys_enabled ON public.lab_pipeline_api_keys(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_api_keys_expires_at ON public.lab_pipeline_api_keys(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_pipeline_api_usage_api_key_id ON public.lab_pipeline_api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_api_usage_pipeline_id ON public.lab_pipeline_api_usage(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_api_usage_created_at ON public.lab_pipeline_api_usage(created_at DESC);
-- Nota: Índices funcionais por hora/dia foram removidos devido a limitações do PostgreSQL
-- O índice em created_at DESC já cobre a maioria das queries de período
-- Se necessário, índices específicos podem ser criados posteriormente usando expressões imutáveis

-- Função para gerar API key
CREATE OR REPLACE FUNCTION generate_api_key(prefix TEXT DEFAULT 'wak_')
RETURNS TEXT AS $$
DECLARE
    random_part TEXT;
    full_key TEXT;
BEGIN
    -- Gerar parte aleatória (24 bytes em base64, limpo para URL-safe)
    SELECT translate(encode(gen_random_bytes(24), 'base64'), '+/=', '0A1')
    INTO random_part;
    
    full_key := prefix || random_part;
    RETURN full_key;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular hash de API key
CREATE OR REPLACE FUNCTION hash_api_key(api_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(api_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_pipeline_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lab_pipeline_api_keys_updated_at ON public.lab_pipeline_api_keys;
CREATE TRIGGER update_lab_pipeline_api_keys_updated_at
    BEFORE UPDATE ON public.lab_pipeline_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_pipeline_api_keys_updated_at();

-- RLS Policies
ALTER TABLE public.lab_pipeline_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pipeline_api_usage ENABLE ROW LEVEL SECURITY;

-- Políticas para lab_pipeline_api_keys
-- Usuários podem ver suas próprias API keys
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.lab_pipeline_api_keys;
CREATE POLICY "Users can view their own API keys"
    ON public.lab_pipeline_api_keys
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins podem ver todas as API keys
DROP POLICY IF EXISTS "Admins can view all API keys" ON public.lab_pipeline_api_keys;
CREATE POLICY "Admins can view all API keys"
    ON public.lab_pipeline_api_keys
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Usuários podem criar suas próprias API keys
DROP POLICY IF EXISTS "Users can create their own API keys" ON public.lab_pipeline_api_keys;
CREATE POLICY "Users can create their own API keys"
    ON public.lab_pipeline_api_keys
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias API keys
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.lab_pipeline_api_keys;
CREATE POLICY "Users can update their own API keys"
    ON public.lab_pipeline_api_keys
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Usuários podem deletar suas próprias API keys
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.lab_pipeline_api_keys;
CREATE POLICY "Users can delete their own API keys"
    ON public.lab_pipeline_api_keys
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins podem gerenciar todas as API keys
DROP POLICY IF EXISTS "Admins can manage all API keys" ON public.lab_pipeline_api_keys;
CREATE POLICY "Admins can manage all API keys"
    ON public.lab_pipeline_api_keys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_pipeline_api_usage
-- Usuários podem ver uso de suas próprias API keys
DROP POLICY IF EXISTS "Users can view usage of their API keys" ON public.lab_pipeline_api_usage;
CREATE POLICY "Users can view usage of their API keys"
    ON public.lab_pipeline_api_usage
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.lab_pipeline_api_keys
            WHERE lab_pipeline_api_keys.id = lab_pipeline_api_usage.api_key_id
            AND lab_pipeline_api_keys.user_id = auth.uid()
        )
    );

-- Admins podem ver todo o uso
DROP POLICY IF EXISTS "Admins can view all API usage" ON public.lab_pipeline_api_usage;
CREATE POLICY "Admins can view all API usage"
    ON public.lab_pipeline_api_usage
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Política especial: permitir inserção sem autenticação (para tracking de uso via API key)
-- Isso será feito via service role no backend

-- Comentários nas tabelas
COMMENT ON TABLE public.lab_pipeline_api_keys IS 'API keys para acesso público aos pipelines';
COMMENT ON TABLE public.lab_pipeline_api_usage IS 'Histórico de uso de APIs para rate limiting e métricas';

COMMENT ON COLUMN public.lab_pipeline_api_keys.key_hash IS 'Hash SHA-256 da API key (para validação segura)';
COMMENT ON COLUMN public.lab_pipeline_api_keys.api_key IS 'API key completa (apenas exibida na criação)';
