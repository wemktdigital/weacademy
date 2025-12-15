/**
 * Script para criar agentes automaticamente a partir de todos os templates
 * Uso: npx tsx scripts/criar-agentes-de-templates.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function criarAgentesDeTemplates() {
  try {
    console.log('🚀 Iniciando criação de agentes a partir de templates...')
    console.log(`📡 Conectando em: ${supabaseUrl}`)
    
    // Criar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'public',
      },
    })
    
    // Buscar todos os templates
    console.log('\n📚 Buscando templates...')
    const { data: templates, error: templatesError } = await supabase
      .from('lab_agent_templates')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (templatesError) {
      throw templatesError
    }
    
    if (!templates || templates.length === 0) {
      console.log('⚠️  Nenhum template encontrado')
      return
    }
    
    console.log(`✅ Encontrados ${templates.length} templates\n`)
    
    // Buscar agentes existentes para evitar duplicatas
    const { data: existingAgents } = await supabase
      .from('lab_agents')
      .select('name')
    
    const existingNames = new Set(existingAgents?.map(a => a.name.toLowerCase()) || [])
    
    // Criar agentes
    const results = []
    let successCount = 0
    let skippedCount = 0
    let errorCount = 0
    
    for (const template of templates) {
      try {
        // Verificar se já existe um agente com mesmo nome
        const templateNameLower = template.name.toLowerCase()
        if (existingNames.has(templateNameLower)) {
          console.log(`⏭️  Pulando "${template.name}" - agente já existe`)
          results.push({
            name: template.name,
            success: false,
            skipped: true,
            reason: 'Agente já existe',
          })
          skippedCount++
          continue
        }
        
        // Preparar dados do agente (apenas campos que existem na tabela lab_agents)
        const agentData: any = {
          name: template.name,
          description: template.description || '',
          icon: template.icon || '📋',
          type: template.type || 'llm',
          provider: template.provider || 'openai',
          model: template.model || 'gpt-4o-mini',
          prompt: template.prompt,
          category: template.category || '',
          active: true,
        }
        
        // Remover campos undefined/null
        Object.keys(agentData).forEach(key => {
          if (agentData[key] === undefined || agentData[key] === null) {
            delete agentData[key]
          }
        })
        
        // Criar agente
        const { data: agent, error: agentError } = await supabase
          .from('lab_agents')
          .insert(agentData)
          .select()
          .single()
        
        if (agentError) {
          console.error(`❌ Erro ao criar "${template.name}":`, agentError.message)
          results.push({
            name: template.name,
            success: false,
            error: agentError.message,
          })
          errorCount++
        } else {
          console.log(`✅ Criado: "${template.name}" (ID: ${agent.id})`)
          existingNames.add(templateNameLower) // Adicionar ao set para evitar duplicatas futuras
          results.push({
            name: template.name,
            success: true,
            id: agent.id,
          })
          successCount++
        }
      } catch (error: any) {
        console.error(`❌ Erro ao processar "${template.name}":`, error.message)
        results.push({
          name: template.name,
          success: false,
          error: error.message || 'Erro desconhecido',
        })
        errorCount++
      }
    }
    
    // Resumo
    console.log('\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 Resumo da Criação de Agentes')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Criados com sucesso: ${successCount}`)
    console.log(`⏭️  Pulados (já existem): ${skippedCount}`)
    console.log(`❌ Erros: ${errorCount}`)
    console.log(`📦 Total processado: ${templates.length}`)
    console.log('')
    
    if (errorCount > 0) {
      console.log('⚠️  Agentes com erro:')
      results
        .filter(r => !r.success && !r.skipped)
        .forEach(r => {
          console.log(`   - ${r.name}: ${r.error}`)
        })
      console.log('')
    }
    
    console.log('🎉 Processo concluído!')
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    console.error(error)
    process.exit(1)
  }
}

criarAgentesDeTemplates()

