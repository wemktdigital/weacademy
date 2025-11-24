# 🧪 Plano de Testes - WE Academy

## 📊 Status Atual

### Testes Existentes: 40+ arquivos
- ✅ Gamificação: 5 arquivos
- ✅ AI Lab: 12 arquivos
- ✅ Plataforma: 7 arquivos
- ✅ Autenticação: 2 arquivos
- ✅ Integração: 8 arquivos
- ✅ Unitários: 6 arquivos

### Testes Pendentes: ~15 arquivos críticos

---

## 🎯 Priorização de Testes para Deploy

### 🔴 CRÍTICO (Fazer ANTES do deploy)

#### 1. Componentes de UI Recentes (8 arquivos)
- [x] `ui/FloatingInput.test.tsx` ✅ CRIADO
- [x] `ui/Stepper.test.tsx` ✅ CRIADO
- [x] `ui/ConfirmDialog.test.tsx` ✅ CRIADO
- [ ] `ui/ContextualTooltip.test.tsx`
- [ ] `ui/ProgressIndicator.test.tsx`
- [ ] `ui/ClickableCard.test.tsx`
- [ ] `ui/AccessibleFilters.test.tsx`
- [ ] `ui/FormStepper.test.tsx`

#### 2. Componentes de Gamificação Recentes (2 arquivos)
- [x] `gamification/XPProgressChart.test.tsx` ✅ CRIADO
- [x] `gamification/PersonalizedInsights.test.tsx` ✅ CRIADO

#### 3. APIs Recentes (1 arquivo)
- [x] `api/gamification/xp-history.test.ts` ✅ CRIADO

#### 4. Hooks Recentes (3 arquivos)
- [x] `hooks/use-auto-draft.test.ts` ✅ CRIADO
- [x] `hooks/use-keyboard-shortcut.test.ts` ✅ CRIADO
- [ ] `hooks/use-local-storage.test.ts`

#### 5. Utilitários Recentes (2 arquivos)
- [ ] `lib/errors/error-messages.test.ts`
- [ ] `lib/feedback/success-messages.test.ts`

**Progresso: 8/15 testes críticos criados (53%)**

---

### 🟡 IMPORTANTE (Recomendado antes do deploy)

#### 1. Testes de Integração
- [ ] Integração: gamificação + ações do usuário
- [ ] Integração: memória + chat
- [ ] Integração: formulários + auto-draft

#### 2. Testes de Acessibilidade
- [ ] Navegação por teclado
- [ ] Leitores de tela
- [ ] ARIA attributes

#### 3. Testes de Performance
- [ ] Gráficos com muitos dados
- [ ] Auto-draft com debounce
- [ ] Tour guiado com muitos passos

---

### 🟢 OPCIONAL (Pode fazer depois)

#### 1. Testes E2E
- [ ] Fluxo completo de gamificação
- [ ] Fluxo completo de onboarding
- [ ] Fluxo completo de formulário multi-etapa

---

## 📝 Comandos Úteis

### Executar Todos os Testes
```bash
npm run test
```

### Executar Testes com Cobertura
```bash
npm run test -- --coverage
```

### Executar Testes Específicos
```bash
# Testes de UI
npm run test -- ui

# Testes de hooks
npm run test -- hooks

# Testes de gamificação
npm run test -- gamification

# Testes de API
npm run test -- api
```

### Executar Testes em Watch Mode
```bash
npm run test -- --watch
```

### Ver Interface de Testes
```bash
npm run test:ui
```

---

## ✅ Checklist de Execução

### Antes de Criar Testes
- [ ] Verificar se componente/hook/API já tem teste
- [ ] Entender comportamento esperado
- [ ] Identificar casos de borda

### Ao Criar Testes
- [ ] Testar comportamento normal
- [ ] Testar casos de erro
- [ ] Testar casos de borda
- [ ] Testar acessibilidade (se componente)
- [ ] Verificar que testes passam

### Antes de Commit
- [ ] Todos os testes passam
- [ ] Cobertura adequada (>80% para arquivos críticos)
- [ ] Nenhum console.error
- [ ] Código limpo e comentado

---

## 🎯 Meta Final

**Cobertura de Testes: ≥80%**

### Distribuição Esperada
- Componentes: ≥85%
- Hooks: ≥80%
- APIs: ≥85%
- Utilitários: ≥90%

---

## 📈 Próximos Passos

1. ✅ Criar testes críticos restantes (7 arquivos)
2. ⏳ Executar suite completa de testes
3. ⏳ Verificar cobertura de código
4. ⏳ Corrigir testes que falharem
5. ⏳ Executar verificações de build/lint
6. ⏳ Preparar para deploy

**Estimativa:** 4-6 horas para completar testes críticos

