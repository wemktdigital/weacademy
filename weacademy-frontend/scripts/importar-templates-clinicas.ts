/**
 * Script para importar templates de clínicas e consultórios
 * Uso: npx tsx scripts/importar-templates-clinicas.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { agentSchema } from '../src/lib/validations/agent.schema'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function importarTemplates() {
  try {
    console.log('🚀 Iniciando importação de templates...')
    console.log(`📡 Conectando em: ${supabaseUrl}`)
    
    // Ler arquivo JSON
    const jsonFile = join(process.cwd(), 'src/app/ai-lab/admin/agents/templates/templates-clinicas-consultorios-openai-academy.json')
    const fileContent = readFileSync(jsonFile, 'utf-8')
    const data = JSON.parse(fileContent)
    
    if (!data.templates || !Array.isArray(data.templates)) {
      throw new Error('Formato inválido: arquivo deve conter um array "templates"')
    }
    
    console.log(`📄 Arquivo JSON carregado: ${jsonFile}`)
    console.log(`📦 Templates encontrados: ${data.templates.length}`)
    
    // Criar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'public',
      },
    })
    
    // Validar e importar cada template
    const results = []
    let successCount = 0
    let errorCount = 0
    
    for (const template of data.templates) {
      try {
        // Validar usando schema
        const validatedData = agentSchema.parse(template)
        
        // Remover campos que não existem na tabela lab_agent_templates
        const templateData = {
          name: validatedData.name,
          description: validatedData.description,
          icon: validatedData.icon,
          category: validatedData.category,
          provider: validatedData.provider,
          model: validatedData.model,
          prompt: validatedData.prompt,
          type: validatedData.type || 'chat', // Default para 'chat' se não especificado
        }
        
        // Verificar se já existe (evitar duplicatas)
        const { data: existing } = await supabase
          .from('lab_agent_templates')
          .select('id')
          .eq('name', templateData.name)
          .single()
        
        if (existing) {
          console.log(`⚠️  Template "${templateData.name}" já existe, pulando...`)
          results.push({
            name: templateData.name,
            success: false,
            skipped: true,
            reason: 'Já existe no banco',
          })
          continue
        }
        
        // Inserir no banco
        const { data: inserted, error } = await supabase
          .from('lab_agent_templates')
          .insert(templateData)
          .select()
          .single()
        
        if (error) {
          console.error(`❌ Erro ao importar "${templateData.name}":`, error.message)
          results.push({
            name: templateData.name,
            success: false,
            error: error.message,
          })
          errorCount++
        } else {
          console.log(`✅ Importado: "${templateData.name}" (ID: ${inserted.id})`)
          results.push({
            name: templateData.name,
            success: true,
            id: inserted.id,
          })
          successCount++
        }
      } catch (error: any) {
        console.error(`❌ Erro de validação para "${template.name}":`, error.message)
        results.push({
          name: template.name,
          success: false,
          error: error.message || 'Validation error',
        })
        errorCount++
      }
    }
    
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 Resumo da Importação')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Sucesso: ${successCount}`)
    console.log(`❌ Erros: ${errorCount}`)
    console.log(`📦 Total: ${data.templates.length}`)
    console.log('')
    
    if (errorCount > 0) {
      console.log('⚠️  Templates com erro:')
      results
        .filter(r => !r.success && !r.skipped)
        .forEach(r => {
          console.log(`   - ${r.name}: ${r.error}`)
        })
      console.log('')
    }
    
    console.log('🎉 Importação concluída!')
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    console.error(error)
    process.exit(1)
  }
}

importarTemplates()

