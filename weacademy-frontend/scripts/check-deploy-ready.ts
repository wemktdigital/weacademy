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

  // 7. Verificar se há testes
  const testsPath = join(process.cwd(), 'src', 'tests')
  if (existsSync(testsPath)) {
    const testFiles = countTsFiles(testsPath)
    checks.push({
      name: 'Arquivos de teste encontrados',
      passed: testFiles > 0,
      message: `${testFiles} arquivo(s) de teste encontrado(s)`,
    })
  } else {
    checks.push({
      name: 'Arquivos de teste encontrados',
      passed: false,
      message: 'Pasta src/tests não encontrada',
    })
  }

  // 8. Verificar componentes críticos recentes
  const criticalComponents = [
    'src/components/ui/floating-input.tsx',
    'src/components/ui/stepper.tsx',
    'src/components/ui/confirm-dialog.tsx',
    'src/components/gamification/XPProgressChart.tsx',
    'src/components/gamification/PersonalizedInsights.tsx',
    'src/hooks/use-auto-draft.ts',
    'src/hooks/use-keyboard-shortcut.ts',
  ]

  let missingTests = 0
  const testFilesMap: Record<string, boolean> = {}
  
  // Mapeamento específico (nome do arquivo de teste pode ser diferente do componente)
  const componentTestMap: Record<string, string> = {
    'src/components/ui/floating-input.tsx': 'src/tests/ui/FloatingInput.test.tsx',
    'src/components/ui/stepper.tsx': 'src/tests/ui/Stepper.test.tsx',
    'src/components/ui/confirm-dialog.tsx': 'src/tests/ui/ConfirmDialog.test.tsx',
    'src/components/gamification/XPProgressChart.tsx': 'src/tests/gamification/XPProgressChart.test.tsx',
    'src/components/gamification/PersonalizedInsights.tsx': 'src/tests/gamification/PersonalizedInsights.test.tsx',
    'src/hooks/use-auto-draft.ts': 'src/tests/hooks/use-auto-draft.test.ts',
    'src/hooks/use-keyboard-shortcut.ts': 'src/tests/hooks/use-keyboard-shortcut.test.ts',
  }

  criticalComponents.forEach((component) => {
    const componentPath = join(process.cwd(), component)
    if (existsSync(componentPath)) {
      // Tentar caminho mapeado primeiro
      const mappedTestPath = componentTestMap[component]
      let hasTest = false
      
      if (mappedTestPath) {
        hasTest = existsSync(join(process.cwd(), mappedTestPath))
      }
      
      // Se não encontrou, tentar caminhos padrão
      if (!hasTest) {
        const possibleTestPaths = [
          componentPath.replace('src/components/ui/', 'src/tests/ui/').replace('.tsx', '.test.tsx').replace('.ts', '.test.ts'),
          componentPath.replace('src/components/gamification/', 'src/tests/gamification/').replace('.tsx', '.test.tsx').replace('.ts', '.test.ts'),
          componentPath.replace('src/hooks/', 'src/tests/hooks/').replace('.tsx', '.test.tsx').replace('.ts', '.test.ts'),
          componentPath.replace('src/app/api/', 'src/tests/api/').replace('route.ts', 'route.test.ts'),
          componentPath.replace('src/', 'src/tests/').replace('.tsx', '.test.tsx').replace('.ts', '.test.ts'),
        ]
        hasTest = possibleTestPaths.some(path => existsSync(path))
      }
      
      testFilesMap[component] = hasTest
      if (!hasTest) missingTests++
    }
  })

  checks.push({
    name: 'Testes para componentes críticos',
    passed: missingTests === 0,
    message: missingTests === 0 
      ? 'Todos os componentes críticos têm testes'
      : `${missingTests} componente(s) crítico(s) sem testes`,
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

  // Mostrar componentes sem testes
  if (missingTests > 0) {
    console.log('\n⚠️  Componentes sem testes:')
    Object.entries(testFilesMap).forEach(([component, hasTest]) => {
      if (!hasTest) {
        log(`     ${cross()} ${component}`, 'red')
      }
    })
  }

  console.log('\n')

  if (allPassed) {
    log('✅ Todas as verificações passaram! O projeto parece estar pronto para deploy.', 'green')
    log('\n📝 Próximos passos:', 'blue')
    log('  1. Execute: npm run test (verificar se todos passam)')
    log('  2. Execute: npm run build (verificar se build funciona)')
    log('  3. Execute: npm run lint (verificar se não há erros)')
    log('  4. Crie um projeto no Supabase Cloud')
    log('  5. Execute: supabase link --project-ref seu-project-ref')
    log('  6. Execute: supabase db push')
    log('  7. Configure as variáveis de ambiente na Vercel')
    log('  8. Faça o deploy!')
  } else {
    log('⚠️  Algumas verificações falharam. Corrija os problemas antes de fazer deploy.', 'yellow')
    log('\n💡 Dica: Consulte docs/DEPLOY_CHECKLIST.md para lista completa de verificações.', 'blue')
  }

  console.log('\n')
}

main().catch((error) => {
  console.error('Erro ao executar verificação:', error)
  process.exit(1)
})

