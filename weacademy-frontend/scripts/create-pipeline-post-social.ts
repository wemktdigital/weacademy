/**
 * Script para criar o pipeline "Criação Completa de Post Social"
 * 
 * Uso:
 * 1. Certifique-se de que os agentes foram criados a partir dos templates
 * 2. Execute: npx ts-node scripts/create-pipeline-post-social.ts
 * 
 * Ou importe este script no projeto e execute via API
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function createPipelinePostSocial() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Nomes dos agentes necessários
  const agentNames = [
    'Criador de Postagens Sociais Médicas',
    'Auditor de Compliance Médico',
    'Especialista em SEO Médico', // Opcional
  ]

  console.log('🔍 Buscando agentes...')

  // Buscar IDs dos agentes
  const agentIds: Record<string, string | null> = {}
  
  for (const agentName of agentNames) {
    const { data, error } = await supabase
      .from('lab_agents')
      .select('id, name')
      .eq('name', agentName)
      .eq('active', true)
      .single()

    if (error || !data) {
      console.warn(`⚠️  Agente "${agentName}" não encontrado`)
      agentIds[agentName] = null
    } else {
      console.log(`✅ Agente "${agentName}" encontrado: ${data.id}`)
      agentIds[agentName] = data.id
    }
  }

  // Verificar agentes obrigatórios
  if (!agentIds['Criador de Postagens Sociais Médicas']) {
    console.error('❌ Erro: Agente "Criador de Postagens Sociais Médicas" é obrigatório!')
    return
  }

  if (!agentIds['Auditor de Compliance Médico']) {
    console.error('❌ Erro: Agente "Auditor de Compliance Médico" é obrigatório!')
    return
  }

  // Verificar se pipeline já existe
  const { data: existingPipeline } = await supabase
    .from('lab_agent_pipelines')
    .select('id, name')
    .eq('name', 'Criação Completa de Post Social')
    .single()

  if (existingPipeline) {
    console.warn(`⚠️  Pipeline "Criação Completa de Post Social" já existe (ID: ${existingPipeline.id})`)
    return
  }

  // Construir steps
  const steps = [
    {
      order: 1,
      agent_id: agentIds['Criador de Postagens Sociais Médicas']!,
    },
    {
      order: 2,
      agent_id: agentIds['Auditor de Compliance Médico']!,
    },
  ]

  // Adicionar SEO se disponível
  if (agentIds['Especialista em SEO Médico']) {
    steps.push({
      order: 3,
      agent_id: agentIds['Especialista em SEO Médico']!,
    })
  }

  // Criar pipeline
  const pipelineData = {
    name: 'Criação Completa de Post Social',
    description: agentIds['Especialista em SEO Médico']
      ? 'Cria post para redes sociais, valida compliance com ANVISA/CFM e otimiza para SEO. Pipeline completo e seguro para publicar.'
      : 'Cria post para redes sociais e valida compliance com ANVISA/CFM. Pipeline seguro para publicar.',
    steps,
    active: true,
  }

  const { data: pipeline, error } = await supabase
    .from('lab_agent_pipelines')
    .insert(pipelineData)
    .select()
    .single()

  if (error) {
    console.error('❌ Erro ao criar pipeline:', error)
    return
  }

  console.log('✅ Pipeline criado com sucesso!')
  console.log(`📋 ID: ${pipeline.id}`)
  console.log(`📋 Nome: ${pipeline.name}`)
  console.log(`📋 Etapas: ${steps.length}`)
  console.log(`\n🚀 Pipeline pronto para uso em /ai-lab!`)
}

// Executar se chamado diretamente
if (require.main === module) {
  createPipelinePostSocial().catch(console.error)
}

export default createPipelinePostSocial

