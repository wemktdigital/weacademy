-- WE Academy - Sistema de Turmas (Cohorts)
-- Migration: 20241020000010_cohorts.sql

-- Tabela de turmas (cohorts)
CREATE TABLE IF NOT EXISTS public.cohorts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 50,
    enrolled_count INTEGER DEFAULT 0,
    price_override DECIMAL(10,2), -- Preço específico da turma (sobrescreve preço do curso)
    instructor_notes TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (end_date >= start_date),
    CONSTRAINT valid_capacity CHECK (capacity > 0 AND capacity <= 1000)
);

-- Tabela de lista de espera
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cohort_id UUID REFERENCES public.cohorts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL,
    notified_at TIMESTAMP WITH TIME ZONE,
    enrolled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cohort_id, user_id)
);

-- Adicionar cohort_id na tabela de enrollments
ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'refunded'));

-- Comentários
COMMENT ON TABLE public.cohorts IS 'Turmas de cursos com datas específicas';
COMMENT ON TABLE public.waitlist IS 'Lista de espera para turmas lotadas';
COMMENT ON COLUMN public.cohorts.price_override IS 'Preço específico da turma (null = usa preço do curso)';
COMMENT ON COLUMN public.waitlist.position IS 'Posição na lista de espera';
COMMENT ON COLUMN public.enrollments.cohort_id IS 'Turma específica da inscrição';
COMMENT ON COLUMN public.enrollments.status IS 'Status da inscrição';

-- Índices
CREATE INDEX IF NOT EXISTS idx_cohorts_course ON public.cohorts(course_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_status ON public.cohorts(status);
CREATE INDEX IF NOT EXISTS idx_cohorts_dates ON public.cohorts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_cohort ON public.waitlist(cohort_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON public.waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON public.waitlist(position);
CREATE INDEX IF NOT EXISTS idx_enrollments_cohort ON public.enrollments(cohort_id);

-- Triggers
DROP TRIGGER IF EXISTS update_cohorts_updated_at ON public.cohorts;
CREATE TRIGGER update_cohorts_updated_at 
    BEFORE UPDATE ON public.cohorts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Políticas para cohorts
DROP POLICY IF EXISTS "Anyone can view open cohorts" ON public.cohorts;
CREATE POLICY "Anyone can view open cohorts"
    ON public.cohorts FOR SELECT 
    USING (status IN ('open', 'closed', 'completed'));

DROP POLICY IF EXISTS "Instructors can manage cohorts of their courses" ON public.cohorts;
CREATE POLICY "Instructors can manage cohorts of their courses"
    ON public.cohorts FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.courses 
            WHERE courses.id = cohorts.course_id 
            AND courses.instructor_id = auth.uid()
        )
    );

-- Políticas para waitlist
DROP POLICY IF EXISTS "Users can view their own waitlist entries" ON public.waitlist;
CREATE POLICY "Users can view their own waitlist entries"
    ON public.waitlist FOR SELECT 
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can add themselves to waitlist" ON public.waitlist;
CREATE POLICY "Users can add themselves to waitlist"
    ON public.waitlist FOR INSERT 
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove themselves from waitlist" ON public.waitlist;
CREATE POLICY "Users can remove themselves from waitlist"
    ON public.waitlist FOR DELETE 
    USING (user_id = auth.uid());

-- Função para atualizar enrolled_count automaticamente
CREATE OR REPLACE FUNCTION update_cohort_enrolled_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.cohorts 
        SET enrolled_count = enrolled_count + 1 
        WHERE id = NEW.cohort_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.cohorts 
        SET enrolled_count = enrolled_count - 1 
        WHERE id = OLD.cohort_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para INSERT (quando cohort_id não é null)
DROP TRIGGER IF EXISTS update_enrolled_count_on_insert ON public.enrollments;
CREATE TRIGGER update_enrolled_count_on_insert
    AFTER INSERT ON public.enrollments
    FOR EACH ROW 
    WHEN (NEW.cohort_id IS NOT NULL)
    EXECUTE FUNCTION update_cohort_enrolled_count();

-- Trigger para DELETE (quando cohort_id não é null)
DROP TRIGGER IF EXISTS update_enrolled_count_on_delete ON public.enrollments;
CREATE TRIGGER update_enrolled_count_on_delete
    AFTER DELETE ON public.enrollments
    FOR EACH ROW 
    WHEN (OLD.cohort_id IS NOT NULL)
    EXECUTE FUNCTION update_cohort_enrolled_count();

-- Função para gerenciar lista de espera automaticamente
CREATE OR REPLACE FUNCTION manage_waitlist()
RETURNS TRIGGER AS $$
DECLARE
    next_waitlist_entry RECORD;
    cohort_capacity INTEGER;
    current_enrolled INTEGER;
BEGIN
    -- Se uma inscrição foi deletada ou cancelada
    IF TG_OP = 'UPDATE' AND NEW.status IN ('cancelled', 'refunded') AND OLD.status = 'active' THEN
        SELECT capacity, enrolled_count 
        INTO cohort_capacity, current_enrolled
        FROM public.cohorts 
        WHERE id = NEW.cohort_id;
        
        -- Se há espaço vago
        IF current_enrolled < cohort_capacity THEN
            -- Pegar próximo da lista de espera
            SELECT * INTO next_waitlist_entry
            FROM public.waitlist
            WHERE cohort_id = NEW.cohort_id
            AND enrolled_at IS NULL
            ORDER BY position ASC
            LIMIT 1;
            
            -- Se encontrou alguém
            IF FOUND THEN
                -- Criar notificação
                INSERT INTO public.notifications (user_id, message, read)
                VALUES (
                    next_waitlist_entry.user_id,
                    'Uma vaga está disponível na turma!',
                    false
                );
                
                -- Atualizar waitlist
                UPDATE public.waitlist
                SET notified_at = NOW()
                WHERE id = next_waitlist_entry.id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para gerenciar lista de espera
DROP TRIGGER IF EXISTS manage_waitlist_on_enrollment_change ON public.enrollments;
CREATE TRIGGER manage_waitlist_on_enrollment_change
    AFTER UPDATE ON public.enrollments
    FOR EACH ROW
    WHEN (NEW.cohort_id IS NOT NULL)
    EXECUTE FUNCTION manage_waitlist();
