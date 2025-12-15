'use client'

/**
 * Utilitários para criar mensagens de erro mais específicas e acionáveis
 */

export interface ErrorContext {
  action?: string // Ação que estava sendo executada (ex: "salvar curso", "enviar mensagem")
  entity?: string // Entidade afetada (ex: "curso", "mensagem", "usuário")
  code?: string // Código de erro específico
  details?: Record<string, any> // Detalhes adicionais
}

export interface ActionableError {
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  suggestions?: string[]
}

/**
 * Cria mensagem de erro específica e acionável baseada no contexto
 */
export function createActionableError(
  error: Error | string,
  context?: ErrorContext
): ActionableError {
  const errorMessage = typeof error === 'string' ? error : error.message
  const errorName = typeof error === 'string' ? '' : error.name

  // Erros de autenticação
  if (
    errorMessage.includes('autenticado') ||
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('401') ||
    errorName === 'AuthError'
  ) {
    return {
      message: 'Sua sessão expirou. Por favor, faça login novamente para continuar.',
      action: {
        label: 'Fazer Login',
        onClick: () => {
          window.location.href = '/auth/login'
        },
      },
      suggestions: [
        'Verifique se você está logado',
        'Tente fazer logout e login novamente',
        'Limpe os cookies do navegador se o problema persistir',
      ],
    }
  }

  // Erros de permissão
  if (
    errorMessage.includes('permissão') ||
    errorMessage.includes('Forbidden') ||
    errorMessage.includes('403') ||
    errorName === 'PermissionError'
  ) {
    return {
      message: `Você não tem permissão para ${context?.action || 'executar esta ação'}.`,
      suggestions: [
        'Verifique se você tem as permissões necessárias',
        'Entre em contato com o administrador se precisar de acesso',
        'Certifique-se de que está usando a conta correta',
      ],
    }
  }

  // Erros de rede
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('Failed to fetch') ||
    errorName === 'NetworkError'
  ) {
    return {
      message: 'Erro de conexão. Verifique sua internet e tente novamente.',
      action: {
        label: 'Tentar Novamente',
        onClick: () => {
          window.location.reload()
        },
      },
      suggestions: [
        'Verifique sua conexão com a internet',
        'Tente recarregar a página',
        'Verifique se o servidor está acessível',
      ],
    }
  }

  // Erros de validação
  if (
    errorMessage.includes('validação') ||
    errorMessage.includes('validation') ||
    errorMessage.includes('invalid') ||
    errorName === 'ValidationError'
  ) {
    const field = errorMessage.match(/(?:campo|field)\s+['"]?([^'"]+)['"]?/i)?.[1]
    
    return {
      message: field
        ? `O campo "${field}" está inválido. Por favor, corrija e tente novamente.`
        : 'Alguns campos estão inválidos. Verifique os dados e tente novamente.',
      suggestions: [
        'Verifique se todos os campos obrigatórios estão preenchidos',
        'Certifique-se de que os dados estão no formato correto',
        'Confira mensagens de validação específicas nos campos',
      ],
    }
  }

  // Erros de não encontrado
  if (
    errorMessage.includes('não encontrado') ||
    errorMessage.includes('not found') ||
    errorMessage.includes('404') ||
    errorName === 'NotFoundError'
  ) {
    return {
      message: `${context?.entity || 'Recurso'} não encontrado.`,
      action: {
        label: 'Voltar',
        onClick: () => {
          window.history.back()
        },
      },
      suggestions: [
        'O item pode ter sido removido',
        'Verifique se a URL está correta',
        'Tente voltar para a página anterior',
      ],
    }
  }

  // Erros de conflito
  if (
    errorMessage.includes('conflito') ||
    errorMessage.includes('conflict') ||
    errorMessage.includes('409') ||
    errorName === 'ConflictError'
  ) {
    return {
      message: 'Já existe um registro com essas informações. Por favor, use dados diferentes.',
      suggestions: [
        'Verifique se não está tentando criar um registro duplicado',
        'Tente atualizar o registro existente',
        'Use valores únicos nos campos obrigatórios',
      ],
    }
  }

  // Erros de servidor
  if (
    errorMessage.includes('servidor') ||
    errorMessage.includes('server error') ||
    errorMessage.includes('500') ||
    errorName === 'ServerError'
  ) {
    return {
      message: 'Erro no servidor. Nossa equipe foi notificada e está trabalhando para resolver.',
      action: {
        label: 'Tentar Novamente',
        onClick: () => {
          window.location.reload()
        },
      },
      suggestions: [
        'Tente novamente em alguns instantes',
        'Se o problema persistir, entre em contato com o suporte',
        'Verifique o status do sistema',
      ],
    }
  }

  // Erro genérico
  return {
    message: context?.action
      ? `Não foi possível ${context.action}. ${errorMessage}`
      : errorMessage,
    suggestions: [
      'Verifique se todos os dados estão corretos',
      'Tente novamente em alguns instantes',
      'Se o problema persistir, entre em contato com o suporte',
    ],
  }
}

/**
 * Exibe erro usando toast com mensagem específica e acionável
 */
export function showActionableError(
  error: Error | string,
  context?: ErrorContext,
  toast?: any
) {
  if (!toast) {
    console.error('Toast function not provided')
    return
  }

  const actionableError = createActionableError(error, context)

  toast({
    title: 'Erro',
    description: actionableError.message,
    variant: 'destructive',
    action: actionableError.action
      ? {
          label: actionableError.action.label,
          onClick: actionableError.action.onClick,
        }
      : undefined,
    duration: actionableError.action ? 10000 : 5000, // Mais tempo se tiver ação
  })

  // Log detalhado no console para debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Actionable Error:', {
      originalError: error,
      context,
      suggestions: actionableError.suggestions,
    })
  }
}

