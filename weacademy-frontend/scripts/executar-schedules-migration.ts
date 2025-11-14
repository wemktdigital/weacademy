/**
 * Script para executar migração de Pipeline Schedules no Supabase local
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import pg from 'pg'

const { Client } = pg

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
    console.log('🚀 Iniciando execução da migração de Pipeline Schedules...')
    console.log(`📡 Conectando ao PostgreSQL local...`)
    
    // Ler arquivo SQL
    const sqlFile = join(process.cwd(), 'supabase/migrations/20251103000001_lab_pipeline_schedules.sql')
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
      console.log('   - lab_pipeline_schedules')
      console.log('   - lab_pipeline_schedule_runs')
      console.log('   - lab_pipeline_webhooks')
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

