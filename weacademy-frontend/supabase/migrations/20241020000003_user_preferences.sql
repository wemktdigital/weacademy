-- WE Academy - Schema Update para Preferências do Usuário
-- Criado em: 2024-10-20

-- Adicionar colunas de preferências na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"email": true, "push": true, "sms": false}';

-- Criar função para atualizar perfil do usuário
CREATE OR REPLACE FUNCTION public.update_user_profile(
    user_id UUID,
    full_name TEXT DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    theme TEXT DEFAULT NULL,
    preferences JSONB DEFAULT NULL,
    notification_settings JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificar se o usuário existe e tem permissão
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
        RAISE EXCEPTION 'Usuário não encontrado';
    END IF;
    
    -- Atualizar apenas os campos fornecidos
    UPDATE public.profiles 
    SET 
        full_name = COALESCE(update_user_profile.full_name, profiles.full_name),
        bio = COALESCE(update_user_profile.bio, profiles.bio),
        theme = COALESCE(update_user_profile.theme, profiles.theme),
        preferences = COALESCE(update_user_profile.preferences, profiles.preferences),
        notification_settings = COALESCE(update_user_profile.notification_settings, profiles.notification_settings),
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para upload de avatar
CREATE OR REPLACE FUNCTION public.update_user_avatar(
    user_id UUID,
    avatar_url TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificar se o usuário existe
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
        RAISE EXCEPTION 'Usuário não encontrado';
    END IF;
    
    -- Atualizar avatar
    UPDATE public.profiles 
    SET 
        avatar_url = update_user_avatar.avatar_url,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar políticas RLS para permitir atualização de perfil
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Política para admins atualizarem qualquer perfil
CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE USING (public.is_admin(auth.uid()));

-- Criar tabela para logs de mudanças de perfil
CREATE TABLE IF NOT EXISTS public.profile_changes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas para logs de mudanças
ALTER TABLE public.profile_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile changes" ON public.profile_changes
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile changes" ON public.profile_changes
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Função para log de mudanças de perfil
CREATE OR REPLACE FUNCTION public.log_profile_change(
    target_user_id UUID,
    field_name TEXT,
    old_value TEXT DEFAULT NULL,
    new_value TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.profile_changes (user_id, field_name, old_value, new_value)
    VALUES (target_user_id, field_name, old_value, new_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para log automático de mudanças
CREATE OR REPLACE FUNCTION public.profile_change_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Log mudanças de nome
    IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
        PERFORM public.log_profile_change(NEW.id, 'full_name', OLD.full_name, NEW.full_name);
    END IF;
    
    -- Log mudanças de bio
    IF OLD.bio IS DISTINCT FROM NEW.bio THEN
        PERFORM public.log_profile_change(NEW.id, 'bio', OLD.bio, NEW.bio);
    END IF;
    
    -- Log mudanças de tema
    IF OLD.theme IS DISTINCT FROM NEW.theme THEN
        PERFORM public.log_profile_change(NEW.id, 'theme', OLD.theme, NEW.theme);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_change_log_trigger
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profile_change_trigger();
