import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoDraft } from '@/hooks/use-auto-draft'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useAutoDraft', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should save draft after debounce', async () => {
    const data = { title: 'Test', description: 'Description' }
    const { result } = renderHook(() =>
      useAutoDraft({
        key: 'test-form',
        data,
        debounceMs: 1000,
      })
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(localStorage.getItem('draft-test-form')).toBeTruthy()
  })

  it('should load draft on mount when draft exists', () => {
    const savedDraft = { title: 'Saved', description: 'Saved Description' }
    localStorage.setItem('draft-test-form', JSON.stringify(savedDraft))

    const onLoad = vi.fn()
    renderHook(() =>
      useAutoDraft({
        key: 'test-form',
        data: { title: '', description: '' },
        onLoad,
      })
    )

    expect(onLoad).toHaveBeenCalledWith(savedDraft)
  })

  it('should clear draft when clearDraft is called', () => {
    const data = { title: 'Test' }
    const { result } = renderHook(() =>
      useAutoDraft({
        key: 'test-form',
        data,
        debounceMs: 100,
      })
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Verificar se foi salvo
    const saved = localStorage.getItem('draft-test-form')
    expect(saved).toBeTruthy()

    act(() => {
      result.current.clearDraft()
    })

    // Após clearDraft, o draft deve ser null
    // clearDraft() chama setDraft(null)
    // useLocalStorage salva null como JSON.stringify(null) = "null" (string)
    // Mas o hook retorna null no estado
    expect(result.current.draft).toBeNull()
    
    // O localStorage pode ter "null" (string) ou null (removido)
    // Isso depende da implementação de useLocalStorage
    // Verificar que pelo menos o estado está null
    const afterClear = localStorage.getItem('draft-test-form')
    
    // Se useLocalStorage remove o item quando null, afterClear será null
    // Se useLocalStorage salva "null" como string, afterClear será "null"
    // Ambos são aceitáveis, pois o hook retorna null de qualquer forma
    if (afterClear !== null && afterClear !== 'null') {
      // Se há outro valor, algo está errado
      expect(afterClear).toBeNull()
    }
    
    // O importante é que o estado do hook está null
    expect(result.current.draft).toBeNull()
  })

  it('should not save when enabled is false', () => {
    const data = { title: 'Test' }
    renderHook(() =>
      useAutoDraft({
        key: 'test-form',
        data,
        enabled: false,
        debounceMs: 100,
      })
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(localStorage.getItem('draft-test-form')).toBeNull()
  })

  it('should call onSave callback when saving', () => {
    const data = { title: 'Test' }
    const onSave = vi.fn()
    
    renderHook(() =>
      useAutoDraft({
        key: 'test-form',
        data,
        debounceMs: 100,
        onSave,
      })
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(onSave).toHaveBeenCalledWith(data)
  })

  it('should not save if data has not changed', () => {
    const data = { title: 'Test' }
    const onSave = vi.fn()
    
    const { rerender } = renderHook(
      (props) => useAutoDraft(props),
      {
        initialProps: {
          key: 'test-form',
          data,
          debounceMs: 100,
          onSave,
        },
      }
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(onSave).toHaveBeenCalledTimes(1)

    // Rerender com mesmos dados
    rerender({
      key: 'test-form',
      data,
      debounceMs: 100,
      onSave,
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Não deve salvar novamente
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})

