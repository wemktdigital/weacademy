-- WE Academy - Sistema de Auditoria
-- Criado em: 2024-10-20

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name TEXT NOT NULL,
    row_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_table ON public.audit_logs(user_id, table_name);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem ver logs de auditoria
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Política: Sistema pode inserir logs (via trigger)
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- Função genérica para criar logs de auditoria
CREATE OR REPLACE FUNCTION public.create_audit_log(
    action_type TEXT,
    table_name TEXT,
    row_id UUID,
    old_data JSONB DEFAULT NULL,
    new_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
    current_user_id UUID;
BEGIN
    -- Obter ID do usuário atual
    current_user_id := auth.uid();
    
    -- Inserir log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        row_id,
        old_data,
        new_data,
        created_at
    )
    VALUES (
        current_user_id,
        action_type,
        table_name,
        row_id,
        old_data,
        new_data,
        NOW()
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar trigger de auditoria para uma tabela
CREATE OR REPLACE FUNCTION public.create_audit_trigger(table_schema TEXT, table_name TEXT)
RETURNS void AS $$
DECLARE
    trigger_name TEXT;
BEGIN
    trigger_name := 'audit_trigger_' || table_name;
    
    -- Remover trigger existente se houver
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', trigger_name, table_schema, table_name);
    
    -- Criar trigger para INSERT
    EXECUTE format('
        CREATE TRIGGER %I
        AFTER INSERT ON %I.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_audit_insert()',
        trigger_name || '_insert', table_schema, table_name
    );
    
    -- Criar trigger para UPDATE
    EXECUTE format('
        CREATE TRIGGER %I
        AFTER UPDATE ON %I.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_audit_update()',
        trigger_name || '_update', table_schema, table_name
    );
    
    -- Criar trigger para DELETE
    EXECUTE format('
        CREATE TRIGGER %I
        AFTER DELETE ON %I.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_audit_delete()',
        trigger_name || '_delete', table_schema, table_name
    );
END;
$$ LANGUAGE plpgsql;

-- Função para tratar INSERT
CREATE OR REPLACE FUNCTION public.handle_audit_insert()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_audit_log(
        'INSERT',
        TG_TABLE_NAME,
        NEW.id,
        NULL,
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para tratar UPDATE
CREATE OR REPLACE FUNCTION public.handle_audit_update()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_audit_log(
        'UPDATE',
        TG_TABLE_NAME,
        NEW.id,
        to_jsonb(OLD),
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para tratar DELETE
CREATE OR REPLACE FUNCTION public.handle_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_audit_log(
        'DELETE',
        TG_TABLE_NAME,
        OLD.id,
        to_jsonb(OLD),
        NULL
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers de auditoria para tabelas importantes
DO $$
BEGIN
    -- Perfis
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        PERFORM public.create_audit_trigger('public', 'profiles');
    END IF;
    
    -- Cursos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'courses') THEN
        PERFORM public.create_audit_trigger('public', 'courses');
    END IF;
    
    -- Notificações
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        PERFORM public.create_audit_trigger('public', 'notifications');
    END IF;
    
    -- Matrículas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrollments') THEN
        PERFORM public.create_audit_trigger('public', 'enrollments');
    END IF;
END $$;

-- Função para obter logs de auditoria com filtros
CREATE OR REPLACE FUNCTION public.get_audit_logs(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_user_id UUID DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_table_name TEXT DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    action TEXT,
    table_name TEXT,
    row_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.user_id,
        p.email as user_email,
        p.full_name as user_name,
        al.action,
        al.table_name,
        al.row_id,
        al.old_data,
        al.new_data,
        al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.profiles p ON al.user_id = p.id
    WHERE 
        (p_user_id IS NULL OR al.user_id = p_user_id)
        AND (p_action IS NULL OR al.action = p_action)
        AND (p_table_name IS NULL OR al.table_name = p_table_name)
        AND (p_start_date IS NULL OR al.created_at >= p_start_date)
        AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para contar logs de auditoria
CREATE OR REPLACE FUNCTION public.count_audit_logs(
    p_user_id UUID DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_table_name TEXT DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO count_result
    FROM public.audit_logs
    WHERE 
        (p_user_id IS NULL OR user_id = p_user_id)
        AND (p_action IS NULL OR action = p_action)
        AND (p_table_name IS NULL OR table_name = p_table_name)
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date);
    
    RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View para facilitar a visualização dos logs
CREATE OR REPLACE VIEW public.audit_logs_view AS
SELECT 
    al.id,
    al.user_id,
    p.email as user_email,
    p.full_name as user_name,
    al.action,
    al.table_name,
    al.row_id,
    al.created_at,
    CASE 
        WHEN al.action = 'INSERT' THEN 'Criado'
        WHEN al.action = 'UPDATE' THEN 'Atualizado'
        WHEN al.action = 'DELETE' THEN 'Excluído'
        ELSE al.action
    END as action_label,
    CASE
        WHEN al.table_name = 'profiles' THEN 'Perfis'
        WHEN al.table_name = 'courses' THEN 'Cursos'
        WHEN al.table_name = 'notifications' THEN 'Notificações'
        WHEN al.table_name = 'enrollments' THEN 'Matrículas'
        ELSE al.table_name
    END as table_label
FROM public.audit_logs al
LEFT JOIN public.profiles p ON al.user_id = p.id;

-- Conceder permissões de visualização
GRANT SELECT ON public.audit_logs_view TO authenticated;
