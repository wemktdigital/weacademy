CREATE TABLE IF NOT EXISTS public.lab_workflow_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  canvas JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  published_workflow_version_id UUID REFERENCES public.lab_workflow_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_blueprints_owner
  ON public.lab_workflow_blueprints(owner_user_id);

CREATE OR REPLACE FUNCTION update_lab_workflow_blueprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lab_workflow_blueprints_updated
  BEFORE UPDATE ON public.lab_workflow_blueprints
  FOR EACH ROW EXECUTE FUNCTION update_lab_workflow_blueprints_updated_at();

ALTER TABLE public.lab_workflow_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their blueprints"
  ON public.lab_workflow_blueprints
  FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

COMMENT ON TABLE public.lab_workflow_blueprints IS 'Blueprints visuais de workflows, armazenando nós e conexões do editor React Flow.';

