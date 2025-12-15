-- WE Academy - Sistema de Rastreamento de Eventos
-- Criado em: 2024-10-20

-- Tabela de eventos
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    page_url TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON public.events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_event ON public.events(user_id, event_name);

-- Índice GIN para busca eficiente em metadata
CREATE INDEX IF NOT EXISTS idx_events_metadata ON public.events USING GIN (metadata);

-- Habilitar RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem inserir seus próprios eventos
CREATE POLICY "Users can insert their own events" ON public.events
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Política: Admins podem ver todos os eventos
CREATE POLICY "Admins can view all events" ON public.events
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Política: Usuários podem ver seus próprios eventos
CREATE POLICY "Users can view their own events" ON public.events
    FOR SELECT USING (auth.uid() = user_id);

-- Função para criar evento
CREATE OR REPLACE FUNCTION public.track_event(
    event_name TEXT,
    event_metadata JSONB DEFAULT '{}'::JSONB,
    page_url TEXT DEFAULT NULL,
    user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
    current_user_id UUID;
BEGIN
    -- Obter ID do usuário atual
    current_user_id := auth.uid();
    
    -- Inserir evento
    INSERT INTO public.events (
        user_id,
        event_name,
        metadata,
        page_url,
        user_agent,
        created_at
    )
    VALUES (
        current_user_id,
        event_name,
        event_metadata,
        page_url,
        user_agent,
        NOW()
    )
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas de eventos
CREATE OR REPLACE FUNCTION public.get_event_stats(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    event_name TEXT,
    event_count BIGINT,
    unique_users BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.event_name,
        COUNT(*) as event_count,
        COUNT(DISTINCT e.user_id) as unique_users
    FROM public.events e
    WHERE 
        (start_date IS NULL OR e.created_at >= start_date)
        AND (end_date IS NULL OR e.created_at <= end_date)
    GROUP BY e.event_name
    ORDER BY event_count DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter eventos por data
CREATE OR REPLACE FUNCTION public.get_events_by_date(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    date DATE,
    event_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(e.created_at) as date,
        COUNT(*) as event_count
    FROM public.events e
    WHERE 
        (start_date IS NULL OR e.created_at >= start_date)
        AND (end_date IS NULL OR e.created_at <= end_date)
    GROUP BY DATE(e.created_at)
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter eventos por usuário
CREATE OR REPLACE FUNCTION public.get_user_events(
    target_user_id UUID,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    event_name TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.event_name,
        e.metadata,
        e.created_at
    FROM public.events e
    WHERE e.user_id = target_user_id
    ORDER BY e.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter eventos recentes
CREATE OR REPLACE FUNCTION public.get_recent_events(
    limit_count INTEGER DEFAULT 100,
    event_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email TEXT,
    event_name TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.user_id,
        p.email as user_email,
        e.event_name,
        e.metadata,
        e.created_at
    FROM public.events e
    LEFT JOIN public.profiles p ON e.user_id = p.id
    WHERE (event_filter IS NULL OR e.event_name = event_filter)
    ORDER BY e.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar eventos antigos (manutenção)
CREATE OR REPLACE FUNCTION public.cleanup_old_events(
    days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.events
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
