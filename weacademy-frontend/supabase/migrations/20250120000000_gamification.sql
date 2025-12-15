-- WE Academy - Sistema Completo de Gamificação
-- Migration: 20250120000000_gamification.sql
-- Criado em: 2025-01-20

-- ============================================================================
-- TABELAS
-- ============================================================================

-- 1. Tabela de pontos do usuário (histórico)
CREATE TABLE IF NOT EXISTS public.user_points (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    points INTEGER NOT NULL CHECK (points > 0),
    source_type TEXT NOT NULL CHECK (source_type IN ('course_complete', 'lesson_complete', 'quiz_pass', 'quiz_perfect', 'lab_ia_usage', 'certificate', 'streak', 'achievement', 'manual')),
    source_id UUID, -- ID da origem (course_id, quiz_id, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Tabela de níveis do usuário
CREATE TABLE IF NOT EXISTS public.user_levels (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    total_xp INTEGER DEFAULT 0 NOT NULL CHECK (total_xp >= 0),
    current_level INTEGER DEFAULT 1 NOT NULL CHECK (current_level >= 1),
    level_xp INTEGER DEFAULT 0 NOT NULL CHECK (level_xp >= 0), -- XP no nível atual
    next_level_xp INTEGER DEFAULT 100 NOT NULL CHECK (next_level_xp > 0), -- XP necessário para próximo nível
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Tabela de achievements/badges
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- Código único (ex: "first_lesson", "quiz_master")
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT '🏆',
    category TEXT NOT NULL CHECK (category IN ('courses', 'quizzes', 'lab-ia', 'community', 'special')),
    points INTEGER DEFAULT 0 NOT NULL CHECK (points >= 0),
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    conditions JSONB DEFAULT '{}'::jsonb, -- Condições para desbloquear (ex: {"courses_completed": 5})
    active BOOLEAN DEFAULT true NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Tabela de achievements desbloqueados pelos usuários
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, achievement_id)
);

-- 5. Tabela de streaks (sequências de dias estudados)
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    current_streak INTEGER DEFAULT 0 NOT NULL CHECK (current_streak >= 0),
    longest_streak INTEGER DEFAULT 0 NOT NULL CHECK (longest_streak >= 0),
    last_study_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Tabela de leaderboard (cache de rankings)
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'all-time')),
    period_value TEXT NOT NULL, -- Ex: "2025-W03", "2025-01", "all-time"
    rank INTEGER NOT NULL CHECK (rank > 0),
    points INTEGER DEFAULT 0 NOT NULL CHECK (points >= 0),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, period_type, period_value)
);

-- 7. Tabela de configuração de níveis (editável pelo admin)
CREATE TABLE IF NOT EXISTS public.gamification_levels_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    level_number INTEGER UNIQUE NOT NULL CHECK (level_number > 0),
    name TEXT NOT NULL,
    min_xp INTEGER NOT NULL CHECK (min_xp >= 0),
    max_xp INTEGER, -- NULL significa nível máximo
    icon TEXT DEFAULT '⭐',
    color TEXT DEFAULT '#29CEDF',
    benefits JSONB DEFAULT '[]'::jsonb, -- Lista de benefícios do nível
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 8. Tabela de configurações gerais de gamificação
CREATE TABLE IF NOT EXISTS public.gamification_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL, -- Configurações em JSON
    enabled BOOLEAN DEFAULT true NOT NULL,
    beta_users UUID[] DEFAULT '{}'::uuid[], -- Lista de usuários beta (se aplicável)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
-- Inserir registro único de configurações
INSERT INTO public.gamification_settings (id, settings) 
VALUES ('00000000-0000-0000-0000-000000000000', '{"xp_multiplier": 1.0, "streak_bonus": 0.1}')
ON CONFLICT DO NOTHING;

-- 9. Tabela de log de mudanças administrativas
CREATE TABLE IF NOT EXISTS public.gamification_change_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'activate', 'deactivate')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('achievement', 'level', 'settings')),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_points_user_created ON public.user_points(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_points_source ON public.user_points(source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked ON public.user_achievements(user_id, unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON public.user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_study ON public.user_streaks(last_study_date);
CREATE INDEX IF NOT EXISTS idx_user_levels_total_xp ON public.user_levels(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON public.leaderboard_entries(period_type, period_value, rank);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON public.achievements(category, active);
CREATE INDEX IF NOT EXISTS idx_gamification_change_log_admin ON public.gamification_change_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_change_log_type ON public.gamification_change_log(change_type, created_at DESC);

-- ============================================================================
-- FUNÇÕES SQL
-- ============================================================================

-- Função para calcular nível baseado em XP total
CREATE OR REPLACE FUNCTION public.calculate_user_level(total_xp INTEGER)
RETURNS TABLE(
    level_number INTEGER,
    level_name TEXT,
    level_xp INTEGER,
    next_level_xp INTEGER,
    progress_percentage NUMERIC
) AS $$
DECLARE
    level_config RECORD;
BEGIN
    -- Buscar o nível correspondente ao XP total
    SELECT * INTO level_config
    FROM public.gamification_levels_config
    WHERE total_xp >= min_xp 
        AND (max_xp IS NULL OR total_xp < max_xp)
    ORDER BY level_number DESC
    LIMIT 1;

    -- Se não encontrou nível, usar nível 1 padrão
    IF level_config IS NULL THEN
        SELECT * INTO level_config
        FROM public.gamification_levels_config
        WHERE level_number = 1;
    END IF;

    -- Calcular XP no nível atual e próximo nível
    DECLARE
        current_level_xp INTEGER := total_xp - level_config.min_xp;
        next_level_config RECORD;
    BEGIN
        -- Buscar próximo nível
        SELECT * INTO next_level_config
        FROM public.gamification_levels_config
        WHERE level_number = level_config.level_number + 1
        LIMIT 1;

        IF next_level_config IS NULL THEN
            -- Nível máximo
            RETURN QUERY SELECT 
                level_config.level_number,
                level_config.name,
                current_level_xp,
                level_config.max_xp - level_config.min_xp AS next_xp,
                100.0 AS progress;
        ELSE
            -- Calcular progresso
            DECLARE
                xp_needed INTEGER := next_level_config.min_xp - level_config.min_xp;
                progress NUMERIC := (current_level_xp::NUMERIC / xp_needed::NUMERIC) * 100.0;
            BEGIN
                RETURN QUERY SELECT 
                    level_config.level_number,
                    level_config.name,
                    current_level_xp,
                    xp_needed,
                    LEAST(progress, 100.0);
            END;
        END IF;
    END;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar pontos e verificar conquistas
CREATE OR REPLACE FUNCTION public.add_user_points(
    p_user_id UUID,
    p_points INTEGER,
    p_source_type TEXT,
    p_source_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    point_id UUID;
    old_xp INTEGER;
    new_xp INTEGER;
    settings JSONB;
    multiplier NUMERIC := 1.0;
BEGIN
    -- Verificar se gamificação está habilitada
    SELECT gs.settings INTO settings
    FROM public.gamification_settings gs
    WHERE gs.enabled = true
    LIMIT 1;

    IF settings IS NULL THEN
        RAISE EXCEPTION 'Gamificação não está habilitada';
    END IF;

    -- Aplicar multiplicador se configurado
    IF settings->>'xp_multiplier' IS NOT NULL THEN
        multiplier := (settings->>'xp_multiplier')::NUMERIC;
    END IF;

    -- Calcular pontos finais
    p_points := FLOOR(p_points * multiplier);

    -- Inserir pontos
    INSERT INTO public.user_points (user_id, points, source_type, source_id, metadata)
    VALUES (p_user_id, p_points, p_source_type, p_source_id, p_metadata)
    RETURNING id INTO point_id;

    -- Atualizar XP total do usuário
    INSERT INTO public.user_levels (user_id, total_xp, current_level, level_xp, next_level_xp)
    VALUES (p_user_id, p_points, 1, p_points, 100)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        total_xp = user_levels.total_xp + p_points,
        updated_at = NOW();

    -- Buscar XP atualizado e calcular nível
    SELECT total_xp INTO new_xp
    FROM public.user_levels
    WHERE user_id = p_user_id;

    -- Calcular e atualizar nível
    PERFORM public.update_user_level_from_xp(p_user_id, new_xp);

    -- Verificar conquistas
    PERFORM public.check_and_unlock_achievements(p_user_id);

    RETURN point_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para atualizar nível baseado em XP
CREATE OR REPLACE FUNCTION public.update_user_level_from_xp(p_user_id UUID, p_total_xp INTEGER)
RETURNS VOID AS $$
DECLARE
    level_info RECORD;
BEGIN
    -- Calcular nível
    SELECT * INTO level_info
    FROM public.calculate_user_level(p_total_xp);

    -- Atualizar nível do usuário
    UPDATE public.user_levels
    SET 
        current_level = level_info.level_number,
        level_xp = level_info.level_xp,
        next_level_xp = level_info.next_level_xp,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar e desbloquear achievements
CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    achievement RECORD;
    unlocked_count INTEGER := 0;
    condition_value NUMERIC;
    condition_met BOOLEAN;
    achievement_unlocked BOOLEAN;
BEGIN
    -- Iterar sobre achievements ativos
    FOR achievement IN 
        SELECT * FROM public.achievements WHERE active = true
    LOOP
        -- Verificar se já desbloqueou
        SELECT EXISTS(
            SELECT 1 FROM public.user_achievements 
            WHERE user_id = p_user_id AND achievement_id = achievement.id
        ) INTO achievement_unlocked;

        IF achievement_unlocked THEN
            CONTINUE;
        END IF;

        -- Verificar condições
        condition_met := true;

        -- Verificar condição: courses_completed
        IF achievement.conditions->>'courses_completed' IS NOT NULL THEN
            SELECT COUNT(*) INTO condition_value
            FROM public.enrollments
            WHERE user_id = p_user_id AND completed_at IS NOT NULL;
            
            IF condition_value < (achievement.conditions->>'courses_completed')::NUMERIC THEN
                condition_met := false;
            END IF;
        END IF;

        -- Verificar condição: lessons_completed
        IF achievement.conditions->>'lessons_completed' IS NOT NULL THEN
            SELECT COUNT(*) INTO condition_value
            FROM public.lesson_progress
            WHERE user_id = p_user_id;
            
            IF condition_value < (achievement.conditions->>'lessons_completed')::NUMERIC THEN
                condition_met := false;
            END IF;
        END IF;

        -- Verificar condição: quizzes_passed
        IF achievement.conditions->>'quizzes_passed' IS NOT NULL THEN
            SELECT COUNT(*) INTO condition_value
            FROM public.quiz_attempts
            WHERE user_id = p_user_id AND passed = true;
            
            IF condition_value < (achievement.conditions->>'quizzes_passed')::NUMERIC THEN
                condition_met := false;
            END IF;
        END IF;

        -- Verificar condição: quizzes_perfect_score
        IF achievement.conditions->>'quizzes_perfect_score' IS NOT NULL THEN
            SELECT COUNT(*) INTO condition_value
            FROM public.quiz_attempts
            WHERE user_id = p_user_id AND score = 100 AND passed = true;
            
            IF condition_value < (achievement.conditions->>'quizzes_perfect_score')::NUMERIC THEN
                condition_met := false;
            END IF;
        END IF;

        -- Verificar condição: streak_days
        IF achievement.conditions->>'streak_days' IS NOT NULL THEN
            SELECT current_streak INTO condition_value
            FROM public.user_streaks
            WHERE user_id = p_user_id;
            
            IF condition_value IS NULL OR condition_value < (achievement.conditions->>'streak_days')::NUMERIC THEN
                condition_met := false;
            END IF;
        END IF;

        -- Verificar condição: certificates_count
        IF achievement.conditions->>'certificates_count' IS NOT NULL THEN
            SELECT COUNT(*) INTO condition_value
            FROM public.certificates
            WHERE user_id = p_user_id;
            
            IF condition_value < (achievement.conditions->>'certificates_count')::NUMERIC THEN
                condition_met := false;
            END IF;
        END IF;

        -- Se todas as condições foram atendidas, desbloquear achievement
        IF condition_met THEN
            INSERT INTO public.user_achievements (user_id, achievement_id)
            VALUES (p_user_id, achievement.id)
            ON CONFLICT (user_id, achievement_id) DO NOTHING;

            IF FOUND THEN
                unlocked_count := unlocked_count + 1;
                
                -- Adicionar pontos do achievement
                IF achievement.points > 0 THEN
                    PERFORM public.add_user_points(
                        p_user_id, 
                        achievement.points, 
                        'achievement', 
                        achievement.id,
                        jsonb_build_object('achievement_code', achievement.code)
                    );
                END IF;

                -- Criar notificação (se tabela de notificações existir)
                BEGIN
                    INSERT INTO public.notifications (user_id, type, title, message, metadata)
                    VALUES (
                        p_user_id,
                        'achievement',
                        'Conquista Desbloqueada!',
                        achievement.name || ': ' || achievement.description,
                        jsonb_build_object('achievement_id', achievement.id, 'icon', achievement.icon)
                    );
                EXCEPTION WHEN OTHERS THEN
                    -- Ignorar se tabela não existir
                    NULL;
                END;
            END IF;
        END IF;
    END LOOP;

    RETURN unlocked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar streak
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    today DATE := CURRENT_DATE;
    last_study DATE;
    current_streak INTEGER;
    longest_streak INTEGER;
BEGIN
    -- Buscar streak atual
    SELECT last_study_date, current_streak, longest_streak
    INTO last_study, current_streak, longest_streak
    FROM public.user_streaks
    WHERE user_id = p_user_id;

    IF last_study IS NULL THEN
        -- Primeiro dia de estudo
        INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_study_date)
        VALUES (p_user_id, 1, 1, today)
        ON CONFLICT (user_id) DO UPDATE
        SET 
            current_streak = 1,
            longest_streak = GREATEST(user_streaks.longest_streak, 1),
            last_study_date = today,
            updated_at = NOW();
    ELSIF last_study = today THEN
        -- Já estudou hoje, não atualizar
        RETURN;
    ELSIF last_study = today - INTERVAL '1 day' THEN
        -- Continuação do streak
        current_streak := COALESCE(current_streak, 0) + 1;
        longest_streak := GREATEST(COALESCE(longest_streak, 0), current_streak);
        
        UPDATE public.user_streaks
        SET 
            current_streak = current_streak,
            longest_streak = longest_streak,
            last_study_date = today,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    ELSE
        -- Streak quebrado, começar novo
        UPDATE public.user_streaks
        SET 
            current_streak = 1,
            last_study_date = today,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar leaderboard
CREATE OR REPLACE FUNCTION public.refresh_leaderboard(
    p_period_type TEXT,
    p_period_value TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Deletar entradas existentes do período
    DELETE FROM public.leaderboard_entries
    WHERE period_type = p_period_type AND period_value = p_period_value;

    -- Inserir novas entradas baseado no tipo de período
    IF p_period_type = 'all-time' THEN
        INSERT INTO public.leaderboard_entries (user_id, period_type, period_value, rank, points)
        SELECT 
            ul.user_id,
            p_period_type,
            p_period_value,
            ROW_NUMBER() OVER (ORDER BY ul.total_xp DESC)::INTEGER,
            ul.total_xp
        FROM public.user_levels ul
        WHERE ul.total_xp > 0
        ORDER BY ul.total_xp DESC
        LIMIT 100;
    ELSE
        -- Para weekly/monthly, usar pontos do período
        INSERT INTO public.leaderboard_entries (user_id, period_type, period_value, rank, points)
        SELECT 
            up.user_id,
            p_period_type,
            p_period_value,
            ROW_NUMBER() OVER (ORDER BY SUM(up.points) DESC)::INTEGER,
            SUM(up.points)
        FROM public.user_points up
        WHERE 
            (p_period_type = 'weekly' AND up.created_at >= DATE_TRUNC('week', CURRENT_DATE))
            OR (p_period_type = 'monthly' AND up.created_at >= DATE_TRUNC('month', CURRENT_DATE))
        GROUP BY up.user_id
        ORDER BY SUM(up.points) DESC
        LIMIT 100;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas completas do usuário
CREATE OR REPLACE FUNCTION public.get_user_gamification_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user_id', p_user_id,
        'total_xp', COALESCE(ul.total_xp, 0),
        'current_level', COALESCE(ul.current_level, 1),
        'level_xp', COALESCE(ul.level_xp, 0),
        'next_level_xp', COALESCE(ul.next_level_xp, 100),
        'achievements_unlocked', (
            SELECT COUNT(*) FROM public.user_achievements WHERE user_id = p_user_id
        ),
        'achievements_total', (
            SELECT COUNT(*) FROM public.achievements WHERE active = true
        ),
        'current_streak', COALESCE(us.current_streak, 0),
        'longest_streak', COALESCE(us.longest_streak, 0),
        'courses_completed', (
            SELECT COUNT(*) FROM public.enrollments WHERE user_id = p_user_id AND completed_at IS NOT NULL
        ),
        'lessons_completed', (
            SELECT COUNT(*) FROM public.lesson_progress WHERE user_id = p_user_id
        ),
        'quizzes_passed', (
            SELECT COUNT(*) FROM public.quiz_attempts WHERE user_id = p_user_id AND passed = true
        ),
        'certificates_earned', (
            SELECT COUNT(*) FROM public.certificates WHERE user_id = p_user_id
        )
    ) INTO stats
    FROM public.profiles p
    LEFT JOIN public.user_levels ul ON ul.user_id = p.id
    LEFT JOIN public.user_streaks us ON us.user_id = p.id
    WHERE p.id = p_user_id;

    RETURN COALESCE(stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para migrar usuários existentes
CREATE OR REPLACE FUNCTION public.migrate_existing_users_gamification()
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    migrated_count INTEGER := 0;
    total_xp INTEGER;
BEGIN
    FOR user_record IN SELECT id FROM public.profiles LOOP
        -- Calcular XP total baseado em ações existentes
        total_xp := 0;

        -- XP de cursos completos (100 XP por curso)
        SELECT COALESCE(COUNT(*) * 100, 0) INTO total_xp
        FROM public.enrollments
        WHERE user_id = user_record.id AND completed_at IS NOT NULL;

        -- XP de aulas completas (10 XP por aula)
        SELECT total_xp + COALESCE(COUNT(*) * 10, 0) INTO total_xp
        FROM public.lesson_progress
        WHERE user_id = user_record.id;

        -- XP de quizzes passados (50 XP por quiz)
        SELECT total_xp + COALESCE(COUNT(*) * 50, 0) INTO total_xp
        FROM public.quiz_attempts
        WHERE user_id = user_record.id AND passed = true;

        -- Inicializar user_levels
        INSERT INTO public.user_levels (user_id, total_xp, current_level, level_xp, next_level_xp)
        VALUES (user_record.id, total_xp, 1, 0, 100)
        ON CONFLICT (user_id) DO UPDATE
        SET total_xp = EXCLUDED.total_xp;

        -- Atualizar nível baseado em XP
        PERFORM public.update_user_level_from_xp(user_record.id, total_xp);

        migrated_count := migrated_count + 1;
    END LOOP;

    -- Verificar conquistas para todos os usuários
    FOR user_record IN SELECT id FROM public.profiles LOOP
        PERFORM public.check_and_unlock_achievements(user_record.id);
    END LOOP;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para log de mudanças
CREATE OR REPLACE FUNCTION public.log_gamification_change(
    p_change_type TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
    current_admin UUID;
BEGIN
    -- Tentar obter admin atual (se autenticado)
    BEGIN
        current_admin := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_admin := NULL;
    END;

    INSERT INTO public.gamification_change_log (admin_id, change_type, entity_type, entity_id, old_value, new_value)
    VALUES (current_admin, p_change_type, p_entity_type, p_entity_id, p_old_value, p_new_value)
    RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para atualizar updated_at em user_levels
CREATE TRIGGER update_user_levels_updated_at 
    BEFORE UPDATE ON public.user_levels 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em user_streaks
CREATE TRIGGER update_user_streaks_updated_at 
    BEFORE UPDATE ON public.user_streaks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em gamification_levels_config
CREATE TRIGGER update_gamification_levels_config_updated_at 
    BEFORE UPDATE ON public.gamification_levels_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em gamification_settings
CREATE TRIGGER update_gamification_settings_updated_at 
    BEFORE UPDATE ON public.gamification_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em leaderboard_entries
CREATE TRIGGER update_leaderboard_entries_updated_at 
    BEFORE UPDATE ON public.leaderboard_entries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Após completar curso, adicionar XP
CREATE OR REPLACE FUNCTION public.trigger_add_xp_course_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        PERFORM public.add_user_points(
            NEW.user_id,
            100, -- 100 XP por curso completo
            'course_complete',
            NEW.course_id,
            jsonb_build_object('course_id', NEW.course_id)
        );
        PERFORM public.update_user_streak(NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enrollments_add_xp
    AFTER UPDATE ON public.enrollments
    FOR EACH ROW
    WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
    EXECUTE FUNCTION public.trigger_add_xp_course_complete();

-- Trigger: Após completar aula, adicionar XP e atualizar streak
CREATE OR REPLACE FUNCTION public.trigger_add_xp_lesson_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.lesson_progress 
        WHERE user_id = NEW.user_id AND lesson_id = NEW.lesson_id
    ) THEN
        PERFORM public.add_user_points(
            NEW.user_id,
            10, -- 10 XP por aula completa
            'lesson_complete',
            NEW.lesson_id,
            jsonb_build_object('lesson_id', NEW.lesson_id)
        );
        PERFORM public.update_user_streak(NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lesson_progress_add_xp
    AFTER INSERT ON public.lesson_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_add_xp_lesson_complete();

-- Trigger: Após passar quiz, adicionar XP
CREATE OR REPLACE FUNCTION public.trigger_add_xp_quiz_pass()
RETURNS TRIGGER AS $$
DECLARE
    points_to_award INTEGER;
BEGIN
    -- Verificar se passed mudou para true (INSERT ou UPDATE)
    IF NEW.passed = true THEN
        -- Se é UPDATE, verificar se antes era false ou NULL
        IF TG_OP = 'UPDATE' AND (OLD.passed IS NULL OR OLD.passed = false) THEN
            -- Pontos base: 50 XP
            points_to_award := 50;
            
            -- Bônus por score perfeito: +25 XP
            IF NEW.score = 100 THEN
                points_to_award := points_to_award + 25;
            END IF;
            
            PERFORM public.add_user_points(
                NEW.user_id,
                points_to_award,
                CASE WHEN NEW.score = 100 THEN 'quiz_perfect' ELSE 'quiz_pass' END,
                NEW.quiz_id,
                jsonb_build_object('quiz_id', NEW.quiz_id, 'score', NEW.score)
            );
        ELSIF TG_OP = 'INSERT' THEN
            -- Para INSERT, sempre adicionar XP se passed = true
            -- Pontos base: 50 XP
            points_to_award := 50;
            
            -- Bônus por score perfeito: +25 XP
            IF NEW.score = 100 THEN
                points_to_award := points_to_award + 25;
            END IF;
            
            PERFORM public.add_user_points(
                NEW.user_id,
                points_to_award,
                CASE WHEN NEW.score = 100 THEN 'quiz_perfect' ELSE 'quiz_pass' END,
                NEW.quiz_id,
                jsonb_build_object('quiz_id', NEW.quiz_id, 'score', NEW.score)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_quiz_attempts_add_xp ON public.quiz_attempts;
CREATE TRIGGER trigger_quiz_attempts_add_xp
    AFTER INSERT OR UPDATE ON public.quiz_attempts
    FOR EACH ROW
    WHEN (NEW.passed = true)
    EXECUTE FUNCTION public.trigger_add_xp_quiz_pass();

-- Trigger: Log de mudanças em achievements
CREATE OR REPLACE FUNCTION public.trigger_log_achievement_changes()
RETURNS TRIGGER AS $$
DECLARE
    old_json JSONB;
    new_json JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        new_json := to_jsonb(NEW);
        PERFORM public.log_gamification_change('create', 'achievement', NEW.id, NULL, new_json);
    ELSIF TG_OP = 'UPDATE' THEN
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
        PERFORM public.log_gamification_change('update', 'achievement', NEW.id, old_json, new_json);
    ELSIF TG_OP = 'DELETE' THEN
        old_json := to_jsonb(OLD);
        PERFORM public.log_gamification_change('delete', 'achievement', OLD.id, old_json, NULL);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_achievement_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.achievements
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_log_achievement_changes();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_levels_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_change_log ENABLE ROW LEVEL SECURITY;

-- Políticas para user_points
CREATE POLICY "Users can view their own points" ON public.user_points
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all points" ON public.user_points
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Políticas para user_levels
CREATE POLICY "Users can view their own level" ON public.user_levels
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view levels (for leaderboard)" ON public.user_levels
    FOR SELECT USING (true);

-- Políticas para achievements
CREATE POLICY "Anyone can view active achievements" ON public.achievements
    FOR SELECT USING (active = true OR public.is_admin(auth.uid()));

-- Políticas para user_achievements
CREATE POLICY "Users can view their own achievements" ON public.user_achievements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all achievements" ON public.user_achievements
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Políticas para user_streaks
CREATE POLICY "Users can view their own streak" ON public.user_streaks
    FOR SELECT USING (auth.uid() = user_id);

-- Políticas para leaderboard_entries (público para leitura)
CREATE POLICY "Anyone can view leaderboard" ON public.leaderboard_entries
    FOR SELECT USING (true);

-- Políticas para gamification_levels_config
CREATE POLICY "Anyone can view level configs" ON public.gamification_levels_config
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage level configs" ON public.gamification_levels_config
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas para gamification_settings
CREATE POLICY "Anyone can view settings" ON public.gamification_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.gamification_settings
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas para achievements (admin only para modificação)
CREATE POLICY "Admins can manage achievements" ON public.achievements
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas para gamification_change_log
CREATE POLICY "Admins can view change log" ON public.gamification_change_log
    FOR SELECT USING (public.is_admin(auth.uid()));

-- ============================================================================
-- DADOS INICIAIS
-- ============================================================================

-- Inserir níveis padrão
INSERT INTO public.gamification_levels_config (level_number, name, min_xp, max_xp, icon, color, sort_order) VALUES
(1, 'Iniciante', 0, 99, '🌱', '#29CEDF', 1),
(2, 'Explorador', 100, 299, '🚀', '#25D366', 2),
(3, 'Aprendiz', 300, 599, '📚', '#29CEDF', 3),
(4, 'Estudioso', 600, 999, '🎓', '#FFA500', 4),
(5, 'Conhecido', 1000, 1999, '⭐', '#9B59B6', 5),
(6, 'Especialista', 2000, 4999, '🏆', '#E74C3C', 6),
(7, 'Mestre', 5000, 9999, '👑', '#F39C12', 7),
(8, 'Lendário', 10000, NULL, '💎', '#E91E63', 8)
ON CONFLICT (level_number) DO NOTHING;

-- Inserir achievements iniciais (20 achievements)
INSERT INTO public.achievements (code, name, description, icon, category, points, rarity, conditions, sort_order) VALUES
('first_lesson', 'Primeiro Passo', 'Complete sua primeira aula', '🎯', 'courses', 10, 'common', '{"lessons_completed": 1}'::jsonb, 1),
('courses_5', 'Estudioso', 'Complete 5 cursos', '📖', 'courses', 100, 'rare', '{"courses_completed": 5}'::jsonb, 2),
('courses_10', 'Mestre', 'Complete 10 cursos', '👑', 'courses', 250, 'epic', '{"courses_completed": 10}'::jsonb, 3),
('quiz_perfect_3', 'Perfeccionista', 'Tire 100% em 3 quizzes', '💯', 'quizzes', 75, 'rare', '{"quizzes_perfect_score": 3}'::jsonb, 4),
('quiz_90_5', 'Quase Perfeito', 'Tire 90%+ em 5 quizzes', '✨', 'quizzes', 50, 'common', '{"quizzes_passed": 5}'::jsonb, 5),
('streak_7', 'Sequência 7', 'Estude 7 dias seguidos', '🔥', 'courses', 50, 'common', '{"streak_days": 7}'::jsonb, 6),
('streak_30', 'Sequência 30', 'Estude 30 dias seguidos', '💪', 'courses', 200, 'epic', '{"streak_days": 30}'::jsonb, 7),
('lab_agents_10', 'Curioso', 'Use 10 agentes diferentes no Lab IA', '🤖', 'lab-ia', 100, 'rare', '{}'::jsonb, 8),
('lab_models_all', 'Explorador', 'Teste todos os modelos de IA', '🔬', 'lab-ia', 150, 'epic', '{}'::jsonb, 9),
('lab_requests_100', 'Lab Master', 'Faça 100 requisições no Lab IA', '⚡', 'lab-ia', 100, 'rare', '{}'::jsonb, 10),
('first_certificate', 'Certificado', 'Obtenha seu primeiro certificado', '📜', 'courses', 50, 'common', '{"certificates_count": 1}'::jsonb, 11),
('certificates_5', 'Especialista', 'Obtenha 5 certificados', '🏅', 'courses', 150, 'epic', '{"certificates_count": 5}'::jsonb, 12),
('course_fast', 'Rápido', 'Complete um curso em menos de 24h', '⚡', 'courses', 75, 'rare', '{}'::jsonb, 13),
('study_hours_50', 'Dedicado', 'Estude 50 horas no total', '⏰', 'courses', 100, 'rare', '{}'::jsonb, 14),
('category_master', 'Categoria Master', 'Complete todos os cursos de uma categoria', '🎯', 'courses', 200, 'epic', '{}'::jsonb, 15),
('quiz_questions_100', 'Quiz Master', 'Acerte 100 questões', '🧠', 'quizzes', 75, 'rare', '{}'::jsonb, 16),
('lab_first_conversation', 'Primeira Conversa', 'Crie sua primeira conversa no Lab IA', '💬', 'lab-ia', 10, 'common', '{}'::jsonb, 17),
('lab_favorites_10', 'Social', 'Favorite 10 conversas', '❤️', 'lab-ia', 25, 'common', '{}'::jsonb, 18),
('course_advanced', 'Avançado', 'Complete um curso avançado', '🎓', 'courses', 75, 'rare', '{}'::jsonb, 19),
('courses_premium_all', 'Premium', 'Complete todos os cursos premium', '💎', 'courses', 300, 'legendary', '{}'::jsonb, 20)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE public.user_points IS 'Histórico de pontos ganhos pelos usuários';
COMMENT ON TABLE public.user_levels IS 'Níveis e XP total dos usuários';
COMMENT ON TABLE public.achievements IS 'Definições de badges/achievements disponíveis';
COMMENT ON TABLE public.user_achievements IS 'Achievements desbloqueados pelos usuários';
COMMENT ON TABLE public.user_streaks IS 'Sequências de dias estudados pelos usuários';
COMMENT ON TABLE public.leaderboard_entries IS 'Cache de rankings (weekly, monthly, all-time)';
COMMENT ON TABLE public.gamification_levels_config IS 'Configuração editável de níveis de gamificação';
COMMENT ON TABLE public.gamification_settings IS 'Configurações gerais de gamificação';
COMMENT ON TABLE public.gamification_change_log IS 'Histórico de mudanças administrativas na gamificação';

