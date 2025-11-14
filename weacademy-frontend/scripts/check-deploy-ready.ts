#!/usr/bin/env tsx
/**
 * Script para verificar se o projeto está pronto para deploy
 * Execute: npx tsx scripts/check-deploy-ready.ts
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkmark() {
  return `${colors.green}✓${colors.reset}`
}

function cross() {
  return `${colors.red}✗${colors.reset}`
}

function warning() {
  return `${colors.yellow}⚠${colors.reset}`
}

async function main() {
  log('\n🔍 Verificando se o projeto está pronto para deploy...\n', 'blue')

  const checks: Array<{ name: string; passed: boolean; message?: string }> = []

  // 1. Verificar se package.json existe
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    checks.push({
      name: 'package.json existe',
      passed: true,
    })
    checks.push({
      name: 'Scripts de build configurados',
      passed: !!packageJson.scripts?.build,
    })
  } else {
    checks.push({
      name: 'package.json existe',
      passed: false,
      message: 'package.json não encontrado',
    })
  }

  // 2. Verificar se existe pasta supabase/migrations
  const migrationsPath = join(process.cwd(), 'supabase', 'migrations')
  if (existsSync(migrationsPath)) {
    const files = require('fs').readdirSync(migrationsPath)
    const sqlFiles = files.filter((f: string) => f.endsWith('.sql'))
    checks.push({
      name: 'Migrations existem',
      passed: sqlFiles.length > 0,
      message: `${sqlFiles.length} arquivo(s) de migration encontrado(s)`,
    })
  } else {
    checks.push({
      name: 'Migrations existem',
      passed: false,
      message: 'Pasta supabase/migrations não encontrada',
    })
  }

  // 3. Verificar se .env.production.example existe
  const envExamplePath = join(process.cwd(), '.env.production.example')
  checks.push({
    name: '.env.production.example existe',
    passed: existsSync(envExamplePath),
    message: existsSync(envExamplePath)
      ? 'Arquivo de exemplo encontrado'
      : 'Crie .env.production.example com as variáveis necessárias',
  })

  // 4. Verificar se next.config existe
  const nextConfigPath = join(process.cwd(), 'next.config.ts')
  const nextConfigJsPath = join(process.cwd(), 'next.config.js')
  checks.push({
    name: 'next.config existe',
    passed: existsSync(nextConfigPath) || existsSync(nextConfigJsPath),
  })

  // 5. Verificar estrutura de pastas
  const srcPath = join(process.cwd(), 'src')
  const appPath = join(process.cwd(), 'src', 'app')
  checks.push({
    name: 'Estrutura de pastas correta',
    passed: existsSync(srcPath) && existsSync(appPath),
  })

  // 6. Verificar se há arquivos TypeScript
  function countTsFiles(dir: string): number {
    if (!existsSync(dir)) return 0
    let count = 0
    const files = require('fs').readdirSync(dir, { withFileTypes: true })
    for (const file of files) {
      const fullPath = join(dir, file.name)
      if (file.isDirectory()) {
        count += countTsFiles(fullPath)
      } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
        count++
      }
    }
    return count
  }

  const tsFilesCount = countTsFiles(join(process.cwd(), 'src'))
  checks.push({
    name: 'Arquivos TypeScript encontrados',
    passed: tsFilesCount > 0,
    message: `${tsFilesCount} arquivo(s) TypeScript encontrado(s)`,
  })

  // Exibir resultados
  console.log('\n📋 Resultados da Verificação:\n')
  
  let allPassed = true
  checks.forEach((check) => {
    const icon = check.passed ? checkmark() : cross()
    log(`  ${icon} ${check.name}`, check.passed ? 'green' : 'red')
    if (check.message) {
      log(`     ${check.message}`, 'yellow')
    }
    if (!check.passed) allPassed = false
  })

  console.log('\n')

  if (allPassed) {
    log('✅ Todas as verificações passaram! O projeto parece estar pronto para deploy.', 'green')
    log('\n📝 Próximos passos:', 'blue')
    log('  1. Crie um projeto no Supabase Cloud')
    log('  2. Execute: supabase link --project-ref seu-project-ref')
    log('  3. Execute: supabase db push')
    log('  4. Configure as variáveis de ambiente na Vercel')
    log('  5. Faça o deploy!')
  } else {
    log('⚠️  Algumas verificações falharam. Corrija os problemas antes de fazer deploy.', 'yellow')
  }

  console.log('\n')
}

main().catch((error) => {
  console.error('Erro ao executar verificação:', error)
  process.exit(1)
})

