/**
 * Script para executar migração de debug mode no Supabase local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import pg from 'pg'

const { Client } = pg

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// Configuração do PostgreSQL local do Supabase
const dbConfig = {
  host: 'localhost',
  port: 54322,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
}

async function executarMigracao() {
  try {
    console.log('🚀 Iniciando execução da migração de Debug Mode...')
    console.log(`📡 Conectando ao PostgreSQL local...`)
    
    // Ler arquivo SQL
    const sqlFile = join(process.cwd(), 'supabase/migrations/20251103000005_lab_debug_mode.sql')
    const sql = readFileSync(sqlFile, 'utf-8')
    
    console.log('📄 Arquivo SQL carregado:', sqlFile)
    
    // Criar cliente PostgreSQL
    const client = new Client(dbConfig)
    
    try {
      await client.connect()
      console.log('✅ Conectado ao PostgreSQL')
      
      // Executar SQL
      console.log('📝 Executando SQL...')
      await client.query(sql)
      
      console.log('✅ Migração executada com sucesso!')
      console.log('')
      console.log('📊 Tabelas criadas:')
      console.log('   - lab_pipeline_debug_sessions')
      console.log('   - lab_pipeline_debug_snapshots')
      console.log('')
      console.log('🔧 Funções criadas:')
      console.log('   - update_lab_debug_sessions_updated_at()')
      console.log('   - create_debug_snapshot()')
      console.log('')
      console.log('🔒 RLS Policies configuradas')
      
    } catch (error: any) {
      console.error('❌ Erro ao executar SQL:', error.message)
      if (error.code === '42P07') {
        console.log('ℹ️  Algumas tabelas já existem. Isso é normal se a migração já foi executada.')
      } else {
        throw error
      }
    } finally {
      await client.end()
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.log('')
      console.log('⚠️  Não foi possível conectar ao PostgreSQL.')
      console.log('💡 Certifique-se de que o Supabase está rodando localmente:')
      console.log('   npx supabase start')
      console.log('')
    }
    
    process.exit(1)
  }
}

executarMigracao()

