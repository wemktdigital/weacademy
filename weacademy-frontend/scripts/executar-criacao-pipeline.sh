#!/bin/bash

# Script para executar a migração SQL que cria agentes e pipeline
# Uso: ./scripts/executar-criacao-pipeline.sh

echo "🚀 Executando criação de agentes e pipeline..."
echo ""

# Caminho do arquivo SQL
SQL_FILE="supabase/migrations/20250130000002_create_agents_and_pipeline_post_social.sql"

# Verificar se o arquivo existe
if [ ! -f "$SQL_FILE" ]; then
  echo "❌ Erro: Arquivo SQL não encontrado: $SQL_FILE"
  exit 1
fi

echo "📄 Arquivo SQL encontrado: $SQL_FILE"
echo ""

# Tentar executar via Supabase CLI
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI encontrado"
  echo ""
  echo "🔄 Executando migração via Supabase CLI..."
  echo ""
  
  supabase db execute --file "$SQL_FILE"
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migração executada com sucesso!"
    echo ""
    echo "📋 Próximos passos:"
    echo "   1. Verifique os agentes em /ai-lab/admin/agents"
    echo "   2. Verifique o pipeline em /ai-lab/admin/pipelines"
    echo "   3. Teste o pipeline em /ai-lab"
  else
    echo ""
    echo "❌ Erro ao executar migração"
    echo ""
    echo "💡 Alternativa: Execute manualmente no Supabase Dashboard:"
    echo "   1. Acesse https://supabase.com/dashboard"
    echo "   2. SQL Editor > New query"
    echo "   3. Cole o conteúdo de: $SQL_FILE"
    echo "   4. Execute (Run ou Ctrl+Enter)"
  fi
else
  echo "⚠️  Supabase CLI não encontrado"
  echo ""
  echo "💡 Execute manualmente no Supabase Dashboard:"
  echo "   1. Acesse https://supabase.com/dashboard"
  echo "   2. SQL Editor > New query"
  echo "   3. Cole o conteúdo de: $SQL_FILE"
  echo "   4. Execute (Run ou Ctrl+Enter)"
  echo ""
  echo "📄 Ou use o arquivo: $SQL_FILE"
fi

