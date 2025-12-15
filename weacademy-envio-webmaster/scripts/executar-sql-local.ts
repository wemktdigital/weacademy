/**
 * Script para executar SQL no Supabase local
 * Uso: npx tsx scripts/executar-sql-local.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function executarSQL() {
  try {
    console.log('🚀 Iniciando execução do SQL...')
    console.log(`📡 Conectando em: ${supabaseUrl}`)
    
    // Ler arquivo SQL
    const sqlFile = join(process.cwd(), 'supabase/migrations/20250130000002_create_agents_and_pipeline_post_social.sql')
    const sql = readFileSync(sqlFile, 'utf-8')
    
    console.log('📄 Arquivo SQL carregado:', sqlFile)
    
    // Criar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'public',
      },
    })
    
    // Executar SQL via RPC (se houver função) ou diretamente via REST
    // Como não podemos executar SQL arbitrário via REST, vamos usar o método alternativo
    
    console.log('')
    console.log('⚠️  Não é possível executar SQL DO block diretamente via REST API.')
    console.log('')
    console.log('💡 Soluções:')
    console.log('   1. Execute manualmente no Supabase Studio (recomendado):')
    console.log('      - Acesse: http://localhost:54323')
    console.log('      - SQL Editor > New query')
    console.log('      - Cole o conteúdo do arquivo:')
    console.log(`      - ${sqlFile}`)
    console.log('      - Execute (Run)')
    console.log('')
    console.log('   2. Ou use psql diretamente:')
    console.log('      PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/20250130000002_create_agents_and_pipeline_post_social.sql')
    console.log('')
    
    // Mostrar o SQL para o usuário copiar
    console.log('📋 SQL para copiar:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(sql)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    console.error(error)
    process.exit(1)
  }
}

executarSQL()

