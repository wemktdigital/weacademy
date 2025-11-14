/**
 * Script para testar todos os modelos LLM disponíveis no Laboratório de IA
 * 
 * Uso:
 *   npx tsx scripts/test-all-llm-models.ts
 * 
 * Ou com token explícito:
 *   TEST_AUTH_TOKEN="seu-token" npx tsx scripts/test-all-llm-models.ts
 * 
 * Para obter o token:
 *   1. Faça login no sistema em http://localhost:3000
 *   2. Abra o console do navegador (F12)
 *   3. Execute: (await supabase.auth.getSession()).data.session?.access_token
 *   4. Copie o token e use como variável de ambiente
 */

import { AVAILABLE_MODELS } from '../src/modules/laboratorio-ia/config/models'
import * as fs from 'fs'
import * as path from 'path'

interface TestResult {
  provider: string
  model: string
  displayName: string
  status: 'success' | 'error' | 'skipped'
  latency?: number
  error?: string
  responsePreview?: string
  timestamp: string
}

interface TestOptions {
  authToken: string
  baseUrl?: string
  testMessage?: string
  delayBetweenTests?: number
  skipVideoModels?: boolean
}

async function testModel(
  provider: string,
  model: string,
  options: TestOptions
): Promise<TestResult> {
  const startTime = Date.now()
  const { authToken, baseUrl = 'http://localhost:3000', testMessage } = options
  
  try {
    const response = await fetch(`${baseUrl}/api/lab-ia/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: testMessage || 'Responda apenas com "OK" se você está funcionando corretamente.',
          },
        ],
        provider,
        model,
        stream: false, // Testar sem streaming primeiro (mais rápido)
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status} ${response.statusText}`,
      }))
      
      return {
        provider,
        model,
        displayName: AVAILABLE_MODELS.find(m => m.model === model)?.displayName || model,
        status: 'error',
        error: errorData.error || `HTTP ${response.status}`,
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }
    }

    const data = await response.json()
    const latency = Date.now() - startTime

    return {
      provider,
      model,
      displayName: AVAILABLE_MODELS.find(m => m.model === model)?.displayName || model,
      status: 'success',
      latency,
      responsePreview: data.content?.substring(0, 100) || 'Sem conteúdo',
      timestamp: new Date().toISOString(),
    }
  } catch (error: any) {
    return {
      provider,
      model,
      displayName: AVAILABLE_MODELS.find(m => m.model === model)?.displayName || model,
      status: 'error',
      error: error.message || 'Erro desconhecido',
      latency: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }
  }
}

async function testAllModels(options: TestOptions) {
  const {
    authToken,
    baseUrl = 'http://localhost:3000',
    testMessage,
    delayBetweenTests = 1000,
    skipVideoModels = true,
  } = options

  console.log('🧪 Iniciando testes de todos os modelos LLM...\n')
  console.log(`📡 URL base: ${baseUrl}`)
  console.log(`📊 Total de modelos disponíveis: ${AVAILABLE_MODELS.length}\n`)

  // Filtrar modelos a testar
  let modelsToTest = AVAILABLE_MODELS
  
  if (skipVideoModels) {
    modelsToTest = AVAILABLE_MODELS.filter(
      m => m.capabilities?.output?.includes('text')
    )
    console.log(`⏭️  Pulando modelos de vídeo (use skipVideoModels=false para incluir)\n`)
  }

  console.log(`📋 Modelos a testar: ${modelsToTest.length}\n`)
  console.log('='.repeat(70))

  const results: TestResult[] = []
  let successCount = 0
  let errorCount = 0

  // Testar cada modelo
  for (let i = 0; i < modelsToTest.length; i++) {
    const modelConfig = modelsToTest[i]
    const progress = `[${i + 1}/${modelsToTest.length}]`
    
    console.log(`\n${progress} ⏳ Testando ${modelConfig.displayName} (${modelConfig.provider})...`)
    
    const result = await testModel(
      modelConfig.provider,
      modelConfig.model,
      { ...options, baseUrl, testMessage }
    )
    
    results.push(result)
    
    if (result.status === 'success') {
      successCount++
      console.log(`   ✅ Sucesso! Latência: ${result.latency}ms`)
      if (result.responsePreview) {
        console.log(`   📝 Preview: ${result.responsePreview}...`)
      }
    } else {
      errorCount++
      console.log(`   ❌ Erro: ${result.error}`)
      if (result.latency) {
        console.log(`   ⏱️  Latência: ${result.latency}ms`)
      }
    }
    
    // Aguardar entre testes (exceto no último)
    if (i < modelsToTest.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenTests))
    }
  }

  // Relatório final
  console.log('\n' + '='.repeat(70))
  console.log('📊 RELATÓRIO FINAL')
  console.log('='.repeat(70))
  
  const successful = results.filter(r => r.status === 'success')
  const failed = results.filter(r => r.status === 'error')
  
  console.log(`\n✅ Sucesso: ${successful.length}/${results.length} (${Math.round(successful.length / results.length * 100)}%)`)
  console.log(`❌ Falhas: ${failed.length}/${results.length} (${Math.round(failed.length / results.length * 100)}%)`)
  
  if (successful.length > 0) {
    const avgLatency = Math.round(
      successful.reduce((acc, r) => acc + (r.latency || 0), 0) / successful.length
    )
    const minLatency = Math.min(...successful.map(r => r.latency || 0))
    const maxLatency = Math.max(...successful.map(r => r.latency || 0))
    
    console.log(`\n📈 Latência:`)
    console.log(`   Média: ${avgLatency}ms`)
    console.log(`   Mínima: ${minLatency}ms`)
    console.log(`   Máxima: ${maxLatency}ms`)
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Modelos com falha:')
    failed.forEach(r => {
      console.log(`   - ${r.displayName} (${r.provider}/${r.model})`)
      console.log(`     Erro: ${r.error}`)
    })
  }

  // Agrupar por provider
  console.log('\n📦 Resultados por Provider:')
  const providers = [...new Set(results.map(r => r.provider))]
  providers.forEach(provider => {
    const providerResults = results.filter(r => r.provider === provider)
    const providerSuccess = providerResults.filter(r => r.status === 'success').length
    console.log(`   ${provider}: ${providerSuccess}/${providerResults.length} sucesso`)
  })
  
  // Salvar relatório em arquivo JSON
  const reportDir = path.join(process.cwd(), 'test-reports')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(reportDir, `llm-models-test-${timestamp}.json`)
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      success: successful.length,
      failed: failed.length,
      successRate: Math.round(successful.length / results.length * 100),
    },
    results,
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n💾 Relatório JSON salvo em: ${reportPath}`)
  
  // Salvar também um relatório legível em texto
  const textReportPath = path.join(reportDir, `llm-models-test-${timestamp}.txt`)
  let textReport = 'RELATÓRIO DE TESTE - MODELOS LLM\n'
  textReport += '='.repeat(70) + '\n\n'
  textReport += `Data: ${new Date().toLocaleString('pt-BR')}\n`
  textReport += `Total: ${results.length} modelos\n`
  textReport += `Sucesso: ${successful.length} (${Math.round(successful.length / results.length * 100)}%)\n`
  textReport += `Falhas: ${failed.length} (${Math.round(failed.length / results.length * 100)}%)\n\n`
  
  textReport += 'RESULTADOS DETALHADOS:\n'
  textReport += '-'.repeat(70) + '\n'
  results.forEach(r => {
    textReport += `\n${r.displayName} (${r.provider}/${r.model})\n`
    textReport += `  Status: ${r.status === 'success' ? '✅ Sucesso' : '❌ Erro'}\n`
    if (r.latency) textReport += `  Latência: ${r.latency}ms\n`
    if (r.error) textReport += `  Erro: ${r.error}\n`
    if (r.responsePreview) textReport += `  Preview: ${r.responsePreview}\n`
  })
  
  fs.writeFileSync(textReportPath, textReport)
  console.log(`📄 Relatório texto salvo em: ${textReportPath}`)
  
  // Retornar código de saída apropriado
  if (failed.length > 0) {
    console.log('\n⚠️  Alguns modelos falharam. Verifique os logs acima.')
    process.exit(1)
  } else {
    console.log('\n🎉 Todos os modelos testados com sucesso!')
    process.exit(0)
  }
}

// Função principal
async function main() {
  const authToken = process.env.TEST_AUTH_TOKEN || ''
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
  const testMessage = process.env.TEST_MESSAGE
  const delayBetweenTests = parseInt(process.env.TEST_DELAY || '1000', 10)
  const skipVideoModels = process.env.TEST_INCLUDE_VIDEO !== 'true'
  
  if (!authToken) {
    console.error('❌ Erro: TEST_AUTH_TOKEN não configurado\n')
    console.log('💡 Como obter o token:')
    console.log('   1. Faça login no sistema em http://localhost:3000')
    console.log('   2. Abra o console do navegador (F12)')
    console.log('   3. Execute:')
    console.log('      const { createClient } = await import("@supabase/supabase-js")')
    console.log('      const supabase = createClient("URL", "KEY")')
    console.log('      const { data } = await supabase.auth.getSession()')
    console.log('      console.log(data.session?.access_token)')
    console.log('\n   4. Copie o token e execute:')
    console.log('      export TEST_AUTH_TOKEN="seu-token-aqui"')
    console.log('      npx tsx scripts/test-all-llm-models.ts\n')
    console.log('   Ou passe diretamente:')
    console.log('      TEST_AUTH_TOKEN="seu-token" npx tsx scripts/test-all-llm-models.ts\n')
    process.exit(1)
  }

  await testAllModels({
    authToken,
    baseUrl,
    testMessage,
    delayBetweenTests,
    skipVideoModels,
  })
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Erro fatal:', error)
    process.exit(1)
  })
}

export { testAllModels, testModel }

