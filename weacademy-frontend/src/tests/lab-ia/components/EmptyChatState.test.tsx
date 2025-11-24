import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyChatState } from '@/modules/laboratorio-ia/components/EmptyChatState'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import { getModelDescription } from '@/modules/laboratorio-ia/config/modelDescriptions'
import type { LLMModel, MediaType } from '@/modules/laboratorio-ia/config/models'

// Mock dos módulos
vi.mock('@/modules/laboratorio-ia/config/models', () => ({
  AVAILABLE_MODELS: [] as LLMModel[], // Será sobrescrito nos testes
}))

vi.mock('@/modules/laboratorio-ia/config/modelDescriptions', () => ({
  getModelDescription: vi.fn(),
}))

describe('EmptyChatState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderização com modelo existente', () => {
    it('deve renderizar informações do GPT-5 Nano', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        displayName: 'GPT-5 Nano',
        icon: '🤖',
        capabilities: {
          input: ['text', 'image'],
          output: ['text'],
        },
      }

      const mockDescription = {
        description: 'Modelo rápido e eficiente para tarefas do dia a dia.',
        tip: 'Envie imagens junto com seu texto para análise multimodal.',
      }

      // Mock AVAILABLE_MODELS
      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue(mockDescription)

      render(<EmptyChatState provider="OpenAI" model="gpt-5-nano" />)

      // Verificar se o nome do modelo aparece
      expect(screen.getByText('GPT-5 Nano')).toBeInTheDocument()

      // Verificar se a descrição aparece
      expect(screen.getByText(mockDescription.description)).toBeInTheDocument()

      // Verificar se a dica aparece
      expect(screen.getByText(/💡 Dica:/)).toBeInTheDocument()
      expect(screen.getByText(mockDescription.tip)).toBeInTheDocument()

      // Verificar badges de input
      const inputSection = screen.getByText('O que você pode enviar').closest('.grid')?.parentElement
      expect(inputSection).toBeInTheDocument()
      
      // Verificar badges de output
      const outputSection = screen.getByText('O que você vai receber').closest('.grid')?.parentElement
      expect(outputSection).toBeInTheDocument()
      
      // Verificar que há badges de texto e imagem (pode aparecer em ambos input e output)
      const textBadges = screen.getAllByText('Texto')
      expect(textBadges.length).toBeGreaterThan(0)
      expect(screen.getByText('Imagem')).toBeInTheDocument()

      // Limpar mock
      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('deve renderizar modelo com múltiplos tipos de input/output', () => {
      const modelData: LLMModel = {
        provider: 'Google',
        model: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        icon: '✨',
        capabilities: {
          input: ['text', 'image', 'audio', 'video'],
          output: ['text'],
        },
      }

      const mockDescription = {
        description: 'Modelo multimodal com suporte completo.',
        tip: 'Envie qualquer tipo de mídia para análise.',
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue(mockDescription)

      render(<EmptyChatState provider="Google" model="gemini-2.5-flash" />)

      // Verificar badges de input (texto, imagem, áudio, vídeo)
      // Pode haver múltiplos badges com o mesmo texto (input e output)
      const textBadges = screen.getAllByText('Texto')
      expect(textBadges.length).toBeGreaterThan(0)
      expect(screen.getByText('Imagem')).toBeInTheDocument()
      expect(screen.getByText('Áudio')).toBeInTheDocument()
      expect(screen.getByText('Vídeo')).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('deve renderizar ícone do modelo corretamente', () => {
      const modelData: LLMModel = {
        provider: 'Google',
        model: 'nano-banana',
        displayName: 'Nano Banana',
        icon: '🍌',
        capabilities: {
          input: ['text'],
          output: ['image'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Geração de imagens.',
        tip: 'Descreva a imagem desejada.',
      })

      render(<EmptyChatState provider="Google" model="nano-banana" />)

      // Verificar se o ícone aparece no DOM (como emoji ou texto)
      const iconElement = screen.getByText('🍌').closest('.rounded-full')
      expect(iconElement).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })
  })

  describe('Fallback genérico', () => {
    it('deve usar fallback genérico quando modelo não tem descrição personalizada', () => {
      const modelData: LLMModel = {
        provider: 'TestProvider',
        model: 'test-model',
        displayName: 'Test Model',
        icon: '🧪',
        capabilities: {
          input: ['text'],
          output: ['text'],
        },
      }

      const genericDescription = {
        description: 'Modelo TestProvider test-model. Aceita texto e gera texto.',
        tip: 'Seja específico em seus prompts para obter melhores resultados.',
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue(genericDescription)

      render(<EmptyChatState provider="TestProvider" model="test-model" />)

      expect(screen.getByText('Test Model')).toBeInTheDocument()
      expect(screen.getByText(genericDescription.description)).toBeInTheDocument()
      expect(screen.getByText(genericDescription.tip)).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('deve renderizar mensagem apropriada quando modelo não tem capabilities', () => {
      const modelData: LLMModel = {
        provider: 'TestProvider',
        model: 'test-model-no-caps',
        displayName: 'Test Model No Caps',
        icon: '🧪',
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Modelo sem capabilities definidas.',
        tip: 'Use com cuidado.',
      })

      render(<EmptyChatState provider="TestProvider" model="test-model-no-caps" />)

      expect(screen.getByText('Test Model No Caps')).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })
  })

  describe('Modelo não encontrado', () => {
    it('não deve renderizar nada quando modelo não existe em AVAILABLE_MODELS', () => {
      vi.mocked(AVAILABLE_MODELS).length = 0 // Array vazio

      const { container } = render(
        <EmptyChatState provider="NonExistentProvider" model="non-existent-model" />
      )

      // Componente deve retornar null
      expect(container.firstChild).toBeNull()
    })

    it('não deve renderizar quando provider não corresponde', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'gpt-5',
        displayName: 'GPT-5',
        icon: '🤖',
        capabilities: {
          input: ['text'],
          output: ['text'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)

      const { container } = render(
        <EmptyChatState provider="Google" model="gpt-5" />
      )

      // Provider não corresponde, então não deve renderizar
      expect(container.firstChild).toBeNull()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('não deve renderizar quando model não corresponde', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'gpt-5',
        displayName: 'GPT-5',
        icon: '🤖',
        capabilities: {
          input: ['text'],
          output: ['text'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)

      const { container } = render(
        <EmptyChatState provider="OpenAI" model="gpt-4" />
      )

      // Model não corresponde, então não deve renderizar
      expect(container.firstChild).toBeNull()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })
  })

  describe('Capabilities e badges', () => {
    it('deve renderizar badges corretos para modelo de geração de imagem', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'gpt-image-1',
        displayName: 'GPT-Image-1',
        icon: '🖼️',
        capabilities: {
          input: ['text', 'image'],
          output: ['image'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Geração de imagens.',
        tip: 'Descreva a imagem.',
      })

      render(<EmptyChatState provider="OpenAI" model="gpt-image-1" />)

      // Badge de output deve ser "Imagem"
      // Pode aparecer tanto em input quanto em output
      const imageBadges = screen.getAllByText('Imagem')
      expect(imageBadges.length).toBeGreaterThan(0)

      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('deve renderizar badges corretos para modelo de transcrição de áudio', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'gpt-4o-transcribe',
        displayName: 'GPT-4o Transcribe',
        icon: '🎙️',
        capabilities: {
          input: ['audio'],
          output: ['text'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Transcrição de áudio.',
        tip: 'Envie arquivos de áudio.',
      })

      render(<EmptyChatState provider="OpenAI" model="gpt-4o-transcribe" />)

      // Badge de input deve ser "Áudio"
      expect(screen.getByText('Áudio')).toBeInTheDocument()
      // Badge de output deve ser "Texto" (pode aparecer em ambos)
      const textBadges = screen.getAllByText('Texto')
      expect(textBadges.length).toBeGreaterThan(0)

      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('deve renderizar badges corretos para modelo de geração de vídeo', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'sora-2',
        displayName: 'Sora 2',
        icon: '🎬',
        capabilities: {
          input: ['text', 'image'],
          output: ['video'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Geração de vídeos.',
        tip: 'Descreva a cena.',
      })

      render(<EmptyChatState provider="OpenAI" model="sora-2" />)

      // Badge de output deve ser "Vídeo"
      expect(screen.getByText('Vídeo')).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('deve renderizar mensagem apropriada quando não há capabilities de input', () => {
      const modelData: LLMModel = {
        provider: 'TestProvider',
        model: 'test-no-input',
        displayName: 'Test No Input',
        icon: '🧪',
        capabilities: {
          input: [],
          output: ['text'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Modelo sem input.',
        tip: 'Use com cuidado.',
      })

      render(<EmptyChatState provider="TestProvider" model="test-no-input" />)

      expect(screen.getByText(/Este modelo não aceita entradas/i)).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('deve renderizar mensagem apropriada quando não há capabilities de output', () => {
      const modelData: LLMModel = {
        provider: 'TestProvider',
        model: 'test-no-output',
        displayName: 'Test No Output',
        icon: '🧪',
        capabilities: {
          input: ['text'],
          output: [],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Modelo sem output.',
        tip: 'Use com cuidado.',
      })

      render(<EmptyChatState provider="TestProvider" model="test-no-output" />)

      expect(screen.getByText(/Este modelo não gera saídas/i)).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })
  })

  describe('Dicas contextuais', () => {
    it('deve exibir dica específica do modelo', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        displayName: 'GPT-5 Nano',
        icon: '🤖',
        capabilities: {
          input: ['text', 'image'],
          output: ['text'],
        },
      }

      const customTip = 'Dica personalizada para GPT-5 Nano: use imagens!'

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Modelo rápido.',
        tip: customTip,
      })

      render(<EmptyChatState provider="OpenAI" model="gpt-5-nano" />)

      expect(screen.getByText(customTip)).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })

    it('deve exibir ícone de lâmpada na seção de dica', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'gpt-5',
        displayName: 'GPT-5',
        icon: '🤖',
        capabilities: {
          input: ['text'],
          output: ['text'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Modelo avançado.',
        tip: 'Dica personalizada.',
      })

      render(<EmptyChatState provider="OpenAI" model="gpt-5" />)

      // Verificar se o ícone de lâmpada aparece (via texto ou aria-label)
      expect(screen.getByText(/💡 Dica:/i)).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })
  })

  describe('Estrutura do componente', () => {
    it('deve ter estrutura correta com cabeçalho, cards e dica', () => {
      const modelData: LLMModel = {
        provider: 'OpenAI',
        model: 'gpt-5',
        displayName: 'GPT-5',
        icon: '🤖',
        capabilities: {
          input: ['text'],
          output: ['text'],
        },
      }

      vi.mocked(AVAILABLE_MODELS).push(modelData)
      vi.mocked(getModelDescription).mockReturnValue({
        description: 'Descrição do modelo.',
        tip: 'Dica do modelo.',
      })

      render(<EmptyChatState provider="OpenAI" model="gpt-5" />)

      // Verificar estrutura: cabeçalho
      expect(screen.getByText('GPT-5')).toBeInTheDocument()

      // Verificar estrutura: cards de input/output
      expect(screen.getByText('O que você pode enviar')).toBeInTheDocument()
      expect(screen.getByText('O que você vai receber')).toBeInTheDocument()

      // Verificar estrutura: seção de dica
      expect(screen.getByText(/💡 Dica:/i)).toBeInTheDocument()

      vi.mocked(AVAILABLE_MODELS).length = 0
    })
  })
})

