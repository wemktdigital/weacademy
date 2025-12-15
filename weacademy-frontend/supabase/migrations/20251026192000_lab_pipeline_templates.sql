-- Tabela de templates de pipelines
CREATE TABLE IF NOT EXISTS public.lab_pipeline_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- marketing, educacional, pesquisa, compliance, outros
  steps JSONB NOT NULL, -- [{order:1, agent_name:'Criador de Posts'}, {order:2, agent_name:'Auditor de Compliance'}]
  agent_templates JSONB, -- [{name:'Criador de Posts', template_id:'uuid'}, {name:'Auditor', template_id:'uuid'}]
  official BOOLEAN DEFAULT false, -- Templates oficiais criados pela equipe
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_templates_category ON lab_pipeline_templates(category);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_templates_official ON lab_pipeline_templates(official);
CREATE INDEX IF NOT EXISTS idx_lab_pipeline_templates_created_at ON lab_pipeline_templates(created_at DESC);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_pipeline_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_lab_pipeline_templates_timestamp_trigger ON lab_pipeline_templates;
CREATE TRIGGER update_lab_pipeline_templates_timestamp_trigger
BEFORE UPDATE ON lab_pipeline_templates
FOR EACH ROW
EXECUTE FUNCTION update_lab_pipeline_templates_timestamp();

-- RLS (Row Level Security)
ALTER TABLE lab_pipeline_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Anyone can view pipeline templates" ON lab_pipeline_templates;
CREATE POLICY "Anyone can view pipeline templates"
  ON lab_pipeline_templates
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage pipeline templates" ON lab_pipeline_templates;
CREATE POLICY "Admins can manage pipeline templates"
  ON lab_pipeline_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

-- Comentários
COMMENT ON TABLE lab_pipeline_templates IS 'Templates de pipelines para criação rápida';
COMMENT ON COLUMN lab_pipeline_templates.category IS 'Categoria: marketing, educacional, pesquisa, compliance, outros';
COMMENT ON COLUMN lab_pipeline_templates.steps IS 'Array JSON com ordem e nomes dos agentes: [{order:1, agent_name:"..."}]';
COMMENT ON COLUMN lab_pipeline_templates.agent_templates IS 'IDs dos templates de agentes que podem ser usados para criar os agentes do pipeline';

-- Inserir templates pré-configurados
INSERT INTO lab_pipeline_templates (name, description, category, steps, official)
VALUES
  (
    'Criação Completa de Post Social',
    'Pipeline completo para criação de posts sociais com múltiplas etapas: briefing, criação de conteúdo, otimização para redes sociais e auditoria de compliance.',
    'marketing',
    '[
      {"order": 1, "agent_name": "Especialista em Briefing"},
      {"order": 2, "agent_name": "Criador de Posts Sociais"},
      {"order": 3, "agent_name": "Otimizador de Conteúdo"},
      {"order": 4, "agent_name": "Auditor de Compliance Médico"}
    ]'::jsonb,
    true
  ),
  (
    'Análise de Campanha → Otimização → Relatório',
    'Pipeline para análise completa de campanhas de marketing: análise de dados, otimização de performance e geração de relatório executivo.',
    'marketing',
    '[
      {"order": 1, "agent_name": "Analista de Campanha"},
      {"order": 2, "agent_name": "Otimizador de Performance"},
      {"order": 3, "agent_name": "Gerador de Relatórios"}
    ]'::jsonb,
    true
  ),
  (
    'Resumo → Tradução → Revisão',
    'Pipeline para processamento de conteúdo acadêmico: resumo de artigos científicos, tradução para diferentes idiomas e revisão linguística.',
    'educacional',
    '[
      {"order": 1, "agent_name": "Resumidor de Artigos"},
      {"order": 2, "agent_name": "Tradutor Médico"},
      {"order": 3, "agent_name": "Revisor Linguístico"}
    ]'::jsonb,
    true
  ),
  (
    'Briefing → Roteiro → Revisão de Compliance',
    'Pipeline para criação de conteúdo médico regulamentado: criação de briefing, desenvolvimento de roteiro e revisão de compliance médico.',
    'compliance',
    '[
      {"order": 1, "agent_name": "Especialista em Briefing"},
      {"order": 2, "agent_name": "Roteirista de Conteúdo"},
      {"order": 3, "agent_name": "Auditor de Compliance Médico"}
    ]'::jsonb,
    true
  );

