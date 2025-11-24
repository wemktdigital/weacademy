import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloatingInput } from '@/components/ui/floating-input'

describe('FloatingInput', () => {
  it('should render with label', () => {
    render(<FloatingInput label="Nome" />)
    expect(screen.getByText('Nome')).toBeInTheDocument()
  })

  it('should show floating label when focused', () => {
    render(<FloatingInput label="Nome" />)
    const input = screen.getByLabelText('Nome')
    
    fireEvent.focus(input)
    
    const label = screen.getByText('Nome')
    expect(label).toHaveClass('top-2', 'text-xs')
  })

  it('should show floating label when has value', () => {
    render(<FloatingInput label="Nome" value="João" />)
    
    const label = screen.getByText('Nome')
    expect(label).toHaveClass('top-2', 'text-xs')
  })

  it('should show error message when error prop is provided', () => {
    render(<FloatingInput label="Nome" error="Campo obrigatório" />)
    
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('should show success icon when success is true', () => {
    render(<FloatingInput label="Email" success />)
    
    const input = screen.getByLabelText('Email')
    expect(input).toHaveClass('border-green-500')
  })

  it('should show loading icon when loading is true', () => {
    const { container } = render(<FloatingInput label="Buscar" loading />)
    
    // Verificar que o ícone de loading está presente (Loader2)
    const loaderIcon = container.querySelector('svg[class*="animate-spin"]')
    expect(loaderIcon).toBeInTheDocument()
  })

  it('should show required indicator when required is true', () => {
    render(<FloatingInput label="Nome" required />)
    
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('should use placeholder when showFloatingLabel is false', () => {
    render(
      <FloatingInput
        label="Nome"
        placeholder="Digite seu nome"
        showFloatingLabel={false}
      />
    )
    
    const input = screen.getByPlaceholderText('Digite seu nome')
    expect(input).toBeInTheDocument()
  })

  it('should have correct aria attributes when error', () => {
    render(<FloatingInput label="Email" error="Email inválido" id="email" />)
    
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'email-error')
  })

  it('should call onChange handler', () => {
    const handleChange = vi.fn()
    render(<FloatingInput label="Nome" onChange={handleChange} />)
    
    const input = screen.getByLabelText('Nome')
    fireEvent.change(input, { target: { value: 'João' } })
    
    expect(handleChange).toHaveBeenCalledTimes(1)
  })
})

