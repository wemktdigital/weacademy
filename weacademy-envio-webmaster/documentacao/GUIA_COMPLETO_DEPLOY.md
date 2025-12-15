# 🚀 Guia Completo de Deploy - WE Academy

> **Documento consolidado para Webmaster**  
> Este guia contém todas as informações necessárias para fazer o deploy da aplicação WE Academy, seja em ambiente cloud (Supabase + Vercel) ou self-hosted.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Opção 1: Deploy Cloud (Supabase + Vercel)](#opção-1-deploy-cloud-supabase--vercel)
3. [Opção 2: Deploy Self-Hosted](#opção-2-deploy-self-hosted)
4. [Variáveis de Ambiente](#variáveis-de-ambiente)
5. [Migrations do Banco de Dados](#migrations-do-banco-de-dados)
6. [Storage Buckets](#storage-buckets)
7. [Configuração de Email](#configuração-de-email)
8. [Testes e Verificações](#testes-e-verificações)
9. [Troubleshooting](#troubleshooting)
10. [Checklist Final](#checklist-final)

---

## Visão Geral

A WE Academy é uma plataforma de cursos online construída com:
- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deploy**: Vercel (cloud) ou servidor próprio (self-hosted)

### Estrutura do Projeto

```
weacademy3/
├── weacademy-frontend/          # Aplicação Next.js
│   ├── src/                     # Código fonte
│   ├── supabase/                # Configuração Supabase
│   │   ├── migrations/          # 50+ migrations SQL
│   │   ├── config.toml          # Configuração local
│   │   └── seed.sql            # Dados iniciais
│   └── package.json
└── docs/                        # Documentação
```

---

## Opção 1: Deploy Cloud (Supabase + Vercel)

### Pré-requisitos
- Conta no [Supabase Cloud](https://supabase.com) (gratuita)
- Conta no [Vercel](https://vercel.com) (gratuita)
- Conta no GitHub
- Supabase CLI instalado

### Passo 1: Criar Projeto Supabase

1. Acesse [app.supabase.com](https://app.supabase.com)
2. Crie novo projeto: `weacademy-production`
3. Escolha região: `South America (São Paulo)` (recomendado)
4. Crie senha forte para o banco e **ANOTE**
5. Aguarde criação (2-3 minutos)

### Passo 2: Obter Credenciais

No Supabase Dashboard → **Settings** → **API**:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ SECRETO

No **Settings** → **General**:
- **Reference ID**: `abcdefghijklmnop` (project-ref)

### Passo 3: Aplicar Migrations

```bash
cd weacademy-frontend

# Login no Supabase CLI
supabase login

# Link com projeto remoto
supabase link --project-ref seu-project-ref

# Aplicar todas as migrations
supabase db push
```

⚠️ Isso pode levar alguns minutos. Verifique em **Database** → **Migrations** se todas foram aplicadas.

### Passo 4: Configurar Storage Buckets

No Supabase Dashboard → **Storage**, criar:
- `avatars` (público)
- `course-thumbnails` (público)
- `knowledge-base` (público ou privado)
- `certificates` (público)
- `course-materials` (público ou privado)

### Passo 5: Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Importe repositório GitHub
3. **Configurações importantes**:
   - **Root Directory**: `weacademy-frontend` ⚠️
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`

4. **Variáveis de Ambiente** (Settings → Environment Variables):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://seu-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   NEXT_PUBLIC_APP_URL=https://seu-projeto.vercel.app
   NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://seu-ref.supabase.co/storage/v1
   DATABASE_URL=postgresql://postgres:[SENHA]@db.seu-ref.supabase.co:5432/postgres
   ```

5. Clique em **Deploy** e aguarde (2-5 minutos)

### Passo 6: Configurar URLs de Redirect

No Supabase Dashboard → **Authentication** → **URL Configuration**:
- **Site URL**: URL da Vercel
- **Redirect URLs**: URL da Vercel + `/auth/callback`

---

## Opção 2: Deploy Self-Hosted

### Pré-requisitos
- Servidor com Docker e Docker Compose
- Domínio configurado com SSL/HTTPS
- Acesso root ao servidor

### Passo 1: Configurar Supabase Self-Hosted

Existem duas formas de fazer deploy do Supabase self-hosted:

#### Opção A: Usando Docker Compose (Recomendado)

1. Clone o repositório do Supabase:
```bash
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker
```

2. Copie os arquivos de configuração:
```bash
cp .env.example .env
```

3. Configure o arquivo `.env` com suas variáveis

4. Inicie os serviços:
```bash
docker-compose up -d
```

#### Opção B: Usar Helm Chart (Kubernetes)

Para produção, recomenda-se usar Kubernetes. Veja a [documentação oficial](https://supabase.com/docs/guides/hosting/overview).

### Passo 2: Configurar Variáveis de Ambiente

No seu servidor Next.js ou através do serviço de deploy, configure:

```bash
# Supabase Self-Hosted
NEXT_PUBLIC_SUPABASE_URL=https://seu-dominio.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<obter-do-servidor>
SUPABASE_SERVICE_ROLE_KEY=<obter-do-servidor>

# Database URL
DATABASE_URL=postgresql://postgres:senha@seu-servidor:5432/postgres

# App Configuration
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
NEXT_PUBLIC_APP_NAME=WE Academy

# Storage Configuration
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://seu-dominio.com/storage/v1

# Email Configuration (SMTP de produção)
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_USER=seu-email@dominio.com
SMTP_PASS=sua-senha
SMTP_FROM=noreply@seu-dominio.com

# OpenAI (se usar IA)
OPENAI_API_KEY=sua-openai-api-key
```

### Passo 3: Obter Chaves de API

Para obter as chaves no Supabase self-hosted:

```bash
# Via CLI
supabase status

# Ou via Dashboard
# Acesse http://seu-dominio.com:54323 (Supabase Studio)
# Settings > API > Project API keys
```

### Passo 4: Aplicar Migrations

```bash
cd weacademy-frontend

# Conectar ao servidor remoto
supabase link --project-ref <ref> --db-url postgresql://...

# Aplicar migrations
supabase db push

# Ou aplicar manualmente via psql
psql $DATABASE_URL -f supabase/migrations/[arquivo].sql
```

**Migrations a aplicar** (em ordem cronológica):
- `20241020000001_initial_schema.sql`
- `20241020000002_rbac_schema.sql`
- `20241020000003_user_preferences.sql`
- `20241020000004_storage_setup.sql`
- `20241020000005_notifications.sql`
- ... (todas as 50+ migrations na pasta `supabase/migrations/`)

### Passo 5: Configurar Storage

Os buckets serão criados automaticamente pelas migrations, mas verifique:

1. Acesse o Supabase Studio: `http://seu-dominio.com:54323`
2. Vá em **Storage** → **Buckets**
3. Verifique se existem:
   - `avatars`
   - `course-thumbnails`
   - `knowledge-base`
   - `certificates`

### Passo 6: Configurar Email (SMTP)

Edite `supabase/config.toml` ou configure via variáveis de ambiente:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.gmail.com"  # ou seu provedor SMTP
port = 587
user = "seu-email@gmail.com"
pass = "env(SMTP_PASS)"
admin_email = "admin@seu-dominio.com"
sender_name = "WE Academy"

[auth.email]
enable_confirmations = true
double_confirm_changes = true
secure_password_change = true
```

**Provedores SMTP recomendados:**
- Gmail (com App Password)
- SendGrid
- AWS SES
- Mailgun
- Postmark

### Passo 7: Configurar SSL/HTTPS

Para produção, SSL é obrigatório:

1. Obter certificado (Let's Encrypt):
```bash
certbot certonly --standalone -d seu-dominio.com
```

2. Configurar no Supabase `config.toml`:
```toml
[api.tls]
enabled = true
cert_path = "/etc/letsencrypt/live/seu-dominio.com/fullchain.pem"
key_path = "/etc/letsencrypt/live/seu-dominio.com/privkey.pem"
```

### Passo 8: Configurar Proxy Reverso (Nginx)

Para servir Supabase e Next.js pelo mesmo domínio:

```nginx
# /etc/nginx/sites-available/weacademy
server {
    listen 80;
    server_name seu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    # Supabase API
    location /rest/v1/ {
        proxy_pass http://localhost:54321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Supabase Auth
    location /auth/v1/ {
        proxy_pass http://localhost:54321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Supabase Storage
    location /storage/v1/ {
        proxy_pass http://localhost:54321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Next.js App
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Passo 9: Deploy da Aplicação Next.js

```bash
# No servidor, clone o repositório
git clone https://github.com/seu-usuario/weacademy3.git
cd weacademy3/weacademy-frontend

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env.production
nano .env.production  # Edite com as variáveis corretas

# Build da aplicação
npm run build

# Inicie em produção (usando PM2 ou similar)
npm install -g pm2
pm2 start npm --name "weacademy" -- start
pm2 save
pm2 startup
```

---

## Variáveis de Ambiente

### Obrigatórias

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=<url-do-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# App
NEXT_PUBLIC_APP_URL=<url-da-aplicacao>
NEXT_PUBLIC_APP_NAME=WE Academy

# Database (opcional, se precisar conectar diretamente)
DATABASE_URL=postgresql://postgres:senha@host:5432/postgres
```

### Opcionais (Conforme Funcionalidades)

```bash
# Storage
NEXT_PUBLIC_SUPABASE_STORAGE_URL=<url-storage>

# Email (se usar serviço externo)
RESEND_API_KEY=re_...
SMTP_HOST=smtp.provedor.com
SMTP_PORT=587
SMTP_USER=email@dominio.com
SMTP_PASS=senha
SMTP_FROM=noreply@dominio.com

# APIs de IA (conforme uso)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
DEEPSEEK_API_KEY=...
XAI_API_KEY=...
REPLICATE_API_TOKEN=r8_...

# PubMed
PUBMED_API_KEY=...

# Configurações do Lab IA
LAB_MAX_COST_USD=50
LAB_ALERT_EMAIL=contato@dominio.com
```

---

## Migrations do Banco de Dados

### Lista Completa de Migrations

O projeto possui **50+ migrations** organizadas cronologicamente. Principais:

1. **Schema Inicial**: `20241020000001_initial_schema.sql`
2. **RBAC**: `20241020000002_rbac_schema.sql`
3. **Storage**: `20241020000004_storage_setup.sql`
4. **Notificações**: `20241020000005_notifications.sql`
5. **Gamificação**: `20250120000000_gamification.sql`
6. **Lab IA**: `20251026105808_lab_ia_schema.sql`
7. ... (todas as outras)

### Aplicar Todas as Migrations

```bash
# Via Supabase CLI (recomendado)
supabase db push

# Via psql (manual)
for file in supabase/migrations/*.sql; do
    psql $DATABASE_URL -f "$file"
done
```

### Verificar Migrations Aplicadas

```sql
-- No SQL Editor do Supabase
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version;
```

---

## Storage Buckets

### Buckets Necessários

| Bucket | Tipo | Descrição |
|--------|------|-----------|
| `avatars` | Público | Fotos de perfil dos usuários |
| `course-thumbnails` | Público | Imagens dos cursos |
| `knowledge-base` | Privado/Público | Base de conhecimento do Lab IA |
| `certificates` | Público | Certificados emitidos |
| `course-materials` | Privado | Materiais dos cursos |

### Criar Buckets Manualmente

```sql
-- No SQL Editor do Supabase
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('course-thumbnails', 'course-thumbnails', true)
ON CONFLICT (id) DO NOTHING;
```

Ou via Dashboard: **Storage** → **New Bucket**

### Políticas RLS dos Buckets

As políticas são criadas automaticamente pela migration `20241020000004_storage_setup.sql`. Verifique se estão ativas em **Storage** → **Policies**.

---

## Configuração de Email

### Opção 1: Resend (Recomendado para Cloud)

1. Criar conta em [resend.com](https://resend.com)
2. Obter API key
3. Adicionar variável:
```bash
RESEND_API_KEY=re_...
```

### Opção 2: SMTP Customizado (Self-Hosted)

No `supabase/config.toml`:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.gmail.com"
port = 587
user = "seu-email@gmail.com"
pass = "env(SMTP_PASS)"
admin_email = "admin@seu-dominio.com"
sender_name = "WE Academy"
```

**Gmail Setup:**
1. Ative autenticação de 2 fatores
2. Crie uma "App Password"
3. Use essa senha no `SMTP_PASS`

---

## Testes e Verificações

### Pré-Deploy

```bash
# Build
npm run build

# Lint
npm run lint

# Type Check
npx tsc --noEmit

# Testes (se houver)
npm run test
```

### Pós-Deploy

#### 1. Testar Autenticação
- [ ] Criar novo usuário
- [ ] Login
- [ ] Recuperação de senha
- [ ] Verificação de email

#### 2. Testar Funcionalidades
- [ ] Listar cursos
- [ ] Criar/editar curso (admin)
- [ ] Upload de arquivos
- [ ] Laboratório de IA
- [ ] Gamificação (XP, badges)

#### 3. Verificar Logs
- [ ] Vercel: Deployments → Logs
- [ ] Supabase: Logs → API/Postgres
- [ ] Browser Console (F12)

---

## Troubleshooting

### Erro: "Failed to fetch"

**Causa**: URLs ou chaves incorretas

**Solução**:
1. Verificar `NEXT_PUBLIC_SUPABASE_URL`
2. Verificar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Verificar CORS no Supabase (se self-hosted)

### Erro: "Database connection failed"

**Causa**: `DATABASE_URL` incorreto ou senha com caracteres especiais

**Solução**:
1. URL-encode senha: `postgresql://user:senha%40com@host:5432/db`
2. Verificar firewall/portas abertas
3. Verificar se banco está acessível

### Erro: "Storage bucket not found"

**Causa**: Buckets não criados

**Solução**:
1. Criar buckets no Dashboard
2. Verificar políticas RLS
3. Verificar `NEXT_PUBLIC_SUPABASE_STORAGE_URL`

### Erro: "Authentication redirect failed"

**Causa**: URLs de redirect não configuradas

**Solução**:
1. Supabase Dashboard → Authentication → URL Configuration
2. Adicionar URL da aplicação em:
   - Site URL
   - Redirect URLs

### Build falha na Vercel

**Causa**: Root directory incorreto

**Solução**:
1. Vercel → Settings → General
2. Root Directory: `weacademy-frontend`
3. Re-deploy

### Erro: "RLS policy violation"

**Causa**: Políticas RLS muito restritivas

**Solução**:
1. Verificar políticas em Supabase Dashboard
2. Testar queries no SQL Editor
3. Ajustar políticas se necessário

---

## Checklist Final

### Antes do Deploy

- [ ] Todas as migrations aplicadas
- [ ] Storage buckets criados
- [ ] Variáveis de ambiente configuradas
- [ ] Build local bem-sucedido
- [ ] Lint sem erros críticos
- [ ] URLs de redirect configuradas

### Durante o Deploy

- [ ] Deploy iniciado
- [ ] Build completado sem erros
- [ ] Variáveis de ambiente aplicadas
- [ ] Aplicação acessível

### Após o Deploy

- [ ] Página inicial carrega
- [ ] Autenticação funciona
- [ ] Cursos aparecem
- [ ] Upload de arquivos funciona
- [ ] Laboratório de IA funciona (se configurado)
- [ ] Emails são enviados (se configurado)
- [ ] Logs sem erros críticos

### Segurança

- [ ] SSL/HTTPS configurado
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca exposta no frontend
- [ ] API keys protegidas
- [ ] CORS configurado corretamente
- [ ] RLS policies ativas

### Monitoramento

- [ ] Logs sendo coletados
- [ ] Alertas configurados (opcional)
- [ ] Backup automático do banco (opcional)
- [ ] Métricas de performance (opcional)

---

## Recursos Adicionais

### Documentação Oficial

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Self-Hosting](https://supabase.com/docs/guides/hosting/overview)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

### Comandos Úteis

```bash
# Status do Supabase (local)
supabase status

# Logs do Supabase
supabase logs

# Resetar banco (CUIDADO em produção!)
supabase db reset

# Verificar migrations
supabase migration list

# Link com projeto remoto
supabase link --project-ref <ref>

# Push de migrations
supabase db push
```

---

## Contato e Suporte

Para dúvidas sobre o deploy, consulte:
- Este documento
- Documentação oficial das tecnologias
- Logs de erro na Vercel/Supabase

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0

