# 🎨 Sprint 6 - Interface Visual de Criação e Edição de Agentes

**Data:** Janeiro 2025  
**Autor:** WE Academy Development Team

## 📋 Visão Geral

Este sprint implementa uma interface administrativa completa para gerenciar agentes de IA do Laboratório. A equipe WE Academy pode criar, editar, duplicar e excluir agentes sem alterar código.

## 🎯 Objetivos Alcançados

✅ **CRUD Completo de Agentes**: Interface visual para gerenciar agentes  
✅ **Tabela Supabase**: `lab_agents` com validações e RLS  
✅ **APIs RESTful**: CRUD completo com validação Zod  
✅ **Integração com UI**: `AgentSelector` carrega agentes do banco  
✅ **Validação**: Schema Zod para campos obrigatórios  
✅ **UX/UI**: shadcn/ui com dark mode compatível  
✅ **RBAC**: Apenas admin/gestor_we acessam a página

## 📦 Arquivos Criados

### Database

- `supabase/migrations/20251026150000_lab_agents_crud.sql` - Tabela lab_agents

### APIs

- `src/app/api/lab-ia/admin/agents/route.ts` - GET e POST agentes
- `src/app/api/lab-ia/admin/agents/[id]/route.ts` - PUT e DELETE agente específico

### Frontend

- `src/app/ai-lab/admin/agents/page.tsx` - Página CRUD de agentes
- `src/lib/validations/agent.schema.ts` - Schema Zod

### Atualizados

- `src/modules/laboratorio-ia/components/AgentSelector.tsx` - Busca agentes do banco

## 🗄️ Banco de Dados

### Tabela `lab_agents`

```sql
CREATE TABLE lab_agents (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  type TEXT CHECK (type IN ('llm', 'automation')),
  provider TEXT,
  model TEXT,
  prompt TEXT,
  category TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Campos

- **name**: Nome do agente (obrigatório)
- **description**: Descrição breve
- **icon**: Emoji ou SVG
- **type**: `llm` (local) ou `automation` (externo)
- **provider**: OpenAI, Google, etc
- **model**: gpt-4o-mini, gemini-2.5-flash, etc
- **prompt**: Instruções base do agente
- **category**: Categoria (pesquisa, marketing, etc)
- **active**: Ativo/inativo

## 📡 APIs Criadas

### GET `/api/lab-ia/admin/agents`

Lista agentes com paginação.

**Query params:**
- `page`: Página (default: 1)
- `limit`: Itens por página (default: 10)

**Response:**
```json
{
  "agents": [...],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

### POST `/api/lab-ia/admin/agents`

Cria novo agente.

**Body:**
```json
{
  "name": "Novo Agente",
  "description": "...",
  "icon": "🤖",
  "type": "llm",
  "prompt": "...",
  "active": true
}
```

### PUT `/api/lab-ia/admin/agents/[id]`

Atualiza agente existente.

### DELETE `/api/lab-ia/admin/agents/[id]`

Exclui agente.

## 🎨 UI/UX

### Página de Gestão

- **Listagem em Cards**: Grid responsivo com cards
- **Botões de Ação**: Editar, Duplicar, Excluir
- **Dialog de Criação/Edição**: Modal com formulário completo
- **Alert Dialog**: Confirmação de exclusão
- **Toasts**: Feedback visual de ações

### Campos do Formulário

- Nome* (obrigatório)
- Ícone (emoji)
- Descrição* (obrigatório)
- Tipo* (llm/automation)
- Categoria
- Provedor
- Modelo
- Prompt* (obrigatório)
- Ativo/Inativo

## 🔒 Segurança

- RBAC: Apenas admin/gestor_we
- RLS: Políticas de acesso na tabela
- Validação: Schema Zod com mensagens de erro
- Sanitização: Dados validados antes de inserir

## 🚀 Fluxo de Uso

1. Admin acessa `/ai-lab/admin/agents`
2. Clica em "+ Novo Agente"
3. Preenche formulário e salva
4. Agente aparece na listagem
5. `AgentSelector` carrega automaticamente o novo agente

## 📈 Próximos Passos

- [ ] Adicionar busca e filtros avançados
- [ ] Implementar paginação frontend
- [ ] Adicionar preview do prompt
- [ ] Upload de ícone SVG
- [ ] Histórico de alterações

---

**Status:** ✅ 100% Completo
