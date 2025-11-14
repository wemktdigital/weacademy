-- Criar Agentes e Pipeline: Criação Completa de Post Social
-- Este script:
-- 1. Busca os templates pelos nomes
-- 2. Cria os agentes a partir dos templates (se ainda não existirem)
-- 3. Cria o pipeline usando os IDs dos agentes

DO $$
DECLARE
  -- Template IDs
  v_template_criador_postagens UUID;
  v_template_auditor_compliance UUID;
  v_template_seo_medico UUID;
  
  -- Agent IDs
  v_agente_criador_postagens UUID;
  v_agente_auditor_compliance UUID;
  v_agente_seo_medico UUID;
  
  -- Pipeline
  v_pipeline_id UUID;
  v_template_data RECORD;
BEGIN
  RAISE NOTICE '🚀 Iniciando criação de agentes e pipeline...';
  
  -- ============================================
  -- PASSO 1: Buscar Templates
  -- ============================================
  RAISE NOTICE '📚 Buscando templates...';
  
  SELECT id INTO v_template_criador_postagens
  FROM lab_agent_templates
  WHERE name = 'Criador de Postagens Sociais Médicas'
  LIMIT 1;

  SELECT id INTO v_template_auditor_compliance
  FROM lab_agent_templates
  WHERE name = 'Auditor de Compliance Médico'
  LIMIT 1;

  SELECT id INTO v_template_seo_medico
  FROM lab_agent_templates
  WHERE name = 'Especialista em SEO Médico'
  LIMIT 1;

  -- Verificar se templates foram encontrados
  IF v_template_criador_postagens IS NULL THEN
    RAISE EXCEPTION '❌ Template "Criador de Postagens Sociais Médicas" não encontrado. Importe os templates primeiro!';
  END IF;

  IF v_template_auditor_compliance IS NULL THEN
    RAISE EXCEPTION '❌ Template "Auditor de Compliance Médico" não encontrado. Importe os templates primeiro!';
  END IF;

  IF v_template_seo_medico IS NULL THEN
    RAISE WARNING '⚠️  Template "Especialista em SEO Médico" não encontrado. Pipeline será criado sem SEO.';
  END IF;

  RAISE NOTICE '✅ Templates encontrados!';

  -- ============================================
  -- PASSO 2: Criar Agentes a partir dos Templates
  -- ============================================
  RAISE NOTICE '🤖 Criando agentes a partir dos templates...';

  -- Criar agente: Criador de Postagens Sociais Médicas
  -- Verificar se já existe
  SELECT id INTO v_agente_criador_postagens
  FROM lab_agents
  WHERE name = 'Criador de Postagens Sociais Médicas'
  AND active = true
  LIMIT 1;

  IF v_agente_criador_postagens IS NULL THEN
    -- Buscar dados do template
    SELECT * INTO v_template_data
    FROM lab_agent_templates
    WHERE id = v_template_criador_postagens;

    -- Criar agente a partir do template
    INSERT INTO lab_agents (
      name,
      description,
      icon,
      category,
      provider,
      model,
      prompt,
      type,
      active
    )
    VALUES (
      v_template_data.name,
      v_template_data.description,
      v_template_data.icon,
      v_template_data.category,
      v_template_data.provider,
      v_template_data.model,
      v_template_data.prompt,
      v_template_data.type,
      true
    )
    RETURNING id INTO v_agente_criador_postagens;

    RAISE NOTICE '✅ Agente "Criador de Postagens Sociais Médicas" criado: %', v_agente_criador_postagens;
  ELSE
    RAISE NOTICE 'ℹ️  Agente "Criador de Postagens Sociais Médicas" já existe: %', v_agente_criador_postagens;
  END IF;

  -- Criar agente: Auditor de Compliance Médico
  SELECT id INTO v_agente_auditor_compliance
  FROM lab_agents
  WHERE name = 'Auditor de Compliance Médico'
  AND active = true
  LIMIT 1;

  IF v_agente_auditor_compliance IS NULL THEN
    SELECT * INTO v_template_data
    FROM lab_agent_templates
    WHERE id = v_template_auditor_compliance;

    INSERT INTO lab_agents (
      name,
      description,
      icon,
      category,
      provider,
      model,
      prompt,
      type,
      active
    )
    VALUES (
      v_template_data.name,
      v_template_data.description,
      v_template_data.icon,
      v_template_data.category,
      v_template_data.provider,
      v_template_data.model,
      v_template_data.prompt,
      v_template_data.type,
      true
    )
    RETURNING id INTO v_agente_auditor_compliance;

    RAISE NOTICE '✅ Agente "Auditor de Compliance Médico" criado: %', v_agente_auditor_compliance;
  ELSE
    RAISE NOTICE 'ℹ️  Agente "Auditor de Compliance Médico" já existe: %', v_agente_auditor_compliance;
  END IF;

  -- Criar agente: Especialista em SEO Médico (opcional)
  IF v_template_seo_medico IS NOT NULL THEN
    SELECT id INTO v_agente_seo_medico
    FROM lab_agents
    WHERE name = 'Especialista em SEO Médico'
    AND active = true
    LIMIT 1;

    IF v_agente_seo_medico IS NULL THEN
      SELECT * INTO v_template_data
      FROM lab_agent_templates
      WHERE id = v_template_seo_medico;

      INSERT INTO lab_agents (
        name,
        description,
        icon,
        category,
        provider,
        model,
        prompt,
        type,
        active
      )
      VALUES (
        v_template_data.name,
        v_template_data.description,
        v_template_data.icon,
        v_template_data.category,
        v_template_data.provider,
        v_template_data.model,
        v_template_data.prompt,
        v_template_data.type,
        true
      )
      RETURNING id INTO v_agente_seo_medico;

      RAISE NOTICE '✅ Agente "Especialista em SEO Médico" criado: %', v_agente_seo_medico;
    ELSE
      RAISE NOTICE 'ℹ️  Agente "Especialista em SEO Médico" já existe: %', v_agente_seo_medico;
    END IF;
  END IF;

  -- ============================================
  -- PASSO 3: Criar Pipeline
  -- ============================================
  RAISE NOTICE '🔗 Criando pipeline...';

  -- Verificar se pipeline já existe
  SELECT id INTO v_pipeline_id
  FROM lab_agent_pipelines
  WHERE name = 'Criação Completa de Post Social';

  IF v_pipeline_id IS NOT NULL THEN
    RAISE WARNING '⚠️  Pipeline "Criação Completa de Post Social" já existe (ID: %). Pulando criação.', v_pipeline_id;
    RETURN;
  END IF;

  -- Criar pipeline com as etapas
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
    )
    RETURNING id INTO v_pipeline_id;

    RAISE NOTICE '✅ Pipeline criado com 3 etapas (incluindo SEO): %', v_pipeline_id;
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
    )
    RETURNING id INTO v_pipeline_id;

    RAISE NOTICE '✅ Pipeline criado com 2 etapas (sem SEO): %', v_pipeline_id;
    RAISE NOTICE '💡 Dica: Crie o agente "Especialista em SEO Médico" e edite o pipeline para adicioná-lo.';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🎉 Concluído com sucesso!';
  RAISE NOTICE '📋 Agentes criados:';
  RAISE NOTICE '   - Criador de Postagens Sociais Médicas: %', v_agente_criador_postagens;
  RAISE NOTICE '   - Auditor de Compliance Médico: %', v_agente_auditor_compliance;
  IF v_agente_seo_medico IS NOT NULL THEN
    RAISE NOTICE '   - Especialista em SEO Médico: %', v_agente_seo_medico;
  END IF;
  RAISE NOTICE '📋 Pipeline criado: %', v_pipeline_id;
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Pipeline pronto para uso em /ai-lab!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '❌ Erro: %', SQLERRM;
END $$;

