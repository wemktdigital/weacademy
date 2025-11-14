/**
 * Script para importar todos os templates de agentes
 * Uso: npx tsx scripts/importar-todos-templates.ts [arquivo1.json] [arquivo2.json] ...
 * Se nenhum arquivo for especificado, importa todos os templates encontrados
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { agentSchema } from '../src/lib/validations/agent.schema'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function importarTemplates(arquivo: string) {
  try {
    console.log(`\n📄 Processando: ${arquivo}`)
    
    // Ler arquivo JSON
    const fileContent = readFileSync(arquivo, 'utf-8')
    const data = JSON.parse(fileContent)
    
    if (!data.templates || !Array.isArray(data.templates)) {
      throw new Error('Formato inválido: arquivo deve conter um array "templates"')
    }
    
    console.log(`   📦 Templates encontrados: ${data.templates.length}`)
    
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
    let skippedCount = 0
    
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
          type: validatedData.type || 'llm', // Default para 'llm' se não especificado
        }
        
        // Verificar se já existe (evitar duplicatas)
        const { data: existing } = await supabase
          .from('lab_agent_templates')
          .select('id')
          .eq('name', templateData.name)
          .single()
        
        if (existing) {
          results.push({
            name: templateData.name,
            success: false,
            skipped: true,
            reason: 'Já existe no banco',
          })
          skippedCount++
          continue
        }
        
        // Inserir no banco
        const { data: inserted, error } = await supabase
          .from('lab_agent_templates')
          .insert(templateData)
          .select()
          .single()
        
        if (error) {
          console.error(`   ❌ Erro ao importar "${templateData.name}":`, error.message)
          results.push({
            name: templateData.name,
            success: false,
            error: error.message,
          })
          errorCount++
        } else {
          console.log(`   ✅ Importado: "${templateData.name}"`)
          results.push({
            name: templateData.name,
            success: true,
            id: inserted.id,
          })
          successCount++
        }
      } catch (error: any) {
        console.error(`   ❌ Erro de validação para "${template.name}":`, error.message)
        results.push({
          name: template.name,
          success: false,
          error: error.message || 'Validation error',
        })
        errorCount++
      }
    }
    
    return {
      arquivo,
      total: data.templates.length,
      successCount,
      errorCount,
      skippedCount,
      results,
    }
  } catch (error: any) {
    console.error(`❌ Erro ao processar ${arquivo}:`, error.message)
    return {
      arquivo,
      total: 0,
      successCount: 0,
      errorCount: 1,
      skippedCount: 0,
      results: [],
      error: error.message,
    }
  }
}

async function main() {
  try {
    console.log('🚀 Iniciando importação de templates...')
    console.log(`📡 Conectando em: ${supabaseUrl}`)
    
    const templatesDir = join(process.cwd(), 'src/app/ai-lab/admin/agents/templates')
    
    // Obter arquivos para importar
    let arquivosParaImportar: string[] = []
    
    if (process.argv.length > 2) {
      // Arquivos especificados via linha de comando
      arquivosParaImportar = process.argv.slice(2).map(arquivo => {
        if (arquivo.startsWith('/')) {
          return arquivo
        }
        return join(templatesDir, arquivo)
      })
    } else {
      // Importar todos os arquivos templates-*-openai-academy.json
      const arquivos = readdirSync(templatesDir)
      arquivosParaImportar = arquivos
        .filter(arquivo => arquivo.includes('openai-academy') && arquivo.endsWith('.json'))
        .map(arquivo => join(templatesDir, arquivo))
    }
    
    if (arquivosParaImportar.length === 0) {
      console.log('⚠️  Nenhum arquivo encontrado para importar')
      return
    }
    
    console.log(`\n📚 Arquivos a importar: ${arquivosParaImportar.length}`)
    
    // Importar cada arquivo
    const resultados = []
    for (const arquivo of arquivosParaImportar) {
      const resultado = await importarTemplates(arquivo)
      resultados.push(resultado)
    }
    
    // Resumo geral
    console.log('\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 Resumo Geral da Importação')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    let totalGeral = 0
    let sucessoGeral = 0
    let erroGeral = 0
    let puladoGeral = 0
    
    resultados.forEach(resultado => {
      console.log(`\n📄 ${resultado.arquivo.split('/').pop()}`)
      console.log(`   ✅ Sucesso: ${resultado.successCount}`)
      console.log(`   ⏭️  Pulados: ${resultado.skippedCount}`)
      console.log(`   ❌ Erros: ${resultado.errorCount}`)
      console.log(`   📦 Total: ${resultado.total}`)
      
      totalGeral += resultado.total
      sucessoGeral += resultado.successCount
      erroGeral += resultado.errorCount
      puladoGeral += resultado.skippedCount
    })
    
    console.log('\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📈 Total Geral')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Sucesso: ${sucessoGeral}`)
    console.log(`⏭️  Pulados: ${puladoGeral}`)
    console.log(`❌ Erros: ${erroGeral}`)
    console.log(`📦 Total processado: ${totalGeral}`)
    console.log('')
    
    if (erroGeral > 0) {
      console.log('⚠️  Templates com erro:')
      resultados.forEach(resultado => {
        resultado.results
          .filter(r => !r.success && !r.skipped)
          .forEach(r => {
            console.log(`   - ${r.name}: ${r.error}`)
          })
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

main()

