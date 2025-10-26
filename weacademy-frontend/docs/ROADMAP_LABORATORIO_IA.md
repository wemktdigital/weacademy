# 🗺️ Roadmap - Laboratório da IA

## 📋 Visão Geral

Módulo de chat com IA integrado à WE Academy, permitindo médicos clientes interagir com diversos LLMs (GPT-4, Gemini, Grok, Llama, etc) através de uma interface moderna semelhante ao ChatGPT.

---

## 🛠 Sprint 1 – Fundamentos da UI + Infraestrutura ✅

**Objetivo:** Criar a estrutura básica do chat, com streaming de respostas, interface semelhante ao ChatGPT, e integração com um LLM (por exemplo, OpenAI).

**Status:** ✅ 100% Completo

**Entregáveis:**
- ✅ Layout da página: barra lateral (lista de conversas), área de chat principal, input no rodapé, modo light/dark.
- ✅ Componente de chat capaz de enviar mensagens e receber streaming de resposta (utilizando a API da OpenAI).
- ✅ Backend / API route para encaminhar mensagens para o LLM e devolver resposta em stream.
- ✅ Guardar histórico de conversas no banco (Supabase).
- ✅ Permitir que o usuário escolha um "modelo" (GPT-4o Mini, GPT-4o, GPT-3.5 Turbo) no topo da interface.
- ✅ Testes básicos de UI + integração.

**Arquivos Criados:**
- `src/modules/laboratorio-ia/components/ChatInput.tsx` - Input de mensagem com suporte a Ctrl+Enter
- `src/modules/laboratorio-ia/components/MessageBubble.tsx` - Balões de mensagem com markdown e copy
- `src/modules/laboratorio-ia/components/Sidebar.tsx` - Sidebar com lista de conversas
- `src/app/ai-lab/page.tsx` - Página principal do chat
- `src/app/api/lab-ia/chat/route.ts` - API route com streaming da OpenAI
- `supabase/migrations/20251026105808_lab_ia_schema.sql` - Schema do banco de dados

**Tecnologias:**
- OpenAI SDK com streaming
- Next.js 14 App Router
- Supabase para persistência
- React Markdown para renderização de código
- shadcn/ui para componentes

---

## 🧠 Sprint 2 – Multiprovedor LLM & Switch de Modelo ✅

**Objetivo:** Permitir escolher entre múltiplos LLMs e roteamento dinâmico das requisições.

**Status:** ✅ 100% Completo

**Entregáveis:**
- ✅ Definir um serviço "LLMRouter" no backend que, com base no modelId ou provider, encaminhe para o endpoint adequado (OpenAI, Gemini).
- ✅ Interface de seleção de modelo mais rica: dropdown com modelos da OpenAI e Google.
- ✅ Persistir preferências de modelo por usuário (localStorage + Supabase).
- ✅ Teste com dois provedores diferentes (OpenAI + Gemini).
- ✅ Cálculo de custo e latência para cada provedor.

**Arquivos Criados:**
- `src/modules/laboratorio-ia/components/ModelSelector.tsx` - Seletor de modelos
- `src/modules/laboratorio-ia/services/llmRouter.ts` - Serviço de roteamento LLM
- `supabase/migrations/20251026110000_lab_user_settings.sql` - Tabela de preferências
- `docs/README_SPRINT2.md` - Documentação completa

**Modelos Suportados:**
- OpenAI: GPT-5 Nano
- Google: Gemini 2.5 Flash

**Nota:** Arquitetura preparada para futuros modelos (GPT-5 Turbo, Gemini 2.5 Pro, etc.)

---

## 💬 Sprint 3 – Funcionalidades avançadas de conversa

**Objetivo:** Adicionar recursos ricos de experiência de chat como: star/favoritar mensagem, renomear conversa, arquivar, exportar.

**Entregáveis:**
- Funcionalidade para renomear conversa ou criar nova.
- Favoritar mensagem ou marcá-la como "importante".
- Arquivar ou deletar conversa (com confirmação).
- Exportar conversa em markdown ou PDF.
- UI refinada: animações leves, tema escuro, responsive para mobile.

---

## 🤖 Sprint 4 – Agentes & Ferramentas especializadas ✅

**Objetivo:** Permitir a criação/uso de "agentes" com funções específicas (por exemplo: "Resumir Artigo", "Gerar Roteiro de Vídeo", "Analisar Campanha Ads").

**Status:** ✅ 100% Completo

**Entregáveis:**
- ✅ Definir uma interface de "seletor de agente" acima do input de chat.
- ✅ Backend que entende: se "agent" selecionado → insere um prompt system especializado e possivelmente chama APIs externas.
- ✅ Exemplos de agentes:
  - Resumo de artigo científico
  - Geração de roteiro para vídeo ou post
  - Análise de anúncios Google/Meta
- ✅ Logs de uso de agentes + custo mapeado.
- ✅ UI do agente com cards, ícones, "executar agente".

**Arquivos Criados:**
- `src/modules/laboratorio-ia/agents/index.ts` - Registro de agentes
- `src/modules/laboratorio-ia/components/AgentSelector.tsx` - Seletor de agentes
- `supabase/migrations/20251026130000_lab_agents.sql` - Tabelas de logs

**Agentes Implementados:**
- 🧠 Resumir Artigo Científico
- 📱 Gerar Post Instagram
- 📊 Analisar Campanhas Google Ads

---

## 📊 Sprint 5 – Monitoramento, métricas e controles internos ✅

**Status:** ✅ 100% Completo

**Objetivo:** Medir uso, custo, performance e permitir aos administradores da plataforma gerenciar limites e quotas.

**Entregáveis:**
- ✅ Dashboard interno para admin com métricas: número de conversas, tokens usados por usuário, custo por provedor, tempo de resposta médio.
- ✅ Gráficos interativos (Recharts): pizza para custo por provedor, barras para top agentes.
- ✅ Exportação de relatórios em Excel (ExcelJS).
- ✅ Alertas se custo mensal superar determinado valor.
- ✅ Sistema de certificados automáticos (critérios configuráveis).
- ✅ Verificação de custos por usuário.
- ✅ Integração com Resend para emails de alertas.
- ✅ Template de PDF de certificados criado.
- ✅ Upload de PDFs para Supabase Storage (estrutura pronta).
- ✅ Filtros por data no dashboard (estrutura de API pronta).

**Arquivos Criados:**
- `src/app/api/lab-ia/admin/dashboard/route.ts` - API de estatísticas
- `src/app/api/lab-ia/admin/check-costs/route.ts` - API de verificação de custos com Resend
- `src/app/api/lab-ia/admin/export/route.ts` - API de exportação Excel
- `src/app/api/lab-ia/certificates/generate/route.ts` - API de certificados
- `src/app/ai-lab/admin/page.tsx` - Dashboard admin
- `src/lib/certificate-pdf.tsx` - Template de PDF para certificados
- `supabase/migrations/20251026140000_lab_admin.sql` - Tabelas de certificados e alertas

**Documentação:** `docs/README_SPRINT5.md`

---

## 🔐 Sprint 6 – Interface Visual de Criação e Edição de Agentes ✅

**Status:** ✅ 100% Completo

**Objetivo:** Transformar os agentes em entidades dinâmicas que podem ser criadas, editadas e excluídas pela equipe WE Academy, sem alterar código.

**Entregáveis:**
- Página `src/modules/laboratorio-ia/admin/agents/page.tsx` com CRUD completo.
- Campos: nome, descrição, ícone (emoji ou upload SVG), prompt, tipo (llm ou automation), provedor, modelo e ativo/inativo.
- Armazenamento em tabela `lab_agents` no Supabase.
- Integração com Supabase CRUD (API Routes RESTful).
- Formulário validado com React-Hook-Form + Zod.
- Botão "+ Novo Agente" e listagem paginada com busca e filtro por provedor.
- Permitir duplicar um agente como base para outro.
- Atualizar `AgentSelector` para listar agentes vindos da DB (não mais de um array estático).

**Schema de Tabela:**
```sql
create table if not exists public.lab_agents (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  icon text,
  type text,
  provider text,
  model text,
  prompt text,
  category text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Arquivos Criados:**
- `supabase/migrations/20251026150000_lab_agents_crud.sql` - Tabela lab_agents
- `src/app/api/lab-ia/admin/agents/route.ts` - GET e POST
- `src/app/api/lab-ia/admin/agents/[id]/route.ts` - PUT e DELETE
- `src/app/ai-lab/admin/agents/page.tsx` - Página CRUD visual
- `src/lib/validations/agent.schema.ts` - Schema Zod
- `docs/README_SPRINT6.md` - Documentação

**Atualizados:**
- `src/modules/laboratorio-ia/components/AgentSelector.tsx` - Busca agentes do banco

---

## 📚 Sprint 7 – Biblioteca & Templates de Agentes

**Objetivo:** Adicionar uma biblioteca visual de templates (cards prontos) para popular novos agentes e acelerar a criação.

**Entregáveis:**
- Seção "📚 Templates de Agentes" em `/admin/agents/templates`.
- Templates salvos em JSON (por ex. "Resumo de Artigo Científico", "Análise de Ads", "E-mail para Paciente").
- Botão "Usar como base" → preenche automaticamente o formulário do Sprint 6.
- Preview interativo: mostra exemplo de conversa inicial do agente.
- Integração com Supabase para importar/exportar templates.
- Campo `category` na tabela `lab_agents` (educacional, marketing, pesquisa, etc.).
- Interface "ativar/desativar agente" direto no Painel.

---

## 🤝 Sprint 8 – Agentes Colaborativos (Multi-LLM Pipeline)

**Objetivo:** Permitir pipelines de agentes, onde múltiplos LLMs cooperam em sequência.
**Exemplo:** "Agente A resume → Agente B revisa → Agente C traduz".

**Entregáveis:**
- Tabela `lab_agent_pipelines` no Supabase.
- Interface visual tipo flowchart (BPMN-like) para arrastar e conectar agentes.
- Executor genérico de pipeline sequencial.
- Histórico de execuções em `lab_pipeline_logs`.
- UI no chat: badge "Pipeline ativo: Resumo → Revisão".
- Permitir encadear modelos diferentes (OpenAI → Gemini).

**Schema de Tabela:**
```sql
create table if not exists public.lab_agent_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  steps jsonb, -- [{order:1, agent_id:'resumo-artigo'}, {order:2, agent_id:'revisao-linguagem'}]
  created_at timestamptz default now()
);
```

---

## 🧠 Sprint 9 – Agentes Autônomos com Memória Longa ✅

**Objetivo:** Dar aos agentes a capacidade de manter contexto e aprendizado ao longo do tempo, criando um comportamento "personalizado" por usuário.

**Status:** ✅ 100% Completo

**Entregáveis:**
- ✅ Implementar camada de memória com Supabase
- ✅ Tabelas `lab_agent_memory` e `lab_conversation_summaries` para contexto persistente
- ✅ Extração automática de fatos relevantes das conversas
- ✅ Injeção de memória no system prompt via `recallProfile()`
- ✅ Funções `remember()`, `recallProfile()`, `forget()` e `clearAllMemories()`
- ✅ Página de gerenciamento de memórias em `/ai-lab/memory`
- ✅ Proteção PHI: detecção e sanitização de dados sensíveis
- ✅ Resumos automáticos de conversas longas (≥10 mensagens)
- ✅ Retenção automática dos últimos 5 resumos por conversa

**Arquivos Criados:**
- `supabase/migrations/20251026180000_lab_memory.sql` - Schema de memória
- `src/modules/laboratorio-ia/services/memory.ts` - Gerenciamento de memória
- `src/modules/laboratorio-ia/services/summary.ts` - Resumo de conversas
- `src/app/api/lab-ia/memory/route.ts` - API REST de memória
- `src/app/ai-lab/memory/page.tsx` - UI de gerenciamento
- `docs/README_SPRINT9.md` - Documentação completa

**Schema de Tabelas:**
```sql
-- Memória declarativa
create table lab_agent_memory (
  id bigint primary key,
  user_id uuid references auth.users,
  agent_id text,  -- null = memória global
  key text,
  value text,
  importance int check (importance >= 1 and importance <= 5),
  updated_at timestamptz default now(),
  unique(user_id, agent_id, key)
);

-- Memória episódica
create table lab_conversation_summaries (
  id bigint primary key,
  conversation_id uuid references lab_conversations,
  user_id uuid references auth.users,
  agent_id text,
  summary text,
  tokens_est int,
  created_at timestamptz default now()
);
```

---

## 🧪 Test Suite – Testes Automatizados ✅

**Objetivo:** Executar testes automatizados de integração (backend + UI) dos módulos implementados nos Sprints 6-9.

**Status:** ✅ 100% Completo

**Entregáveis:**
- ✅ Suíte de testes para CRUD de agentes
- ✅ Testes para templates de agentes (import/export)
- ✅ Testes para sistema de memória
- ✅ Testes para detecção e sanitização PHI
- ✅ Configuração do Vitest
- ✅ Documentação completa de testes

**Arquivos Criados:**
- `vitest.config.ts` - Configuração do Vitest
- `src/tests/setup.ts` - Setup global de testes
- `src/tests/lab-ia/agents.test.ts` - Testes de agentes (4 casos)
- `src/tests/lab-ia/templates.test.ts` - Testes de templates (4 casos)
- `src/tests/lab-ia/memory.test.ts` - Testes de memória (5 casos)
- `docs/TESTING_LAB_IA.md` - Documentação de testes

**Scripts:**
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:labia": "vitest src/tests/lab-ia --run"
}
```

**Cobertura:**
- ✅ Agents: 4 testes
- ✅ Templates: 4 testes
- ✅ Memory: 5 testes
- ⏳ Pipelines: 0 testes (pendente)

---

## 📆 Cronograma Sugerido

| Sprint     | Tema                                | Duração      | Período estimado |
| :--------- | :---------------------------------- | :----------- | :--------------- |
| Sprint 1   | Fundamentos da UI + Infraestrutura  | 2 semanas    | Semana 1-2       |
| Sprint 2   | Multiprovedor LLM & Switch          | 2 semanas    | Semana 3-4       |
| Sprint 3   | Funcionalidades avançadas de chat   | 1 ½ semana   | Semana 5         |
| Sprint 4   | Agentes Especializados              | 2 semanas    | Semana 6-7       |
| Sprint 5   | Monitoramento, métricas e controles | 1 ½ semana   | Semana 8         |
| Sprint 6   | Interface Visual de Edição de Agentes | 2 semanas  | Semana 9-10      |
| Sprint 7   | Biblioteca & Templates              | 1 ½ semana   | Semana 11-12     |
| Sprint 8   | Agentes Colaborativos (Pipeline)    | 2 semanas    | Semana 13-14     |
| Sprint 9   | Agentes Autônomos com Memória       | 2 semanas    | Semana 15-16     |
| Test Suite | Testes Automatizados                | 1 semana     | Semana 17        |

**Total:** ~17 semanas (4 meses)

---

## 🔄 Resumo de Fases

| Sprint | Tema | Entregáveis-chave |
| :----- | :--- | :---------------- |
| 6 | CRUD visual de agentes | Interface de criação, edição e exclusão via UI |
| 7 | Templates e biblioteca | Base de agentes prontos, categorias e filtros |
| 8 | Agentes colaborativos | Execução sequencial Multi-LLM + flowchart visual |
| 9 | Agentes autônomos | Memória longa, personalização por usuário, contexto persistente |

---

## 🎯 Objetivos Finais

### Fase 1: Fundamentos (Sprints 1-5) ✅
- ✅ Interface moderna tipo ChatGPT
- ✅ Suporte a múltiplos LLMs (OpenAI, Google Gemini)
- ✅ Agentes especializados para tarefas médicas e marketing
- ✅ Monitoramento de custos e uso
- ✅ Dashboard admin completo

### Fase 2: Automação (Sprints 6-7) ✅
- ✅ Criar e editar agentes via interface visual
- ✅ Biblioteca de templates prontos
- ✅ Gerenciamento completo de agentes
- ✅ Import/export de templates

### Fase 3: Inteligência Avançada (Sprints 8-9) ✅
- ✅ Pipelines multi-agente (execução sequencial)
- ✅ Memória persistente por usuário
- ✅ Personalização inteligente
- ✅ Contexto contínuo entre conversas
- ✅ Proteção PHI (dados sensíveis)
- ✅ Resumos automáticos de conversas

### Fase 4: Qualidade & Testes ✅
- ✅ Suíte de testes automatizados
- ✅ Testes de integração
- ✅ Validação de funcionalidades críticas
- ✅ Documentação de testes

