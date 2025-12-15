import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

describe('ConfirmDialog', () => {
  it('should render when open', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirmar Exclusão"
        description="Tem certeza?"
      />
    )

    expect(screen.getByText('Confirmar Exclusão')).toBeInTheDocument()
    expect(screen.getByText('Tem certeza?')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Test"
        description="Test"
      />
    )

    expect(screen.queryByText('Test')).not.toBeInTheDocument()
  })

  it('should call onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        title="Test"
        description="Test"
      />
    )

    const confirmButton = screen.getByText('Confirmar')
    fireEvent.click(confirmButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should call onOpenChange when cancel button is clicked', () => {
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
        title="Test"
        description="Test"
      />
    )

    const cancelButton = screen.getByText('Cancelar')
    fireEvent.click(cancelButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should show loading state when isLoading is true', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Test"
        description="Test"
        isLoading={true}
      />
    )

    expect(screen.getByText('Processando...')).toBeInTheDocument()
  })

  it('should render with destructive variant', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Deletar"
        description="Confirmar?"
        variant="destructive"
      />
    )

    const confirmButton = screen.getByText('Confirmar')
    expect(confirmButton).toHaveClass('bg-destructive')
  })

  it('should render with warning variant', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Aviso"
        description="Atenção!"
        variant="warning"
      />
    )

    expect(screen.getByText('Aviso')).toBeInTheDocument()
  })

  it('should use custom button text', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Test"
        description="Test"
        confirmText="Sim, Deletar"
        cancelText="Não, Cancelar"
      />
    )

    expect(screen.getByText('Sim, Deletar')).toBeInTheDocument()
    expect(screen.getByText('Não, Cancelar')).toBeInTheDocument()
  })
})

