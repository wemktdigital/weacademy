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

**Status:** ✅ 85% Completo

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
- ⏳ Upload automático de PDFs para Supabase Storage.
- ⏳ Filtros por data no dashboard.

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

## 🔐 Sprint 6 – Produção, escalabilidade e IA Extendida

**Objetivo:** Preparar para produção real, otimizar custos, segurança, experiência mobile, e planejar evolução.

**Entregáveis:**
- Deploy automatizado (CI/CD) com verificação de build e testes.
- Caching de respostas repetidas para economizar tokens.
- Integração mobile (PWA ou app React Native / Expo).
- Sessões persistentes, segurança (rate-limite, IP ban, verificação de conteúdo via moderação).
- Roadmap técnico para evoluções futuras: suporte aos Llama-families on-premise, RAG (retrieval augmented generation) com base de conhecimento médico, upload de documentos e interação multimodal.
- Documentação de uso interno + onboarding para médicos usuários.

---

## 📆 Cronograma Sugerido

| Sprint     | Duração      | Período estimado |
| :--------- | :----------- | :--------------- |
| Sprint 1   | 2 semanas    | Semana 1-2       |
| Sprint 2   | 2 semanas    | Semana 3-4       |
| Sprint 3   | 1 ½ semana   | Semana 5         |
| Sprint 4   | 2 semanas    | Semana 6-7       |
| Sprint 5   | 1 ½ semana   | Semana 8         |
| Sprint 6   | 2 semanas    | Semana 9-10      |

**Total:** ~10 semanas

---

## 🎯 Objetivos Finais

- Interface moderna tipo ChatGPT
- Suporte a múltiplos LLMs (OpenAI, Google, Grok, etc)
- Agentes especializados para tarefas médicas e marketing
- Monitoramento de custos e uso
- Deploy em produção escalável
- Experiência mobile otimizada

