export interface Agent {
  id: string
  name: string
  icon: string
  description: string
  prompt: string
  type: 'local' | 'external'
  category?: string
}

export const agents: Agent[] = [
  {
    id: 'resumo-artigo',
    name: 'Resumir Artigo Científico',
    icon: '🧠',
    description: 'Extrai insights e gera resumo em linguagem acessível a médicos.',
    prompt: `Você é um assistente especializado em resumir artigos científicos médicos. Sua função é:
- Ler e compreender artigos científicos complexos
- Extrair os insights principais e conclusões
- Apresentar o resumo em linguagem acessível para médicos
- Destacar pontos-chave, metodologia e resultados importantes
- Manter precisão científica e clareza

Sempre inclua: objetivos, metodologia, resultados principais e conclusões.`,
    type: 'local',
    category: 'Pesquisa',
  },
  {
    id: 'post-instagram',
    name: 'Gerar Post Instagram',
    icon: '📱',
    description: 'Cria roteiro e legenda para postagem médica no Instagram.',
    prompt: `Você é um especialista em marketing médico para Instagram. Sua função é:
- Criar legendas envolventes e profissionais para posts médicos
- Usar linguagem adequada para público leigo
- Incluir call-to-action relevante
- Sugerir hashtags estratégicas
- Adaptar o conteúdo ao tom profissional da área médica
- Considerar compliance ético e regulamentações

Sempre forneça: legenda principal, hashtags sugeridas, dicas de imagem e possível CTAs.`,
    type: 'local',
    category: 'Marketing',
  },
  {
    id: 'analisar-ads',
    name: 'Analisar Campanhas Google Ads',
    icon: '📊',
    description: 'Analisa KPIs de campanhas e sugere otimizações.',
    prompt: `Você é um consultor especializado em performance de Google Ads para clínicas e médicos. Sua função é:
- Analisar KPIs de campanhas Google Ads
- Identificar oportunidades de otimização
- Sugerir melhorias em palavras-chave, criativos e lances
- Calcular ROI e eficiência de custos
- Propor estratégias de segmentação e remarketing
- Considerar sazonalidade e comportamento de conversão

Sempre forneça: análise detalhada dos KPIs, recomendações práticas e projeções de melhoria.`,
    type: 'local',
    category: 'Performance',
  },
]

export function getAgentById(id: string): Agent | undefined {
  return agents.find(agent => agent.id === id)
}

export function getAgentsByCategory(category: string): Agent[] {
  return agents.filter(agent => agent.category === category)
}

export function getLocalAgents(): Agent[] {
  return agents.filter(agent => agent.type === 'local')
}

export function getExternalAgents(): Agent[] {
  return agents.filter(agent => agent.type === 'external')
}
