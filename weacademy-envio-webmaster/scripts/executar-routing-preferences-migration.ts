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

    const migrationFile = path.join(__dirname, '../supabase/migrations/20251103000013_lab_routing_preferences.sql')
    const sql = fs.readFileSync(migrationFile, 'utf-8')

    console.log('📄 Executando: 20251103000013_lab_routing_preferences.sql')
    await client.query(sql)
    console.log('✅ Migration executada com sucesso: 20251103000013_lab_routing_preferences.sql\n')

    console.log('✅ Migration de preferências de routing concluída!\n')
    console.log('📋 Tabelas criadas:')
    console.log('   - lab_model_recommendations_history')
    console.log('   - lab_user_routing_preferences')
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

executeMigration()

