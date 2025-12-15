-- WE Academy - Schema inicial do banco de dados
-- Criado em: 2024-10-20

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de perfis de usuário (estende auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de categorias de cursos
CREATE TABLE public.categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de cursos
CREATE TABLE public.courses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    thumbnail_url TEXT,
    price DECIMAL(10,2) DEFAULT 0,
    is_free BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT false,
    level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    duration_hours INTEGER DEFAULT 0,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    instructor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de módulos (seções do curso)
CREATE TABLE public.modules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de aulas
CREATE TABLE public.lessons (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    video_url TEXT,
    duration_minutes INTEGER DEFAULT 0,
    order_index INTEGER NOT NULL,
    is_preview BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de inscrições de usuários em cursos
CREATE TABLE public.enrollments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    UNIQUE(user_id, course_id)
);

-- Tabela de progresso das aulas
CREATE TABLE public.lesson_progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    watch_time_seconds INTEGER DEFAULT 0,
    UNIQUE(user_id, lesson_id)
);

-- Tabela de avaliações de cursos
CREATE TABLE public.course_reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- Tabela de certificados
CREATE TABLE public.certificates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    certificate_url TEXT,
    UNIQUE(user_id, course_id)
);

-- Tabela de favoritos
CREATE TABLE public.favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- Índices para melhorar performance
CREATE INDEX idx_courses_category ON public.courses(category_id);
CREATE INDEX idx_courses_instructor ON public.courses(instructor_id);
CREATE INDEX idx_courses_published ON public.courses(is_published);
CREATE INDEX idx_modules_course ON public.modules(course_id);
CREATE INDEX idx_lessons_module ON public.lessons(module_id);
CREATE INDEX idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX idx_lesson_progress_user ON public.lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson ON public.lesson_progress(lesson_id);
CREATE INDEX idx_course_reviews_course ON public.course_reviews(course_id);
CREATE INDEX idx_certificates_user ON public.certificates(user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_course_reviews_updated_at BEFORE UPDATE ON public.course_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para criar perfil automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Políticas de segurança (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Políticas para perfis
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Políticas para cursos
CREATE POLICY "Anyone can view published courses" ON public.courses
    FOR SELECT USING (is_published = true);

CREATE POLICY "Instructors can view their own courses" ON public.courses
    FOR SELECT USING (instructor_id = auth.uid());

CREATE POLICY "Instructors can insert their own courses" ON public.courses
    FOR INSERT WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors can update their own courses" ON public.courses
    FOR UPDATE USING (instructor_id = auth.uid());

-- Políticas para módulos
CREATE POLICY "Anyone can view modules of published courses" ON public.modules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.courses 
            WHERE courses.id = modules.course_id 
            AND courses.is_published = true
        )
    );

CREATE POLICY "Instructors can manage modules of their courses" ON public.modules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.courses 
            WHERE courses.id = modules.course_id 
            AND courses.instructor_id = auth.uid()
        )
    );

-- Políticas para aulas
CREATE POLICY "Anyone can view lessons of published courses" ON public.lessons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.modules 
            JOIN public.courses ON courses.id = modules.course_id
            WHERE modules.id = lessons.module_id 
            AND courses.is_published = true
        )
    );

CREATE POLICY "Instructors can manage lessons of their courses" ON public.lessons
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.modules 
            JOIN public.courses ON courses.id = modules.course_id
            WHERE modules.id = lessons.module_id 
            AND courses.instructor_id = auth.uid()
        )
    );

-- Políticas para inscrições
CREATE POLICY "Users can view their own enrollments" ON public.enrollments
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can enroll in courses" ON public.enrollments
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own enrollments" ON public.enrollments
    FOR UPDATE USING (user_id = auth.uid());

-- Políticas para progresso das aulas
CREATE POLICY "Users can view their own lesson progress" ON public.lesson_progress
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own lesson progress" ON public.lesson_progress
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own lesson progress" ON public.lesson_progress
    FOR UPDATE USING (user_id = auth.uid());

-- Políticas para avaliações
CREATE POLICY "Anyone can view course reviews" ON public.course_reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own reviews" ON public.course_reviews
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reviews" ON public.course_reviews
    FOR UPDATE USING (user_id = auth.uid());

-- Políticas para certificados
CREATE POLICY "Users can view their own certificates" ON public.certificates
    FOR SELECT USING (user_id = auth.uid());

-- Políticas para favoritos
CREATE POLICY "Users can view their own favorites" ON public.favorites
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own favorites" ON public.favorites
    FOR ALL USING (user_id = auth.uid());
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
-- Fix user trigger to use correct default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
