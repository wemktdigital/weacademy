#!/bin/bash

# Script para aplicar migrations no Supabase na nuvem
# Uso: ./apply_migrations.sh

set -e

echo "🚀 Aplicando migrations no Supabase na nuvem..."
echo ""

cd "$(dirname "$0")/weacademy-frontend"

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado. Instale com:"
    echo "   brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI encontrado"
echo ""

# URL do banco de dados (senha codificada)
DB_URL="postgresql://postgres:C7Zt%26yXPVWhphcbnA%40xcCXc@supabase-dev.we.marketing:5432/postgres"

echo "📡 Conectando ao banco de dados..."
echo ""

# Tentar aplicar migrations diretamente
echo "📦 Aplicando todas as migrations..."
supabase db push --db-url "$DB_URL" || {
    echo ""
    echo "⚠️  Não foi possível aplicar via 'db push'"
    echo ""
    echo "📋 Alternativa: Execute as migrations manualmente via SQL Editor:"
    echo "   1. Acesse: https://supabase-dev.we.marketing"
    echo "   2. Vá em SQL Editor"
    echo "   3. Execute cada migration em ordem (por timestamp)"
    echo ""
    echo "   Ordem das migrations principais:"
    ls -1 supabase/migrations/*.sql | head -12 | while read file; do
        echo "   - $(basename "$file")"
    done
    echo ""
    exit 1
}

echo ""
echo "✅ Migrations aplicadas com sucesso!"
echo ""
echo "🎯 Próximos passos:"
echo "   1. Verifique se as tabelas foram criadas"
echo "   2. Execute o script create_users_admin_user.sql para criar os usuários"
echo ""
