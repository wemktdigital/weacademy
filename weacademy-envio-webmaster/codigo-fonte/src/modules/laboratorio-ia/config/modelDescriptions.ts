// Descrições e dicas personalizadas para cada modelo
// Focadas em pontos fortes e capacidades do modelo, não em custo/preço

import { ModelCapabilities } from './models'

export interface ModelDescription {
  description: string  // Descrição focada em pontos fortes e capacidades
  tip: string          // Dica específica sobre como usar o modelo
}

export const MODEL_DESCRIPTIONS: Record<string, ModelDescription> = {
  // OpenAI - Geração de Texto (Fase 1)
  'openai:gpt-5': {
    description: 'Modelo de última geração para tarefas complexas e análises detalhadas. Excelente em raciocínio avançado, compreensão profunda e resolução de problemas desafiadores.',
    tip: 'Ideal para tarefas que exigem raciocínio profundo e análises detalhadas. Use para problemas complexos, análise de dados e respostas elaboradas que requerem máxima qualidade.'
  },
  'openai:gpt-5.1': {
    description: 'Versão aprimorada do GPT-5 com melhor desempenho em tarefas especializadas. Superior em raciocínio lógico, análise técnica e compreensão contextual avançada.',
    tip: 'Perfeito para tarefas especializadas que exigem máxima precisão. Use quando precisar da melhor qualidade possível em raciocínio e análise técnica.'
  },
  'openai:gpt-5-mini': {
    description: 'Modelo compacto e rápido, ideal para tarefas do dia a dia. Boa qualidade com excelente velocidade e análise multimodal de texto e imagens.',
    tip: 'Excelente para uso frequente e tarefas cotidianas. Envie imagens junto com seu texto para análise multimodal e obtenha respostas rápidas e precisas.'
  },
  'openai:gpt-5-nano': {
    description: 'Modelo rápido e eficiente, ideal para conversas leves e respostas instantâneas. Excelente em análise multimodal de texto e imagens para tarefas do dia a dia.',
    tip: 'Envie imagens junto com seu texto. O GPT-5 Nano descreve imagens, responde perguntas e combina informações visuais com texto para fornecer respostas mais completas.'
  },
  'openai:gpt-4o': {
    description: 'Modelo otimizado com excelente equilíbrio entre qualidade e velocidade. Ideal para análises complexas, geração de conteúdo e processamento multimodal.',
    tip: 'Versátil para diversas tarefas. Envie texto e imagens para análise completa. Ideal para quando precisa de qualidade alta com boa velocidade de resposta.'
  },
  'openai:gpt-4o-mini': {
    description: 'Versão compacta otimizada, perfeita para tarefas do dia a dia com velocidade excepcional. Excelente qualidade mantendo alta velocidade.',
    tip: 'Ideal para conversas rápidas e tarefas frequentes. Envie imagens para análise multimodal e obtenha respostas instantâneas e precisas.'
  },

  // Google - Gemini (Fase 2)
  'google:gemini-3-pro-preview-high': {
    description: 'Modelo premium com raciocínio profundo (High Thinking). Maximiza a profundidade de análise e qualidade das respostas para tarefas complexas.',
    tip: 'Ideal para problemas que exigem raciocínio profundo e análises detalhadas. Envie texto, imagens, áudio ou vídeo para análise multimodal completa.'
  },
  'google:gemini-3-pro-preview-low': {
    description: 'Modelo premium otimizado para baixa latência (Low Thinking). Perfeito para tarefas que precisam de respostas rápidas sem perder qualidade.',
    tip: 'Excelente para quando precisa de respostas rápidas mantendo alta qualidade. Minimiza tempo de processamento enquanto mantém excelentes resultados.'
  },
  'google:gemini-2.5-pro': {
    description: 'Modelo avançado com capacidades multimodais completas. Excelente em análise de texto, imagens, áudio e vídeo com alta qualidade de resposta.',
    tip: 'Envie qualquer tipo de mídia: texto, imagens, áudio ou vídeo. O Gemini 2.5 Pro analisa e processa todos os formatos para fornecer respostas completas.'
  },
  'google:gemini-2.5-flash': {
    description: 'Modelo rápido e eficiente com suporte multimodal completo. Ideal para tarefas do dia a dia que requerem análise de múltiplos tipos de conteúdo.',
    tip: 'Versátil para análise multimodal. Envie texto, imagens, áudio ou vídeo e obtenha respostas rápidas e precisas sobre qualquer tipo de conteúdo.'
  },
  'google:gemini-2.5-flash-lite': {
    description: 'Versão ultra leve e rápida, perfeita para conversas e tarefas simples. Mantém excelente qualidade com velocidade máxima.',
    tip: 'Ideal para conversas rápidas e tarefas simples. Envie texto ou imagens para análise e obtenha respostas instantâneas.'
  },
  'google:gemini-2.5-flash-image': {
    description: 'Especializado em geração de imagens a partir de descrições textuais. Criativo e preciso na criação de visualizações baseadas em seus prompts.',
    tip: 'Descreva detalhadamente a imagem que deseja criar. Inclua informações sobre estilo, composição, cores e elementos visuais para melhores resultados.'
  },
  'google:gemini-2.0-pro': {
    description: 'Modelo avançado com capacidades multimodais. Excelente em análise complexa de texto, imagens, áudio e vídeo.',
    tip: 'Suporta múltiplos formatos de entrada. Envie texto, imagens, áudio ou vídeo para análise multimodal completa e detalhada.'
  },
  'google:gemini-2.0-flash': {
    description: 'Modelo rápido com suporte multimodal. Ideal para análise rápida de diferentes tipos de conteúdo com boa qualidade.',
    tip: 'Versátil para análise multimodal rápida. Envie qualquer tipo de conteúdo e obtenha respostas eficientes e precisas.'
  },

  // OpenAI - Transcrição de Áudio (Fase 3)
  'openai:gpt-4o-mini-transcribe': {
    description: 'Especializado em transcrição de áudio com alta precisão. Ideal para converter arquivos de áudio em texto com velocidade e qualidade.',
    tip: 'Envie arquivos de áudio em formatos como MP3, WAV, M4A ou outros formatos comuns. O modelo transcreve com alta precisão e rapidez.'
  },
  'openai:gpt-4o-transcribe': {
    description: 'Versão avançada com melhor precisão em transcrição de áudio e suporte a múltiplos idiomas. Excelente para conteúdo complexo e técnico.',
    tip: 'Perfeito para transcrições de alta qualidade em múltiplos idiomas. Envie áudios longos ou com terminologia técnica para transcrição precisa.'
  },
  'openai:gpt-4o-transcribe-diarize': {
    description: 'Transcrição avançada com diarização (identificação de falantes). Ideal para conversas com múltiplos participantes, entrevistas e reuniões.',
    tip: 'Envie áudios de conversas ou reuniões com múltiplos falantes. O modelo identifica quem está falando e transcreve cada participante separadamente.'
  },

  // OpenAI - Geração de Vídeo (Fase 4)
  'openai:sora-2': {
    description: 'Geração de vídeos curtos a partir de descrições textuais ou imagens de referência. Excelente para criar conteúdo visual dinâmico.',
    tip: 'Descreva detalhadamente a cena, movimento e estilo visual desejado. Vídeos são gerados em até 5 segundos com alta qualidade visual.'
  },
  'openai:sora-2-pro': {
    description: 'Versão premium para geração de vídeos de alta qualidade com maior duração e controle de movimento. Suporta resoluções mais altas e melhor qualidade.',
    tip: 'Ideal para vídeos de alta qualidade e maior duração (até 12 segundos). Descreva ações específicas, movimento e detalhes visuais para melhores resultados.'
  },

  // OpenAI - Geração de Imagem (Fase 5)
  'openai:gpt-image-1': {
    description: 'Geração de imagens de alta qualidade a partir de descrições textuais. Suporta múltiplas resoluções e estilos para criação visual precisa.',
    tip: 'Descreva detalhadamente a imagem que deseja criar. Inclua informações sobre estilo, composição, cores e elementos visuais para obter resultados precisos.'
  },
  'openai:gpt-image-1-mini': {
    description: 'Versão otimizada para geração rápida de imagens com qualidade excelente. Ideal para criação visual rápida mantendo alta qualidade.',
    tip: 'Perfeito para geração rápida de imagens. Seja específico em sua descrição sobre estilo, elementos e composição para melhores resultados.'
  },

  // Replicate - Geração de Imagem (Fase 6)
  'replicate:black-forest-labs/flux-1.1-pro': {
    description: 'Modelo de geração de imagens de alta qualidade com excelente aderência ao prompt. Ideal para criação visual precisa e detalhada.',
    tip: 'Descreva detalhadamente a imagem desejada. O FLUX 1.1 Pro segue seus prompts com alta precisão, ideal para imagens realistas e detalhadas.'
  },
  'replicate:black-forest-labs/flux-krea-dev': {
    description: 'Fotorealismo excepcional que evita o "AI look" oversaturado. Estética distintiva e visualmente interessante para imagens naturais.',
    tip: 'Ideal para criar imagens realistas e naturais. Descreva cenas e elementos como se estivesse fotografando, para resultados mais autênticos.'
  },
  'replicate:black-forest-labs/flux-kontext-max': {
    description: 'Modelo premium de edição de imagem com máxima performance. Excelente em geração de tipografia melhorada e edição precisa.',
    tip: 'Perfeito para editar imagens existentes ou criar imagens com texto. Envie uma imagem de referência e descreva as modificações desejadas.'
  },
  'replicate:black-forest-labs/flux-kontext-pro': {
    description: 'Performance state-of-the-art com saídas de alta qualidade. Excelente seguimento de prompt e resultados consistentes para criação visual.',
    tip: 'Ideal para projetos que exigem máxima qualidade. Descreva detalhadamente o que deseja e obtenha resultados consistentes e precisos.'
  },
  'replicate:black-forest-labs/flux-kontext-dev': {
    description: 'Versão open-weight com boa performance para edição de imagens. Uso comercial disponível com excelente custo-benefício.',
    tip: 'Excelente para edição de imagens baseada em texto. Envie uma imagem e descreva as modificações ou melhorias que deseja aplicar.'
  },
  'replicate:bytedance/seedream-4': {
    description: 'Geração e edição unificadas de imagens. Suporta até 4K e múltiplas referências para criação visual versátil e de alta qualidade.',
    tip: 'Versátil para criação e edição de imagens. Pode usar múltiplas imagens de referência e gerar em alta resolução (até 4K).'
  },
  'replicate:ideogram-ai/ideogram-v3-turbo': {
    description: 'Mais rápido e eficiente com excelente renderização de texto e fotorealismo. Ideal para criação visual rápida com alta qualidade.',
    tip: 'Perfeito para criar imagens com texto renderizado de forma precisa. Descreva a imagem incluindo qualquer texto que deseja ver na imagem.'
  },
  'replicate:ideogram-ai/ideogram-v3-balanced': {
    description: 'Bom equilíbrio entre velocidade e qualidade. Excelente para uso geral em geração de imagens com resultados consistentes.',
    tip: 'Ideal para uso geral. Balanceia velocidade e qualidade, perfeito para quando precisa de resultados rápidos mantendo boa qualidade visual.'
  },
  'replicate:ideogram-ai/ideogram-v3-quality': {
    description: 'Versão de mais alta qualidade com renderização precisa de texto e máximo fotorealismo. Ideal para projetos que exigem máxima excelência visual.',
    tip: 'Use quando precisar da máxima qualidade possível. Excelente em renderizar texto dentro de imagens e criar visualizações realistas e detalhadas.'
  },
  'replicate:ideogram-ai/ideogram-character': {
    description: 'Especializado em gerar variações consistentes de personagens a partir de uma imagem de referência. Ideal para criar personagens recorrentes.',
    tip: 'Envie uma imagem de referência de um personagem e descreva as variações que deseja. Perfeito para criar personagens consistentes em diferentes cenas.'
  },

  // Google - Geração de Vídeo e Música (Fase 7)
  'google:veo-3.1-generate-preview': {
    description: 'Geração de vídeos de alta qualidade a partir de texto ou imagens. Geração assíncrona com excelente qualidade visual e movimento natural.',
    tip: 'Descreva detalhadamente a cena, movimento e estilo visual. A geração é assíncrona - você receberá uma notificação quando o vídeo estiver pronto.'
  },
  'google:veo-3.1-fast-generate-preview': {
    description: 'Versão rápida para geração de vídeos com menor tempo de processamento. Mantém alta qualidade visual com velocidade otimizada.',
    tip: 'Ideal para quando precisa de vídeos mais rapidamente. Descreva a cena desejada e receba o vídeo gerado em menos tempo.'
  },
  'google:lyria-realtime-exp': {
    description: 'Geração de música instrumental em tempo real via WebSocket streaming. Modelo experimental para criação musical instantânea.',
    tip: 'Modelo experimental para geração de música. Atualmente disponível para informações - integração completa via WebSocket em desenvolvimento.'
  },

  // Modelos Especializados e Outros (Fase 8)
  'pubmed:pubmed-search': {
    description: 'Busca e recuperação de artigos científicos do PubMed via NCBI E-utilities. Acesso gratuito a milhões de publicações científicas.',
    tip: 'Descreva o tópico ou pergunta científica que deseja pesquisar. O modelo busca e recupera artigos relevantes do banco de dados PubMed.'
  },
  'deepseek:deepseek-chat': {
    description: 'Modelo rápido e eficiente para conversas e tarefas do dia a dia. Excelente em análise de código e respostas contextualizadas.',
    tip: 'Ideal para conversas rápidas e análise de código. Envie perguntas ou código para análise e obtenha respostas precisas e rápidas.'
  },
  'deepseek:deepseek-reasoner': {
    description: 'Modelo especializado em raciocínio profundo e resolução de problemas complexos. Excelente em análise lógica e dedução.',
    tip: 'Perfeito para problemas que exigem raciocínio lógico e análise detalhada. Use para questões complexas que requerem pensamento passo a passo.'
  },
  'grok:grok-4-fast': {
    description: 'Modelo rápido com suporte multimodal para análise de texto e imagens. Ideal para tarefas do dia a dia com alta velocidade.',
    tip: 'Versátil para análise rápida de texto e imagens. Envie mensagens ou imagens para análise e obtenha respostas instantâneas e precisas.'
  },
  'grok:grok-4-fast-reasoning': {
    description: 'Versão otimizada para raciocínio rápido com suporte multimodal. Perfeito para análise rápida que ainda exige pensamento estruturado.',
    tip: 'Ideal quando precisa de raciocínio estruturado com rapidez. Envie texto ou imagens para análise e obtenha respostas rápidas e bem fundamentadas.'
  },
  'anthropic:claude-3-5-sonnet-20241022': {
    description: 'Modelo avançado com excelente raciocínio e análise profunda. Ideal para tarefas complexas que exigem compreensão contextual.',
    tip: 'Excelente para análise complexa e raciocínio profundo. Envie texto ou imagens para análise detalhada e respostas bem fundamentadas.'
  },
  'anthropic:claude-3-5-haiku-20241022': {
    description: 'Modelo rápido e eficiente mantendo alta qualidade de resposta. Ideal para uso frequente em tarefas do dia a dia.',
    tip: 'Perfeito para tarefas frequentes que precisam de respostas rápidas e precisas. Envie texto ou imagens para análise e obtenha resultados rápidos.'
  },
  'anthropic:claude-3-opus-20240229': {
    description: 'Modelo premium com máxima capacidade de raciocínio e análise. Excelente para problemas complexos e análise profunda.',
    tip: 'Use para tarefas que exigem máxima qualidade e raciocínio profundo. Ideal para análise complexa, redação e resolução de problemas desafiadores.'
  },
  'replicate:meta/meta-llama-3.1-405b-instruct': {
    description: 'Modelo de última geração com excelente desempenho em instruções e análise. Ideal para tarefas complexas e raciocínio avançado.',
    tip: 'Perfeito para seguir instruções complexas e análises detalhadas. Descreva claramente o que deseja e obtenha respostas precisas e completas.'
  },
  'replicate:bytedance/seedance-1-pro-fast': {
    description: 'Geração rápida de vídeos a partir de texto ou imagens de referência. Ideal para criar conteúdo visual dinâmico com velocidade.',
    tip: 'Descreva a cena, movimento e estilo visual desejado. Perfeito para geração rápida de vídeos a partir de descrições textuais ou imagens.'
  },
  // Outras descrições serão adicionadas conforme novos modelos forem disponibilizados
}

// Função helper para gerar descrição genérica baseada em capabilities
function generateGenericDescription(
  provider: string,
  model: string,
  capabilities?: ModelCapabilities
): ModelDescription {
  const inputTypes = capabilities?.input || []
  const outputTypes = capabilities?.output || []
  
  // Construir descrição baseada em capabilities
  const inputDesc = getMediaTypeDescription(inputTypes, 'entrada')
  const outputDesc = getMediaTypeDescription(outputTypes, 'saída')
  
  let description = `Modelo ${provider} ${model}. `
  
  if (inputDesc && outputDesc) {
    description += `Aceita ${inputDesc} e gera ${outputDesc}. `
  }
  
  // Adicionar contexto baseado no tipo de saída
  if (outputTypes.includes('video')) {
    description += 'Ideal para geração de vídeos a partir de texto ou imagens.'
  } else if (outputTypes.includes('image')) {
    description += 'Perfeito para criar imagens a partir de descrições textuais.'
  } else if (outputTypes.includes('audio')) {
    description += 'Especializado em geração de conteúdo de áudio.'
  } else if (inputTypes.includes('audio')) {
    description += 'Excelente para processamento e transcrição de áudio.'
  } else {
    description += 'Potente para análise e geração de conteúdo.'
  }
  
  // Gerar dica baseada em capabilities
  let tip = 'Seja específico em seus prompts para obter melhores resultados.'
  
  if (inputTypes.includes('image') && outputTypes.includes('text')) {
    tip = 'Envie imagens junto com seu texto para análise multimodal. O modelo pode descrever imagens e responder perguntas sobre elas.'
  } else if (outputTypes.includes('image')) {
    tip = 'Descreva detalhadamente a imagem que deseja criar. Inclua informações sobre estilo, composição e elementos visuais.'
  } else if (outputTypes.includes('video')) {
    tip = 'Descreva a cena, movimento e estilo visual desejado. Seja específico sobre ações e detalhes visuais.'
  } else if (inputTypes.includes('audio')) {
    tip = 'Envie arquivos de áudio para transcrição. Formatos comuns como MP3, WAV e M4A são suportados.'
  }
  
  return {
    description: description.trim(),
    tip
  }
}

// Helper para descrever tipos de mídia
function getMediaTypeDescription(types: string[], context: 'entrada' | 'saída'): string {
  if (types.length === 0) return ''
  
  const labels: Record<string, string> = {
    text: 'texto',
    image: 'imagens',
    audio: 'áudio',
    video: 'vídeos'
  }
  
  if (types.length === 1) {
    return labels[types[0]] || types[0]
  }
  
  if (types.length === 2) {
    return `${labels[types[0]] || types[0]} e ${labels[types[1]] || types[1]}`
  }
  
  // 3 ou mais tipos
  const last = types[types.length - 1]
  const others = types.slice(0, -1).map(t => labels[t] || t).join(', ')
  return `${others} e ${labels[last] || last}`
}

/**
 * Obtém descrição personalizada do modelo ou gera uma genérica
 */
export function getModelDescription(
  provider: string,
  model: string,
  capabilities?: ModelCapabilities
): ModelDescription {
  const key = `${provider.toLowerCase()}:${model}`
  const custom = MODEL_DESCRIPTIONS[key]
  
  if (custom) return custom
  
  // Gerar descrição genérica baseada em capabilities
  return generateGenericDescription(provider, model, capabilities)
}

