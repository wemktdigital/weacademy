// Configuração de modelos disponíveis no Laboratório de IA

export type MediaType = 'text' | 'image' | 'audio' | 'video'

export interface ModelCapabilities {
  input: MediaType[]
  output: MediaType[]
}

export interface LLMModel {
  provider: string
  model: string
  displayName: string
  icon: string
  capabilities?: ModelCapabilities
}

export const AVAILABLE_MODELS: LLMModel[] = [
  {
    provider: 'OpenAI',
    model: 'gpt-5.2',
    displayName: 'GPT-5.2',
    icon: '🤖',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-5.1',
    displayName: 'GPT-5.1',
    icon: '🚀',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-5',
    displayName: 'GPT-5',
    icon: '🤖',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    icon: '🤖',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    icon: '🤖',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-image-1.5',
    displayName: 'GPT-Image-1.5',
    icon: '🖼️',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-image-1',
    displayName: 'GPT-Image-1',
    icon: '🖼️',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-image-1-mini',
    displayName: 'GPT-Image-1 Mini',
    icon: '🖼️',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'o1-mini',
    displayName: 'o1-mini',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'o3-mini',
    displayName: 'o3-mini',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'o4-mini',
    displayName: 'o4-mini',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'o4-mini-deep-research',
    displayName: 'o4-mini (Deep Research)',
    icon: '🔬',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'o3',
    displayName: 'o3',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'sora-2',
    displayName: 'Sora 2',
    icon: '🎬',
    capabilities: {
      input: ['text', 'image'],
      output: ['video'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'sora-2-pro',
    displayName: 'Sora 2 Pro',
    icon: '🎥',
    capabilities: {
      input: ['text', 'image'],
      output: ['video'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-4o-mini-tts',
    displayName: 'GPT-4o Mini TTS',
    icon: '🗣️',
    capabilities: {
      input: ['text'],
      output: ['audio'],
    },
  },
  {
    provider: 'OpenAI',
    model: 'gpt-4o-transcribe',
    displayName: 'GPT-4o Transcribe',
    icon: '🎙️',
    capabilities: {
      input: ['audio'],
      output: ['text'],
    },
  },
  {
    provider: 'PubMed',
    model: 'pubmed-search',
    displayName: 'PubMed Search',
    icon: '🔬',
    capabilities: {
      input: ['text'],
      output: ['text'],
    },
  },
  {
    provider: 'Google',
    model: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro Preview',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image', 'audio', 'video'],
      output: ['text'],
    },
  },
  {
    provider: 'Google',
    model: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image',
    icon: '🎨',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Google',
    model: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    icon: '💎',
    capabilities: {
      input: ['text', 'image', 'audio', 'video'],
      output: ['text'],
    },
  },
  {
    provider: 'Google',
    model: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    icon: '⚡',
    capabilities: {
      input: ['text', 'image', 'audio', 'video'],
      output: ['text'],
    },
  },
  {
    provider: 'Google',
    model: 'veo-3.1-generate-preview',
    displayName: 'Veo 3.1 Generate',
    icon: '🎬',
    capabilities: {
      input: ['text', 'image'],
      output: ['video'],
    },
  },
  {
    provider: 'Google',
    model: 'veo-3.1-fast-generate-preview',
    displayName: 'Veo 3.1 Fast Generate',
    icon: '⚡🎬',
    capabilities: {
      input: ['text', 'image'],
      output: ['video'],
    },
  },
  {
    provider: 'Google',
    model: 'lyria-realtime-exp',
    displayName: 'Lyria RealTime',
    icon: '🎵',
    capabilities: {
      input: ['text'],
      output: ['audio'],
    },
  },
  {
    provider: 'DeepSeek',
    model: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    icon: '🔥',
    capabilities: {
      input: ['text'],
      output: ['text'],
    },
  },
  {
    provider: 'DeepSeek',
    model: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    icon: '🧠',
    capabilities: {
      input: ['text'],
      output: ['text'],
    },
  },
  {
    provider: 'Grok',
    model: 'grok-4-1-fast-reasoning',
    displayName: 'Grok 4.1 Fast Reasoning',
    icon: '⚡🧠',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Grok',
    model: 'grok-4-1-fast-non-reasoning',
    displayName: 'Grok 4.1 Fast',
    icon: '⚡',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Grok',
    model: 'grok-2-image-1212',
    displayName: 'Grok 2 Image',
    icon: '🖼️',
    capabilities: {
      input: ['text'],
      output: ['image'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-4-5-sonnet-latest',
    displayName: 'Claude Sonnet 4.5',
    icon: '🎯',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-4-sonnet-latest',
    displayName: 'Claude Sonnet 4',
    icon: '🎯',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-4-5-opus-latest',
    displayName: 'Claude Opus 4.5',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-4-1-opus-latest',
    displayName: 'Claude Opus 4.1',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-4-5-haiku-latest',
    displayName: 'Claude Haiku 4.5',
    icon: '🚀',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Claude Haiku 3.5',
    icon: '🚀',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-haiku-20240307',
    displayName: 'Claude Haiku 3',
    icon: '💨',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-5-sonnet-20240620',
    displayName: 'Claude 3.5 Sonnet (Legacy)',
    icon: '🎯',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus (Legacy)',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Replicate',
    model: 'meta/meta-llama-3.1-405b-instruct',
    displayName: 'Llama 3.1 405B Instruct',
    icon: '🦙',
    capabilities: {
      input: ['text'],
      output: ['text'],
    },
  },
  {
    provider: 'Replicate',
    model: 'bytedance/seedance-1-pro-fast',
    displayName: 'Seedance 1.0 Pro Fast',
    icon: '🎬',
    capabilities: {
      input: ['text', 'image'],
      output: ['video'],
    },
  },
  {
    provider: 'Replicate',
    model: 'black-forest-labs/flux-1.1-pro',
    displayName: 'FLUX 1.1 Pro',
    icon: '🎨',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'black-forest-labs/flux-krea-dev',
    displayName: 'FLUX.1 Krea [dev]',
    icon: '📸',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'black-forest-labs/flux-kontext-max',
    displayName: 'FLUX.1 Kontext [max]',
    icon: '✏️',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'black-forest-labs/flux-kontext-pro',
    displayName: 'FLUX.1 Kontext [pro]',
    icon: '⭐',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'black-forest-labs/flux-kontext-dev',
    displayName: 'FLUX.1 Kontext [dev]',
    icon: '🔧',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'bytedance/seedream-4',
    displayName: 'Seedream 4.0',
    icon: '✨',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'ideogram-ai/ideogram-v3-turbo',
    displayName: 'Ideogram v3 Turbo',
    icon: '🎨',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'ideogram-ai/ideogram-v3-balanced',
    displayName: 'Ideogram v3 Balanced',
    icon: '⚖️',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'ideogram-ai/ideogram-v3-quality',
    displayName: 'Ideogram v3 Quality',
    icon: '✨',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  {
    provider: 'Replicate',
    model: 'ideogram-ai/ideogram-character',
    displayName: 'Ideogram Character',
    icon: '👤',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
    },
  },
  // Modelos futuros - remover comentários quando disponíveis
  // {
  //   provider: 'OpenAI',
  //   model: 'gpt-5-turbo',
  //   displayName: 'GPT-5 Turbo',
  //   icon: '🤖',
  // },
  // {
  //   provider: 'Google',
  //   model: 'gemini-2.5-pro',
  //   displayName: 'Gemini 2.5 Pro',
  //   icon: '✨',
  // },
]

export const PROVIDERS = [
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Google', label: 'Google' },
  { value: 'DeepSeek', label: 'DeepSeek' },
  { value: 'Grok', label: 'Grok (xAI)' },
  { value: 'Anthropic', label: 'Anthropic (Claude)' },
  { value: 'Replicate', label: 'Replicate (Llama e outros)' },
  { value: 'PubMed', label: 'PubMed' },
] as const

export function getModelsByProvider(provider: string): LLMModel[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider)
}

export function getProviderByModel(model: string): string | null {
  const found = AVAILABLE_MODELS.find((m) => m.model === model)
  return found?.provider || null
}

