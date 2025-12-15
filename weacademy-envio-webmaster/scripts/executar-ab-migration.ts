/**
 * Script para executar migração de A/B Testing no Supabase local
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
    console.log('🚀 Iniciando execução da migração de A/B Testing...')
    console.log(`📡 Conectando ao PostgreSQL local...`)
    
    // Ler arquivo SQL
    const sqlFile = join(process.cwd(), 'supabase/migrations/20251103000007_lab_ab_testing.sql')
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
      console.log('   - lab_pipeline_ab_experiments')
      console.log('   - lab_pipeline_ab_executions')
      console.log('   - lab_pipeline_ab_metrics')
      console.log('')
      console.log('🔧 Funções criadas:')
      console.log('   - get_ab_variant()')
      console.log('   - update_ab_metrics()')
      console.log('   - analyze_ab_experiment()')
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

