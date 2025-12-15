-- Adicionar campo draft à tabela lab_agent_pipelines
ALTER TABLE public.lab_agent_pipelines 
ADD COLUMN IF NOT EXISTS draft BOOLEAN DEFAULT false;

-- Adicionar campo last_tested_at para rastrear quando o pipeline foi testado
ALTER TABLE public.lab_agent_pipelines 
ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ;

-- Comentários
COMMENT ON COLUMN lab_agent_pipelines.draft IS 'Indica se o pipeline está em modo rascunho (não disponível para uso público)';
COMMENT ON COLUMN lab_agent_pipelines.last_tested_at IS 'Data/hora do último teste realizado neste pipeline';

-- Criar índice para performance nas consultas de pipelines draft
CREATE INDEX IF NOT EXISTS idx_lab_pipelines_draft ON lab_agent_pipelines(draft);
CREATE INDEX IF NOT EXISTS idx_lab_pipelines_last_tested ON lab_agent_pipelines(last_tested_at);

-- Atualizar RLS para garantir que pipelines draft só sejam visíveis para admins/gestores
-- (manter políticas existentes, mas adicionar validação)

-- Política adicional para garantir que usuários normais não vejam pipelines draft
DROP POLICY IF EXISTS "Users can only see non-draft pipelines" ON lab_agent_pipelines;
CREATE POLICY "Users can only see non-draft pipelines"
  ON lab_agent_pipelines
  FOR SELECT
  USING (
    NOT draft OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

-- Atualizar política de INSERT para permitir que admins criem pipelines draft
DROP POLICY IF EXISTS "Admins can create pipelines" ON lab_agent_pipelines;
CREATE POLICY "Admins can create pipelines"
  ON lab_agent_pipelines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we', 'gestor')
    )
  );

-- Atualizar política de UPDATE para permitir que admins atualizem pipelines
DROP POLICY IF EXISTS "Admins can update pipelines" ON lab_agent_pipelines;
CREATE POLICY "Admins can update pipelines"
  ON lab_agent_pipelines
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we', 'gestor')
    )
  );

-- Atualizar política de DELETE para permitir que admins deletem pipelines
DROP POLICY IF EXISTS "Admins can delete pipelines" ON lab_agent_pipelines;
CREATE POLICY "Admins can delete pipelines"
  ON lab_agent_pipelines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we', 'gestor')
    )
  );

