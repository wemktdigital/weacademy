#!/bin/bash
# Script para descobrir o IP local e gerar URL de acesso

echo "🔍 Descobrindo IP local..."
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$IP" ]; then
    echo "❌ Não foi possível detectar o IP local"
    echo "Tente manualmente: ifconfig | grep 'inet '"
    exit 1
fi

echo ""
echo "✅ IP Local encontrado: $IP"
echo ""
echo "📱 URL para compartilhar na rede local:"
echo "   http://$IP:3000"
echo ""
echo "💡 Para iniciar o servidor acessível na rede:"
echo "   npm run dev:network"
echo ""
echo "⚠️  Lembre-se de atualizar o .env.local com este IP"
echo "   (substitua 127.0.0.1 por $IP nas variáveis do Supabase)"
echo ""

