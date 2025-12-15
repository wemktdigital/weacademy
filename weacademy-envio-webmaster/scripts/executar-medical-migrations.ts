import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

async function executeMedicalMigrations() {
  const client = new Client({
    host: '127.0.0.1',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  })

  try {
    await client.connect()
    console.log('✅ Conectado ao banco de dados')

    const migrations = [
      'supabase/migrations/20251103000009_lab_medical_analyses.sql',
      'supabase/migrations/20251103000011_create_medical_storage_buckets.sql',
      'supabase/migrations/20251103000010_insert_medical_analysis_agents.sql',
    ]

    for (const migrationPath of migrations) {
      const fullPath = path.join(process.cwd(), migrationPath)
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️  Arquivo não encontrado: ${migrationPath}`)
        continue
      }

      const sql = fs.readFileSync(fullPath, 'utf-8')
      console.log(`\n📄 Executando: ${path.basename(migrationPath)}`)
      
      try {
        await client.query(sql)
        console.log(`✅ Migration executada com sucesso: ${path.basename(migrationPath)}`)
      } catch (error: any) {
        // Ignorar erros de "already exists" ou "duplicate"
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('ON CONFLICT')) {
          console.log(`ℹ️  Migration já aplicada ou conflito ignorado: ${path.basename(migrationPath)}`)
        } else {
          console.error(`❌ Erro ao executar ${path.basename(migrationPath)}:`, error.message)
          throw error
        }
      }
    }

    console.log('\n✅ Todas as migrations de análise médica foram executadas!')
    console.log('\n📋 Próximos passos:')
    console.log('1. Acesse http://localhost:3000/ai-lab/medical-analysis')
    console.log('2. Teste a análise de imagens médicas')
    console.log('3. Verifique os agentes criados em /ai-lab/admin/agents')
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

executeMedicalMigrations()

