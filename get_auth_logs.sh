#!/bin/bash
# Script para verificar logs e schema do Supabase Auth

echo "🔍 Verificando Schema do Supabase Auth..."
echo ""

echo "📋 1. Tabelas do schema auth:"
echo "Execute no SQL Editor:"
echo "SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth' ORDER BY table_name;"
echo ""

echo "📋 2. Verificar se auth.instances existe:"
echo "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'instances') as has_instances_table;"
echo ""

echo "📋 3. Estrutura da tabela auth.instances (se existir):"
echo "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'instances';"
echo ""

echo "✅ Execute o script check_auth_schema.sql no SQL Editor para diagnóstico completo"
