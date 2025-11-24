'use client'

import { useEffect, useCallback } from 'react'

export interface KeyboardShortcutOptions {
  key: string // Tecla principal (ex: 'Enter', 's', 'Escape')
  ctrl?: boolean // Requer Ctrl (ou Cmd no Mac)
  shift?: boolean // Requer Shift
  alt?: boolean // Requer Alt
  meta?: boolean // Requer Meta (Cmd no Mac)
  callback: (event: KeyboardEvent) => void
  enabled?: boolean // Habilitar/desabilitar atalho
  preventDefault?: boolean // Prevenir comportamento padrão (padrão: true)
}

/**
 * Hook para criar atalhos de teclado
 * 
 * @example
 * ```tsx
 * // Ctrl+Enter para enviar formulário
 * useKeyboardShortcut({
 *   key: 'Enter',
 *   ctrl: true,
 *   callback: () => handleSubmit(),
 *   enabled: !isSubmitting
 * })
 * 
 * // Ctrl+S para salvar
 * useKeyboardShortcut({
 *   key: 's',
 *   ctrl: true,
 *   callback: (e) => {
 *     e.preventDefault()
 *     handleSave()
 *   }
 * })
 * ```
 */
export function useKeyboardShortcut({
  key,
  ctrl = false,
  shift = false,
  alt = false,
  meta = false,
  callback,
  enabled = true,
  preventDefault = true,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Verificar se a tecla corresponde
      if (event.key !== key) return

      // Verificar modificadores
      // Se ctrl=true, aceitar tanto ctrlKey quanto metaKey (para compatibilidade Mac/Windows)
      const hasCtrl = ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey
      const hasShift = shift ? event.shiftKey : !event.shiftKey
      const hasAlt = alt ? event.altKey : !event.altKey
      const hasMeta = meta ? event.metaKey : !event.metaKey

      // Se ctrl=true e não especificou meta separadamente, aceitar meta como ctrl
      // (para compatibilidade: Ctrl+Enter funciona tanto com Ctrl quanto Cmd)
      const ctrlOrMetaMatch = ctrl ? (event.ctrlKey || event.metaKey) : (!event.ctrlKey && !event.metaKey)

      // Verificar se todos os modificadores requeridos estão presentes
      const allModifiersMatch = ctrlOrMetaMatch && hasShift && hasAlt && (meta ? hasMeta : !meta)

      if (allModifiersMatch) {
        if (preventDefault) {
          event.preventDefault()
        }
        callback(event)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [key, ctrl, shift, alt, meta, callback, enabled, preventDefault])
}

/**
 * Hook específico para Ctrl+Enter (ou Cmd+Enter no Mac)
 */
export function useSubmitShortcut(
  callback: () => void,
  enabled: boolean = true
) {
  useKeyboardShortcut({
    key: 'Enter',
    ctrl: true,
    callback: () => callback(),
    enabled,
    preventDefault: true,
  })
}

/**
 * Hook específico para Ctrl+S (ou Cmd+S no Mac) para salvar
 */
export function useSaveShortcut(
  callback: () => void,
  enabled: boolean = true
) {
  useKeyboardShortcut({
    key: 's',
    ctrl: true,
    callback: (e) => {
      e.preventDefault()
      callback()
    },
    enabled,
    preventDefault: true,
  })
}

