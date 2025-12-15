-- Stores snapshots/diffs for workflow versions to enable comparisons and rollback

CREATE TABLE IF NOT EXISTS public.lab_workflow_versions_diff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.lab_workflows(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.lab_workflow_versions(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  diff JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_versions_diff_workflow
  ON public.lab_workflow_versions_diff(workflow_id, generated_at DESC);

ALTER TABLE public.lab_workflow_versions_diff ENABLE ROW LEVEL SECURITY;


