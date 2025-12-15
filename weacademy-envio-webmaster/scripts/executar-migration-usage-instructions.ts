/**
 * Script para executar migration de instruções de uso de agentes
 * Uso: npx tsx scripts/executar-migration-usage-instructions.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function executarMigration() {
  try {
    console.log('🚀 Executando migration: add_agent_usage_instructions')
    console.log(`📡 Conectando em: ${supabaseUrl}`)
    
    // Ler arquivo SQL
    const sqlFile = join(process.cwd(), 'supabase/migrations/20251110000000_add_agent_usage_instructions.sql')
    const sql = readFileSync(sqlFile, 'utf-8')
    
    console.log('📄 Arquivo SQL carregado:', sqlFile)
    
    // Criar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('\n📋 SQL a ser executado:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(sql)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    // Tentar executar via função auxiliar
    try {
      // Primeiro, criar função auxiliar se não existir
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION exec_ddl_sql(sql_text text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql_text;
        END;
        $$;
      `
      
      // Tentar criar a função
      const { error: funcError } = await supabase.rpc('exec_sql', { 
        sql_query: createFunctionSQL 
      }).catch(async () => {
        // Se não existir exec_sql, tentar criar exec_ddl_sql diretamente
        // Mas isso também não funciona via REST...
        return { error: new Error('Cannot execute DDL via REST API') }
      })
      
      if (funcError) {
        throw new Error('Não é possível executar DDL via REST API')
      }
      
      // Executar a migration
      const { error: execError } = await supabase.rpc('exec_ddl_sql', { 
        sql_text: sql 
      })
      
      if (execError) {
        throw execError
      }
      
      console.log('✅ Migration executada com sucesso!')
    } catch (error: any) {
      console.log('\n⚠️  Não é possível executar DDL (ALTER TABLE) diretamente via REST API.')
      console.log('💡 Use uma das opções abaixo:\n')
      console.log('📌 Opção 1 - Via Supabase Studio (Mais fácil):')
      console.log('   1. Acesse: http://127.0.0.1:54323')
      console.log('   2. Vá em SQL Editor (ícone de código no menu lateral)')
      console.log('   3. Clique em "New query"')
      console.log('   4. Cole o SQL mostrado acima')
      console.log('   5. Clique em "Run" (ou pressione Cmd/Ctrl + Enter)\n')
      console.log('📌 Opção 2 - Via linha de comando (se psql estiver instalado):')
      console.log(`   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f ${sqlFile}\n`)
      console.log('📌 Opção 3 - Copiar e colar o SQL acima no terminal psql\n')
      
      // Verificar se as colunas já existem
      console.log('🔍 Verificando se as colunas já existem...')
      const { data: checkData, error: checkError } = await supabase
        .from('lab_agents')
        .select('id')
        .limit(1)
      
      if (!checkError) {
        console.log('✅ Tabela lab_agents existe e está acessível')
        console.log('⚠️  Execute o SQL acima para adicionar as novas colunas\n')
      }
      
      process.exit(0)
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

executarMigration()
