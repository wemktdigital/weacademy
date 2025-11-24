# Guia de Formulários e Inputs Melhorados - WE Academy

## Visão Geral

Este guia documenta os componentes e utilitários aprimorados para formulários e inputs, incluindo labels flutuantes, validação inline, steppers, salvamento automático de rascunho e atalhos de teclado.

## Componentes

### 1. FloatingInput

Input com label flutuante e validação inline.

**Uso:**
```typescript
import { FloatingInput } from '@/components/ui/floating-input'

<FloatingInput
  label="Nome do Curso"
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  error={errors.title?.message}
  success={isValid}
  helperText="Digite o nome do curso"
  required
  showFloatingLabel
/>
```

**Props:**
- `label?: string` - Label do input
- `error?: string` - Mensagem de erro (exibe ícone e cor vermelha)
- `success?: boolean` - Estado de sucesso (exibe ícone e cor verde)
- `helperText?: string` - Texto de ajuda
- `loading?: boolean` - Mostra spinner de loading
- `required?: boolean` - Marca o campo como obrigatório
- `showFloatingLabel?: boolean` - Habilita label flutuante (padrão: true)
- Todas as props padrão de `Input`

**Características:**
- Label flutua quando o input está focado ou tem valor
- Placeholder como fallback quando label flutuante não está habilitado
- Ícones de erro/sucesso/loading
- Mensagens de erro claras e acionáveis
- Acessibilidade completa (aria-invalid, aria-describedby)

### 2. Stepper

Componente para progresso multi-etapa em formulários.

**Uso:**
```typescript
import { Stepper } from '@/components/ui/stepper'

const steps = [
  { id: '1', label: 'Informações Básicas', description: 'Nome e descrição' },
  { id: '2', label: 'Conteúdo', description: 'Módulos e lições' },
  { id: '3', label: 'Configurações', description: 'Preço e status' },
]

<Stepper
  steps={steps}
  currentStep={currentStep}
  onStepClick={(index) => setCurrentStep(index)}
  completedSteps={[0]}
  allowNavigation
  orientation="horizontal" // ou "vertical"
/>
```

**Props:**
- `steps: StepperStep[]` - Array de passos
- `currentStep: number` - Índice do passo atual
- `onStepClick?: (stepIndex: number) => void` - Callback ao clicar em um passo
- `completedSteps?: number[]` - Índices dos passos completados
- `allowNavigation?: boolean` - Permite navegar clicando nos passos
- `orientation?: 'horizontal' | 'vertical'` - Orientação do stepper

### 3. FormStepper

Stepper completo para formulários com navegação integrada.

**Uso:**
```typescript
import { FormStepper } from '@/components/ui/form-stepper'

<FormStepper
  steps={steps}
  currentStep={currentStep}
  onStepChange={setCurrentStep}
  onFinish={handleSubmit}
  onCancel={handleCancel}
  isLoading={isSubmitting}
  isValid={!hasErrors}
  allowStepClick
>
  {(stepIndex) => {
    switch (stepIndex) {
      case 0:
        return <BasicInfoForm />
      case 1:
        return <ContentForm />
      case 2:
        return <SettingsForm />
      default:
        return null
    }
  }}
</FormStepper>
```

**Props:**
- `steps: StepperStep[]` - Array de passos
- `currentStep: number` - Índice do passo atual
- `onStepChange: (step: number) => void` - Callback ao mudar passo
- `onFinish?: () => void` - Callback ao finalizar
- `onCancel?: () => void` - Callback ao cancelar
- `isLoading?: boolean` - Estado de carregamento
- `isValid?: boolean` - Se o formulário é válido
- `showNavigation?: boolean` - Mostrar botões de navegação
- `allowStepClick?: boolean` - Permitir clicar nos passos
- `children: (stepIndex: number) => React.ReactNode` - Renderiza conteúdo do passo

## Hooks

### 1. useAutoDraft

Hook para salvar rascunho automaticamente.

**Uso:**
```typescript
import { useAutoDraft } from '@/hooks/use-auto-draft'

const { draft, clearDraft, isLoading } = useAutoDraft({
  key: 'course-form',
  data: formData,
  debounceMs: 2000,
  onSave: (data) => {
    toast.success('Rascunho salvo automaticamente')
  },
  onLoad: (data) => {
    if (data && !hasUserData) {
      setFormData(data)
      toast.info('Rascunho restaurado')
    }
  }
})
```

**Opções:**
- `key: string` - Chave única para identificar o rascunho
- `data: T` - Dados a serem salvos
- `debounceMs?: number` - Tempo de debounce (padrão: 1000ms)
- `enabled?: boolean` - Habilitar/desabilitar (padrão: true)
- `onSave?: (data: T) => void` - Callback ao salvar
- `onLoad?: (data: T | null) => void` - Callback ao carregar

**Retorno:**
- `draft: T | null` - Dados do rascunho
- `clearDraft: () => void` - Função para limpar rascunho
- `isLoading: boolean` - Se está salvando

### 2. useKeyboardShortcut

Hook genérico para atalhos de teclado.

**Uso:**
```typescript
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'

// Ctrl+Enter para enviar
useKeyboardShortcut({
  key: 'Enter',
  ctrl: true,
  callback: () => handleSubmit(),
  enabled: !isSubmitting
})

// Ctrl+S para salvar
useKeyboardShortcut({
  key: 's',
  ctrl: true,
  callback: (e) => {
    e.preventDefault()
    handleSave()
  }
})
```

**Opções:**
- `key: string` - Tecla principal
- `ctrl?: boolean` - Requer Ctrl (ou Cmd no Mac)
- `shift?: boolean` - Requer Shift
- `alt?: boolean` - Requer Alt
- `meta?: boolean` - Requer Meta (Cmd no Mac)
- `callback: (event: KeyboardEvent) => void` - Função a ser executada
- `enabled?: boolean` - Habilitar/desabilitar (padrão: true)
- `preventDefault?: boolean` - Prevenir comportamento padrão (padrão: true)

### 3. useSubmitShortcut

Hook específico para Ctrl+Enter (ou Cmd+Enter no Mac).

**Uso:**
```typescript
import { useSubmitShortcut } from '@/hooks/use-keyboard-shortcut'

useSubmitShortcut(() => {
  handleSubmit()
}, !isSubmitting)
```

### 4. useSaveShortcut

Hook específico para Ctrl+S (ou Cmd+S no Mac).

**Uso:**
```typescript
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut'

useSaveShortcut(() => {
  handleSaveDraft()
}, !isSaving)
```

## Exemplos Completos

### Exemplo 1: Formulário com FloatingInput e Validação

```typescript
import { FloatingInput } from '@/components/ui/floating-input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  description: z.string().min(50, 'Descrição deve ter no mínimo 50 caracteres'),
})

export function CourseForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FloatingInput
        {...register('title')}
        label="Título do Curso"
        error={errors.title?.message}
        helperText="Digite o nome do curso"
        required
      />
      
      <FloatingInput
        {...register('description')}
        label="Descrição"
        error={errors.description?.message}
        helperText="Descreva o conteúdo do curso"
        required
        multiline
      />
    </form>
  )
}
```

### Exemplo 2: Formulário Multi-etapa com Stepper

```typescript
import { FormStepper } from '@/components/ui/form-stepper'
import { useAutoDraft } from '@/hooks/use-auto-draft'
import { useSubmitShortcut } from '@/hooks/use-keyboard-shortcut'

const steps = [
  { id: '1', label: 'Informações Básicas' },
  { id: '2', label: 'Conteúdo' },
  { id: '3', label: 'Configurações' },
]

export function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({})

  // Salvar rascunho automaticamente
  useAutoDraft({
    key: 'multi-step-form',
    data: formData,
    debounceMs: 2000,
  })

  // Ctrl+Enter para enviar
  useSubmitShortcut(() => {
    if (currentStep === steps.length - 1) {
      handleSubmit()
    }
  }, currentStep === steps.length - 1)

  return (
    <FormStepper
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onFinish={handleSubmit}
      allowStepClick
    >
      {(stepIndex) => {
        switch (stepIndex) {
          case 0:
            return <BasicInfoStep />
          case 1:
            return <ContentStep />
          case 2:
            return <SettingsStep />
        }
      }}
    </FormStepper>
  )
}
```

### Exemplo 3: Formulário com Confirmação Destrutiva

```typescript
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut'

export function EditableForm() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Ctrl+S para salvar rascunho
  useSaveShortcut(() => {
    handleSaveDraft()
  })

  return (
    <>
      <Button onClick={() => setShowDeleteDialog(true)} variant="destructive">
        Deletar
      </Button>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        description="Tem certeza que deseja deletar este item? Esta ação não pode ser desfeita."
        variant="destructive"
      />
    </>
  )
}
```

## Boas Práticas

1. **Labels Flutuantes**: Use quando o espaço é limitado ou para melhorar a UX em formulários longos
2. **Validação Inline**: Sempre mostre mensagens de erro claras e acionáveis
3. **Steppers**: Use para formulários com 3+ etapas ou quando há dependências entre campos
4. **Auto-draft**: Sempre ofereça salvamento automático em formulários longos
5. **Atalhos**: Documente atalhos importantes e mantenha consistência (Ctrl+Enter = enviar, Ctrl+S = salvar)

## Estrutura de Arquivos

```
src/
├── components/
│   └── ui/
│       ├── floating-input.tsx      # Input com label flutuante
│       ├── stepper.tsx             # Componente de stepper
│       ├── form-stepper.tsx        # Stepper para formulários
│       └── index.ts                # Exports
└── hooks/
    ├── use-auto-draft.ts           # Hook para salvamento automático
    └── use-keyboard-shortcut.ts    # Hook para atalhos de teclado
```

## Conclusão

Esses componentes e hooks melhoram significativamente a experiência do usuário em formulários, fornecendo feedback visual claro, salvamento automático e atalhos de teclado úteis.

