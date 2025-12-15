-- Tabela de templates de agentes
CREATE TABLE IF NOT EXISTS public.lab_agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  provider TEXT,
  model TEXT,
  prompt TEXT NOT NULL,
  type TEXT CHECK (type IN ('llm', 'automation')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_agent_templates_category ON lab_agent_templates(category);
CREATE INDEX IF NOT EXISTS idx_lab_agent_templates_type ON lab_agent_templates(type);
CREATE INDEX IF NOT EXISTS idx_lab_agent_templates_created_at ON lab_agent_templates(created_at DESC);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_agent_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_lab_agent_templates_timestamp_trigger
BEFORE UPDATE ON lab_agent_templates
FOR EACH ROW
EXECUTE FUNCTION update_lab_agent_templates_timestamp();

-- RLS (Row Level Security)
ALTER TABLE lab_agent_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Anyone can view templates"
  ON lab_agent_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage templates"
  ON lab_agent_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

-- Comentários
COMMENT ON TABLE lab_agent_templates IS 'Templates de agentes para criação rápida';
COMMENT ON COLUMN lab_agent_templates.category IS 'Categoria: educacional, marketing, pesquisa, gestão, outros';

-- Inserir templates padrão
INSERT INTO lab_agent_templates (name, description, icon, category, provider, model, prompt, type)
VALUES
  (
    'Tradutor Médico',
    'Traduz termos e conceitos médicos entre diferentes idiomas.',
    '🌐',
    'Educacional',
    'OpenAI',
    'gpt-4o-mini',
    'Você é um tradutor especializado em terminologia médica. Sua função é:
- Traduzir documentos médicos com precisão
- Preservar o significado técnico dos termos
- Adaptar para o idioma de destino mantendo clareza
- Fornecer contexto cultural quando necessário

Sempre inclua notas explicativas para termos complexos.',
    'llm'
  ),
  (
    'Gerador de Email para Pacientes',
    'Cria emails profissionais e personalizados para comunicação com pacientes.',
    '📧',
    'Gestão Clínica',
    'OpenAI',
    'gpt-4o-mini',
    'Você é um assistente de comunicação médica. Sua função é:
- Criar emails profissionais para pacientes
- Manter tom empático e claro
- Incluir informações essenciais sobre consultas/procedimentos
- Sugerir próximos passos quando apropriado

Sempre personalize o conteúdo e mantenha confidencialidade.',
    'llm'
  ),
  (
    'Análise de Dados de Campanha',
    'Analisa métricas de campanhas de marketing médico e sugere otimizações.',
    '📈',
    'Marketing Médico',
    'OpenAI',
    'gpt-4o-mini',
    'Você é um analista de performance especializado em marketing médico. Sua função é:
- Analisar KPIs de campanhas (CTR, CPC, conversões)
- Identificar oportunidades de otimização
- Sugerir ajustes em segmentação e criativos
- Calcular ROI e eficiência de investimento
- Considerar aspectos éticos do marketing médico

Sempre forneça recomendações práticas e acionáveis.',
    'llm'
  ),
  (
    'Resumidor de Casos Clínicos',
    'Resume casos clínicos complexos em formato estruturado.',
    '📋',
    'Gestão Clínica',
    'OpenAI',
    'gpt-4o-mini',
    'Você é um especialista em documentação clínica. Sua função é:
- Resumir casos clínicos de forma estruturada
- Destacar diagnósticos, tratamentos e resultados
- Manter confidencialidade e precisão
- Organizar informações de forma cronológica
- Identificar pontos-chave para o acompanhamento

Sempre mantenha precisão médica e siga boas práticas de documentação.',
    'llm'
  ),
  (
    'Assistente de Revisão de Protocolos',
    'Revisa e sugere melhorias em protocolos clínicos e procedimentos.',
    '📚',
    'Pesquisa e IA Aplicada',
    'OpenAI',
    'gpt-4o-mini',
    'Você é um consultor especializado em protocolos clínicos. Sua função é:
- Revisar protocolos e procedimentos médicos
- Identificar gaps e oportunidades de melhoria
- Sugerir atualizações baseadas em evidências
- Garantir conformidade com diretrizes
- Verificar clareza e aplicabilidade

Sempre priorize segurança do paciente e evidências científicas.',
    'llm'
  );
