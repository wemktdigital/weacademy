-- Loop & Iteration support for workflows

ALTER TABLE lab_workflow_stages
ADD COLUMN IF NOT EXISTS loop_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN lab_workflow_stages.loop_config IS 'Configuração de loops/iterações para a etapa (batch, until, retry variations, parallel)';


