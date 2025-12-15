/**
 * Script para executar migration de tokens diretamente via PostgreSQL
 */

import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

async function executarMigration() {
  const client = new Client({
    connectionString: dbUrl,
  })

  try {
    console.log('🚀 Executando migration: add_tokens_to_lab_agent_logs')
    console.log(`📡 Conectando ao banco: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`)
    
    await client.connect()
    console.log('✅ Conectado ao banco de dados\n')
    
    // Ler arquivo SQL
    const sqlFile = join(process.cwd(), 'supabase/migrations/20251110000002_add_tokens_to_lab_agent_logs.sql')
    const sql = readFileSync(sqlFile, 'utf-8')
    
    console.log('📄 Executando SQL do arquivo:', sqlFile)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Executar SQL
    await client.query(sql)
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n✅ Migration executada com sucesso!')
    
    // Verificar se as colunas foram criadas
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'lab_agent_logs' 
      AND column_name IN ('input_tokens', 'output_tokens')
      ORDER BY column_name
    `)
    
    if (rows.length > 0) {
      console.log('\n✅ Colunas criadas:')
      rows.forEach((row: any) => {
        console.log(`   - ${row.column_name} (${row.data_type})`)
      })
    } else {
      console.log('\n⚠️  Colunas não encontradas. Verifique se a migration foi executada corretamente.')
    }
    
    // Verificar índice
    const { rows: indexRows } = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'lab_agent_logs' 
      AND indexname = 'idx_lab_agent_logs_tokens'
    `)
    
    if (indexRows.length > 0) {
      console.log('\n✅ Índice criado:')
      console.log(`   - ${indexRows[0].indexname}`)
    }
    
  } catch (error: any) {
    console.error('\n❌ Erro ao executar migration:', error.message)
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Certifique-se de que o Supabase local está rodando:')
      console.error('   Execute: supabase start')
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

executarMigration()

