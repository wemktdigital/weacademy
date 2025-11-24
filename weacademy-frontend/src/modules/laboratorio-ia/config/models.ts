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
    model: 'gpt-4o-mini-transcribe',
    displayName: 'GPT-4o Mini Transcribe',
    icon: '🎤',
    capabilities: {
      input: ['audio'],
      output: ['text'],
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
    provider: 'OpenAI',
    model: 'gpt-4o-transcribe-diarize',
    displayName: 'GPT-4o Transcribe Diarize',
    icon: '👥',
    capabilities: {
      input: ['audio'],
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
    provider: 'Google',
    model: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    icon: '✨',
    capabilities: {
      input: ['text', 'image', 'audio', 'video'],
      output: ['text'],
    },
  },
  {
    provider: 'Google',
    model: 'gemini-3-pro-preview-high',
    displayName: 'Gemini 3 Pro (High Thinking)',
    icon: '🧠',
    capabilities: {
      input: ['text', 'image', 'audio', 'video'],
      output: ['text'],
    },
  },
  {
    provider: 'Google',
    model: 'gemini-3-pro-preview-low',
    displayName: 'Gemini 3 Pro (Low Thinking)',
    icon: '⚡🧠',
    capabilities: {
      input: ['text', 'image', 'audio', 'video'],
      output: ['text'],
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
    model: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    icon: '⚡',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Google',
    model: 'gemini-2.5-flash-image',
    displayName: 'Nano Banana',
    icon: '🍌',
    capabilities: {
      input: ['text', 'image'],
      output: ['image'],
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
    model: 'grok-4-fast',
    displayName: 'Grok-4 Fast',
    icon: '⚡',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Grok',
    model: 'grok-4-fast-reasoning',
    displayName: 'Grok-4 Fast Reasoning',
    icon: '🧪',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude Sonnet 4.5',
    icon: '🎯',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Claude Haiku 4.5',
    icon: '🚀',
    capabilities: {
      input: ['text', 'image'],
      output: ['text'],
    },
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-opus-20240229',
    displayName: 'Claude Opus 4.1',
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

