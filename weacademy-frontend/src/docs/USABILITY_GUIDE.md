# Guia de Usabilidade - WE Academy

## Visão Geral

Este guia documenta os componentes e utilitários de usabilidade implementados na plataforma WE Academy, incluindo onboarding, tooltips contextuais, confirmações e melhorias de feedback.

## Componentes

### 1. ConfirmDialog

Componente de confirmação melhorado para ações destrutivas, com variantes visuais e estados de loading.

**Uso:**
```typescript
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const [deleteDialog, setDeleteDialog] = useState({ open: false, itemId: null })

<ConfirmDialog
  open={deleteDialog.open}
  onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
  onConfirm={handleDelete}
  title="Confirmar Exclusão"
  description="Tem certeza que deseja deletar este item? Esta ação não pode ser desfeita."
  confirmText="Sim, Deletar"
  cancelText="Cancelar"
  variant="destructive" // ou "warning" ou "info"
  isLoading={isDeleting}
/>
```

### 2. ContextualTooltip

Tooltip contextual com ícones e suporte a diferentes variantes.

**Uso:**
```typescript
import { ContextualTooltip } from '@/components/ui/contextual-tooltip'

<ContextualTooltip
  content="Este campo é obrigatório e será usado como identificador único"
  icon="info" // ou "help" ou "sparkles" ou "none"
  side="top"
  variant="default" // ou "compact"
>
  <Label htmlFor="slug">Slug</Label>
</ContextualTooltip>
```

### 3. TourGuide

Sistema de tour guiado customizado para onboarding de novos usuários.

**Uso:**
```typescript
import { TourGuide } from '@/components/onboarding/TourGuide'
import { aiLabTourSteps } from '@/app/onboarding/ai-lab-tour/steps'

// Na página
<TourGuide
  id="ai-lab-tour"
  steps={aiLabTourSteps}
  autoStart={!hasSeenTour}
  onComplete={() => console.log('Tour completo!')}
  onSkip={() => console.log('Tour pulado')}
/>
```

**Criar passos do tour:**
```typescript
export const myTourSteps: TourStep[] = [
  {
    target: '#my-element', // ou '.my-class' ou 'my-element'
    title: 'Título do Passo',
    content: 'Descrição detalhada do que o usuário deve saber sobre este elemento.',
    placement: 'bottom', // 'top' | 'bottom' | 'left' | 'right' | 'auto'
    disableBeacon: false,
  },
]
```

**Adicionar data-tour attributes:**
```tsx
<div data-tour="sidebar">
  {/* Conteúdo */}
</div>
```

### 4. ProgressIndicator

Indicador de progresso visual para tarefas longas.

**Uso:**
```typescript
import { ProgressIndicator, TaskProgress } from '@/components/ui/progress-indicator'

// Indicador simples
<ProgressIndicator
  progress={uploadProgress}
  status="loading" // ou "success" | "error" | "idle"
  label="Enviando arquivo"
  description="Aguarde enquanto o arquivo é processado..."
  showPercentage
  size="md" // ou "sm" | "lg"
/>

// Múltiplas tarefas
<TaskProgress
  tasks={[
    { id: '1', label: 'Processando imagem', status: 'loading', progress: 45 },
    { id: '2', label: 'Gerando preview', status: 'pending' },
    { id: '3', label: 'Salvando arquivo', status: 'success' },
  ]}
/>
```

## Utilitários

### 1. Mensagens de Erro Acionáveis

Criar mensagens de erro específicas e acionáveis.

**Uso:**
```typescript
import { showActionableError, createActionableError } from '@/lib/feedback'
import { useToast } from '@/hooks/use-toast'

const { toast } = useToast()

try {
  // ... operação
} catch (error) {
  showActionableError(error, {
    action: 'salvar curso',
    entity: 'curso',
    code: 'VALIDATION_ERROR',
    details: { field: 'title' }
  }, toast)
}
```

**Tipos de erro suportados:**
- Autenticação (401) → Sugere fazer login
- Permissão (403) → Sugere verificar permissões
- Rede → Sugere verificar conexão
- Validação → Indica campos inválidos
- Não encontrado (404) → Sugere voltar
- Conflito (409) → Sugere usar dados diferentes
- Servidor (500) → Sugere tentar novamente

### 2. Mensagens de Sucesso Melhoradas

Criar mensagens de sucesso claras e específicas.

**Uso:**
```typescript
import { showSuccessMessage } from '@/lib/feedback'

showSuccessMessage({
  action: 'curso criado',
  entity: 'curso',
  duration: 5000,
  showIcon: true,
  variant: 'default', // ou 'achievement' | 'important'
}, toast)
```

**Mensagens pré-configuradas:**
- `curso criado` → "Curso criado com sucesso!"
- `curso atualizado` → "Curso atualizado com sucesso!"
- `curso deletado` → "Curso removido com sucesso"
- `mensagem enviada` → "Mensagem enviada!"
- `perfil atualizado` → "Perfil atualizado com sucesso!"
- `configurações salvas` → "Configurações salvas!"
- `arquivo enviado` → "Arquivo enviado com sucesso!"
- `conquista desbloqueada` → "Conquista Desbloqueada!"
- `nível alcançado` → "Level Up!"

### 3. Onboarding Provider

Provider para gerenciar múltiplos tours na aplicação.

**Uso:**
```typescript
import { OnboardingProvider, HelpButton, useOnboarding } from '@/components/onboarding/OnboardingProvider'

// No layout
<OnboardingProvider>
  {children}
</OnboardingProvider>

// No componente
const { startTour, resetTour, hasSeenTour } = useOnboarding()

// Botão de ajuda
<HelpButton
  tourId="ai-lab-tour"
  steps={aiLabTourSteps}
  variant="ghost"
  size="icon"
/>
```

## Exemplos de Integração

### Exemplo 1: Página com Confirmação Destrutiva

```typescript
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showActionableError, showSuccessMessage } from '@/lib/feedback'

const [deleteDialog, setDeleteDialog] = useState({ open: false, itemId: null })
const [isDeleting, setIsDeleting] = useState(false)

const handleDelete = async (itemId: string) => {
  setIsDeleting(true)
  try {
    // Deletar item
    await deleteItem(deleteDialog.itemId)
    
    showSuccessMessage({ action: 'item deletado', entity: 'item' }, toast)
    setDeleteDialog({ open: false, itemId: null })
  } catch (error) {
    showActionableError(error, { action: 'deletar item', entity: 'item' }, toast)
  } finally {
    setIsDeleting(false)
  }
}

<ConfirmDialog
  open={deleteDialog.open}
  onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
  onConfirm={handleDelete}
  title="Confirmar Exclusão"
  description="Tem certeza que deseja deletar este item? Esta ação não pode ser desfeita."
  variant="destructive"
  isLoading={isDeleting}
/>
```

### Exemplo 2: Formulário com Tooltips Contextuais

```typescript
import { ContextualTooltip } from '@/components/ui/contextual-tooltip'

<FormField>
  <FormLabel>
    <ContextualTooltip
      content="O slug será usado na URL do curso. Use apenas letras minúsculas, números e hífens."
      icon="info"
      variant="compact"
    >
      Slug
    </ContextualTooltip>
  </FormLabel>
  <FormControl>
    <Input {...field} />
  </FormControl>
</FormField>
```

### Exemplo 3: Upload com Progresso Visual

```typescript
import { ProgressIndicator } from '@/components/ui/progress-indicator'

{uploading && (
  <ProgressIndicator
    progress={uploadProgress}
    status="loading"
    label="Enviando arquivo"
    description={`${uploadProgress}% concluído`}
    showPercentage
    size="md"
  />
)}
```

## Boas Práticas

1. **Confirmações Destrutivas**: Sempre use `ConfirmDialog` para ações irreversíveis
2. **Mensagens de Erro**: Use `showActionableError` para erros, oferecendo soluções
3. **Mensagens de Sucesso**: Use `showSuccessMessage` para ações importantes
4. **Tooltips**: Use `ContextualTooltip` para explicar campos complexos ou não óbvios
5. **Progresso**: Use `ProgressIndicator` ou `TaskProgress` para operações que demoram mais de 2 segundos
6. **Onboarding**: Forneça tours guiados para novas funcionalidades ou novos usuários

## Estrutura de Arquivos

```
src/
├── components/
│   ├── ui/
│   │   ├── confirm-dialog.tsx      # Diálogo de confirmação
│   │   ├── contextual-tooltip.tsx  # Tooltip contextual
│   │   ├── progress-indicator.tsx  # Indicadores de progresso
│   │   └── index.ts                # Exports
│   └── onboarding/
│       ├── TourGuide.tsx           # Sistema de tour guiado
│       └── OnboardingProvider.tsx  # Provider de onboarding
├── hooks/
│   └── use-local-storage.ts        # Hook para localStorage
└── lib/
    ├── errors/
    │   └── error-messages.ts       # Utilitários de erro
    └── feedback/
        ├── success-messages.ts     # Utilitários de sucesso
        └── index.ts                # Exports
```

## Conclusão

Esses componentes e utilitários melhoram significativamente a experiência do usuário, fornecendo feedback claro, orientação contextual e proteção contra ações acidentais.

