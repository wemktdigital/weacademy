'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useLocalStorage } from './use-local-storage'

export interface AutoDraftOptions<T> {
  key: string // Chave única para identificar o rascunho
  data: T // Dados a serem salvos
  debounceMs?: number // Tempo de debounce em milissegundos (padrão: 1000)
  enabled?: boolean // Habilitar/desabilitar salvamento automático
  onSave?: (data: T) => void // Callback quando salvar (opcional)
  onLoad?: (data: T | null) => void // Callback quando carregar (opcional)
}

/**
 * Hook para salvar rascunho automaticamente
 * 
 * @example
 * ```tsx
 * const { data: draft, clearDraft, isLoading } = useAutoDraft({
 *   key: 'course-form',
 *   data: formData,
 *   debounceMs: 2000,
 *   onSave: (data) => console.log('Rascunho salvo:', data),
 *   onLoad: (data) => {
 *     if (data) {
 *       setFormData(data)
 *     }
 *   }
 * })
 * ```
 */
export function useAutoDraft<T>({
  key,
  data,
  debounceMs = 1000,
  enabled = true,
  onSave,
  onLoad,
}: AutoDraftOptions<T>) {
  const [draft, setDraft] = useLocalStorage<T | null>(`draft-${key}`, null)
  const [isLoading, setIsLoading] = useLocalStorage<boolean>(`draft-${key}-loading`, false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')
  const hasLoadedRef = useRef(false)

  // Carregar rascunho na inicialização
  useEffect(() => {
    if (draft && !hasLoadedRef.current && onLoad) {
      hasLoadedRef.current = true
      onLoad(draft)
    }
  }, [draft, onLoad])

  // Salvar rascunho automaticamente com debounce
  useEffect(() => {
    if (!enabled || !data) return

    const dataString = JSON.stringify(data)
    
    // Se os dados não mudaram, não salvar
    if (dataString === lastSavedRef.current) return

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setIsLoading(true)

    // Debounce: salvar após o tempo especificado
    timeoutRef.current = setTimeout(() => {
      try {
        setDraft(data)
        lastSavedRef.current = dataString
        
        if (onSave) {
          onSave(data)
        }
      } catch (error) {
        console.error('Erro ao salvar rascunho:', error)
      } finally {
        setIsLoading(false)
      }
    }, debounceMs)

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, debounceMs, enabled, setDraft, setIsLoading, onSave])

  // Função para limpar rascunho manualmente
  const clearDraft = useCallback(() => {
    setDraft(null)
    lastSavedRef.current = ''
    hasLoadedRef.current = false
  }, [setDraft])

  return {
    draft,
    clearDraft,
    isLoading: isLoading || false,
  }
}

