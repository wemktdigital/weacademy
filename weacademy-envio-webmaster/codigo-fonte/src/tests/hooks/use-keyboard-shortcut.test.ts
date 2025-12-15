import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcut, useSubmitShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut'

describe('useKeyboardShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call callback when shortcut is pressed', () => {
    const callback = vi.fn()
    
    renderHook(() =>
      useKeyboardShortcut({
        key: 'Enter',
        ctrl: true,
        callback,
      })
    )

    // Simular Ctrl+Enter
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
    })
    
    window.dispatchEvent(event)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should not call callback when shortcut is not pressed', () => {
    const callback = vi.fn()
    
    renderHook(() =>
      useKeyboardShortcut({
        key: 'Enter',
        ctrl: true,
        callback,
      })
    )

    // Simular Enter sem Ctrl
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    })
    
    window.dispatchEvent(event)

    expect(callback).not.toHaveBeenCalled()
  })

  it('should prevent default behavior when preventDefault is true', () => {
    const callback = vi.fn()
    
    renderHook(() =>
      useKeyboardShortcut({
        key: 's',
        ctrl: true,
        callback,
        preventDefault: true,
      })
    )

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should not call callback when enabled is false', () => {
    const callback = vi.fn()
    
    renderHook(() =>
      useKeyboardShortcut({
        key: 'Enter',
        ctrl: true,
        callback,
        enabled: false,
      })
    )

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
    })
    
    window.dispatchEvent(event)

    expect(callback).not.toHaveBeenCalled()
  })
})

describe('useSubmitShortcut', () => {
  it('should call callback on Ctrl+Enter', () => {
    const callback = vi.fn()
    
    renderHook(() => useSubmitShortcut(callback))

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
    })
    
    window.dispatchEvent(event)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should work with Cmd+Enter on Mac', () => {
    const callback = vi.fn()
    
    renderHook(() => useSubmitShortcut(callback, true))

    // Criar evento com metaKey (Cmd no Mac)
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true, // Cmd no Mac
      ctrlKey: false,
      bubbles: true,
      cancelable: true,
    })
    
    window.dispatchEvent(event)

    // O useSubmitShortcut verifica ctrl OU meta, então deve funcionar
    expect(callback).toHaveBeenCalled()
  })
})

describe('useSaveShortcut', () => {
  it('should call callback on Ctrl+S', () => {
    const callback = vi.fn()
    
    renderHook(() => useSaveShortcut(callback))

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(preventDefaultSpy).toHaveBeenCalled()
  })
})

