#!/bin/bash

# Script para preparar arquivos para envio ao webmaster
# Uso: ./preparar-envio-webmaster.sh

set -e

echo "🚀 Preparando arquivos para envio ao webmaster..."
echo ""

# Configurações
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$PROJECT_DIR/weacademy-envio-webmaster"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ZIP_NAME="weacademy-${TIMESTAMP}.zip"

# Limpar diretório anterior (se existir)
if [ -d "$OUTPUT_DIR" ]; then
    echo "🗑️  Removendo diretório anterior..."
    rm -rf "$OUTPUT_DIR"
fi

# Criar diretório de saída
mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR"

echo "📁 Copiando arquivos essenciais..."
echo ""

# 1. Código fonte
echo "  ✅ Código fonte (src/)"
mkdir -p codigo-fonte
cp -r "$PROJECT_DIR/weacademy-frontend/src" codigo-fonte/ 2>/dev/null || echo "    ⚠️  Pasta src/ não encontrada"

echo "  ✅ Arquivos públicos (public/)"
cp -r "$PROJECT_DIR/weacademy-frontend/public" codigo-fonte/ 2>/dev/null || echo "    ⚠️  Pasta public/ não encontrada"

echo "  ✅ Arquivos de configuração"
cp "$PROJECT_DIR/weacademy-frontend/package.json" codigo-fonte/ 2>/dev/null || echo "    ⚠️  package.json não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/package-lock.json" codigo-fonte/ 2>/dev/null || echo "    ⚠️  package-lock.json não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/next.config.ts" codigo-fonte/ 2>/dev/null || echo "    ⚠️  next.config.ts não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/tsconfig.json" codigo-fonte/ 2>/dev/null || echo "    ⚠️  tsconfig.json não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/tailwind.config.ts" codigo-fonte/ 2>/dev/null || echo "    ⚠️  tailwind.config.ts não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/postcss.config.mjs" codigo-fonte/ 2>/dev/null || echo "    ⚠️  postcss.config.mjs não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/eslint.config.mjs" codigo-fonte/ 2>/dev/null || echo "    ⚠️  eslint.config.mjs não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/vitest.config.ts" codigo-fonte/ 2>/dev/null || echo "    ⚠️  vitest.config.ts não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/components.json" codigo-fonte/ 2>/dev/null || echo "    ⚠️  components.json não encontrado"

# 2. Migrations do banco
echo ""
echo "  ✅ Migrations do banco de dados"
mkdir -p banco-dados
cp -r "$PROJECT_DIR/weacademy-frontend/supabase/migrations" banco-dados/ 2>/dev/null || echo "    ⚠️  Pasta migrations/ não encontrada"
cp "$PROJECT_DIR/weacademy-frontend/supabase/seed.sql" banco-dados/ 2>/dev/null || echo "    ℹ️  seed.sql não encontrado (opcional)"
cp "$PROJECT_DIR/weacademy-frontend/supabase/config.toml" banco-dados/ 2>/dev/null || echo "    ℹ️  config.toml não encontrado (opcional)"

# 3. Documentação
echo ""
echo "  ✅ Documentação"
mkdir -p documentacao
cp "$PROJECT_DIR/weacademy-frontend/docs/GUIA_COMPLETO_DEPLOY.md" documentacao/ 2>/dev/null || echo "    ⚠️  GUIA_COMPLETO_DEPLOY.md não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/README.md" documentacao/ 2>/dev/null || echo "    ⚠️  README.md não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/env.example" documentacao/ 2>/dev/null || echo "    ⚠️  env.example não encontrado"
cp "$PROJECT_DIR/weacademy-frontend/docs/COMO_ENVIAR_ARQUIVOS_WEBMASTER.md" documentacao/ 2>/dev/null || echo "    ℹ️  COMO_ENVIAR_ARQUIVOS_WEBMASTER.md não encontrado (opcional)"

# 4. Scripts úteis (se existirem)
echo ""
echo "  ✅ Scripts úteis"
mkdir -p scripts
if [ -d "$PROJECT_DIR/weacademy-frontend/scripts" ]; then
    cp -r "$PROJECT_DIR/weacademy-frontend/scripts"/* scripts/ 2>/dev/null || true
    echo "    ✅ Scripts copiados"
else
    echo "    ℹ️  Nenhum script encontrado (opcional)"
fi

# 5. Criar arquivo README com instruções
echo ""
echo "  ✅ Criando README com instruções..."
cat > README.txt << 'EOF'
WE ACADEMY - ARQUIVOS PARA DEPLOY
==================================

Este pacote contém todos os arquivos necessários para fazer o deploy da aplicação WE Academy.

ESTRUTURA:
----------
- codigo-fonte/     : Todo o código fonte da aplicação
- banco-dados/      : Migrations e configurações do banco
- documentacao/     : Guias e documentação
- scripts/          : Scripts úteis

PRÓXIMOS PASSOS:
---------------
1. Extrair todos os arquivos deste ZIP
2. Ler a documentação em: documentacao/GUIA_COMPLETO_DEPLOY.md
3. Seguir as instruções do guia de deploy

OBSERVAÇÕES IMPORTANTES:
-----------------------
- NÃO inclui node_modules (será instalado com npm install)
- NÃO inclui arquivos .env com senhas (devem ser configurados separadamente)
- Todas as migrations do banco estão em: banco-dados/migrations/

DÚVIDAS:
--------
Consulte o guia completo de deploy na pasta documentacao/

EOF

# Criar ZIP
echo ""
echo "📦 Criando arquivo ZIP..."
cd "$PROJECT_DIR"
zip -r "$ZIP_NAME" weacademy-envio-webmaster \
    -x "*.DS_Store" \
    -x "*/.git/*" \
    -x "*/node_modules/*" \
    -x "*/.next/*" \
    -x "*/.env*" \
    > /dev/null 2>&1

# Calcular tamanho
SIZE=$(du -h "$ZIP_NAME" | cut -f1)

echo ""
echo "✅ ARQUIVOS PREPARADOS COM SUCESSO!"
echo ""
echo "📦 Arquivo ZIP: $ZIP_NAME"
echo "📊 Tamanho: $SIZE"
echo "📁 Localização: $PROJECT_DIR/$ZIP_NAME"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "  1. Revisar o conteúdo: unzip -l $ZIP_NAME"
echo "  2. Enviar via WeTransfer/Google Drive"
echo "  3. Compartilhar com o webmaster"
echo ""
echo "📚 Documentação incluída:"
echo "  - documentacao/GUIA_COMPLETO_DEPLOY.md (Guia completo)"
echo "  - documentacao/COMO_ENVIAR_ARQUIVOS_WEBMASTER.md (Este processo)"
echo ""
echo "⚠️  LEMBRE-SE:"
echo "  - NÃO inclua senhas ou chaves de API no ZIP"
echo "  - Envie credenciais separadamente e de forma segura"
echo ""

