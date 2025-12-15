/**
 * Passos do tour guiado do Laboratório de IA
 */

import { TourStep } from '@/components/onboarding/TourGuide'

export const aiLabTourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: 'Histórico de Conversas',
    content: 'Aqui você pode ver e gerenciar todas as suas conversas anteriores. Clique em uma conversa para continuar de onde parou.',
    placement: 'right',
  },
  {
    target: '[data-tour="chat-input"]',
    title: 'Campo de Mensagem',
    content: 'Digite sua mensagem aqui e pressione Enter para enviar. Você pode anexar arquivos, imagens, vídeos e documentos usando o botão de clipe.',
    placement: 'top',
  },
  {
    target: '[data-tour="agent-selector"]',
    title: 'Agentes Especializados',
    content: 'Escolha um agente especializado para diferentes tarefas. Cada agente tem conhecimentos específicos e pode te ajudar de forma mais precisa.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="model-selector"]',
    title: 'Seletor de Modelo',
    content: 'Escolha o modelo de IA que deseja usar. Diferentes modelos têm diferentes capacidades e custos.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="memory-settings"]',
    title: 'Configurações de Memória',
    content: 'Configure como o Laboratório de IA deve lembrar informações sobre você para personalizar as respostas.',
    placement: 'bottom',
  },
]

