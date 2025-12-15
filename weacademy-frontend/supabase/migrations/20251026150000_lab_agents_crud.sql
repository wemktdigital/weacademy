-- Tabela de agentes do laboratório de IA
CREATE TABLE IF NOT EXISTS public.lab_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  type TEXT CHECK (type IN ('llm', 'automation')),
  provider TEXT,
  model TEXT,
  prompt TEXT,
  category TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_agents_active ON lab_agents(active);
CREATE INDEX IF NOT EXISTS idx_lab_agents_category ON lab_agents(category);
CREATE INDEX IF NOT EXISTS idx_lab_agents_type ON lab_agents(type);
CREATE INDEX IF NOT EXISTS idx_lab_agents_created_at ON lab_agents(created_at DESC);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_agents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_lab_agents_timestamp_trigger ON lab_agents;
CREATE TRIGGER update_lab_agents_timestamp_trigger
BEFORE UPDATE ON lab_agents
FOR EACH ROW
EXECUTE FUNCTION update_lab_agents_timestamp();

-- RLS (Row Level Security)
ALTER TABLE lab_agents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Anyone can view active agents" ON lab_agents;
CREATE POLICY "Anyone can view active agents"
  ON lab_agents
  FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Admins can view all agents" ON lab_agents;
CREATE POLICY "Admins can view all agents"
  ON lab_agents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

DROP POLICY IF EXISTS "Admins can insert agents" ON lab_agents;
CREATE POLICY "Admins can insert agents"
  ON lab_agents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

DROP POLICY IF EXISTS "Admins can update agents" ON lab_agents;
CREATE POLICY "Admins can update agents"
  ON lab_agents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

DROP POLICY IF EXISTS "Admins can delete agents" ON lab_agents;
CREATE POLICY "Admins can delete agents"
  ON lab_agents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

-- Comentários
COMMENT ON TABLE lab_agents IS 'Agentes configuráveis do Laboratório de IA';
COMMENT ON COLUMN lab_agents.type IS 'Tipo: llm (local) ou automation (externo)';
COMMENT ON COLUMN lab_agents.category IS 'Categoria: educacional, marketing, pesquisa, etc';

-- Inserir agentes padrão (migração dos agentes existentes)
INSERT INTO lab_agents (name, description, icon, type, provider, model, prompt, category, active)
VALUES
  (
    'Resumir Artigo Científico',
    'Extrai insights e gera resumo em linguagem acessível a médicos.',
    '🧠',
    'llm',
    'OpenAI',
    'gpt-4o-mini',
    'Você é um assistente especializado em resumir artigos científicos médicos. Sua função é:
- Ler e compreender artigos científicos complexos
- Extrair os insights principais e conclusões
- Apresentar o resumo em linguagem acessível para médicos
- Destacar pontos-chave, metodologia e resultados importantes
- Manter precisão científica e clareza

Sempre inclua: objetivos, metodologia, resultados principais e conclusões.',
    'Pesquisa',
    true
  ),
  (
    'Gerar Post Instagram',
    'Cria roteiro e legenda para postagem médica no Instagram.',
    '📱',
    'llm',
    'OpenAI',
    'gpt-4o-mini',
    'Você é um especialista em marketing médico para Instagram. Sua função é:
- Criar legendas envolventes e profissionais para posts médicos
- Usar linguagem adequada para público leigo
- Incluir call-to-action relevante
- Sugerir hashtags estratégicas
- Adaptar o conteúdo ao tom profissional da área médica
- Considerar compliance ético e regulamentações

Sempre forneça: legenda principal, hashtags sugeridas, dicas de imagem e possível CTAs.',
    'Marketing',
    true
  ),
  (
    'Analisar Campanhas Google Ads',
    'Analisa KPIs de campanhas e sugere otimizações.',
    '📊',
    'llm',
    'OpenAI',
    'gpt-4o-mini',
    'Você é um consultor especializado em performance de Google Ads para clínicas e médicos. Sua função é:
- Analisar KPIs de campanhas Google Ads
- Identificar oportunidades de otimização
- Sugerir melhorias em palavras-chave, criativos e lances
- Calcular ROI e eficiência de custos
- Propor estratégias de segmentação e remarketing
- Considerar sazonalidade e comportamento de conversão

Sempre forneça: análise detalhada dos KPIs, recomendações práticas e projeções de melhoria.',
    'Performance',
    true
  );
