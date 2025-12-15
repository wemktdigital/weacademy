-- Collaborative agent teams for workflows

BEGIN;

CREATE TABLE IF NOT EXISTS public.lab_workflow_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id UUID NOT NULL REFERENCES public.lab_workflow_versions(id) ON DELETE CASCADE,
  team_key TEXT NOT NULL,
  name TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'round_robin',
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_workflow_teams_version_key
  ON public.lab_workflow_teams(workflow_version_id, team_key);

CREATE TABLE IF NOT EXISTS public.lab_workflow_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.lab_workflow_teams(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.lab_agents(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'executor',
  weight NUMERIC DEFAULT 1.0,
  responsibilities TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_team_members_team
  ON public.lab_workflow_team_members(team_id);

COMMENT ON TABLE public.lab_workflow_teams IS 'Times colaborativos de agentes configurados para cada versão de workflow';
COMMENT ON TABLE public.lab_workflow_team_members IS 'Membros de times colaborativos (agentes, papéis, pesos)';

COMMIT;

