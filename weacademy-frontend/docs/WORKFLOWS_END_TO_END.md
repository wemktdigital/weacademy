# 🧩 Workflows End-to-End — Arquitetura e Persistência

Documentação inicial da Fase **Workflows End-to-End Médicos**, cobrindo persistência, recuperação de falhas e estado compartilhado.

## 1. Escopo dos Workflows

### 1.1 Fluxo Clínico Completo (Recepção → Triagem → Agendamento → Consulta → Follow-up)
- Etapas podem durar dias; cada etapa precisa ser retomável.
- Suporte a aprovações manuais (ex.: enfermeiro confirma triagem).
- Reagendamentos devem reabrir etapas subsequentes.
- Notificações multi-canal (email/SMS/whatsapp) configuráveis por etapa.

### 1.2 Workflow de Conteúdo (Criação → Aprovação → Publicação → Métricas)
- Aprovação multi-step (compliance + marketing).
- Loop de revisão (volta para criação com comentários).
- captura automática de métricas (engajamento) para etapa de “aprendizado”.

### 1.3 Análise de Exames (Recepção de exame → Interpretação → Relatório → Notificação)
- Dados sensíveis (PHI) criptografados em repouso.
- Templates médicos por especialidade.
- Logs com assinatura digital.

## 2. Requisitos Técnicos

| Requisito | Descrição |
|-----------|-----------|
| Persistência | Contexto por **workflow_instance** com versionamento e audit trail |
| Checkpoints | Cada etapa gera snapshot de entrada/saída + estado de execuções intermediárias |
| Retry/Resume | Reprocessamento seletivo por etapa (com backoff configurável) |
| Human-in-the-loop | Etapas aguardam input manual (aprovado/reprovado/comentários) |
| Observabilidade | Timeline visual, logs por etapa, status atual, custo acumulado |
| API | Criar/pausar/resumir/cancelar, listar instâncias, consultar histórico |

## 3. Modelo de Dados Proposto

```mermaid
erDiagram
    lab_workflows ||--o{ lab_workflow_versions : has
    lab_workflow_versions ||--o{ lab_workflow_stages : has
    lab_workflow_versions ||--o{ lab_workflow_edges : transitions
    lab_workflow_versions ||--o{ lab_workflow_variables : exposes
    lab_workflow_instances ||--o{ lab_workflow_stage_runs : contains
    lab_workflow_instances ||--o{ lab_workflow_events : logs
    auth_users ||--o{ lab_workflow_blueprints : owns

    lab_workflows {
      uuid id PK
      text name
      text description
      jsonb metadata
      timestamptz created_at
    }
    lab_workflow_versions {
      uuid id PK
      uuid workflow_id FK
      text version_label  -- ex: v1.0.0
      boolean is_active
      jsonb settings
      timestamptz created_at
    }
    lab_workflow_stages {
      uuid id PK
      uuid workflow_version_id FK
      text stage_key -- "triage", "consulta"
      text type -- "agent", "human", "delay", "webhook"
      jsonb config
      jsonb entry_conditions
      jsonb exit_actions
      integer order_hint
    }
    lab_workflow_edges {
      uuid id PK
      uuid workflow_version_id FK
      uuid from_stage_id FK
      uuid to_stage_id FK
      jsonb condition -- regras para seguir (branch)
    }
    lab_workflow_instances {
      uuid id PK
      uuid workflow_version_id FK
      uuid owner_user_id FK
      text status -- running, paused, completed, failed, cancelled
      jsonb context  -- estado global
      jsonb metadata -- ex: dados do paciente
      timestamptz started_at
      timestamptz completed_at
    }
    lab_workflow_stage_runs {
      uuid id PK
      uuid workflow_instance_id FK
      uuid stage_id FK
      text status -- pending, running, waiting_human, completed, failed
      integer attempt
      jsonb input_snapshot
      jsonb output_snapshot
      jsonb error_info
      timestamptz started_at
      timestamptz finished_at
    }
    lab_workflow_events {
      uuid id PK
      uuid workflow_instance_id FK
      text event_type -- stage_started, stage_completed, human_input, retry_scheduled
      jsonb payload
      timestamptz created_at
      uuid created_by
    }
    lab_workflow_blueprints {
      uuid id PK
      uuid owner_user_id FK
      text name
      text description
      text category
      text[] tags
      jsonb canvas -- nós e edges do editor visual
      jsonb settings
      uuid published_workflow_version_id FK
      timestamptz created_at
      timestamptz updated_at
    }
```

### Tabelas auxiliares
- `lab_workflow_assignments`: relaciona usuários/grupos às etapas humanas (quem pode aprovar).
- `lab_workflow_notifications`: fila de notificações pendentes/enviadas por etapa.

## 4. Engine de Execução

### 4.1 Camadas
1. **Workflow Orchestrator**: estado global, scheduler, fila de jobs.
2. **Stage Runner**: executa etapa (agent, pipeline, webhook, humana).
3. **Checkpoint Manager**: salva snapshots (entrada/saída), gera tokens de retomada.
4. **Event Bus**: publica eventos (`stage.waiting_human`, `workflow.completed`).

### 4.2 Fluxo (exemplo)
1. Orchestrator cria `workflow_instance` com contexto inicial.
2. Stage Runner executa primeira etapa (`recepção`).
3. Outputs são mesclados no `context` global seguindo regras (ex: `context.patient = output.patient`).
4. Se etapa requer aprovação, status passa para `waiting_human` e evento é disparado.
5. Ao receber input humano, Stage Runner continua (novo attempt).
6. Em caso de falha, `attempt` incrementa e `retry_policy` decide próxima ação.

### 4.3 Retry & Resume
- Inspector pode visualizar último estado e optar por “repetir etapa” ou “continuar manualmente”.
- `resume_token` com combinação (`workflow_instance_id`, `stage_id`, `attempt`).
- Estratégia de `retry_policy` definida em `lab_workflow_stages.config.retry` (ex.: max 3 tentativas, backoff exponencial).

## 5. Checkpoints & Persistência de Contexto

- `context` global armazenado como jsonb (estrutura definida por schema Zod para validação).
- Cada `stage_run` salva snapshots de entrada/saída para auditoria e reprocessamento.
- Para dados sensíveis (exames), utilizar colunas criptografadas (pgcrypto) + mascaramento na UI.
- Suporte a anexos via Supabase Storage (`lab-workflows-files/{workflow_instance_id}/{stage_id}/...`).

## 6. Recuperação de Falhas

| Tipo | Estratégia |
|------|------------|
| Falha técnica (timeout, rate-limit) | Retry automático com backoff + fallback (opcional).
| Falha lógica (validação) | Marcar etapa como `failed`, exigir intervenção humana.
| Workflow interrompido | Orchestrator reprocessa fila no boot (baseado em `status = running`).
| Node inválido em versão atual | Política de migração (lock version + instrução de atualização).

## 7. Auditoria e Segurança
- Toda mudança de estado gera registro em `lab_workflow_events` com usuário responsável.
- Etapas com dados sensíveis exigem permissão explícita (RLS por role).
- Export de logs completo via endpoint `/api/lab-ia/workflows/{id}/events` (admin).
- Suporte a assinaturas digitais em relatórios (hash + timestamp).

## 8. Interfaces Planejadas

### 8.1 UI de Execução (Operacional)
- Timeline do workflow com status por etapa.
- Botões de ação: pausar, retomar, cancelar, reprocessar etapa.
- Visualização de contexto global (read-only com mascaramento quando necessário).

### 8.2 UI de Designer (Admin)
- Editor visual (React Flow) com pools/swimlanes para fases.
- Configurações por etapa (tipo, agentes/pipelines, notificações, formulários).
- Salvamento como blueprint (draft) antes de publicar versão.
- Testes sandbox com contexto fake antes da publicação.

### 8.3 API
- `POST /api/lab-ia/workflows/run` — inicia execução.
- `POST /api/lab-ia/workflows/{instanceId}/actions` — resumir, cancelar, aprovar.
- `GET /api/lab-ia/workflows/{instanceId}` — status atual + histórico.

## 9. Próximos Passos
1. Criar migrações para as tabelas base (workflows, versions, stages, edges, instances, stage_runs, events).
2. Implementar serviço `workflowOrchestrator.ts` com fila (ex.: BullMQ) + cron.
3. Adaptar `pipelineRunner` para ser reusado como `Stage Runner` (execução de agentes e pipelines existentes).
4. Implementar etapa humana (UI + API) com notificações.
5. Criar dashboard de observabilidade (execuções em andamento, gargalos, custo por workflow).

---

> **Notas**
> - Guardar este documento como referência viva; atualizar conforme decisões técnicas.
> - Alinhar com equipe médica/compliance antes de habilitar fluxos em produção.

