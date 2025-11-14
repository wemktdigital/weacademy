// Tabela centralizada de preços por modelo (USD por 1M tokens ou execução equivalente)
// Os valores foram consolidados a partir das tabelas públicas dos provedores (Out/Nov 2025)
// e adaptados para padronização interna.

export interface ModelPricing {
  input: number // USD por 1M tokens de entrada (ou custo base da execução)
  output: number // USD por 1M tokens de saída (ou custo adicional por geração)
  notes?: string // Observações adicionais (ex.: cobrança por execução única)
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // PubMed - busca de artigos científicos (gratuito via NCBI E-utilities)
  'pubmed:pubmed-search': { input: 0.00, output: 0.00, notes: 'Gratuito. Busca e recuperação de artigos científicos do PubMed via NCBI E-utilities' },
  // OpenAI - geração de texto
  'openai:gpt-5': { input: 5.0, output: 15.0 },
  'openai:gpt-5.1': { input: 6.0, output: 18.0 },
  'openai:gpt-5-mini': { input: 0.60, output: 2.40 },
  'openai:gpt-5-nano': { input: 0.10, output: 0.40 },
  'openai:gpt-4o': { input: 2.50, output: 10.00 },
  'openai:gpt-4o-mini': { input: 0.15, output: 0.60 },
  // OpenAI - transcrição de áudio
  'openai:gpt-4o-mini-transcribe': { input: 0.15, output: 0.00, notes: 'Cobrança por minuto de áudio transcrito. $0.15/minuto. Especializado em transcrição de áudio com alta precisão' },
  'openai:gpt-4o-transcribe': { input: 0.30, output: 0.00, notes: 'Cobrança por minuto de áudio transcrito. $0.30/minuto. Versão avançada com melhor precisão e suporte a múltiplos idiomas' },
  'openai:gpt-4o-transcribe-diarize': { input: 0.45, output: 0.00, notes: 'Cobrança por minuto de áudio transcrito. $0.45/minuto. Inclui diarização (identificação de falantes) para conversas com múltiplos participantes' },
  // OpenAI - geração de vídeo (Sora 2)
  'openai:sora-2': { input: 0.10, output: 0.00, notes: 'Cobrança por segundo de vídeo gerado (720p). $0.10/segundo. Duração máxima: 5 segundos' },
  'openai:sora-2-pro': { input: 0.30, output: 0.00, notes: 'Cobrança por segundo de vídeo gerado. 720p: $0.30/s, 1024p: $0.50/s. Duração máxima: 12 segundos. Suporta resolução mais alta e melhor controle de movimento' },
  // OpenAI - geração de imagem (GPT-Image-1)
  'openai:gpt-image-1': { input: 0.04, output: 0.00, notes: 'Cobrança por imagem gerada. $0.04/imagem. Suporta múltiplas resoluções e estilos' },
  'openai:gpt-image-1-mini': { input: 0.02, output: 0.00, notes: 'Cobrança por imagem gerada. $0.02/imagem. Versão econômica com qualidade otimizada' },
  // Replicate - geração de imagem (FLUX 1.1 Pro)
  'replicate:black-forest-labs/flux-1.1-pro': { input: 0.003, output: 0.00, notes: 'Cobrança por segundo de execução. ~$0.003/s. Modelo de alta qualidade com excelente aderência ao prompt' },
  // Replicate - geração de imagem (FLUX.1 Krea [dev])
  'replicate:black-forest-labs/flux-krea-dev': { input: 0.003, output: 0.00, notes: 'Cobrança por segundo de execução. ~$0.003/s. Fotorealismo excepcional que evita o "AI look" oversaturado, estética distintiva' },
  // Replicate - edição de imagem baseada em texto (FLUX.1 Kontext [max])
  'replicate:black-forest-labs/flux-kontext-max': { input: 0.01, output: 0.00, notes: 'Cobrança por segundo de execução. ~$0.01/s. Modelo premium de edição de imagem com máxima performance e geração de tipografia melhorada' },
  // Replicate - edição de imagem baseada em texto (FLUX.1 Kontext [pro])
  'replicate:black-forest-labs/flux-kontext-pro': { input: 0.007, output: 0.00, notes: 'Cobrança por segundo de execução. ~$0.007/s. Performance state-of-the-art com saídas de alta qualidade, excelente seguimento de prompt e resultados consistentes' },
  // Replicate - edição de imagem baseada em texto (FLUX.1 Kontext [dev])
  'replicate:black-forest-labs/flux-kontext-dev': { input: 0.005, output: 0.00, notes: 'Cobrança por segundo de execução. ~$0.005/s. Versão open-weight com boa performance, uso comercial disponível via Replicate' },
  // Replicate - geração e edição de imagem (Seedream 4.0)
  'replicate:bytedance/seedream-4': { input: 0.004, output: 0.00, notes: 'Cobrança por segundo de execução. ~$0.004/s. Geração e edição unificadas, suporta até 4K e múltiplas referências' },
  // Replicate - geração de imagem (Ideogram v3 Turbo)
  'replicate:ideogram-ai/ideogram-v3-turbo': { input: 0.03, output: 0.00, notes: 'Cobrança por imagem gerada. $0.03/imagem. Mais rápido e barato, excelente renderização de texto e fotorealismo' },
  // Replicate - geração de imagem (Ideogram v3 Balanced)
  'replicate:ideogram-ai/ideogram-v3-balanced': { input: 0.06, output: 0.00, notes: 'Cobrança por imagem gerada. $0.06/imagem. Bom equilíbrio entre velocidade e qualidade' },
  // Replicate - geração de imagem (Ideogram v3 Quality)
  'replicate:ideogram-ai/ideogram-v3-quality': { input: 0.09, output: 0.00, notes: 'Cobrança por imagem gerada. $0.09/imagem. Versão de mais alta qualidade, renderização precisa de texto e máximo fotorealismo' },
  // Replicate - geração de personagens consistentes (Ideogram Character)
  'replicate:ideogram-ai/ideogram-character': { input: 0.05, output: 0.00, notes: 'Cobrança por imagem gerada. $0.05/imagem. Gera variações consistentes de personagens a partir de uma imagem de referência' },
  'openai:gpt-4-turbo': { input: 10.00, output: 30.00 },
  'openai:gpt-4': { input: 30.00, output: 60.00 },
  'openai:gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'openai:o4-mini': { input: 0.60, output: 2.40 },
  'openai:o3-mini': { input: 0.15, output: 0.60 },
  'openai:o1-preview': { input: 15.00, output: 60.00 },
  'openai:o1-mini': { input: 1.10, output: 4.40 },

  // Google Gemini
  'google:gemini-2.5-pro': { input: 3.50, output: 10.50 },
  'google:gemini-2.5-flash': { input: 0.40, output: 1.20 },
  'google:gemini-2.5-flash-lite': { input: 0.03, output: 0.12 },
  'google:gemini-2.5-flash-image': { input: 0.40, output: 1.20 },
  'google:gemini-2.0-pro': { input: 3.50, output: 10.50 },
  'google:gemini-2.0-flash': { input: 0.35, output: 1.05 },
  'google:gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'google:gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'google:gemini-1.5-flash-lite': { input: 0.006, output: 0.024 },
  'google:gemma-3-27b-it': { input: 0.35, output: 0.35 },
  'google:veo-3.1-generate-preview': { input: 1.00, output: 1.00, notes: 'Cobrança por minuto gerado (aprox.)' },
  'google:veo-3.1-fast-generate-preview': { input: 0.50, output: 0.50, notes: 'Cobrança por minuto gerado (aprox.)' },
  'google:imagenes-2': { input: 1.00, output: 0.00, notes: 'Preço por geração de imagem' },

  // DeepSeek (USD por 1M tokens)
  'deepseek:deepseek-chat': { input: 0.28, output: 1.12 },
  'deepseek:deepseek-reasoner': { input: 2.78, output: 11.12 },
  'deepseek:deepseek-r1': { input: 1.12, output: 4.48 },

  // Grok (xAI)
  'grok:grok-4-fast': { input: 0.20, output: 0.20 },
  'grok:grok-4-fast-reasoning': { input: 0.80, output: 0.80 },
  'grok:grok-3': { input: 1.00, output: 1.00 },
  'grok:grok-3-mini': { input: 0.15, output: 0.15 },

  // Anthropic Claude
  'anthropic:claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'anthropic:claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'anthropic:claude-3-7-sonnet': { input: 3.75, output: 15.00 },
  'anthropic:claude-3-7-haiku': { input: 0.88, output: 4.50 },
  'anthropic:claude-3-opus-20240229': { input: 15.00, output: 75.00 },

  // Replicate - LLMs (custo por execução aproximado convertido para tokens)
  'replicate:meta/meta-llama-3.1-405b-instruct': { input: 15.0, output: 15.0, notes: 'Cobrança por tempo de uso; valor médio convertido' },
  'replicate:meta/meta-llama-3.1-70b-instruct': { input: 1.2, output: 1.2, notes: 'Cobrança média por execução' },
  'replicate:meta/meta-llama-3.2-3b-instruct': { input: 0.08, output: 0.08, notes: 'Cobrança média por execução' },
  'replicate:anthropic/claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'replicate:anthropic/claude-3-5-haiku': { input: 0.8, output: 4.0 },
  'replicate:weaviate/ember-v1': { input: 0.12, output: 0.12 },

  // Replicate - Imagem / Vídeo / Multimídia (custo total por execução)
  'replicate:runwayml/gen3-alpha': { input: 0.18, output: 0.00, notes: 'Custo fixo por geração de vídeo' },
  'replicate:runwayml/gen3-turbo': { input: 0.03, output: 0.00, notes: 'Custo fixo por geração de vídeo' },
  'replicate:851-labs/background-remover': { input: 0.20, output: 0.00, notes: 'Cobrança por processamento de imagem' },
  'replicate:arielreplicate/robust_video_matting': { input: 0.45, output: 0.00, notes: 'Cobrança por processamento de vídeo' },
  'replicate:bytedance/seedance-1-pro-fast': { input: 0.65, output: 0.00, notes: 'Cobrança por geração de vídeo' },
  'replicate:bytedance/seedance-image': { input: 0.25, output: 0.00, notes: 'Cobrança por geração de imagem animada' },
  'replicate:black-forest-labs/flux-dev': { input: 0.015, output: 0.00, notes: 'Cobrança por geração de imagem' },
  'replicate:black-forest-labs/flux-pro': { input: 0.10, output: 0.00, notes: 'Cobrança por geração de imagem' },
}

export function getModelPricing(provider: string, model: string): ModelPricing | undefined {
  const key = `${provider.toLowerCase()}:${model}`
  return MODEL_PRICING[key]
}

