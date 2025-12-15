-- WE Academy - Sistema de Notificações
-- Criado em: 2024-10-20

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = FALSE;

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas suas próprias notificações
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Política: Usuários podem atualizar suas próprias notificações (marcar como lidas)
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Política: Sistema pode inserir notificações (via trigger ou função)
CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- Política: Admins podem ver todas as notificações
CREATE POLICY "Admins can view all notifications" ON public.notifications
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Função para obter contagem de notificações não lidas
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.notifications
        WHERE user_id = user_uuid AND read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar notificação como lida
CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    notification_user_id UUID;
BEGIN
    -- Obter user_id da notificação
    SELECT user_id INTO notification_user_id
    FROM public.notifications
    WHERE id = notification_id;
    
    -- Verificar se a notificação pertence ao usuário autenticado
    IF notification_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Notificação não encontrada ou sem permissão';
    END IF;
    
    -- Marcar como lida
    UPDATE public.notifications
    SET read = TRUE, updated_at = NOW()
    WHERE id = notification_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar todas as notificações como lidas
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET read = TRUE, updated_at = NOW()
    WHERE user_id = user_uuid AND read = FALSE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar notificações do sistema
CREATE OR REPLACE FUNCTION public.create_notification(
    target_user_id UUID,
    notification_title TEXT,
    notification_message TEXT,
    notification_type TEXT DEFAULT 'info'
)
RETURNS UUID AS $$
DECLARE
    new_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (target_user_id, notification_title, notification_message, notification_type)
    RETURNING id INTO new_notification_id;
    
    RETURN new_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_updated_at_trigger
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_notification_updated_at();

-- Inserir notificações de exemplo para teste
-- (será executado apenas se a tabela estiver vazia)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.notifications LIMIT 1) THEN
        -- Notificações de exemplo para demonstrar o sistema
        INSERT INTO public.notifications (user_id, title, message, type, read)
        SELECT 
            id,
            'Bem-vindo à WE Academy! 🎉',
            'Explore nossos cursos e comece sua jornada de aprendizado.',
            'success',
            FALSE
        FROM public.profiles
        LIMIT 1;
        
        INSERT INTO public.notifications (user_id, title, message, type, read)
        SELECT 
            id,
            'Novo curso disponível! 📚',
            'Marketing Médico Digital foi adicionado aos cursos.',
            'info',
            FALSE
        FROM public.profiles
        LIMIT 1;
    END IF;
END $$;
