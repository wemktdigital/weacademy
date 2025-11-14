-- Observabilidade & Métricas de Workflows

-- 1) Campos de métricas agregadas por instância
ALTER TABLE public.lab_workflow_instances
  ADD COLUMN IF NOT EXISTS total_latency_ms BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(18,6) DEFAULT 0;

-- 2) Campos de métricas por execução de etapa
ALTER TABLE public.lab_workflow_stage_runs
  ADD COLUMN IF NOT EXISTS latency_ms BIGINT,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER;

-- 3) Views de métricas agregadas (diárias)
DROP VIEW IF EXISTS public.lab_workflow_metrics_daily;
CREATE VIEW public.lab_workflow_metrics_daily AS
SELECT
  DATE_TRUNC('day', COALESCE(i.completed_at, i.started_at)) AS metric_date,
  i.workflow_version_id,
  v.workflow_id,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE i.status = 'completed') AS completed_runs,
  COUNT(*) FILTER (WHERE i.status = 'failed') AS failed_runs,
  COUNT(*) FILTER (WHERE i.status = 'cancelled') AS cancelled_runs,
  AVG(NULLIF(i.total_latency_ms, 0)) AS avg_latency_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY NULLIF(i.total_latency_ms, 0)) AS p50_latency_ms,
  MAX(i.total_latency_ms) AS max_latency_ms,
  AVG(NULLIF(i.total_cost_usd, 0)) AS avg_cost_usd,
  SUM(i.total_cost_usd) AS total_cost_usd,
  MIN(i.started_at) AS first_run_at,
  MAX(i.completed_at) AS last_run_at
FROM public.lab_workflow_instances i
JOIN public.lab_workflow_versions v ON v.id = i.workflow_version_id
GROUP BY 1, 2, 3;

DROP VIEW IF EXISTS public.lab_workflow_stage_metrics_daily;
CREATE VIEW public.lab_workflow_stage_metrics_daily AS
SELECT
  DATE_TRUNC('day', COALESCE(r.finished_at, r.started_at)) AS metric_date,
  r.workflow_instance_id,
  r.stage_id,
  s.workflow_version_id,
  COUNT(*) AS executions,
  COUNT(*) FILTER (WHERE r.status = 'completed') AS completed_executions,
  COUNT(*) FILTER (WHERE r.status = 'failed') AS failed_executions,
  AVG(NULLIF(r.latency_ms, 0)) AS avg_latency_ms,
  MAX(r.latency_ms) AS max_latency_ms,
  SUM(COALESCE(r.cost_usd, 0)) AS total_cost_usd
FROM public.lab_workflow_stage_runs r
JOIN public.lab_workflow_stages s ON s.id = r.stage_id
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW public.lab_workflow_metrics_daily IS 'Métricas agregadas por dia/versão de workflow (runs, custos, latência)';
COMMENT ON VIEW public.lab_workflow_stage_metrics_daily IS 'Métricas agregadas por dia/etapa (execuções, custos, latência)';

