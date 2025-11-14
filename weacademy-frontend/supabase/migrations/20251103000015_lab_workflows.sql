-- Workflows End-to-End: estruturas básicas

CREATE TABLE IF NOT EXISTS public.lab_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lab_workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.lab_workflows(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workflow_id, version_label)
);

CREATE TABLE IF NOT EXISTS public.lab_workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id UUID NOT NULL REFERENCES public.lab_workflow_versions(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  type TEXT NOT NULL, -- agent, pipeline, human, delay, webhook
  name TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  entry_conditions JSONB DEFAULT '[]'::jsonb,
  exit_actions JSONB DEFAULT '[]'::jsonb,
  order_hint INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workflow_version_id, stage_key)
);

CREATE TABLE IF NOT EXISTS public.lab_workflow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id UUID NOT NULL REFERENCES public.lab_workflow_versions(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES public.lab_workflow_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES public.lab_workflow_stages(id) ON DELETE CASCADE,
  condition JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lab_workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id UUID NOT NULL REFERENCES public.lab_workflow_versions(id) ON DELETE RESTRICT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',
  context JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_stage_id UUID REFERENCES public.lab_workflow_stages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lab_workflow_stage_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES public.lab_workflow_instances(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.lab_workflow_stages(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, waiting_human, completed, failed, cancelled
  attempt INTEGER NOT NULL DEFAULT 1,
  input_snapshot JSONB DEFAULT '{}'::jsonb,
  output_snapshot JSONB DEFAULT '{}'::jsonb,
  error_info JSONB,
  resume_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lab_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES public.lab_workflow_instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.lab_workflow_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.lab_workflow_stages(id) ON DELETE CASCADE,
  assignee_type TEXT NOT NULL, -- user, role, group
  assignee_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lab_workflow_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES public.lab_workflow_instances(id) ON DELETE CASCADE,
  stage_run_id UUID REFERENCES public.lab_workflow_stage_runs(id) ON DELETE SET NULL,
  channel TEXT NOT NULL, -- email, sms, whatsapp, webhook
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_lab_workflow_versions_active
  ON public.lab_workflow_versions(workflow_id, is_active);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_stages_version
  ON public.lab_workflow_stages(workflow_version_id);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_edges_graph
  ON public.lab_workflow_edges(workflow_version_id, from_stage_id);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_instances_status
  ON public.lab_workflow_instances(status, workflow_version_id);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_stage_runs_instance
  ON public.lab_workflow_stage_runs(workflow_instance_id, stage_id, status);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_events_instance
  ON public.lab_workflow_events(workflow_instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_notifications_status
  ON public.lab_workflow_notifications(status, scheduled_for);

-- Atualização automática de updated_at
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lab_workflows_updated_at
  BEFORE UPDATE ON public.lab_workflows
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

ALTER TABLE public.lab_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_workflow_stage_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_workflow_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_workflow_notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.lab_workflows IS 'Workflows de alto nível (recepção→follow-up, etc.)';
COMMENT ON TABLE public.lab_workflow_versions IS 'Versões versionadas de workflow (v1.0.0 etc)';
COMMENT ON TABLE public.lab_workflow_instances IS 'Execuções individuais de workflows end-to-end';
COMMENT ON TABLE public.lab_workflow_stage_runs IS 'Execuções por etapa com snapshots e status';

