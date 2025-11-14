-- Human workflow tasks & approvals

BEGIN;

-- Extend stage runs with human-centric columns
ALTER TABLE public.lab_workflow_stage_runs
  ADD COLUMN IF NOT EXISTS human_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_role TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decision TEXT,
  ADD COLUMN IF NOT EXISTS decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.lab_workflow_human_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES public.lab_workflow_instances(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.lab_workflow_stages(id) ON DELETE CASCADE,
  stage_run_id UUID UNIQUE NOT NULL REFERENCES public.lab_workflow_stage_runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, approved, rejected, cancelled, escalated
  assignment JSONB DEFAULT '{}'::jsonb,
  assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_role TEXT,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision TEXT,
  decision_reason TEXT,
  sla_seconds INTEGER,
  reminder_strategy JSONB DEFAULT '{}'::jsonb,
  escalation_config JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_human_tasks_status
  ON public.lab_workflow_human_tasks(status, due_at);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_human_tasks_assignee
  ON public.lab_workflow_human_tasks(assignee_user_id, status);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_human_tasks_instance
  ON public.lab_workflow_human_tasks(workflow_instance_id);

CREATE TABLE IF NOT EXISTS public.lab_workflow_human_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  human_task_id UUID NOT NULL REFERENCES public.lab_workflow_human_tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_human_task_logs_task
  ON public.lab_workflow_human_task_logs(human_task_id, created_at);

CREATE OR REPLACE FUNCTION public.update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lab_workflow_human_tasks_updated_at ON public.lab_workflow_human_tasks;
CREATE TRIGGER update_lab_workflow_human_tasks_updated_at
  BEFORE UPDATE ON public.lab_workflow_human_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp_column();

COMMENT ON TABLE public.lab_workflow_human_tasks IS 'Tarefas human-in-the-loop associadas a etapas de workflow';
COMMENT ON TABLE public.lab_workflow_human_task_logs IS 'Histórico/Auditoria de ações em tarefas humanas';

COMMIT;

