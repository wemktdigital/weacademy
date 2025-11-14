import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

async function executeMigration() {
  const client = new Client({
    host: '127.0.0.1',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  })

  try {
    await client.connect()
    console.log('✅ Conectado ao banco de dados\n')

    const migrationFile = path.join(__dirname, '../supabase/migrations/20251103000012_lab_model_performance.sql')
    const sql = fs.readFileSync(migrationFile, 'utf-8')

    console.log('📄 Executando: 20251103000012_lab_model_performance.sql')
    await client.query(sql)
    console.log('✅ Migration executada com sucesso: 20251103000012_lab_model_performance.sql\n')

    console.log('✅ Migration de histórico de performance concluída!\n')
    console.log('📋 Próximos passos:')
    console.log('1. O sistema agora rastreia automaticamente a performance dos modelos')
    console.log('2. Use enableIntelligentRouting=true no callLLM para ativar routing automático')
    console.log('3. Execute a migration SQL no Supabase')
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

executeMigration()

