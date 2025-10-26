# 🧪 Guia de Testes - WE Academy

## Visão Geral

Este projeto utiliza testes unitários e E2E para garantir qualidade e confiabilidade do código.

## Estrutura de Testes

```
src/
  __tests__/
    components/
      ui/
        button.test.tsx
    lib/
      auth.test.ts
    pages/
      # Testes de páginas
  __e2e__/
    # Testes E2E com Playwright
```

## Executando os Testes

### Testes Unitários

```bash
# Executar todos os testes
npm run test

# Executar com coverage
npm run test:coverage

# Executar em watch mode
npm run test:watch

# Executar testes específicos
npm run test button
```

### Testes E2E

```bash
# Executar testes E2E
npm run test:e2e

# Executar testes E2E em modo UI
npm run test:e2e:ui

# Executar testes E2E com debug
npm run test:e2e:debug
```

## Cobertura de Testes

Meta: **≥80% de cobertura**

### Componentes Testados

- ✅ Button
- ✅ Card
- ✅ Input
- ✅ Badge
- ⏳ VideoPlayer
- ⏳ ProgressTracker
- ⏳ LessonNavigator

### Páginas Testadas

- ⏳ Login
- ⏳ Register
- ⏳ Course Details
- ⏳ My Courses

## Estrutura de um Teste

```typescript
import { render, screen } from '@testing-library/react'
import { MyComponent } from '@/components/my-component'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('should handle user interaction', () => {
    const handleClick = jest.fn()
    render(<MyComponent onClick={handleClick} />)
    
    screen.getByRole('button').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

## Mocking

### Mocking do Supabase

```typescript
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null }))
        }))
      }))
    }))
  }
}))
```

## Continuous Integration

Os testes são executados automaticamente em cada push via GitHub Actions.

Ver: `.github/workflows/test.yml`

## Próximos Passos

- [ ] Adicionar testes para todos os componentes
- [ ] Implementar testes E2E completos
- [ ] Aumentar cobertura para ≥80%
- [ ] Configurar CI/CD no GitHub Actions
