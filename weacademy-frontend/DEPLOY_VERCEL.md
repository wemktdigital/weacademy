# 🚀 Guia de Deploy - Vercel + Supabase

Este guia vai te ajudar a publicar o projeto WE Academy online usando Vercel e Supabase Cloud.

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com) (gratuita)
- Conta no [Vercel](https://vercel.com) (gratuita)
- Conta no [GitHub](https://github.com) (para conectar o repositório)
- Supabase CLI instalado localmente
- Projeto commitado no GitHub

---

## 🔵 Parte 1: Configurar Supabase em Produção

### Passo 1.1: Criar Projeto no Supabase

1. Acesse [app.supabase.com](https://app.supabase.com)
2. Faça login ou crie uma conta
3. Clique em **"New Project"**
4. Preencha os dados:
   - **Name**: `weacademy-production` (ou o nome que preferir)
   - **Database Password**: Crie uma senha forte e **ANOTE** (você precisará depois)
   - **Region**: Escolha a região mais próxima (ex: `South America (São Paulo)`)
   - **Pricing Plan**: Free (para começar)
5. Clique em **"Create new project"**
6. Aguarde 2-3 minutos enquanto o projeto é criado

### Passo 1.2: Obter Credenciais do Supabase

Após o projeto ser criado:

1. Vá em **Settings** → **API**
2. Anote as seguintes informações:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (⚠️ Mantenha secreto!)

### Passo 1.3: Fazer Link do Projeto Local com o Remoto

No terminal, na pasta do projeto:

```bash
cd weacademy-frontend

# Fazer login no Supabase CLI (se ainda não fez)
supabase login

# Fazer link com o projeto remoto
supabase link --project-ref seu-project-ref
```

**Como encontrar o project-ref:**
- Vá em Settings → General no Supabase Dashboard
- O **Reference ID** é o project-ref (ex: `abcdefghijklmnop`)

### Passo 1.4: Fazer Push das Migrations

```bash
# Enviar todas as migrations para produção
supabase db push

# Isso vai aplicar todas as 52 migrations no banco de produção
```

**⚠️ Importante:** Isso pode levar alguns minutos. Aguarde a conclusão.

### Passo 1.5: Verificar Migrations Aplicadas

1. Acesse o Supabase Dashboard
2. Vá em **Database** → **Migrations**
3. Verifique se todas as migrations foram aplicadas

### Passo 1.6: Configurar Storage Buckets

No Supabase Dashboard:

1. Vá em **Storage**
2. Crie os buckets necessários:
   - `knowledge-base` (público ou privado, conforme necessário)
   - `certificates` (público)
   - `course-materials` (público ou privado)
   - `avatars` (público)

Para cada bucket:
- Clique em **"New bucket"**
- Dê um nome
- Escolha se é público ou privado
- Clique em **"Create bucket"**

### Passo 1.7: Configurar RLS (Row Level Security)

As políticas RLS já devem estar configuradas pelas migrations, mas verifique:

1. Vá em **Authentication** → **Policies**
2. Verifique se as políticas estão ativas para as tabelas principais

### Passo 1.8: Criar Usuários Iniciais

Você pode criar usuários de duas formas:

**Opção A: Via Dashboard**
1. Vá em **Authentication** → **Users**
2. Clique em **"Add user"** → **"Create new user"**
3. Crie usuários de teste (admin, instructor, student)

**Opção B: Via SQL**
1. Vá em **SQL Editor**
2. Execute o script `create_demo_users.sql` ou `CREATE_ADMIN_USER.md`

---

## 🟢 Parte 2: Configurar Vercel

### Passo 2.1: Preparar o Repositório

Certifique-se de que tudo está commitado:

```bash
git add .
git commit -m "Preparar para deploy em produção"
git push origin main
```

### Passo 2.2: Criar Projeto na Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub
3. Clique em **"Add New Project"**
4. Importe o repositório `weacademy3`
5. Configure o projeto:
   - **Framework Preset**: Next.js (detectado automaticamente)
   - **Root Directory**: `weacademy-frontend` ⚠️ **IMPORTANTE**
   - **Build Command**: `npm run build` (ou deixe padrão)
   - **Output Directory**: `.next` (ou deixe padrão)
   - **Install Command**: `npm install` (ou deixe padrão)

### Passo 2.3: Configurar Variáveis de Ambiente

Antes de fazer o deploy, configure as variáveis de ambiente:

1. Na página de configuração do projeto, vá em **Environment Variables**
2. Adicione as seguintes variáveis:

```bash
# Supabase Production
NEXT_PUBLIC_SUPABASE_URL=https://seu-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# App Configuration
NEXT_PUBLIC_APP_URL=https://seu-projeto.vercel.app
NEXT_PUBLIC_APP_NAME=WE Academy

# Storage (usar URL do Supabase)
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://seu-project-ref.supabase.co/storage/v1

# Database URL (opcional, se precisar conectar diretamente)
DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.seu-project-ref.supabase.co:5432/postgres

# Email (opcional - configurar serviço de email depois)
# RESEND_API_KEY=seu-resend-key (se usar Resend)

# OpenAI (se usar)
OPENAI_API_KEY=seu-openai-key (opcional)
```

**⚠️ Importante:**
- Substitua `seu-project-ref` pelo Reference ID do seu projeto Supabase
- Substitua `sua-anon-key-aqui` pela anon key do Supabase
- Substitua `sua-service-role-key-aqui` pela service role key
- Substitua `[SUA-SENHA]` pela senha do banco que você criou
- Para `NEXT_PUBLIC_APP_URL`, use a URL que a Vercel vai gerar (ou configure domínio customizado depois)

### Passo 2.4: Fazer Deploy

1. Clique em **"Deploy"**
2. Aguarde o build (pode levar 2-5 minutos)
3. Se tudo der certo, você verá: **"Congratulations! Your project has been deployed."**

### Passo 2.5: Atualizar URL do App

Após o deploy:

1. Copie a URL gerada pela Vercel (ex: `https://weacademy3.vercel.app`)
2. Volte nas **Environment Variables** da Vercel
3. Atualize `NEXT_PUBLIC_APP_URL` com a URL correta
4. Faça um novo deploy (ou aguarde o próximo)

---

## ✅ Parte 3: Verificações Pós-Deploy

### 3.1: Testar Aplicação

1. Acesse a URL do seu projeto na Vercel
2. Teste as funcionalidades principais:
   - ✅ Página inicial carrega
   - ✅ Autenticação funciona
   - ✅ Login de admin funciona
   - ✅ Cursos aparecem
   - ✅ Laboratório de IA funciona

### 3.2: Verificar Logs

Se algo não funcionar:

1. Na Vercel, vá em **Deployments** → clique no último deploy
2. Veja os **Logs** para identificar erros
3. Verifique se todas as variáveis de ambiente estão corretas

### 3.3: Verificar Supabase

1. No Supabase Dashboard, vá em **Logs**
2. Verifique se há erros de autenticação ou queries
3. Teste uma query no **SQL Editor**

---

## 🔧 Troubleshooting

### Erro: "Failed to fetch agents"
- Verifique se as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão corretas
- Verifique se o RLS está configurado corretamente

### Erro: "Database connection failed"
- Verifique se o `DATABASE_URL` está correto
- Verifique se a senha do banco está correta (sem caracteres especiais que precisam ser URL-encoded)

### Erro: "Storage bucket not found"
- Crie os buckets necessários no Supabase Dashboard
- Verifique as políticas de acesso dos buckets

### Build falha na Vercel
- Verifique se o `Root Directory` está configurado como `weacademy-frontend`
- Verifique os logs de build na Vercel
- Teste o build localmente: `npm run build`

### Autenticação não funciona
- Verifique se as URLs de redirect estão configuradas no Supabase:
  - Vá em **Authentication** → **URL Configuration**
  - Adicione sua URL da Vercel em **Site URL** e **Redirect URLs**

---

## 📝 Checklist Final

Antes de considerar o deploy completo:

- [ ] Projeto Supabase criado em produção
- [ ] Todas as migrations aplicadas
- [ ] Storage buckets criados
- [ ] Usuários iniciais criados
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Deploy realizado com sucesso
- [ ] Aplicação acessível e funcionando
- [ ] Autenticação testada
- [ ] Funcionalidades principais testadas
- [ ] URLs de redirect configuradas no Supabase

---

## 🎉 Próximos Passos

Após o deploy bem-sucedido:

1. **Configurar Domínio Customizado** (opcional)
   - Na Vercel: Settings → Domains
   - Adicione seu domínio personalizado

2. **Configurar Email em Produção**
   - Configure Resend ou outro serviço de email
   - Atualize as variáveis de ambiente

3. **Monitoramento**
   - Configure alertas na Vercel
   - Monitore logs no Supabase

4. **Backup**
   - Configure backups automáticos no Supabase
   - Documente o processo de restore

---

## 📚 Recursos Úteis

- [Documentação Vercel](https://vercel.com/docs)
- [Documentação Supabase](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Boa sorte com o deploy! 🚀**

