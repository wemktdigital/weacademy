# 🚀 Checklist de Deploy - WE Academy

## 📊 Status Atual

**Última Verificação:** Janeiro 2025  
**Testes Passando:** 359/446 (80.5%)  
**Testes Críticos Criados:** 8/15 (53%)  
**Status Geral:** 🟡 Pronto para staging, corrigir testes antes de produção

---

## ✅ Verificações Completadas

### Build e Lint
- [x] `package.json` existe e tem scripts de build
- [x] `next.config` configurado
- [x] Estrutura de pastas correta
- [ ] **TODO:** Executar `npm run build` e verificar erros
- [ ] **TODO:** Executar `npm run lint` e corrigir warnings
- [ ] **TODO:** Executar `npx tsc --noEmit` e verificar tipos

### Migrations
- [x] 55 arquivos de migration encontrados
- [ ] **TODO:** Aplicar migrations em staging
- [ ] **TODO:** Testar rollback das migrations

### Testes
- [x] 41 arquivos de teste existentes
- [x] 8 testes críticos criados recentemente
- [ ] **TODO:** Corrigir 87 testes falhando
- [ ] **TODO:** Criar 7 testes pendentes críticos
- [ ] **TODO:** Verificar cobertura ≥80%

### Variáveis de Ambiente
- [ ] **TODO:** Verificar `.env.production.example` existe
- [ ] **TODO:** Listar todas as variáveis necessárias
- [ ] **TODO:** Configurar em staging/produção

---

## ❌ Pendências Críticas Antes do Deploy

### 🔴 URGENTE (Fazer AGORA)

1. **Corrigir Testes Falhando**
   - 87 testes falhando de 446 total
   - Principalmente testes de gamificação
   - Ajustar mocks do Supabase

2. **Criar Testes Pendentes (7 arquivos)**
   - `tests/ui/ContextualTooltip.test.tsx`
   - `tests/ui/ProgressIndicator.test.tsx`
   - `tests/ui/ClickableCard.test.tsx`
   - `tests/ui/AccessibleFilters.test.tsx`
   - `tests/ui/FormStepper.test.tsx`
   - `tests/hooks/use-local-storage.test.ts`
   - `tests/lib/errors/error-messages.test.ts`

3. **Verificar Build**
   ```bash
   npm run build
   ```
   - [ ] Build completa sem erros
   - [ ] Bundle size aceitável
   - [ ] Sem warnings críticos

4. **Verificar Lint**
   ```bash
   npm run lint
   ```
   - [ ] Sem erros de lint
   - [ ] Corrigir warnings importantes

### 🟡 IMPORTANTE (Fazer HOJE)

1. **Configurar Ambiente de Staging**
   - Criar projeto Supabase para staging
   - Aplicar todas as migrations
   - Configurar variáveis de ambiente

2. **Testar Migrations**
   - Verificar todas as 55 migrations
   - Testar rollback em caso de erro
   - Validar dados de seed

3. **Verificar Variáveis de Ambiente**
   - Listar todas as variáveis necessárias
   - Criar `.env.production.example`
   - Documentar variáveis opcionais

### 🟢 DESEJÁVEL (Fazer esta SEMANA)

1. **Melhorar Cobertura de Testes**
   - Aumentar para ≥80%
   - Adicionar testes de integração
   - Testes E2E para fluxos críticos

2. **Documentação**
   - Atualizar README
   - Documentar novas funcionalidades
   - Guias de uso atualizados

---

## 📋 Comandos Úteis

### Verificação Rápida
```bash
# Verificar preparação para deploy
npx tsx scripts/check-deploy-ready.ts

# Executar testes
npm run test

# Executar build
npm run build

# Verificar lint
npm run lint

# Verificar tipos
npx tsc --noEmit
```

### Testes Específicos
```bash
# Testes de UI
npm run test -- ui

# Testes de hooks
npm run test -- hooks

# Testes de gamificação
npm run test -- gamification

# Testes com cobertura
npm run test -- --coverage
```

---

## 🎯 Próximos Passos Recomendados

### 1. Agora (30 minutos)
1. Executar `npm run build` e verificar erros
2. Executar `npm run lint` e corrigir warnings
3. Verificar tipos TypeScript

### 2. Hoje (2-3 horas)
1. Corrigir testes falhando críticos
2. Criar testes pendentes críticos (7 arquivos)
3. Verificar migrations em staging

### 3. Esta Semana (4-6 horas)
1. Configurar ambiente de staging completo
2. Deploy em staging
3. Testes em staging
4. Preparar deploy de produção

---

## 📊 Resumo Executivo

### ✅ O que está pronto:
- Funcionalidades principais implementadas
- Estrutura de código organizada
- Testes básicos criados
- Migrations prontas

### ⚠️ O que precisa atenção:
- Corrigir testes falhando (87 testes)
- Criar testes pendentes (7 arquivos)
- Verificar build e lint
- Configurar ambiente de staging

### 🎯 Recomendação:
**Deploy em STAGING primeiro** para validação completa antes de produção.

**Estimativa:** 4-6 horas de trabalho para estar 100% pronto para deploy de produção.

---

## 📝 Documentação

- `docs/DEPLOY_CHECKLIST.md` - Checklist completo
- `docs/TESTING_ROADMAP.md` - Plano de testes
- `docs/PRE_DEPLOY_SUMMARY.md` - Resumo detalhado

