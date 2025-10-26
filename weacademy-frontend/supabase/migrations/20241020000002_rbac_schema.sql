-- WE Academy - RBAC Schema Update
-- Criado em: 2024-10-20

-- Atualizar tabela profiles para incluir roles simplificados
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'user', 'guest'));

-- Atualizar valores existentes para usar os novos roles
UPDATE public.profiles 
SET role = 'user' 
WHERE role = 'student';

UPDATE public.profiles 
SET role = 'admin' 
WHERE role = 'instructor' AND email = 'admin@weacademy.com';

UPDATE public.profiles 
SET role = 'user' 
WHERE role = 'instructor';

-- Criar função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para verificar se usuário é user ou admin
CREATE OR REPLACE FUNCTION public.is_user_or_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role IN ('user', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar políticas RLS para usar as novas funções
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Políticas para perfis com RBAC
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.is_admin(auth.uid()));

-- Políticas para cursos com RBAC
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can view their own courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can insert their own courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can update their own courses" ON public.courses;

CREATE POLICY "Anyone can view published courses" ON public.courses
    FOR SELECT USING (is_published = true);

CREATE POLICY "Users can view their own courses" ON public.courses
    FOR SELECT USING (instructor_id = auth.uid());

CREATE POLICY "Admins can view all courses" ON public.courses
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can insert courses" ON public.courses
    FOR INSERT WITH CHECK (
        public.is_user_or_admin(auth.uid()) AND 
        instructor_id = auth.uid()
    );

CREATE POLICY "Users can update their own courses" ON public.courses
    FOR UPDATE USING (
        instructor_id = auth.uid() OR 
        public.is_admin(auth.uid())
    );

-- Políticas para inscrições com RBAC
DROP POLICY IF EXISTS "Users can view their own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can enroll in courses" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update their own enrollments" ON public.enrollments;

CREATE POLICY "Users can view their own enrollments" ON public.enrollments
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all enrollments" ON public.enrollments
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can enroll in courses" ON public.enrollments
    FOR INSERT WITH CHECK (
        public.is_user_or_admin(auth.uid()) AND 
        user_id = auth.uid()
    );

CREATE POLICY "Users can update their own enrollments" ON public.enrollments
    FOR UPDATE USING (user_id = auth.uid());

-- Criar tabela para logs de ações administrativas
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas para logs administrativos
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin logs" ON public.admin_logs
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert admin logs" ON public.admin_logs
    FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Função para log de ações administrativas
CREATE OR REPLACE FUNCTION public.log_admin_action(
    action_name TEXT,
    target_user UUID DEFAULT NULL,
    action_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.admin_logs (admin_id, action, target_user_id, details)
    VALUES (auth.uid(), action_name, target_user, action_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar role de usuário (apenas admins)
CREATE OR REPLACE FUNCTION public.update_user_role(
    target_user_id UUID,
    new_role TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificar se o usuário atual é admin
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar roles de usuários';
    END IF;
    
    -- Verificar se o role é válido
    IF new_role NOT IN ('admin', 'user', 'guest') THEN
        RAISE EXCEPTION 'Role inválido. Use: admin, user ou guest';
    END IF;
    
    -- Atualizar o role
    UPDATE public.profiles 
    SET role = new_role, updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Log da ação
    PERFORM public.log_admin_action(
        'role_updated',
        target_user_id,
        jsonb_build_object('new_role', new_role, 'old_role', (SELECT role FROM public.profiles WHERE id = target_user_id))
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
