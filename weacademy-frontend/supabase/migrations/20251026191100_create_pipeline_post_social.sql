-- Criar Pipeline: Criação Completa de Post Social
-- Este pipeline busca os agentes pelos nomes e cria o pipeline automaticamente
-- IMPORTANTE: Execute este script APÓS criar os agentes a partir dos templates

DO $$
DECLARE
  v_agente_criador_postagens UUID;
  v_agente_auditor_compliance UUID;
  v_agente_seo_medico UUID;
  v_pipeline_id UUID;
BEGIN
  -- Buscar IDs dos agentes pelos nomes
  SELECT id INTO v_agente_criador_postagens
  FROM lab_agents
  WHERE name = 'Criador de Postagens Sociais Médicas'
  AND active = true
  LIMIT 1;

  SELECT id INTO v_agente_auditor_compliance
  FROM lab_agents
  WHERE name = 'Auditor de Compliance Médico'
  AND active = true
  LIMIT 1;

  SELECT id INTO v_agente_seo_medico
  FROM lab_agents
  WHERE name = 'Especialista em SEO Médico'
  AND active = true
  LIMIT 1;

  -- Verificar se todos os agentes foram encontrados
  IF v_agente_criador_postagens IS NULL THEN
    RAISE NOTICE '❌ Agente "Criador de Postagens Sociais Médicas" não encontrado. Crie o agente primeiro a partir do template.';
    RETURN;
  END IF;

  IF v_agente_auditor_compliance IS NULL THEN
    RAISE NOTICE '❌ Agente "Auditor de Compliance Médico" não encontrado. Crie o agente primeiro a partir do template.';
    RETURN;
  END IF;

  -- Verificar se o pipeline já existe
  SELECT id INTO v_pipeline_id
  FROM lab_agent_pipelines
  WHERE name = 'Criação Completa de Post Social';

  IF v_pipeline_id IS NOT NULL THEN
    RAISE NOTICE '⚠️ Pipeline "Criação Completa de Post Social" já existe (ID: %)', v_pipeline_id;
    RETURN;
  END IF;

  -- Criar pipeline com 2 etapas (Criador + Auditor)
  -- A etapa de SEO é opcional
  IF v_agente_seo_medico IS NOT NULL THEN
    -- Pipeline com 3 etapas (incluindo SEO)
    INSERT INTO lab_agent_pipelines (name, description, steps, active)
    VALUES (
      'Criação Completa de Post Social',
      'Cria post para redes sociais, valida compliance com ANVISA/CFM e otimiza para SEO. Pipeline completo e seguro para publicar.',
      jsonb_build_array(
        jsonb_build_object('order', 1, 'agent_id', v_agente_criador_postagens),
        jsonb_build_object('order', 2, 'agent_id', v_agente_auditor_compliance),
        jsonb_build_object('order', 3, 'agent_id', v_agente_seo_medico)
      ),
      true
    );
    RAISE NOTICE '✅ Pipeline criado com sucesso com 3 etapas (incluindo SEO)!';
  ELSE
    -- Pipeline com 2 etapas (sem SEO)
    INSERT INTO lab_agent_pipelines (name, description, steps, active)
    VALUES (
      'Criação Completa de Post Social',
      'Cria post para redes sociais e valida compliance com ANVISA/CFM. Pipeline seguro para publicar.',
      jsonb_build_array(
        jsonb_build_object('order', 1, 'agent_id', v_agente_criador_postagens),
        jsonb_build_object('order', 2, 'agent_id', v_agente_auditor_compliance)
      ),
      true
    );
    RAISE NOTICE '✅ Pipeline criado com sucesso com 2 etapas (sem SEO).';
    RAISE NOTICE '💡 Dica: Crie o agente "Especialista em SEO Médico" e edite o pipeline para adicioná-lo.';
  END IF;

  RAISE NOTICE '📋 Pipeline "Criação Completa de Post Social" criado e ativado!';
  
END $$;

