# Sistema Completo de Gamificação - WE Academy

## Visão Geral

Implementar um sistema completo de gamificação para aumentar o engajamento dos usuários na plataforma, incluindo:

- Sistema de badges/achievements (20+ badges)
- Sistema de pontos (XP) por ações
- Sistema de níveis (Iniciante → Especialista)
- Streaks (sequências de dias estudados)
- Leaderboard (rankings semanais/mensais)
- Dashboard do usuário com estatísticas e conquistas
- Interface administrativa completa para gerenciamento

**Status Atual:** ⏳ Planejamento Completo  
**Meta:** ✅ Sistema completo implementado e testado

---

## Fase 1: Banco de Dados e Estrutura (Migration)

### 1.1 Criar Migration de Gamificação

**Arquivo:** `supabase/migrations/20250120000000_gamification.sql`

**Tabelas a criar:**

1. **user_points** - Histórico de pontos do usuário
   - id, user_id, points, source_type, source_id, metadata, created_at
   - Índices: user_id, created_at, source_type

2. **user_levels** - Níveis e XP total dos usuários
   - user_id (PK), total_xp, current_level, level_xp, next_level_xp, created_at, updated_at
   - Trigger para atualizar updated_at

3. **achievements** - Definições de badges/achievements
   - id, code (único), name, description, icon, category, points, rarity, conditions (JSONB), active, sort_order, created_at
   - Categorias: courses, quizzes, lab-ia, community, special

4. **user_achievements** - Badges conquistados pelos usuários
   - id, user_id, achievement_id, unlocked_at, metadata
   - Índices: user_id, achievement_id, unlocked_at

5. **user_streaks** - Sequências de dias estudados
   - user_id (PK), current_streak, longest_streak, last_study_date, created_at, updated_at
   - Trigger para atualizar updated_at

6. **leaderboard_entries** - Entradas do ranking (cache)
   - id, user_id, period_type, period_value, rank, points, metadata, created_at, updated_at
   - Índices: period_type + period_value + rank

7. **gamification_levels_config** - Configuração de níveis (editável)
   - id, level_number (único), name, min_xp, max_xp, icon, color, benefits (JSONB), sort_order, created_at, updated_at
   - Trigger para atualizar updated_at

8. **gamification_settings** - Configurações gerais
   - id (único), settings (JSONB), enabled, beta_users (UUID[]), updated_at, updated_by

9. **gamification_change_log** - Histórico de mudanças admin
   - id, admin_id, change_type, entity_type, entity_id, old_value (JSONB), new_value (JSONB), created_at
   - Índices: admin_id, change_type, created_at

**Funções SQL:**

1. `calculate_user_level(total_xp)` - Calcular nível baseado em XP total (usa gamification_levels_config)
2. `add_user_points(user_id, points, source_type, source_id, metadata)` - Adicionar pontos e verificar conquistas
3. `check_and_unlock_achievements(user_id)` - Verificar condições e desbloquear achievements
4. `update_user_streak(user_id)` - Atualizar sequência de estudo
5. `refresh_leaderboard(period_type, period_value)` - Atualizar ranking
6. `get_user_gamification_stats(user_id)` - Retornar estatísticas completas
7. `migrate_existing_users_gamification()` - Migrar usuários existentes para gamificação
8. `log_achievement_changes()` - Registrar mudanças em achievements/níveis

**Triggers:**

1. Trigger em `enrollments` (após completar curso) - Adicionar XP e verificar conquistas
2. Trigger em `lesson_progress` (após completar aula) - Adicionar XP e atualizar streak
3. Trigger em `quiz_attempts` (após passar quiz) - Adicionar XP e verificar conquistas
4. Trigger em `user_points` (após inserir pontos) - Atualizar user_levels
5. Trigger em `achievements` (após mudanças) - Registrar no change_log

**RLS Policies:**

- Usuários veem apenas seus próprios dados (exceto leaderboard público)
- Admins podem ver todos os dados
- Sistema pode inserir dados (via triggers)

**Achievements iniciais (20):**

1. "Primeiro Passo" - Completar primeira aula (10 XP)
2. "Estudioso" - Completar 5 cursos (100 XP)
3. "Mestre" - Completar 10 cursos (250 XP)
4. "Perfeccionista" - Tirar 100% em 3 quizzes (75 XP)
5. "Quase Perfeito" - Tirar 90%+ em 5 quizzes (50 XP)
6. "Sequência 7" - Estudar 7 dias seguidos (50 XP)
7. "Sequência 30" - Estudar 30 dias seguidos (200 XP)
8. "Curioso" - Usar 10 agentes diferentes no Lab IA (100 XP)
9. "Explorador" - Testar todos os modelos de IA (150 XP)
10. "Lab Master" - Fazer 100 requisições no Lab IA (100 XP)
11. "Certificado" - Obter primeiro certificado (50 XP)
12. "Especialista" - Obter 5 certificados (150 XP)
13. "Rápido" - Completar curso em menos de 24h (75 XP)
14. "Dedicado" - Estudar 50 horas no total (100 XP)
15. "Categoria Master" - Completar todos cursos de uma categoria (200 XP)
16. "Quiz Master" - Acertar 100 questões (75 XP)
17. "Primeira Conversa" - Criar primeira conversa no Lab IA (10 XP)
18. "Social" - Favoritar 10 conversas (25 XP)
19. "Avançado" - Completar curso avançado (75 XP)
20. "Premium" - Completar todos cursos premium (300 XP)

**Índices adicionais para performance:**
- idx_user_points_user_created ON user_points(user_id, created_at DESC)
- idx_user_achievements_user_unlocked ON user_achievements(user_id, unlocked_at DESC)
- idx_user_streaks_last_study ON user_streaks(last_study_date)
- idx_user_levels_total_xp ON user_levels(total_xp DESC)

---

## Fase 2: APIs Backend

### 2.1 API de Pontos

**Arquivo:** `src/app/api/gamification/points/route.ts`

- `POST /api/gamification/points` - Adicionar pontos manualmente (admin)
- `GET /api/gamification/points` - Obter histórico de pontos do usuário
- Rate limiting para prevenir spam

### 2.2 API de Estatísticas

**Arquivo:** `src/app/api/gamification/stats/route.ts`

- `GET /api/gamification/stats` - Obter estatísticas completas do usuário

### 2.3 API de Badges

**Arquivo:** `src/app/api/gamification/badges/route.ts`

- `GET /api/gamification/badges` - Listar todos os badges disponíveis
- `GET /api/gamification/badges/[id]` - Detalhes de um badge específico
- `GET /api/gamification/badges/user` - Badges do usuário atual

### 2.4 API de Leaderboard

**Arquivo:** `src/app/api/gamification/leaderboard/route.ts`

- `GET /api/gamification/leaderboard?period=weekly|monthly|all-time` - Obter ranking
- Cache implementado (TTL configurável)

### 2.5 API de Verificação de Conquistas

**Arquivo:** `src/app/api/gamification/check-achievements/route.ts`

- `POST /api/gamification/check-achievements` - Verificar e desbloquear conquistas

### 2.6 APIs Administrativas

#### 2.6.1 API de Achievements (Admin)

**Arquivo:** `src/app/api/admin/gamification/achievements/route.ts`
**Arquivo:** `src/app/api/admin/gamification/achievements/[id]/route.ts`

- `GET /api/admin/gamification/achievements` - Listar todos
- `POST /api/admin/gamification/achievements` - Criar novo
- `GET /api/admin/gamification/achievements/[id]` - Obter um
- `PUT /api/admin/gamification/achievements/[id]` - Atualizar
- `DELETE /api/admin/gamification/achievements/[id]` - Deletar

#### 2.6.2 API de Níveis (Admin)

**Arquivo:** `src/app/api/admin/gamification/levels/route.ts`
**Arquivo:** `src/app/api/admin/gamification/levels/[id]/route.ts`

- `GET /api/admin/gamification/levels` - Listar todos
- `POST /api/admin/gamification/levels` - Criar novo
- `PUT /api/admin/gamification/levels/[id]` - Atualizar
- `DELETE /api/admin/gamification/levels/[id]` - Deletar
- `PUT /api/admin/gamification/levels/reorder` - Reordenar

#### 2.6.3 API de Configurações (Admin)

**Arquivo:** `src/app/api/admin/gamification/settings/route.ts`

- `GET /api/admin/gamification/settings` - Obter configurações
- `PUT /api/admin/gamification/settings` - Atualizar configurações

#### 2.6.4 API de Analytics (Admin)

**Arquivo:** `src/app/api/admin/gamification/analytics/route.ts`

- `GET /api/admin/gamification/analytics` - Estatísticas gerais

#### 2.6.5 API de Migração (Admin)

**Arquivo:** `src/app/api/admin/gamification/migrate/route.ts`

- `POST /api/admin/gamification/migrate` - Executar migração de usuários existentes

#### 2.6.6 API de Export/Import (Admin)

**Arquivo:** `src/app/api/admin/gamification/export/route.ts`
**Arquivo:** `src/app/api/admin/gamification/import/route.ts`

- `GET /api/admin/gamification/export` - Exportar configuração (JSON)
- `POST /api/admin/gamification/import` - Importar configuração

#### 2.6.7 API de Reset de Usuário (Admin)

**Arquivo:** `src/app/api/admin/gamification/users/[userId]/reset/route.ts`

- `POST /api/admin/gamification/users/[userId]/reset` - Resetar XP/badges de usuário

#### 2.6.8 API de Histórico de Mudanças (Admin)

**Arquivo:** `src/app/api/admin/gamification/change-log/route.ts`

- `GET /api/admin/gamification/change-log` - Obter histórico de mudanças

### 2.7 Helper de Gamificação

**Arquivo:** `src/lib/gamification/index.ts`

Funções auxiliares:
- `awardPoints(userId, points, sourceType, sourceId, metadata)` - Conceder pontos
- `checkAchievements(userId)` - Verificar conquistas
- `updateStreak(userId)` - Atualizar streak
- `getUserStats(userId)` - Obter estatísticas
- `validatePointOrigin(sourceType, sourceId)` - Validar origem de pontos

---

## Fase 3: Componentes Visuais

### 3.1 Componente de Badge

**Arquivo:** `src/components/gamification/AchievementBadge.tsx`

- Exibir badge com ícone, nome, descrição
- Estados: locked, unlocked, in-progress
- Animação ao desbloquear (confetti para badges raros)
- Tooltip com informações
- Progress bar para badges em progresso
- Acessibilidade: aria-label, alt text

### 3.2 Componente de Pontos

**Arquivo:** `src/components/gamification/PointsDisplay.tsx`

- Exibir XP total do usuário
- Animação ao ganhar pontos
- Formatação de números grandes
- Responsivo mobile

### 3.3 Componente de Nível

**Arquivo:** `src/components/gamification/LevelProgress.tsx`

- Barra de progresso para próximo nível
- Nível atual e XP necessário
- Nome do nível (Iniciante, Intermediário, Avançado, Especialista)
- Transição suave ao subir de nível
- Acessibilidade: role="progressbar", aria-valuenow

### 3.4 Componente de Streak

**Arquivo:** `src/components/gamification/StreakDisplay.tsx`

- Calendário visual mostrando dias estudados
- Sequência atual e maior sequência
- Indicador visual de dias consecutivos
- Responsivo mobile

### 3.5 Componente de Leaderboard

**Arquivo:** `src/components/gamification/LeaderboardCard.tsx`

- Ranking com top 10
- Posição do usuário destacada
- Filtros: weekly, monthly, all-time
- Badges de posição (1º, 2º, 3º)
- Acessibilidade: role="table", headers semânticos
- Scroll horizontal em mobile

### 3.6 Componente de Estatísticas

**Arquivo:** `src/components/gamification/StatsCard.tsx`

- Cards com métricas principais
- Gráficos de progresso (Recharts)
- Comparação com média da plataforma
- Responsivo mobile

---

## Fase 4: Dashboard do Usuário

### 4.1 Página de Perfil/Dashboard

**Arquivo:** `src/app/profile/dashboard/page.tsx`

Seções:
1. Header com nome, avatar, nível atual, XP total
2. Cards de estatísticas principais (cursos completos, horas estudadas, badges)
3. Barra de progresso do nível
4. Streak display
5. Lista de badges desbloqueados
6. Gráfico de progresso semanal/mensal
7. Próximos objetivos
8. Conquistas recentes

### 4.2 Página de Badges

**Arquivo:** `src/app/profile/badges/page.tsx`

- Grid de todos os badges disponíveis
- Filtros por categoria
- Estado visual (locked/unlocked)
- Progresso para badges em progresso
- Detalhes ao clicar em um badge
- Responsivo mobile

### 4.3 Página de Leaderboard

**Arquivo:** `src/app/leaderboard/page.tsx`

- Ranking completo com top 100
- Filtros por período
- Posição do usuário destacada
- Cards de usuários com avatar, nome, nível, pontos
- Paginação
- Responsivo mobile

---

## Fase 5: Integração e Hooks

### 5.1 Hook de Gamificação

**Arquivo:** `src/hooks/useGamification.ts`

- Estado do usuário (XP, nível, badges, streak)
- Funções para atualizar estado
- Listener para novos desbloqueios
- Refresh automático de estatísticas

### 5.2 Integração com Notificações

**Arquivo:** `src/lib/gamification/notifications.ts`

Funções:
- `notifyBadgeUnlocked(userId, achievement)` - Notificar ao desbloquear badge
- `notifyLevelUp(userId, newLevel, levelName)` - Notificar ao subir de nível
- `notifyStreakRecord(userId, streak)` - Notificar ao quebrar recorde
- `notifyTopLeaderboard(userId, rank)` - Notificar ao entrar no top 10

Integração com sistema de notificações existente (`create_notification`).

### 5.3 Integração com Ações Existentes

**Locais para adicionar tracking de XP:**

1. `src/app/api/enrollments/[courseId]/complete/route.ts` - Ao completar curso
2. `src/app/api/enrollments/[courseId]/progress/route.ts` - Ao completar aula
3. `src/app/api/quizzes/[id]/submit/route.ts` - Ao passar quiz
4. `src/app/api/lab-ia/chat/route.ts` - Ao usar Lab IA (tracking de uso)
5. `src/modules/laboratorio-ia/services/llmRouter.ts` - Ao usar agentes/modelos

### 5.4 Sistema de Eventos

Integrar com sistema de eventos existente (`src/lib/analytics.ts`):
- Trackar eventos de gamificação
- Analytics de engajamento

---

## Fase 6: Componentes de UI e Layout

### 6.1 Atualizar Header

**Arquivo:** `src/components/header.tsx`

- Adicionar indicador de XP e nível no menu do usuário
- Badge de notificações de conquistas
- Link para dashboard

### 6.2 Atualizar Página "Meus Cursos"

**Arquivo:** `src/app/my-courses/page.tsx`

- Adicionar card de estatísticas no topo
- Mostrar badges relevantes
- Indicador de streak

### 6.3 Atualizar Página do Lab IA

**Arquivo:** `src/app/ai-lab/page.tsx`

- Adicionar indicador de uso do Lab IA
- Mostrar badges relacionados ao Lab IA
- Tracking de uso de modelos/agentes

---

## Fase 7: Testes

### 7.1 Testes de Banco de Dados

**Arquivo:** `src/tests/gamification/database.test.ts`

- Testes de funções SQL
- Testes de triggers
- Testes de RLS policies
- Testes de migração de usuários existentes

### 7.2 Testes de APIs

**Arquivo:** `src/tests/gamification/api.test.ts`

- Testes de endpoints de gamificação
- Testes de autenticação/autorização
- Testes de lógica de pontos e conquistas
- Testes de rate limiting

### 7.3 Testes de Componentes

**Arquivo:** `src/tests/gamification/components.test.tsx`

- Testes de componentes visuais
- Testes de interações
- Testes de animações
- Testes de acessibilidade

### 7.4 Testes de Performance

**Arquivo:** `src/tests/gamification/performance.test.ts`

- Testes de leaderboard com muitos usuários (1000+)
- Testes de queries SQL otimizadas
- Testes de cache do leaderboard
- Benchmarks de queries

### 7.5 Testes de Edge Cases

**Arquivo:** `src/tests/gamification/edge-cases.test.ts`

- Testes de duplicação de XP (evitar)
- Testes de validação de condições
- Testes de sobreposição de níveis
- Testes de rate limiting

### 7.6 Testes de Integração com Notificações

**Arquivo:** `src/tests/gamification/notifications.test.ts`

- Verificar criação de notificações ao desbloquear badges
- Verificar criação de notificações ao subir de nível
- Verificar criação de notificações ao quebrar streak
- Verificar criação de notificações ao entrar no top 10

---

## Fase 8: Interface Administrativa de Gamificação

### 8.1 Componentes Administrativos

#### 8.1.1 Formulário de Achievement

**Arquivo:** `src/components/admin/gamification/AchievementForm.tsx`

- Formulário com validação (Zod)
- Campos: code, name, description, icon picker, category, points, rarity
- Editor de condições JSONB (ConditionsEditor)
- Preview do badge
- Validação de código único

#### 8.1.2 Formulário de Nível

**Arquivo:** `src/components/admin/gamification/LevelForm.tsx`

- Formulário com validação
- Campos: level_number, name, min_xp, max_xp, icon, color
- Editor de benefícios JSONB
- Preview do nível
- Validação de sobreposição de XP

#### 8.1.3 Tabela de Achievements

**Arquivo:** `src/components/admin/gamification/AchievementsTable.tsx`

- Lista todos os achievements
- Colunas: ícone, nome, categoria, pontos, raridade, status, ações
- Filtros: por categoria, raridade, status
- Busca por nome/código
- Ações: editar, deletar, ativar/desativar
- Estatísticas: quantos usuários desbloquearam

#### 8.1.4 Tabela de Níveis

**Arquivo:** `src/components/admin/gamification/LevelsTable.tsx`

- Lista configuração de níveis ordenada
- Colunas: nível, nome, XP mínimo, XP máximo, ícone, ações
- Reordenar níveis (drag & drop ou botões)
- Ações: editar, deletar
- Estatísticas: quantos usuários em cada nível

#### 8.1.5 Componente de Configurações

**Arquivo:** `src/components/admin/gamification/GamificationSettings.tsx`

- Formulário de configurações gerais
- Seções: XP Padrão, Multiplicadores, Leaderboard, Streaks
- Validação de valores (números positivos)
- Preview de impacto das mudanças

#### 8.1.6 Editor de Condições

**Arquivo:** `src/components/admin/gamification/ConditionsEditor.tsx`

- Interface visual para criar condições de achievements
- Tipos de condições: dropdown
- Operadores: >=, =, <=
- Valores: input numérico ou texto
- Múltiplas condições com AND/OR
- Visualização de JSON gerado

### 8.2 Páginas Administrativas

#### 8.2.1 Página Principal de Gamificação (Admin)

**Arquivo:** `src/app/admin/gamification/page.tsx`

Seções:
1. Cards de estatísticas (total achievements, níveis, usuários ativos)
2. Tabs: Achievements, Níveis, Configurações, Analytics
3. Ações rápidas: criar achievement, criar nível
4. Preview: achievements mais desbloqueados, distribuição de níveis

#### 8.2.2 Página de Gerenciamento de Achievements

**Arquivo:** `src/app/admin/gamification/achievements/page.tsx`

- Tabela de achievements (AchievementsTable)
- Botão "Criar Achievement"
- Filtros e busca
- Modal ou página separada para criação/edição

#### 8.2.3 Página de Criação/Edição de Achievement

**Arquivo:** `src/app/admin/gamification/achievements/new/page.tsx`
**Arquivo:** `src/app/admin/gamification/achievements/[id]/edit/page.tsx`

- Formulário (AchievementForm)
- Validação em tempo real
- Preview do badge
- Botões: salvar, cancelar
- Mensagens de sucesso/erro

#### 8.2.4 Página de Gerenciamento de Níveis

**Arquivo:** `src/app/admin/gamification/levels/page.tsx`

- Tabela de níveis (LevelsTable)
- Botão "Criar Nível"
- Reordenar níveis
- Modal ou página separada para criação/edição

#### 8.2.5 Página de Criação/Edição de Nível

**Arquivo:** `src/app/admin/gamification/levels/new/page.tsx`
**Arquivo:** `src/app/admin/gamification/levels/[id]/edit/page.tsx`

- Formulário (LevelForm)
- Validação de sobreposição de XP
- Preview do nível
- Botões: salvar, cancelar

#### 8.2.6 Página de Configurações

**Arquivo:** `src/app/admin/gamification/settings/page.tsx`

- Componente de configurações (GamificationSettings)
- Seções colapsáveis
- Botão "Salvar Configurações"
- Confirmação antes de salvar

#### 8.2.7 Página de Analytics

**Arquivo:** `src/app/admin/gamification/analytics/page.tsx`

- Gráficos de distribuição (Recharts)
- Tabelas de estatísticas
- Filtros por período
- Exportar dados (CSV/JSON)
- Métricas:
  - Taxa de engajamento (% usuários ativos)
  - Badges mais desbloqueados
  - Distribuição de níveis
  - Tempo médio para subir de nível
  - Impacto no completion rate de cursos
  - Comparação antes/depois da gamificação
  - Top 10 usuários mais engajados
  - Badges mais raros

---

## Fase 9: Documentação e Analytics

### 9.1 Documentação para Admins

**Arquivo:** `docs/GAMIFICATION_ADMIN_GUIDE.md`

- Como usar a interface administrativa
- Como criar achievements efetivos
- Como configurar níveis balanceados
- Exemplos de condições JSONB
- Como interpretar analytics
- Como exportar/importar configurações
- Como resetar XP de usuários
- Como migrar usuários existentes

### 9.2 Documentação para Desenvolvedores

**Arquivo:** `docs/GAMIFICATION_DEVELOPER_GUIDE.md`

- Estrutura do banco de dados
- Como adicionar novos tipos de XP
- Como criar novos tipos de achievements
- APIs disponíveis e exemplos
- Integração com sistema existente
- Funções SQL disponíveis
- Triggers e como funcionam
- Estrutura de componentes

---

## Fase 10: Acessibilidade e UX

### 10.1 Acessibilidade

**Atualizar componentes:**

- `AchievementBadge.tsx`: adicionar `aria-label` e `alt` text
- `LevelProgress.tsx`: adicionar `role="progressbar"` e `aria-valuenow`
- `LeaderboardCard.tsx`: usar `role="table"` e headers semânticos
- Respeitar `prefers-reduced-motion` em animações
- Verificar contraste de cores (WCAG AA)

### 10.2 Animações Melhoradas

**Componentes a atualizar:**

- `AchievementBadge.tsx`: adicionar animação de confetti ao desbloquear badge raro
- `PointsDisplay.tsx`: animação de contador ao ganhar XP
- `LevelProgress.tsx`: transição suave ao subir de nível
- Adicionar efeito de "glow" em badges desbloqueados

**Bibliotecas sugeridas:**

```json
// Adicionar ao package.json
{
  "canvas-confetti": "^1.6.0", // Para confetti ao desbloquear badges
  "framer-motion": "^10.16.4" // Para animações suaves (já pode estar instalado)
}
```

### 10.3 Mobile Responsiveness

**Páginas a otimizar:**

- `/profile/dashboard` - Cards em grid responsivo
- `/profile/badges` - Grid de badges responsivo
- `/leaderboard` - Tabela com scroll horizontal se necessário
- `/admin/gamification/*` - Todas as páginas admin responsivas

### 10.4 Feedback Visual Melhorado

- Confetti ao desbloquear badge raro
- Animação de progresso ao ganhar XP
- Transição suave ao subir de nível
- Efeito de "glow" em badges desbloqueados
- Toast notifications mais elaborados

---

## Ordem de Implementação

1. **Fase 1** - Banco de dados (incluindo migração e logs)
2. **Fase 2** - APIs backend (incluindo APIs admin e export/import)
3. **Fase 8** - Interface administrativa (CRUD completo)
4. **Fase 5** - Integração (incluindo notificações)
5. **Fase 3** - Componentes visuais (usuário)
6. **Fase 4** - Dashboard do usuário
7. **Fase 6** - Integração com páginas existentes
8. **Fase 7** - Testes (incluindo novos testes)
9. **Fase 9** - Documentação e Analytics
10. **Fase 10** - Acessibilidade e UX

---

## Arquivos Principais a Criar/Modificar

### Novos arquivos (50+)

**Migration (1 arquivo):**
- `supabase/migrations/20250120000000_gamification.sql`

**APIs (13 arquivos):**
- `src/app/api/gamification/points/route.ts`
- `src/app/api/gamification/stats/route.ts`
- `src/app/api/gamification/badges/route.ts`
- `src/app/api/gamification/badges/[id]/route.ts`
- `src/app/api/gamification/leaderboard/route.ts`
- `src/app/api/gamification/check-achievements/route.ts`
- `src/app/api/admin/gamification/achievements/route.ts`
- `src/app/api/admin/gamification/achievements/[id]/route.ts`
- `src/app/api/admin/gamification/levels/route.ts`
- `src/app/api/admin/gamification/settings/route.ts`
- `src/app/api/admin/gamification/analytics/route.ts`
- `src/app/api/admin/gamification/migrate/route.ts`
- `src/app/api/admin/gamification/export/route.ts`
- `src/app/api/admin/gamification/import/route.ts`
- `src/app/api/admin/gamification/users/[userId]/reset/route.ts`
- `src/app/api/admin/gamification/change-log/route.ts`

**Libs e Helpers (3 arquivos):**
- `src/lib/gamification/index.ts`
- `src/lib/gamification/notifications.ts`
- `src/lib/validations/gamification.ts`

**Hooks (1 arquivo):**
- `src/hooks/useGamification.ts`

**Componentes (12 arquivos):**
- `src/components/gamification/AchievementBadge.tsx`
- `src/components/gamification/PointsDisplay.tsx`
- `src/components/gamification/LevelProgress.tsx`
- `src/components/gamification/StreakDisplay.tsx`
- `src/components/gamification/LeaderboardCard.tsx`
- `src/components/gamification/StatsCard.tsx`
- `src/components/admin/gamification/AchievementForm.tsx`
- `src/components/admin/gamification/LevelForm.tsx`
- `src/components/admin/gamification/AchievementsTable.tsx`
- `src/components/admin/gamification/LevelsTable.tsx`
- `src/components/admin/gamification/GamificationSettings.tsx`
- `src/components/admin/gamification/ConditionsEditor.tsx`

**Páginas (11 arquivos):**
- `src/app/profile/dashboard/page.tsx`
- `src/app/profile/badges/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/app/admin/gamification/page.tsx`
- `src/app/admin/gamification/achievements/page.tsx`
- `src/app/admin/gamification/achievements/new/page.tsx`
- `src/app/admin/gamification/achievements/[id]/edit/page.tsx`
- `src/app/admin/gamification/levels/page.tsx`
- `src/app/admin/gamification/settings/page.tsx`
- `src/app/admin/gamification/analytics/page.tsx`

**Testes (6 arquivos):**
- `src/tests/gamification/database.test.ts`
- `src/tests/gamification/api.test.ts`
- `src/tests/gamification/components.test.tsx`
- `src/tests/gamification/performance.test.ts`
- `src/tests/gamification/edge-cases.test.ts`
- `src/tests/gamification/notifications.test.ts`

**Documentação (2 arquivos):**
- `docs/GAMIFICATION_ADMIN_GUIDE.md`
- `docs/GAMIFICATION_DEVELOPER_GUIDE.md`

### Arquivos a modificar (3 arquivos)

- `src/components/header.tsx`
- `src/app/my-courses/page.tsx`
- `src/app/ai-lab/page.tsx`
- `src/app/admin/page.tsx`

---

## TODOs Completos

### Fase 1 - Banco de Dados
- [x] db-migration - Criar migration com tabelas de gamificação
- [x] db-functions - Implementar funções SQL
- [x] db-triggers - Criar triggers para adicionar XP automaticamente
- [x] db-achievements - Inserir 20 achievements iniciais
- [x] db-levels-config - Adicionar tabela gamification_levels_config
- [x] db-settings-table - Adicionar tabela gamification_settings
- [x] db-migration-log - Criar tabela gamification_change_log
- [x] db-migration-function - Criar função migrate_existing_users_gamification()
- [x] db-additional-indexes - Criar índices adicionais para performance
- [x] db-settings-fields - Adicionar campos enabled e beta_users
- [x] db-trigger-log - Criar trigger para registrar mudanças

### Fase 2 - APIs
- [x] api-points - Criar API /api/gamification/points
- [x] api-stats - Criar API /api/gamification/stats
- [x] api-badges - Criar API /api/gamification/badges
- [x] api-leaderboard - Criar API /api/gamification/leaderboard
- [x] api-check-achievements - Criar API /api/gamification/check-achievements
- [x] admin-api-achievements - Criar APIs admin para CRUD de achievements
- [x] admin-api-levels - Criar APIs admin para CRUD de níveis
- [x] admin-api-settings - Criar API admin para configurações
- [x] admin-api-analytics - Criar API admin para analytics
- [x] api-migrate - Criar API /api/admin/gamification/migrate
- [x] api-export - Criar API /api/admin/gamification/export
- [x] api-import - Criar API /api/admin/gamification/import
- [x] api-reset-user - Criar API /api/admin/gamification/users/[userId]/reset
- [x] api-change-log - Criar API /api/admin/gamification/change-log
- [x] api-rate-limiting - Adicionar rate limiting nas APIs de pontos

### Fase 3 - Componentes Visuais
- [x] component-badge - Criar componente AchievementBadge.tsx
- [x] component-points - Criar componente PointsDisplay.tsx
- [x] component-level - Criar componente LevelProgress.tsx
- [x] component-streak - Criar componente StreakDisplay.tsx
- [x] component-leaderboard - Criar componente LeaderboardCard.tsx
- [x] component-stats - Criar componente StatsCard.tsx

### Fase 4 - Dashboard do Usuário
- [x] page-dashboard - Criar página /profile/dashboard
- [x] page-badges - Criar página /profile/badges
- [x] page-leaderboard - Criar página /leaderboard

### Fase 5 - Integração
- [x] lib-gamification - Criar helper lib/gamification/index.ts
- [x] lib-notifications - Criar lib/gamification/notifications.ts
- [x] hook-gamification - Criar hook useGamification.ts
- [x] lib-notifications-badge - Implementar notificações ao desbloquear badge
- [x] lib-notifications-level - Implementar notificações ao subir de nível
- [x] lib-notifications-streak - Implementar notificações ao quebrar recorde
- [x] lib-notifications-leaderboard - Implementar notificações ao entrar no top 10
- [x] integrate-header - Atualizar header.tsx
- [x] integrate-my-courses - Atualizar my-courses/page.tsx
- [x] integrate-lab-ia - Atualizar ai-lab/page.tsx
- [x] integrate-complete-course - Integrar tracking de XP ao completar curso
- [x] integrate-complete-lesson - Integrar tracking de XP ao completar aula
- [x] integrate-quiz-submit - Integrar tracking de XP ao passar quiz
- [x] integrate-lab-chat - Integrar tracking de uso do Lab IA
- [x] integrate-notifications-achievements - Integrar notificações na função check_and_unlock_achievements
- [x] integrate-notifications-levels - Integrar notificações na função calculate_user_level

### Fase 6 - Componentes de UI
- [x] Atualizar header com indicadores de gamificação
- [x] Atualizar página "Meus Cursos" com estatísticas
- [x] Atualizar página do Lab IA com tracking

### Fase 7 - Testes
- [x] tests-database - Criar testes para funções SQL, triggers e RLS
- [x] tests-api - Criar testes para APIs de gamificação
- [x] tests-components - Criar testes para componentes visuais
- [x] tests-migration - Criar testes para migração de usuários existentes
- [x] tests-performance - Criar testes de performance (leaderboard com 1000+ usuários)
- [x] tests-edge-cases - Criar testes de edge cases (duplicação XP, validações, sobreposição)
- [x] tests-notifications - Criar testes de integração com notificações

### Fase 8 - Interface Administrativa
- [x] component-achievement-form - Criar componente AchievementForm.tsx
- [x] component-level-form - Criar componente LevelForm.tsx
- [x] component-achievements-table - Criar componente AchievementsTable.tsx
- [x] component-levels-table - Criar componente LevelsTable.tsx
- [x] component-settings - Criar componente GamificationSettings.tsx
- [x] component-conditions-editor - Criar componente ConditionsEditor.tsx
- [x] page-admin-gamification - Criar página principal /admin/gamification
- [x] page-admin-achievements - Criar página /admin/gamification/achievements
- [x] page-admin-achievement-new - Criar página /admin/gamification/achievements/new
- [x] page-admin-achievement-edit - Criar página /admin/gamification/achievements/[id]/edit
- [x] page-admin-levels - Criar página /admin/gamification/levels
- [x] page-admin-settings - Criar página /admin/gamification/settings
- [x] page-admin-analytics - Criar página /admin/gamification/analytics
- [x] update-admin-menu - Atualizar admin/page.tsx para adicionar link
- [x] validation-schemas - Criar schemas Zod em lib/validations/gamification.ts

### Fase 9 - Documentação e Analytics
- [x] docs-admin-guide - Criar documentação para admins (GAMIFICATION_ADMIN_GUIDE.md)
- [x] docs-developer-guide - Criar documentação para desenvolvedores (GAMIFICATION_DEVELOPER_GUIDE.md)
- [x] analytics-metrics - Adicionar métricas de engajamento ao dashboard de analytics
- [x] analytics-export - Implementar exportação de dados de analytics (CSV/JSON)

### Fase 10 - Acessibilidade e UX
- [x] accessibility-aria - Adicionar ARIA labels e roles aos componentes
- [x] accessibility-contrast - Verificar e ajustar contraste de cores (WCAG AA)
- [x] animations-confetti - Adicionar animação de confetti ao desbloquear badge raro
- [x] animations-transitions - Adicionar transições suaves em mudanças de estado
- [x] mobile-responsive - Otimizar todas as páginas de gamificação para mobile

---

## Considerações Importantes

### Performance
- Cache do leaderboard (TTL configurável)
- Índices apropriados no banco
- Lazy loading de badges e histórico
- Virtual scrolling no leaderboard

### Segurança
- Rate limiting em APIs de pontos
- Validação de origem de pontos
- RLS policies no banco
- Verificação de admin em rotas administrativas

### Acessibilidade
- ARIA labels em todos os componentes
- Contraste adequado (WCAG AA)
- Suporte a `prefers-reduced-motion`
- Navegação por teclado

### UX
- Feedback visual imediato
- Animações suaves
- Notificações não intrusivas
- Mobile-first design

---

## Próximos Passos

1. Revisar e aprovar este plano
2. Criar a migration do banco de dados
3. Testar funções SQL localmente
4. Implementar APIs backend
5. Criar componentes visuais
6. Integrar nas páginas existentes
7. Executar testes completos
8. Deploy e monitoramento

---

**Documento criado em:** 2025-01-20  
**Última atualização:** 2025-01-20  
**Status:** ⏳ Aguardando implementação

