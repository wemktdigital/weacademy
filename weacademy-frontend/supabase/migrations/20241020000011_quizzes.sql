-- WE Academy - Sistema de Quizzes
-- Migration: 20241020000011_quizzes.sql

-- Tabela de quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    passing_score INTEGER DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
    allow_retake BOOLEAN DEFAULT true,
    max_attempts INTEGER DEFAULT 3 CHECK (max_attempts > 0),
    time_limit_minutes INTEGER DEFAULT 30 CHECK (time_limit_minutes >= 0),
    show_results BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de questões
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer')),
    points INTEGER DEFAULT 1 CHECK (points > 0),
    explanation TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de opções de questões
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de tentativas de quiz
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    passed BOOLEAN DEFAULT false,
    time_taken_seconds INTEGER DEFAULT 0,
    answers JSONB DEFAULT '{}'::jsonb, -- Respostas do usuário {question_id: [option_ids]}
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentários
COMMENT ON TABLE public.quizzes IS 'Quizzes associados a lições';
COMMENT ON TABLE public.questions IS 'Questões de quizzes';
COMMENT ON TABLE public.question_options IS 'Opções de resposta para questões';
COMMENT ON TABLE public.quiz_attempts IS 'Tentativas de quizzes pelos alunos';
COMMENT ON COLUMN public.quizzes.passing_score IS 'Nota mínima para aprovação (0-100)';
COMMENT ON COLUMN public.quizzes.max_attempts IS 'Número máximo de tentativas permitidas';
COMMENT ON COLUMN public.quiz_attempts.answers IS 'JSON com respostas: {question_id: [option_ids]}';

-- Índices
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON public.quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_order ON public.questions(order_index);
CREATE INDEX IF NOT EXISTS idx_question_options_question ON public.question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_question_options_order ON public.question_options(order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_submitted ON public.quiz_attempts(submitted_at);

-- Triggers
DROP TRIGGER IF EXISTS update_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER update_quizzes_updated_at 
    BEFORE UPDATE ON public.quizzes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_questions_updated_at ON public.questions;
CREATE TRIGGER update_questions_updated_at 
    BEFORE UPDATE ON public.questions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular score automaticamente
CREATE OR REPLACE FUNCTION calculate_quiz_score(
    p_quiz_id UUID,
    p_answers JSONB
)
RETURNS INTEGER AS $$
DECLARE
    total_points INTEGER := 0;
    earned_points INTEGER := 0;
    question_record RECORD;
    user_option_ids UUID[];
    correct_option_ids UUID[];
    all_correct BOOLEAN;
BEGIN
    -- Iterar por todas as questões do quiz
    FOR question_record IN 
        SELECT q.*, json_agg(qo.id ORDER BY qo.order_index) as correct_options
        FROM public.questions q
        LEFT JOIN public.question_options qo ON qo.question_id = q.id AND qo.is_correct = true
        WHERE q.quiz_id = p_quiz_id
        GROUP BY q.id
    LOOP
        -- Adicionar pontos da questão ao total
        total_points := total_points + question_record.points;
        
        -- Pegar IDs das opções do usuário para esta questão
        SELECT COALESCE(array_agg(value::uuid), ARRAY[]::UUID[]) 
        INTO user_option_ids
        FROM jsonb_array_elements_text(p_answers->question_record.id::text);
        
        -- Pegar IDs das opções corretas
        SELECT COALESCE(
            json_agg(value::uuid) FILTER (WHERE value IS NOT NULL), 
            ARRAY[]::UUID[]
        )
        INTO correct_option_ids
        FROM jsonb_array_elements(question_record.correct_options);
        
        -- Verificar se respondeu corretamente
        IF question_record.type = 'multiple_choice' THEN
            -- Para múltipla escolha, todas as opções devem estar corretas e nenhuma incorreta
            all_correct := (
                array_length(user_option_ids, 1) = array_length(correct_option_ids, 1)
                AND NOT EXISTS (
                    SELECT 1 FROM unnest(user_option_ids) AS user_option
                    WHERE user_option != ALL(correct_option_ids)
                )
            );
        ELSE
            -- Para escolha única e verdadeiro/falso
            all_correct := (
                array_length(user_option_ids, 1) = 1
                AND user_option_ids[1] = correct_option_ids[1]
            );
        END IF;
        
        -- Se correto, adicionar pontos
        IF all_correct THEN
            earned_points := earned_points + question_record.points;
        END IF;
    END LOOP;
    
    -- Retornar percentual
    IF total_points = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((earned_points::DECIMAL / total_points::DECIMAL) * 100);
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Políticas para quizzes
DROP POLICY IF EXISTS "Anyone can view quizzes of published courses" ON public.quizzes;
CREATE POLICY "Anyone can view quizzes of published courses"
    ON public.quizzes FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.lessons l
            JOIN public.modules m ON m.id = l.module_id
            JOIN public.courses c ON c.id = m.course_id
            WHERE l.id = quizzes.lesson_id
            AND c.is_published = true
        )
    );

DROP POLICY IF EXISTS "Instructors can manage quizzes of their courses" ON public.quizzes;
CREATE POLICY "Instructors can manage quizzes of their courses"
    ON public.quizzes FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.lessons l
            JOIN public.modules m ON m.id = l.module_id
            JOIN public.courses c ON c.id = m.course_id
            WHERE l.id = quizzes.lesson_id
            AND c.instructor_id = auth.uid()
        )
    );

-- Políticas para questions
DROP POLICY IF EXISTS "Anyone can view questions of published courses" ON public.questions;
CREATE POLICY "Anyone can view questions of published courses"
    ON public.questions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            JOIN public.lessons l ON l.id = q.lesson_id
            JOIN public.modules m ON m.id = l.module_id
            JOIN public.courses c ON c.id = m.course_id
            WHERE q.id = questions.quiz_id
            AND c.is_published = true
        )
    );

DROP POLICY IF EXISTS "Instructors can manage questions" ON public.questions;
CREATE POLICY "Instructors can manage questions"
    ON public.questions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            JOIN public.lessons l ON l.id = q.lesson_id
            JOIN public.modules m ON m.id = l.module_id
            JOIN public.courses c ON c.id = m.course_id
            WHERE q.id = questions.quiz_id
            AND c.instructor_id = auth.uid()
        )
    );

-- Políticas para question_options
DROP POLICY IF EXISTS "Anyone can view question options" ON public.question_options;
CREATE POLICY "Anyone can view question options"
    ON public.question_options FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            WHERE q.id = question_options.question_id
        )
    );

DROP POLICY IF EXISTS "Instructors can manage question options" ON public.question_options;
CREATE POLICY "Instructors can manage question options"
    ON public.question_options FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            JOIN public.quizzes qz ON qz.id = q.quiz_id
            JOIN public.lessons l ON l.id = qz.lesson_id
            JOIN public.modules m ON m.id = l.module_id
            JOIN public.courses c ON c.id = m.course_id
            WHERE q.id = question_options.question_id
            AND c.instructor_id = auth.uid()
        )
    );

-- Políticas para quiz_attempts
DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view their own quiz attempts"
    ON public.quiz_attempts FOR SELECT 
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can submit quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can submit quiz attempts"
    ON public.quiz_attempts FOR INSERT 
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can update their own quiz attempts"
    ON public.quiz_attempts FOR UPDATE 
    USING (user_id = auth.uid());
