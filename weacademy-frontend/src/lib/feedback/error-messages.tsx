'use client'

import React from 'react'
import { AlertCircle, XCircle, AlertTriangle, WifiOff, FileWarning, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Utilitários para criar mensagens de erro acionáveis e claras
 */

export interface ErrorContext {
    code?: string // Código do erro (ex: 404, 500, 'AUTH_ERROR')
    message?: string // Mensagem técnica opcional
    action?: string // Ação sugerida (ex: "Tentar novamente", "Fazer login")
    actionUrl?: string // URL para ação (se houver)
    duration?: number // Duração em ms
    showIcon?: boolean
}

export interface ActionableError {
    title: string
    description: string | ReactNode
    icon?: ReactNode
    action?: {
        label: string
        onClick?: () => void
        href?: string
    }
    variant: 'destructive' | 'default' | 'warning'
}

// Funções auxiliares para criar ícones
const createAlertIcon = () => React.createElement(AlertCircle, { className: "h-5 w-5 text-destructive" })
const createXIcon = () => React.createElement(XCircle, { className: "h-5 w-5 text-destructive" })
const createWarningIcon = () => React.createElement(AlertTriangle, { className: "h-5 w-5 text-yellow-500" })
const createWifiIcon = () => React.createElement(WifiOff, { className: "h-5 w-5 text-destructive" })
const createSecurityIcon = () => React.createElement(ShieldAlert, { className: "h-5 w-5 text-destructive" })

const ERROR_TEMPLATES: Record<string, { title: string; description: string; icon?: () => ReactNode; variant?: 'destructive' | 'warning' }> = {
    '404': {
        title: 'Recurso não encontrado',
        description: 'O item que você está procurando não existe ou foi movido.',
        icon: createAlertIcon,
        variant: 'destructive',
    },
    '401': {
        title: 'Acesso não autorizado',
        description: 'Sua sessão expirou ou você não tem permissão para esta ação.',
        icon: createSecurityIcon,
        variant: 'destructive',
    },
    '403': {
        title: 'Permissão negada',
        description: 'Você não tem as permissões necessárias para acessar este recurso.',
        icon: createSecurityIcon,
        variant: 'destructive',
    },
    '500': {
        title: 'Erro no servidor',
        description: 'Algo deu errado do nosso lado. Tente novamente mais tarde.',
        icon: createXIcon,
        variant: 'destructive',
    },
    'NETWORK_ERROR': {
        title: 'Erro de conexão',
        description: 'Verifique sua conexão com a internet e tente novamente.',
        icon: createWifiIcon,
        variant: 'destructive',
    },
    'VALIDATION_ERROR': {
        title: 'Dados inválidos',
        description: 'Por favor, verifique os campos destacados e tente novamente.',
        icon: createWarningIcon,
        variant: 'destructive',
    },
    'DEFAULT': {
        title: 'Algo deu errado',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        icon: createAlertIcon,
        variant: 'destructive',
    }
}

/**
 * Cria um erro acionável baseado no contexto
 */
export function createActionableError(
    error: Error | string | unknown,
    context?: ErrorContext
): ActionableError {
    // Determinar código ou tipo de erro
    let errorCode = context?.code || 'DEFAULT'
    let technicalMessage = typeof error === 'string' ? error : (error as Error)?.message

    // Tentar mapear mensagem técnica para códigos conhecidos
    if (technicalMessage?.includes('Network Error') || technicalMessage?.includes('Failed to fetch')) {
        errorCode = 'NETWORK_ERROR'
    } else if (technicalMessage?.includes('404')) {
        errorCode = '404'
    } else if (technicalMessage?.includes('401') || technicalMessage?.includes('Unauthorized')) {
        errorCode = '401'
    }

    const template = ERROR_TEMPLATES[errorCode] || ERROR_TEMPLATES['DEFAULT']

    return {
        title: template.title,
        description: context?.message || template.description,
        icon: context?.showIcon !== false && template.icon ? template.icon() : undefined,
        variant: template.variant || 'destructive',
        action: context?.action ? {
            label: context.action,
            href: context.actionUrl
        } : undefined
    }
}

/**
 * Exibe erro acionável usando toast
 */
export function showActionableError(
    error: Error | string | unknown,
    context?: ErrorContext,
    toast?: any
) {
    if (!toast) {
        console.warn('Toast function not provided for error')
        return
    }

    const actionableError = createActionableError(error, context)

    toast({
        title: actionableError.title,
        description: actionableError.description,
        variant: actionableError.variant,
        action: actionableError.action ? (
            actionableError.action.href ? (
                React.createElement(Link, {
                    href: actionableError.action.href,
                    className: "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:translate-x-1"
                }, actionableError.action.label)
            ) : (
                React.createElement('button', {
                    onClick: actionableError.action.onClick,
                    className: "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-destructive/90"
                }, actionableError.action.label)
            )
        ) : undefined,
    })
}
