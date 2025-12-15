/**
 * Script para executar migration via Supabase Studio
 * Abre o Supabase Studio com o SQL pronto para executar
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function abrirStudio() {
  try {
    const sqlFile = join(process.cwd(), 'supabase/migrations/20251110000000_add_agent_usage_instructions.sql')
    const sql = readFileSync(sqlFile, 'utf-8')
    
    console.log('🚀 Preparando execução da migration via Supabase Studio\n')
    console.log('📋 SQL a ser executado:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(sql)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    // Tentar abrir o Supabase Studio no navegador
    const studioUrl = 'http://127.0.0.1:54323'
    
    console.log('🌐 Abrindo Supabase Studio...')
    console.log(`   URL: ${studioUrl}\n`)
    
    // Abrir no navegador (macOS)
    try {
      await execAsync(`open ${studioUrl}`)
      console.log('✅ Supabase Studio aberto no navegador!')
    } catch {
      // Tentar Linux
      try {
        await execAsync(`xdg-open ${studioUrl}`)
        console.log('✅ Supabase Studio aberto no navegador!')
      } catch {
        console.log('⚠️  Não foi possível abrir o navegador automaticamente')
        console.log(`   Acesse manualmente: ${studioUrl}`)
      }
    }
    
    console.log('\n📝 Instruções:')
    console.log('   1. No Supabase Studio, vá em "SQL Editor" (ícone de código no menu lateral)')
    console.log('   2. Clique em "New query"')
    console.log('   3. Cole o SQL mostrado acima')
    console.log('   4. Clique em "Run" (ou pressione Cmd/Ctrl + Enter)')
    console.log('   5. Verifique se a mensagem de sucesso aparece\n')
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

abrirStudio()

