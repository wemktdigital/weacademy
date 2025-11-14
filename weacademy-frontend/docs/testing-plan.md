# Plano de Testes Automatizados

## Cobertura Atual

- **Unitários (Vitest)**
  - `pipelineRunner` (execução condicional, fallback, supervisão)
  - `workflowStageRunner`
  - `workflowOrchestrator`
  - `workflowScheduler`
  - `humanTaskService`
  - `workflowInstances` stores (lab-ia, agents, memory, templates)

- **Integração (Vitest)**
  - `/api/lab-ia/workflows/human-tasks` (listar, detalhe, PATCH)
  - `/api/lab-ia/workflows/human-tasks/<id>`
  - `/api/lab-ia/workflows/human-tasks` (listagem)
  - `/api/lab-ia/workflows/stage/[stageRunId]/resume`
  - `/api/lab-ia/admin/workflows/triggers` (GET/POST)
  - `/api/lab-ia/admin/workflows/triggers/run`
  - `/api/lab-ia/workflows/instances` e `/instances/<instanceId>`
  - `/api/lab-ia/pipelines/run` (SSE)
  - `/api/lab-ia/admin/pipelines/[id]/test` (SSE)

## Próximos Alvos

- **Integração adicional**
  - APIs restantes de workflows (versões, blueprints, eventos específicos)
  - Rotas de agentes/knowledge bases que ainda não tenham cobertura
  - Cenários negativos extras (supabase retornando erro, SSE interrompido)

- **E2E / UI (Playwright)**
  - Testes smoke do fluxo de execução de pipeline
  - Designer de workflows (criar draft, publicar)
  - Painéis de triggers e instâncias

- **Infra de testes**
  - Helpers adicionais (mocks de Supabase service role, SSE)
  - Pipeline de CI com `vitest --coverage` e relatório lcov
  - Configuração Playwright no CI

- **Observabilidade**
  - Testes end-to-end validando logs/custos (quando aplicável)
