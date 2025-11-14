# 🌐 Acesso na Rede Local

Guia para permitir que outros dispositivos na mesma rede WiFi/LAN acessem sua aplicação.

## 📍 Seu IP Local

**IP atual:** `192.168.33.175`

⚠️ **Nota:** Este IP pode mudar se você desconectar/reconectar na rede WiFi. Use o comando abaixo para descobrir o IP atual.

---

## 🚀 Como Permitir Acesso na Rede Local

### Passo 1: Descobrir seu IP Local

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1

# Ou simplesmente:
ipconfig getifaddr en0  # macOS (WiFi)
ipconfig getifaddr en1  # macOS (Ethernet)
```

### Passo 2: Iniciar o Servidor Next.js na Rede

Use o script especial para rede local:

```bash
cd weacademy-frontend
npm run dev:network
```

Isso inicia o servidor aceitando conexões de qualquer dispositivo na rede.

### Passo 3: Configurar Variáveis de Ambiente para Rede Local

Crie ou atualize seu `.env.local` com o IP local do Supabase:

```bash
# Use seu IP local ao invés de 127.0.0.1
NEXT_PUBLIC_SUPABASE_URL=http://192.168.33.175:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz

# Database URL também precisa do IP local
DATABASE_URL=postgresql://postgres:postgres@192.168.33.175:54322/postgres

# App URL com seu IP local
NEXT_PUBLIC_APP_URL=http://192.168.33.175:3000

# Storage também precisa do IP local
NEXT_PUBLIC_SUPABASE_STORAGE_URL=http://192.168.33.175:54321/storage/v1
```

⚠️ **Importante:** Substitua `192.168.33.175` pelo seu IP local atual!

### Passo 4: Verificar se o Supabase está Acessível na Rede

O Supabase local precisa estar rodando e acessível. Por padrão, o Supabase CLI já expõe os serviços na rede local, mas verifique:

```bash
# Verificar status do Supabase
supabase status

# Se não estiver rodando:
supabase start
```

### Passo 5: Compartilhar o Link

Compartilhe este link com quem está na mesma rede:

```
http://192.168.33.175:3000
```

⚠️ **Lembre-se:** Substitua pelo seu IP atual!

---

## 🔧 Troubleshooting

### "Não consigo acessar de outro dispositivo"

1. **Verifique o Firewall:**
   ```bash
   # macOS - permitir conexões na porta 3000
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
   ```

2. **Verifique se está na mesma rede:**
   - Ambos os dispositivos devem estar na mesma WiFi/LAN
   - Não funciona entre redes diferentes (ex: WiFi diferente)

3. **Verifique se o servidor está rodando com `dev:network`:**
   ```bash
   npm run dev:network
   ```
   Deve mostrar: `- Local: http://0.0.0.0:3000`

### "Erro ao conectar com Supabase"

1. Verifique se o Supabase está rodando:
   ```bash
   supabase status
   ```

2. Verifique se as variáveis de ambiente usam o IP local (não 127.0.0.1)

3. Verifique se o Supabase está acessível:
   ```bash
   # Teste no navegador (do seu computador primeiro)
   http://192.168.33.175:54321
   ```

### "IP mudou"

O IP pode mudar quando você:
- Reconecta na WiFi
- Reinicia o computador
- Muda de rede

Sempre verifique o IP atual antes de compartilhar:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

---

## 📱 Acessar de Dispositivos Móveis

### iPhone/Android na mesma WiFi:

1. Descubra seu IP local (veja Passo 1)
2. Inicie o servidor com `npm run dev:network`
3. Configure as variáveis de ambiente com o IP local
4. No celular, abra o navegador e acesse:
   ```
   http://192.168.33.175:3000
   ```

### Testar no Celular:

1. Certifique-se de que o celular está na mesma WiFi
2. Abra o navegador no celular
3. Digite: `http://SEU-IP-LOCAL:3000`
4. Deve carregar a aplicação!

---

## ⚠️ Segurança

**Atenção:** Ao expor na rede local, qualquer dispositivo na mesma rede pode acessar:

- ✅ **Seguro para:** Desenvolvimento, testes, demonstrações internas
- ❌ **NÃO seguro para:** Produção, dados sensíveis sem autenticação

Para produção, use sempre HTTPS e um servidor adequado (Vercel, etc.).

---

## 🎯 Resumo Rápido

```bash
# 1. Descobrir IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# 2. Atualizar .env.local com o IP local (substituir 127.0.0.1)

# 3. Iniciar servidor na rede
npm run dev:network

# 4. Compartilhar: http://SEU-IP:3000
```

---

**IP atual detectado:** `192.168.33.175`  
**URL para compartilhar:** `http://192.168.33.175:3000`

