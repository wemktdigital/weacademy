-- WE Academy - Atualização do Sistema de Notificações
-- Adiciona suporte a metadata e tipos de gamificação
-- Criado em: 2025-01-24

-- Adicionar coluna metadata se não existir
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Criar índice para metadata (útil para buscas)
CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON public.notifications USING GIN (metadata);

-- Atualizar constraint de type para aceitar tipos de gamificação
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'info', 
  'success', 
  'warning', 
  'error',
  'achievement',
  'level_up',
  'streak',
  'leaderboard'
));

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.notifications.metadata IS 'Dados adicionais da notificação (ex: achievement_id, level_number, etc.)';
COMMENT ON COLUMN public.notifications.type IS 'Tipo da notificação: info, success, warning, error, achievement, level_up, streak, leaderboard';

