# 👨‍💻 Guia do Desenvolvedor - Sistema de Gamificação

## Visão Geral

Este guia fornece informações técnicas detalhadas para desenvolvedores que desejam entender, estender ou integrar o sistema de gamificação da WE Academy.

## 📋 Índice

1. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
2. [Funções SQL](#funções-sql)
3. [Triggers e Automação](#triggers-e-automação)
4. [APIs REST](#apis-rest)
5. [Componentes React](#componentes-react)
6. [Hooks Customizados](#hooks-customizados)
7. [Adicionar Novos Tipos de XP](#adicionar-novos-tipos-de-xp)
8. [Criar Novos Tipos de Achievements](#criar-novos-tipos-de-achievements)
9. [Integração com Sistema Existente](#integração-com-sistema-existente)

---

## 1. Estrutura do Banco de Dados

### Tabelas Principais

#### `user_points`

Histórico de todos os pontos concedidos aos usuários.

```sql
CREATE TABLE user_points (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    points INTEGER NOT NULL CHECK (points > 0),
    source_type TEXT NOT NULL CHECK (source_type IN (...)),
    source_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Índices**:
- `user_id` para buscar histórico do usuário
- `created_at` para ordenação temporal
- `source_type` para filtrar por tipo

#### `user_levels`

Níveis atuais e XP total dos usuários.

```sql
CREATE TABLE user_levels (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0 CHECK (total_xp >= 0),
    current_level INTEGER DEFAULT 1 CHECK (current_level >= 1),
    level_xp INTEGER DEFAULT 0 CHECK (level_xp >= 0),
    next_level_xp INTEGER DEFAULT 100 CHECK (next_level_xp > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `achievements`

Definições de badges/conquistas.

```sql
CREATE TABLE achievements (
    id UUID PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT '🏆',
    category TEXT NOT NULL CHECK (category IN ('courses', 'quizzes', 'lab-ia', 'community', 'special')),
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    conditions JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT true NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Campos importantes**:
- `code`: Identificador único usado programaticamente
- `conditions`: JSONB com condições para desbloquear (ver seção de achievements)

#### `user_achievements`

Achievements desbloqueados pelos usuários.

```sql
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, achievement_id)
);
```

#### `user_streaks`

Sequências de dias estudados.

```sql
CREATE TABLE user_streaks (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0 CHECK (current_streak >= 0),
    longest_streak INTEGER DEFAULT 0 CHECK (longest_streak >= 0),
    last_study_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `leaderboard_entries`

Cache de rankings (atualizado periodicamente).

```sql
CREATE TABLE leaderboard_entries (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'all-time')),
    period_value TEXT NOT NULL,
    rank INTEGER NOT NULL CHECK (rank > 0),
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period_type, period_value)
);
```

### Relacionamentos

```
profiles (1) ──< (N) user_points
profiles (1) ──< (1) user_levels
profiles (1) ──< (1) user_streaks
profiles (1) ──< (N) user_achievements ──> (N) achievements
profiles (1) ──< (N) leaderboard_entries
```

---

## 2. Funções SQL

### `add_user_points`

Adiciona pontos ao usuário e atualiza nível automaticamente.

```sql
SELECT add_user_points(
    p_user_id := 'user-uuid',
    p_points := 50,
    p_source_type := 'quiz_pass',
    p_source_id := 'quiz-uuid',
    p_metadata := '{"score": 90}'::jsonb
);
```

**Parâmetros**:
- `p_user_id`: UUID do usuário
- `p_points`: Quantidade de XP (deve ser > 0)
- `p_source_type`: Tipo de origem (ver tipos válidos)
- `p_source_id`: ID da origem (opcional)
- `p_metadata`: Metadados adicionais em JSONB

**Efeitos**:
1. Insere registro em `user_points`
2. Atualiza `user_levels.total_xp`
3. Atualiza nível se necessário
4. Verifica achievements (via trigger)

### `check_and_unlock_achievements`

Verifica e desbloqueia achievements baseado nas condições.

```sql
SELECT check_and_unlock_achievements(p_user_id := 'user-uuid');
```

**Retorna**: Número de achievements desbloqueados

**Lógica**:
1. Busca todos os achievements ativos
2. Verifica condições para cada achievement
3. Desbloqueia achievements que atendem condições
4. Adiciona XP de achievements desbloqueados
5. Cria notificações

### `update_user_streak`

Atualiza sequência de estudo do usuário.

```sql
SELECT update_user_streak(p_user_id := 'user-uuid');
```

**Lógica**:
- Se `last_study_date` é hoje: não faz nada
- Se `last_study_date` é ontem: incrementa streak
- Se `last_study_date` é antes de ontem: reseta streak para 1
- Atualiza `longest_streak` se necessário

### `update_user_level_from_xp`

Recalcula nível do usuário baseado em XP total.

```sql
SELECT update_user_level_from_xp(
    p_user_id := 'user-uuid',
    p_total_xp := 500
);
```

**Lógica**:
1. Busca nível correspondente em `gamification_levels_config`
2. Atualiza `current_level`, `level_xp`, `next_level_xp`
3. Se subiu de nível, pode criar notificação

### `refresh_leaderboard`

Atualiza cache do leaderboard.

```sql
SELECT refresh_leaderboard(
    p_period_type := 'all-time',
    p_period_value := '2025'
);
```

**Lógica**:
1. Deleta entradas existentes do período
2. Calcula rankings baseado em XP
3. Insere top 100 usuários

### `get_user_gamification_stats`

Retorna estatísticas completas do usuário.

```sql
SELECT get_user_gamification_stats(p_user_id := 'user-uuid');
```

**Retorna**: JSONB com:
```json
{
  "user_id": "uuid",
  "total_xp": 500,
  "current_level": 3,
  "level_xp": 100,
  "next_level_xp": 200,
  "achievements_unlocked": 5,
  "achievements_total": 20,
  "current_streak": 7,
  "longest_streak": 10,
  "courses_completed": 2,
  "lessons_completed": 15,
  "quizzes_passed": 5,
  "certificates_earned": 1
}
```

---

## 3. Triggers e Automação

### Trigger: `trigger_enrollments_add_xp`

**Tabela**: `enrollments`  
**Evento**: `AFTER UPDATE`  
**Condição**: `NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL`

**Ação**:
- Adiciona 100 XP quando curso é completado
- Atualiza streak
- Verifica achievements

### Trigger: `trigger_lesson_progress_add_xp`

**Tabela**: `lesson_progress`  
**Evento**: `AFTER INSERT`  
**Condição**: Nova entrada com `completed_at`

**Ação**:
- Adiciona 10 XP quando aula é completada
- Atualiza streak
- Verifica achievements (após trigger)

### Trigger: `trigger_quiz_attempts_add_xp`

**Tabela**: `quiz_attempts`  
**Evento**: `AFTER INSERT OR UPDATE`  
**Condição**: `NEW.passed = true AND (OLD.passed IS NULL OR OLD.passed = false)`

**Ação**:
- Adiciona 50 XP quando quiz é passado
- Adiciona 75 XP se score = 100 (perfeito)
- Verifica achievements

### Trigger: `trigger_user_points_update_level`

**Tabela**: `user_points`  
**Evento**: `AFTER INSERT`  

**Ação**:
- Atualiza `user_levels.total_xp`
- Recalcula nível via `update_user_level_from_xp`

---

## 4. APIs REST

### Endpoints Públicos (Autenticados)

#### GET `/api/gamification/stats`

Estatísticas do usuário autenticado.

**Headers**:
```
Authorization: Bearer <token>
```

**Response**:
```json
{
  "total_xp": 500,
  "current_level": 3,
  "level_xp": 100,
  "next_level_xp": 200,
  "achievements_unlocked": 5,
  "current_streak": 7,
  "longest_streak": 10
}
```

#### GET `/api/gamification/points`

Histórico de pontos do usuário.

**Query Params**:
- `page`: Número da página (padrão: 1)
- `limit`: Itens por página (padrão: 50)

#### GET `/api/gamification/badges`

Lista todos os achievements disponíveis.

#### GET `/api/gamification/badges/user`

Lista achievements desbloqueados pelo usuário.

#### GET `/api/gamification/leaderboard`

Ranking de usuários.

**Query Params**:
- `period`: `weekly` | `monthly` | `all-time` (padrão: `all-time`)

#### POST `/api/gamification/check-achievements`

Força verificação de achievements (útil após ações customizadas).

### Endpoints Admin

#### GET `/api/admin/gamification/analytics`

Estatísticas gerais do sistema.

**Autenticação**: Admin apenas

**Response**:
```json
{
  "analytics": {
    "overview": {
      "total_users": 1000,
      "active_users": 750,
      "engagement_rate": 75.0,
      "total_achievements": 20,
      "total_levels": 10
    },
    "level_distribution": {
      "1": 200,
      "2": 150,
      "3": 100
    },
    "top_users": [...],
    "most_unlocked_achievements": [...]
  }
}
```

#### CRUD Achievements

- `GET /api/admin/gamification/achievements`: Lista
- `POST /api/admin/gamification/achievements`: Cria
- `GET /api/admin/gamification/achievements/[id]`: Busca
- `PUT /api/admin/gamification/achievements/[id]`: Atualiza
- `DELETE /api/admin/gamification/achievements/[id]`: Deleta

#### CRUD Levels

Similar aos achievements, mas para `/api/admin/gamification/levels`

---

## 5. Componentes React

### `PointsDisplay`

Exibe XP total do usuário.

```tsx
<PointsDisplay 
  totalXp={500} 
  label="Pontos Totais"
  compact={false}
/>
```

**Props**:
- `totalXp`: Número (obrigatório)
- `label`: String (opcional)
- `compact`: Boolean (opcional)

### `LevelProgress`

Exibe nível e progresso para próximo nível.

```tsx
<LevelProgress
  currentLevel={3}
  levelXp={100}
  nextLevelXp={200}
  compact={false}
/>
```

**Props**:
- `currentLevel`: Número (obrigatório)
- `levelXp`: Número (obrigatório)
- `nextLevelXp`: Número (obrigatório)
- `compact`: Boolean (opcional)

### `StreakDisplay`

Exibe sequência de estudos.

```tsx
<StreakDisplay
  currentStreak={7}
  longestStreak={10}
  compact={false}
/>
```

**Props**:
- `currentStreak`: Número (obrigatório)
- `longestStreak`: Número (obrigatório)
- `compact`: Boolean (opcional)

### `AchievementBadge`

Exibe badge/achievement.

```tsx
<AchievementBadge
  achievement={{
    id: 'badge-1',
    name: 'Primeiro Passo',
    icon: '🎯',
    rarity: 'common'
  }}
  unlocked={true}
/>
```

**Props**:
- `achievement`: Objeto Achievement (obrigatório)
- `unlocked`: Boolean (obrigatório)

### `LeaderboardCard`

Exibe ranking de usuários.

```tsx
<LeaderboardCard
  period="all-time"
  limit={10}
  highlightUserId="user-123"
/>
```

### `StatsCard`

Card genérico para estatísticas.

```tsx
<StatsCard
  title="XP Total"
  value={500}
  icon={<Trophy />}
  trend={+10}
/>
```

---

## 6. Hooks Customizados

### `useGamification`

Hook principal para acessar dados de gamificação.

```tsx
const { stats, achievements, leaderboard, loading, error, refresh } = useGamification()
```

**Retorna**:
- `stats`: Estatísticas do usuário
- `achievements`: Lista de achievements
- `leaderboard`: Dados do ranking
- `loading`: Estado de carregamento
- `error`: Erro se houver
- `refresh`: Função para recarregar dados

**Uso**:
```tsx
import { useGamification } from '@/hooks/useGamification'

function MyComponent() {
  const { stats, loading } = useGamification()
  
  if (loading) return <div>Carregando...</div>
  
  return (
    <div>
      <PointsDisplay totalXp={stats?.total_xp || 0} />
      <LevelProgress 
        currentLevel={stats?.current_level || 1}
        levelXp={stats?.level_xp || 0}
        nextLevelXp={stats?.next_level_xp || 100}
      />
    </div>
  )
}
```

---

## 7. Adicionar Novos Tipos de XP

### Passo 1: Adicionar ao Enum SQL

```sql
ALTER TABLE user_points 
DROP CONSTRAINT IF EXISTS user_points_source_type_check;

ALTER TABLE user_points
ADD CONSTRAINT user_points_source_type_check 
CHECK (source_type IN (
  'course_complete',
  'lesson_complete',
  'quiz_pass',
  'quiz_perfect',
  'lab_ia_usage',
  'certificate',
  'streak',
  'achievement',
  'manual',
  'novo_tipo'  -- Adicione aqui
));
```

### Passo 2: Criar Trigger ou Função

```sql
-- Exemplo: XP por completar módulo
CREATE OR REPLACE FUNCTION trigger_add_xp_module_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        PERFORM add_user_points(
            NEW.user_id,
            25, -- 25 XP por módulo completo
            'module_complete',
            NEW.module_id,
            jsonb_build_object('module_id', NEW.module_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_modules_add_xp
    AFTER UPDATE ON modules_completion
    FOR EACH ROW
    WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
    EXECUTE FUNCTION trigger_add_xp_module_complete();
```

### Passo 3: Integrar no Código TypeScript

```typescript
// Em algum lugar do código (ex: ao completar módulo)
await supabase.rpc('add_user_points', {
  p_user_id: user.id,
  p_points: 25,
  p_source_type: 'module_complete',
  p_source_id: moduleId,
  p_metadata: { module_id: moduleId }
})
```

---

## 8. Criar Novos Tipos de Achievements

### Passo 1: Adicionar Condição ao JSONB

No admin, crie um achievement com condition:

```json
{
  "type": "custom_action",
  "count": 5,
  "metadata": {
    "custom_field": "value"
  }
}
```

### Passo 2: Implementar Verificação na Função SQL

```sql
-- Em check_and_unlock_achievements, adicionar:
ELSIF condition->>'type' = 'custom_action' THEN
    -- Sua lógica customizada
    DECLARE
        required_count INTEGER := (condition->>'count')::INTEGER;
        actual_count INTEGER;
    BEGIN
        -- Buscar contagem da ação customizada
        SELECT COUNT(*) INTO actual_count
        FROM custom_actions_table
        WHERE user_id = p_user_id
        AND action_type = condition->>'action_type';
        
        IF actual_count >= required_count THEN
            -- Desbloquear achievement
            ...
        END IF;
    END;
```

### Passo 3: Criar Helper TypeScript (Opcional)

```typescript
// lib/gamification/customAchievements.ts
export async function checkCustomAchievement(
  userId: string,
  achievementCode: string
): Promise<boolean> {
  // Sua lógica customizada
  const { data } = await supabase
    .from('custom_actions')
    .select('*')
    .eq('user_id', userId)
  
  // Verificar condições
  return data?.length >= requiredCount
}
```

---

## 9. Integração com Sistema Existente

### Integrar com Completar Aula

Já está implementado via trigger. Para integração manual:

```typescript
// Em handleVideoComplete ou similar
await supabase
  .from('lesson_progress')
  .upsert({
    user_id: user.id,
    lesson_id: lesson.id,
    completed_at: new Date().toISOString()
  })

// Trigger automaticamente adiciona XP
```

### Integrar com Passar Quiz

Já está implementado via trigger. Para integração manual:

```typescript
// Em submitQuiz ou similar
const { data: attempt } = await supabase
  .from('quiz_attempts')
  .insert({
    user_id: user.id,
    quiz_id: quiz.id,
    passed: scorePercentage >= passingScore,
    score: scorePercentage
  })

// Trigger automaticamente adiciona XP se passed = true
```

### Integrar com Lab IA

Já está implementado em `/api/lab-ia/chat/route.ts`:

```typescript
// Adiciona XP para uso do Lab IA (máximo 5/dia)
await serviceRoleSupabase.rpc('add_user_points', {
  p_user_id: user.id,
  p_points: 1, // 1 XP por mensagem
  p_source_type: 'lab_ia_usage',
  p_source_id: conversationId,
  p_metadata: { agent_id, messages_count }
})
```

### Adicionar Notificações

As notificações são criadas automaticamente pelos triggers. Para criar manualmente:

```typescript
// lib/gamification/notifications.ts
export async function createAchievementNotification(
  userId: string,
  achievementId: string
) {
  const achievement = await getAchievement(achievementId)
  
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'achievement',
    title: 'Conquista Desbloqueada!',
    message: `${achievement.name}: ${achievement.description}`,
    metadata: {
      achievement_id: achievementId,
      icon: achievement.icon
    }
  })
}
```

---

## 🔧 Debugging

### Ver Logs SQL

```sql
-- Ver última ação de XP
SELECT * FROM user_points 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver achievements desbloqueados
SELECT ua.*, a.name, a.code
FROM user_achievements ua
JOIN achievements a ON a.id = ua.achievement_id
WHERE ua.user_id = 'user-uuid'
ORDER BY ua.unlocked_at DESC;

-- Ver nível do usuário
SELECT * FROM user_levels WHERE user_id = 'user-uuid';
```

### Testar Funções

```sql
-- Testar adicionar XP
SELECT add_user_points(
  p_user_id := 'user-uuid',
  p_points := 100,
  p_source_type := 'manual',
  p_source_id := NULL,
  p_metadata := '{"test": true}'::jsonb
);

-- Testar verificar achievements
SELECT check_and_unlock_achievements(p_user_id := 'user-uuid');

-- Ver estatísticas
SELECT get_user_gamification_stats(p_user_id := 'user-uuid');
```

---

## 📚 Referências

- Migration SQL: `supabase/migrations/20250120000000_gamification.sql`
- APIs: `src/app/api/gamification/` e `src/app/api/admin/gamification/`
- Componentes: `src/components/gamification/`
- Hooks: `src/hooks/useGamification.ts`
- Testes: `src/tests/gamification/`

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0.0
