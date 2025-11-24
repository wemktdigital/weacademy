# 🚀 Plano de Ação para Deploy - WE Academy

## 📊 Resumo Executivo

**Status:** 🟡 Pronto para staging, corrigir testes antes de produção  
**Testes Passando:** 359/446 (80.5%)  
**Testes Críticos Criados:** 8/15 (53%)  
**Migrations:** 55 arquivos ✅  
**Estimativa:** 4-6 horas para estar 100% pronto

---

## ✅ O que está pronto

1. ✅ Funcionalidades principais implementadas
2. ✅ Estrutura de código organizada  
3. ✅ 48 arquivos de teste existentes
4. ✅ 55 migrations criadas
5. ✅ 8 testes críticos criados recentemente

---

## ⚠️ O que precisa atenção

1. ❌ **87 testes falhando** (principalmente gamificação)
2. ❌ **7 testes críticos pendentes** (componentes recentes)
3. ❌ **`.env.production.example`** não existe
4. ⏳ Build e lint precisam ser verificados

---

## 🎯 Plano de Ação (4-6 horas)

### Fase 1: Corrigir Testes Críticos (2-3 horas) 🔴 URGENTE

#### 1.1 Corrigir Testes Falhando (1-2 horas)
```bash
# Identificar testes falhando
npm run test -- --run --reporter=verbose | grep FAIL

# Corrigir mocks do Supabase
# Atualizar src/tests/utils/mockSupabase.ts
```

**Tarefas:**
- [ ] Atualizar mocks do Supabase para gamificação
- [ ] Corrigir testes de API de gamificação (18 testes)
- [ ] Ajustar detecção de PHI nos testes do Lab IA
- [ ] Corrigir testes de componentes (alguns testes)

#### 1.2 Criar Testes Pendentes (1-2 horas)
- [ ] `tests/ui/ContextualTooltip.test.tsx`
- [ ] `tests/ui/ProgressIndicator.test.tsx`
- [ ] `tests/ui/ClickableCard.test.tsx`
- [ ] `tests/ui/AccessibleFilters.test.tsx`
- [ ] `tests/ui/FormStepper.test.tsx`
- [ ] `tests/hooks/use-local-storage.test.ts`
- [ ] `tests/lib/errors/error-messages.test.ts`
- [ ] `tests/lib/feedback/success-messages.test.ts`

---

### Fase 2: Verificações Técnicas (1 hora) 🔴 URGENTE

#### 2.1 Build e Lint (30 minutos)
```bash
# Verificar build
npm run build

# Verificar lint
npm run lint

# Verificar tipos
npx tsc --noEmit
```

**Tarefas:**
- [ ] Build completa sem erros
- [ ] Lint sem erros críticos
- [ ] Tipos TypeScript sem erros
- [ ] Bundle size aceitável

#### 2.2 Migrations (30 minutos)
```bash
# Verificar migrations
ls supabase/migrations | wc -l

# Aplicar em staging
supabase db push --db-url $STAGING_DB_URL
```

**Tarefas:**
- [ ] Verificar todas as 55 migrations
- [ ] Testar rollback das migrations
- [ ] Validar dados de seed

---

### Fase 3: Preparação de Ambiente (1 hora) 🟡 IMPORTANTE

#### 3.1 Variáveis de Ambiente (30 minutos)
```bash
# Criar .env.production.example
cp .env.local .env.production.example
# Remover valores sensíveis
```

**Variáveis Necessárias:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY`

#### 3.2 Configurar Staging (30 minutos)
- [ ] Criar projeto Supabase para staging
- [ ] Aplicar todas as migrations
- [ ] Configurar variáveis de ambiente
- [ ] Testar conexões

---

### Fase 4: Deploy (30 minutos) 🟢 FINAL

#### 4.1 Deploy em Staging (15 minutos)
```bash
# Deploy em staging (Vercel ou similar)
vercel --prod=false
```

#### 4.2 Testes em Staging (15 minutos)
- [ ] Testar funcionalidades principais
- [ ] Verificar autenticação
- [ ] Testar gamificação
- [ ] Testar Lab IA
- [ ] Verificar performance

#### 4.3 Deploy em Produção (após validação)
```bash
# Deploy em produção
vercel --prod
```

---

## 📋 Checklist Final

### Antes de Deploy em Staging
- [ ] Todos os testes críticos criados
- [ ] Testes principais passando (>90%)
- [ ] Build completa sem erros
- [ ] Lint sem erros críticos
- [ ] Tipos TypeScript sem erros
- [ ] Migrations verificadas
- [ ] `.env.production.example` criado

### Antes de Deploy em Produção
- [ ] Todos os testes passando (>95%)
- [ ] Testes em staging validados
- [ ] Performance aceitável
- [ ] Sem bugs críticos
- [ ] Documentação atualizada
- [ ] Variáveis de ambiente configuradas
- [ ] Monitoramento configurado

---

## 🎯 Priorização

### ⚡ FAZER AGORA (Próximas 2 horas)
1. Corrigir testes falhando críticos
2. Criar 5 testes pendentes mais críticos
3. Verificar build e lint

### 🔥 FAZER HOJE (Próximas 4 horas)
1. Completar todos os testes pendentes
2. Configurar ambiente de staging
3. Aplicar migrations em staging

### 📅 FAZER ESTA SEMANA (Próximas 6 horas)
1. Deploy em staging
2. Testes em staging
3. Deploy em produção
4. Monitoramento pós-deploy

---

## 📊 Métricas de Sucesso

### Para Deploy em Staging
- ✅ Testes passando: >85%
- ✅ Build sem erros
- ✅ Lint sem erros críticos
- ✅ Migrations aplicadas

### Para Deploy em Produção
- ✅ Testes passando: >95%
- ✅ Validação em staging completa
- ✅ Performance aceitável
- ✅ Sem bugs críticos

---

## ✅ Recomendação Final

### 🟡 SIM, pode fazer deploy em STAGING AGORA

**Condições:**
1. ✅ Funcionalidades principais implementadas
2. ✅ Estrutura pronta
3. ⚠️ Alguns testes falhando (corrigir antes de produção)
4. ✅ Migrations prontas

### 🔴 NÃO, aguardar antes de PRODUÇÃO

**Condições:**
1. ❌ 87 testes falhando (corrigir primeiro)
2. ❌ 7 testes críticos pendentes (criar primeiro)
3. ⚠️ Build e lint precisam verificação
4. ⚠️ Validação em staging necessária

---

## 📝 Próximos Passos Imediatos

1. **AGORA (30 min):**
   ```bash
   npm run build
   npm run lint
   npx tsc --noEmit
   ```

2. **HOJE (2-3 horas):**
   - Corrigir testes falhando críticos
   - Criar 5 testes pendentes mais críticos
   - Configurar staging

3. **ESTA SEMANA:**
   - Deploy em staging
   - Validação completa
   - Deploy em produção

---

**Estimativa Total:** 4-6 horas para estar 100% pronto para deploy de produção.

